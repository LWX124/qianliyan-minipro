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

    // 如果已登录，获取个人中心数据
    if (app.globalData.isLogin) {
      this.loadPersonalData()
    }
  },

  loadPersonalData() {
    const { request } = require('../../utils/request')
    request({
      url: '/user/personalCenter',
      method: 'GET'
    }).then(res => {
      if (res.code === 200) {
        this.setData({
          statistics: {
            totalReward: res.data.totalReward || 0,
            caseReward: res.data.caseReward || 0,
            taskReward: res.data.taskReward || 0
          }
        })
      }
    }).catch(err => {
      if (err.code === 530) {
        // token 过期，切换到游客状态
        app.logout()
        this.setData({ isLogin: false })
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      } else {
        console.error('获取个人数据失败:', err)
        wx.showToast({ title: '获取数据失败', icon: 'none' })
      }
    })
  },

  handleLogin() {
    app.login({
      success: () => {
        this.setData({
          isLogin: true,
          userInfo: app.globalData.userInfo
        })
        this.loadPersonalData()
        wx.showToast({ title: '登录成功', icon: 'success' })
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
            isLogin: false,
            userInfo: {},
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
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  goUploadHistory() {
    if (!app.globalData.isLogin) {
      app.login({
        success: () => {
          wx.navigateTo({ url: '/pages/upload-history/upload-history' })
        },
        fail: (msg) => {
          wx.showToast({ title: msg || '登录失败', icon: 'none' })
        }
      })
    } else {
      wx.navigateTo({ url: '/pages/upload-history/upload-history' })
    }
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
