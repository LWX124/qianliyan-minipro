const app = getApp()

Page({
  data: {
    showWelfareModal: false
  },

  onShow() {
    this._requestLocation()
  },

  // 请求地理位置权限
  _requestLocation() {
    if (app.globalData.location) return

    wx.getSetting({
      success: (res) => {
        const locationAuth = res.authSetting['scope.userLocation']
        if (locationAuth === undefined) {
          // 从未请求过，直接请求
          this._getLocation()
        } else if (locationAuth === false) {
          // 用户之前拒绝过，引导去设置页
          wx.showModal({
            title: '需要位置权限',
            content: '申请功能需要获取您的位置信息来记录事故地点，请在设置中开启位置权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.userLocation']) {
                      this._getLocation()
                    }
                  }
                })
              }
            }
          })
        } else {
          // 已授权，直接获取
          this._getLocation()
        }
      }
    })
  },

  _getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (loc) => {
        app.globalData.location = { lng: loc.longitude, lat: loc.latitude }
      },
      fail: () => {
        // 获取失败，后续上传时再尝试
      }
    })
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
