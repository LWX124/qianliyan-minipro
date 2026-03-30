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
    showWelfareModal: false,
    showProfileModal: false,
    tempAvatarUrl: '',
    tempNickname: ''
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
      // 登录成功但没有头像昵称，且用户没有跳过过，才弹出设置弹窗
      const profileSkipped = wx.getStorageSync('profileSkipped')
      if (!app.globalData.userInfo.headImg && !app.globalData.userInfo.name && !profileSkipped) {
        this.setData({ showProfileModal: true, tempAvatarUrl: '', tempNickname: '' })
      }
    }
  },
// PLACEHOLDER_PART2

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
        // 登录成功后，仅首次（无头像昵称且未跳过）弹出设置
        const profileSkipped = wx.getStorageSync('profileSkipped')
        if (!app.globalData.userInfo.headImg && !app.globalData.userInfo.name && !profileSkipped) {
          this.setData({ showProfileModal: true, tempAvatarUrl: '', tempNickname: '' })
        }
      },
      fail: (msg) => {
        wx.showToast({ title: msg || '登录失败', icon: 'none' })
      }
    })
  },

  // 弹窗中选择头像
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (avatarUrl) {
      this.setData({ tempAvatarUrl: avatarUrl })
    }
  },

  // 弹窗中获取昵称
  onTempNicknameChange(e) {
    this.setData({ tempNickname: (e.detail.value || '').trim() })
  },

  // 确认设置头像昵称
  confirmProfile() {
    const { tempAvatarUrl, tempNickname } = this.data
    if (!tempAvatarUrl && !tempNickname) {
      wx.showToast({ title: '请选择头像或昵称', icon: 'none' })
      return
    }
// PLACEHOLDER_PART3
    const { uploadFile, request } = require('../../utils/request')
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''

    wx.showLoading({ title: '保存中' })

    let uploadPromise = Promise.resolve(tempAvatarUrl)
    // 如果有头像，先上传文件
    if (tempAvatarUrl) {
      uploadPromise = uploadFile(tempAvatarUrl).then(res => res.data.url || res.data)
    }

    uploadPromise.then(headImgUrl => {
      const profileData = { thirdSessionKey }
      if (headImgUrl) profileData.headImg = headImgUrl
      if (tempNickname) profileData.wxname = tempNickname
      return request({
        url: '/api/v1/wx/user/updateProfile',
        method: 'POST',
        data: profileData
      })
    }).then(res => {
      wx.hideLoading()
      if (res.errorCode === 0) {
        const info = res.data
        app.globalData.userInfo.headImg = info.headImg || app.globalData.userInfo.headImg
        app.globalData.userInfo.name = info.wxname || app.globalData.userInfo.name
        wx.setStorageSync('userInfo', app.globalData.userInfo)
        wx.removeStorageSync('profileSkipped')
        this.setData({
          showProfileModal: false,
          userInfo: app.globalData.userInfo
        })
        wx.showToast({ title: '设置成功', icon: 'success' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  },

  skipProfile() {
    wx.setStorageSync('profileSkipped', true)
    this.setData({ showProfileModal: false })
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
