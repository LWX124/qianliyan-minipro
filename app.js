const config = require('./config/index')

App({
  globalData: {
    userInfo: null,
    thirdSessionKey: '',
    userId: 0
  },

  onLaunch() {
    this.autoLogin()
  },

  // 小程序启动时自动登录
  autoLogin() {
    const token = wx.getStorageSync('thirdSessionKey')
    if (token) {
      this.globalData.thirdSessionKey = token
      this.globalData.userId = wx.getStorageSync('userId') || 0
      return
    }
    this.wxLogin()
  },

  // 微信登录
  wxLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: config.baseUrl + '/user/wxMiniLogin',
            method: 'POST',
            data: { code: res.code, source: config.source },
            header: { 'content-type': 'application/json' },
            success: (loginRes) => {
              if (loginRes.data.code === 200) {
                const data = loginRes.data.data
                this.globalData.thirdSessionKey = data.thirdSessionKey
                this.globalData.userId = data.userId
                wx.setStorageSync('thirdSessionKey', data.thirdSessionKey)
                wx.setStorageSync('userId', data.userId)
              } else {
                console.error('登录失败:', loginRes.data.msg)
              }
            },
            fail: (err) => {
              console.error('登录请求失败:', err)
            }
          })
        }
      },
      fail: (err) => {
        console.error('wx.login 失败:', err)
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '千里眼 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
