const app = getApp()

Page({
  data: {
    isLogin: false,
    userInfo: {},
    statistics: {
      totalReward: 0,
      caseReward: 0,
      taskReward: 0
    },
    showWelfareModal: false
  },

  onShow() {
    // 如果正在验证登录状态，轮询等待验证完成
    if (app.globalData.isCheckingLogin) {
      this._checkTimer = setInterval(() => {
        if (!app.globalData.isCheckingLogin) {
          clearInterval(this._checkTimer)
          this._syncLoginState()
        }
      }, 100)
      return
    }
    this._syncLoginState()
  },

  onHide() {
    if (this._checkTimer) {
      clearInterval(this._checkTimer)
    }
  },

  _syncLoginState() {
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: app.globalData.userInfo
    })

    if (app.globalData.isLogin) {
      this.loadPersonalData()
    }
  },

  loadPersonalData() {
    const { request } = require('../../utils/request')
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    request({
      url: '/api/v1/wx/user/stats',
      method: 'GET',
      data: { thirdSessionKey }
    }).then(res => {
      if (res.errorCode === 0) {
        this.setData({ 'statistics.totalReward': res.data.totalReward || 0 })
      }
    }).catch(err => {
      if (err.code === 530 || err.errorCode === 530) {
        app.logout()
        this.setData({ isLogin: false })
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      }
    })
  },

  handleLogin() {
    app.login({
      success: () => {
        this.setData({ isLogin: true, userInfo: app.globalData.userInfo })
        this.loadPersonalData()
      },
      fail: (msg) => {
        wx.showToast({ title: msg || '登录失败', icon: 'none' })
      }
    })
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          this.setData({
            isLogin: false, userInfo: {},
            statistics: { totalReward: 0, caseReward: 0, taskReward: 0 }
          })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

  copyId() {
    wx.setClipboardData({
      data: String(this.data.userInfo.userId),
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  goRewardRecords() {
    if (!app.globalData.isLogin) {
      app.login({ success: () => wx.navigateTo({ url: '/pages/reward-records/reward-records' }),
        fail: (msg) => wx.showToast({ title: msg || '登录失败', icon: 'none' }) })
    } else {
      wx.navigateTo({ url: '/pages/reward-records/reward-records' })
    }
  },

  goUploadHistory() {
    if (!app.globalData.isLogin) {
      app.login({ success: () => wx.navigateTo({ url: '/pages/upload-history/upload-history' }),
        fail: (msg) => wx.showToast({ title: msg || '登录失败', icon: 'none' }) })
    } else {
      wx.navigateTo({ url: '/pages/upload-history/upload-history' })
    }
  },

  onComingSoon() {
    wx.showToast({ title: '开发中，敬请期待！', icon: 'none' })
  },

  onWelfare() { this.setData({ showWelfareModal: true }) },
  closeWelfareModal() { this.setData({ showWelfareModal: false }) },

  onShareAppMessage() {
    return { title: '拍事故 - 事故快拍', path: '/pages/index/index' }
  }
})
