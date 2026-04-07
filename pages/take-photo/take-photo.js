const { request, uploadFile } = require('../../utils/request')
const config = require('../../config/index')

Page({
  data: {
    photos: [],
    uploading: false,
    uploadedCount: 0
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

    this.setData({ uploading: true, uploadedCount: 0 })
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
      for (let i = 0; i < photos.length; i++) {
        const res = await uploadFile(photos[i])
        urls.push(res.data.url || res.data)
        this.setData({ uploadedCount: i + 1 })
      }

      // 保存事故记录（图片用逗号分隔）
      const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
      const addRes = await request({
        url: '/api/v1/wx/accid/newAdd?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
        method: 'POST',
        data: {
          url: urls.join(','),
          lng: lng,
          lat: lat
        }
      })

      this.setData({ uploading: false })

      // 判断业务错误码
      if (addRes && addRes.errorCode === 5003) {
        wx.removeStorageSync('phoneBound')
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
        fail() { }
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      this.setData({ uploading: false })
      wx.showToast({ title: '上传失败，请重试', icon: 'none' })
    }
  }
})
