const app = getApp()

Page({
  data: {
    userInfo: {},
    userId: 0,
    showWelfareModal: false
  },

  onShow() {
    this.setData({
      userId: app.globalData.userId || wx.getStorageSync('userId') || 0
    })
  },

  copyId() {
    wx.setClipboardData({
      data: String(this.data.userId),
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  goUploadHistory() {
    wx.navigateTo({ url: '/pages/upload-history/upload-history' })
  },

  onComingSoon() {
    wx.showToast({ title: '开发中，敬请期待！', icon: 'none' })
  },

  onWelfare() {
    this.setData({ showWelfareModal: true })
  },

  closeWelfareModal() {
    this.setData({ showWelfareModal: false })
  },

  onShareAppMessage() {
    return {
      title: '千里眼 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
