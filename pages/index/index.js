const app = getApp()

Page({
  data: {
    showWelfareModal: false
  },

  onShow() {
    // 进入申请页面时请求位置权限
    if (!app.globalData.location) {
      wx.getLocation({
        type: 'gcj02',
        success: (loc) => {
          app.globalData.location = { lng: loc.longitude, lat: loc.latitude }
        },
        fail: () => {
          // 用户拒绝，后续上传时再尝试
        }
      })
    }
  },

  goRecordVideo() {
    wx.navigateTo({ url: '/pages/record-video/record-video' })
  },

  goTakePhoto() {
    wx.navigateTo({ url: '/pages/take-photo/take-photo' })
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
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
