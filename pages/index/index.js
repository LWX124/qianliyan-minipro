Page({
  data: {
    showWelfareModal: false
  },

  goRecordVideo() {
    const app = getApp()
    if (!app.globalData.isLogin) {
      app.login({
        success: () => {
          wx.navigateTo({ url: '/pages/record-video/record-video' })
        },
        fail: (msg) => {
          wx.showToast({ title: msg || '登录失败', icon: 'none' })
        }
      })
    } else {
      wx.navigateTo({ url: '/pages/record-video/record-video' })
    }
  },

  goTakePhoto() {
    const app = getApp()
    if (!app.globalData.isLogin) {
      app.login({
        success: () => {
          wx.navigateTo({ url: '/pages/take-photo/take-photo' })
        },
        fail: (msg) => {
          wx.showToast({ title: msg || '登录失败', icon: 'none' })
        }
      })
    } else {
      wx.navigateTo({ url: '/pages/take-photo/take-photo' })
    }
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
