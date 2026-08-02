const { request, uploadFile } = require('../../utils/request')
const config = require('../../config/index')

Page({
  data: {
    photos: [],
    uploading: false,
    uploadedCount: 0,
    uploadPercent: 0,
    showPhoneModal: false
  },

  takePhoto() {
    const remaining = 9 - this.data.photos.length
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        const newPhotos = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ photos: this.data.photos.concat(newPhotos) })
      }
    })
  },

  takeMore() {
    this.takePhoto()
  },

  deletePhoto(e) {
    const idx = e.currentTarget.dataset.index
    const photos = this.data.photos.filter((_, i) => i !== idx)
    this.setData({ photos })
  },

  previewPhoto(e) {
    const idx = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.photos[idx],
      urls: this.data.photos
    })
  },

  async uploadPhotos() {
    const { photos } = this.data
    if (photos.length === 0) return

    // 快速路径：本地已有绑定标记，直接上传
    if (wx.getStorageSync('phoneBound_' + config.source)) {
      this._doUpload()
      return
    }

    // 缓存缺失不代表未绑定（换设备、清缓存、标记被清除都会导致）。
    // 先向后端确认，避免让已绑定用户重复授权 —— 微信对同一用户短时间内
    // 重复调用 getPhoneNumber 会失败，从而阻塞上传。
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey_' + config.source) || ''
    if (!thirdSessionKey) {
      this._pendingUpload = true
      this.setData({ showPhoneModal: true })
      return
    }

    wx.showLoading({ title: '检查中...' })
    try {
      const res = await request({
        url: '/api/v1/wx/user/get',
        method: 'GET',
        data: { thirdSessionKey }
      })
      wx.hideLoading()
      if (res && res.errorCode === 0 && res.data && res.data.phone) {
        // 后端已有手机号，补回本地标记后直接上传
        wx.setStorageSync('phoneBound_' + config.source, '1')
        this._doUpload()
        return
      }
    } catch (e) {
      wx.hideLoading()
    }
    // 后端确认未绑定，或网络异常时退回授权弹窗
    this._pendingUpload = true
    this.setData({ showPhoneModal: true })
  },

  async _doUpload() {
    const { photos } = this.data
    if (photos.length === 0) return

    this.setData({ uploading: true, uploadedCount: 0, uploadPercent: 0 })
    const urls = []

    // 获取地理位置
    let lng = '', lat = ''
    try {
      const loc = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject
        })
      })
      lng = loc.longitude
      lat = loc.latitude
    } catch (e) {
      // 定位失败不阻塞上传
    }

    try {
      const total = photos.length
      for (let i = 0; i < photos.length; i++) {
        // 单张图片上传进度回调
        const basePercent = Math.round((i / total) * 90)
        const res = await uploadFile(photos[i], (progress) => {
          const filePercent = Math.round((progress / 100) * (90 / total))
          this.setData({ uploadPercent: Math.min(basePercent + filePercent, 90) })
        })
        urls.push(res.data.url || res.data)
        const finishedPercent = Math.round(((i + 1) / total) * 90)
        this.setData({ uploadedCount: i + 1, uploadPercent: finishedPercent })
      }

      // 保存事故记录（图片用逗号分隔）
      const thirdSessionKey = wx.getStorageSync('thirdSessionKey_' + config.source) || ''
      this.setData({ uploadPercent: 95 })
      const addRes = await request({
        url: '/api/v1/wx/accid/newAdd?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
        method: 'POST',
        data: {
          url: urls.join(','),
          lng: lng,
          lat: lat
        }
      })

      this.setData({ uploadPercent: 100 })
      // 短暂展示100%完成状态
      await new Promise(r => setTimeout(r, 500))
      this.setData({ uploading: false })

      if (addRes && addRes.errorCode === 5003) {
        wx.removeStorageSync('phoneBound_' + config.source)
        wx.showModal({
          title: '需要授权手机号',
          content: '上传记录需要先授权手机号，请返回首页完成授权后再上传',
          showCancel: false,
          confirmText: '我知道了'
        })
        return
      }
      if (addRes && addRes.errorCode !== 0) {
        wx.showToast({ title: addRes.errorMsg || '上传失败，请重试', icon: 'none' })
        return
      }

      wx.requestSubscribeMessage({
        tmplIds: [config.subscribeTemplateId],
        success() { },
        fail() { },
        complete: () => {
          wx.redirectTo({
            url: '/pages/share-result/share-result?type=photo'
          })
        }
      })
    } catch (err) {
      this.setData({ uploading: false })
      wx.showToast({ title: '上传失败，请重试', icon: 'none' })
    }
  },

  // 手机号授权回调
  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      this.setData({ showPhoneModal: false })
      wx.showToast({ title: '未绑定手机号将影响奖励领取', icon: 'none' })
      if (this._pendingUpload) {
        this._pendingUpload = false
        setTimeout(() => this._doUpload(), 1500)
      }
      return
    }
    const code = e.detail.code
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey_' + config.source) || ''
    wx.showLoading({ title: '绑定中...' })
    wx.request({
      url: config.baseUrl + '/api/v1/wx/user/bindPhone',
      method: 'POST',
      header: { 'content-type': 'application/x-www-form-urlencoded' },
      data: 'thirdSessionKey=' + encodeURIComponent(thirdSessionKey) + '&code=' + encodeURIComponent(code),
      success: (res) => {
        wx.hideLoading()
        const data = res.data || {}
        if (data.errorCode === 0) {
          wx.setStorageSync('phoneBound_' + config.source, '1')
          wx.showToast({ title: '手机号绑定成功', icon: 'success' })
        } else {
          wx.showToast({ title: data.errorMsg || '绑定失败', icon: 'none' })
        }
        this.setData({ showPhoneModal: false })
        if (this._pendingUpload) {
          this._pendingUpload = false
          setTimeout(() => this._doUpload(), 1000)
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
  },

  closePhoneModal() {
    this.setData({ showPhoneModal: false })
    if (this._pendingUpload) {
      this._pendingUpload = false
      wx.showToast({ title: '未绑定手机号将影响奖励领取', icon: 'none' })
      setTimeout(() => this._doUpload(), 1500)
    }
  }
})
