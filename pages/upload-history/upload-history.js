const { request } = require('../../utils/request')

Page({
  data: {
    records: [],
    loading: false,
    page: 1,
    hasMore: true,
    playingVideo: '',
    showProfileSheet: false,
    wxAvatarUrl: '',
    wxNickname: ''
  },

  onShow() {
    // 如果正在完善资料（头像选择器返回），不重新加载
    if (this.data.showProfileSheet) return

    this.setData({ page: 1, hasMore: true })
    this.loadRecords()
    this._delayCheckProfile()
  },

  onHide() {
    if (this._profileTimer) clearTimeout(this._profileTimer)
  },

  // 延迟3秒检查昵称
  _delayCheckProfile() {
    const app = getApp()
    if (!app.globalData.isLogin) return
    const userInfo = app.globalData.userInfo || {}
    const profileDone = wx.getStorageSync('profileDone')
    if (userInfo.name || profileDone) return

    this._profileTimer = setTimeout(() => {
      this.setData({ showProfileSheet: true })
    }, 3000)
  },

  // 昵称输入回调
  onNicknameChange(e) {
    this.setData({ wxNickname: e.detail.value })
  },

  // 确认保存昵称
  confirmProfile() {
    const nickname = this.data.wxNickname

    if (!nickname) {
      wx.showToast({ title: '请先选择昵称', icon: 'none' })
      return
    }

    const app = getApp()
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''

    wx.showLoading({ title: '保存中' })
    request({
      url: '/api/v1/wx/user/updateProfile',
      method: 'POST',
      data: { thirdSessionKey, wxname: nickname }
    }).then(res => {
      wx.hideLoading()
      if (res.errorCode === 0) {
        const info = res.data || {}
        app.globalData.userInfo = {
          userId: info.userId || app.globalData.userInfo.userId,
          headImg: info.headImg || app.globalData.userInfo.headImg,
          name: info.wxname || app.globalData.userInfo.name
        }
        wx.setStorageSync('userInfo', app.globalData.userInfo)
        wx.setStorageSync('profileDone', '1')
        this.setData({ showProfileSheet: false })
        wx.showToast({ title: '设置成功', icon: 'success' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  },

  closeProfileSheet() {
    wx.setStorageSync('profileDone', '1')
    this.setData({ showProfileSheet: false })
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadRecords().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadRecords()
  },

  loadRecords() {
    this.setData({ loading: true })
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    return request({
      url: '/api/v1/wx/accid/list',
      method: 'GET',
      data: { thirdSessionKey, page: this.data.page, pageSize: 20 }
    }).then(res => {
      const list = (res.data && res.data.list) || []
      // 标记转账是否过期（转账发起超过24小时）
      const now = Date.now()
      list.forEach(item => {
        if (item.billStatus == 2 && item.billCreateTime) {
          // 用 biz_wxpay_bill.create_time（转账发起时间）判断
          const billTs = new Date(item.billCreateTime.replace(/-/g, '/')).getTime()
          item.transferExpired = (now - billTs) > 24 * 60 * 60 * 1000
        } else {
          item.transferExpired = false
        }
      })
      const hasMore = list.length >= 20
      if (this.data.page === 1) {
        this.setData({ records: list, loading: false, hasMore })
      } else {
        this.setData({ records: this.data.records.concat(list), loading: false, hasMore })
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  viewDetail(e) {
    const item = e.currentTarget.dataset.item
    if (item.video) {
      this.setData({ playingVideo: item.video })
      // 等 video 组件渲染后请求全屏
      setTimeout(() => {
        const videoCtx = wx.createVideoContext('fullscreenVideo', this)
        videoCtx.requestFullScreen({ direction: 0 })
      }, 100)
    } else if (item.accImg) {
      const urls = item.accImg.split(',')
      wx.previewImage({ urls })
    }
  },

  onVideoFullscreenChange(e) {
    // 退出全屏时清除视频
    if (!e.detail.fullScreen) {
      this.setData({ playingVideo: '' })
    }
  },

  confirmReceive(e) {
    const item = e.currentTarget.dataset.item
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    wx.showLoading({ title: '请稍候...' })
    request({
      url: '/api/v1/wx/accid/transferPackage',
      method: 'GET',
      data: { thirdSessionKey, accid: item.id }
    }).then(res => {
      wx.hideLoading()
      if (res.errorCode !== 0 || !res.data) {
        wx.showToast({ title: res.errorMsg || '获取转账信息失败', icon: 'none' })
        return
      }
      const { mchId, appId, packageInfo } = res.data
      wx.requestMerchantTransfer({
        mchId: mchId,
        appId: appId,
        package: packageInfo,
        success: () => {
          // 通知后端用户已确认收款（POST + @RequestParam 需要拼到 URL query）
          const confirmSessionKey = wx.getStorageSync('thirdSessionKey') || ''
          request({
            url: '/api/v1/wx/accid/confirmTransfer?thirdSessionKey=' + encodeURIComponent(confirmSessionKey) + '&accid=' + item.id,
            method: 'POST'
          }).finally(() => {
            wx.showToast({ title: '收款成功', icon: 'success' })
            this.setData({ page: 1, hasMore: true })
            this.loadRecords()
          })
        },
        fail: (err) => {
          console.log('confirmReceive fail', err)
          wx.showToast({ title: '收款取消或失败', icon: 'none' })
        }
      })
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  }
})
