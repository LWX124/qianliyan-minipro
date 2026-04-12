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
    showProfileSheet: false,
    wxAvatarUrl: '',
    wxNickname: ''
  },

  onShow() {
    // 如果正在完善资料或正在上传头像，不重新同步状态
    if (this.data.showProfileSheet || this._uploadingAvatar) return

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
    if (this._profileTimer) clearTimeout(this._profileTimer)
  },

  _syncLoginState() {
    const { fixCdnUrl } = require('../../utils/request')
    const userInfo = { ...app.globalData.userInfo }
    if (userInfo.headImg) userInfo.headImg = fixCdnUrl(userInfo.headImg)
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: userInfo
    })

    if (app.globalData.isLogin) {
      this.loadPersonalData()
    }

    // 检查是否需要授权头像
    if (app.globalData.isLogin) {
      this._checkProfile()
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
        this.setData({
          'statistics.totalReward': res.data.totalReward || 0,
          'statistics.caseReward': res.data.totalReward || 0,
          'statistics.taskReward': res.data.taskReward || 0
        })
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
        const { fixCdnUrl } = require('../../utils/request')
        const userInfo = { ...app.globalData.userInfo }
        if (userInfo.headImg) userInfo.headImg = fixCdnUrl(userInfo.headImg)
        this.setData({ isLogin: true, userInfo: userInfo })
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

  // 检查昵称是否已设置
  _checkProfile() {
    const userInfo = app.globalData.userInfo || {}
    const profileDone = wx.getStorageSync('profileDone')
    if (!userInfo.name && !profileDone) {
      this.setData({ showProfileSheet: true })
    }
  },

  // 点击头像 → 选择并上传头像
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return

    this._uploadingAvatar = true
    const { request, uploadFile } = require('../../utils/request')
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''

    wx.showLoading({ title: '保存中' })
    uploadFile(avatarUrl).then(res => {
      const headImgUrl = res.data.url || res.data
      return request({
        url: '/api/v1/wx/user/updateProfile',
        method: 'POST',
        data: { thirdSessionKey, headImg: headImgUrl }
      })
    }).then(res => {
      wx.hideLoading()
      this._uploadingAvatar = false
      if (res.errorCode === 0) {
        const { fixCdnUrl } = require('../../utils/request')
        const info = res.data || {}
        app.globalData.userInfo = {
          userId: info.userId || app.globalData.userInfo.userId,
          headImg: info.headImg || app.globalData.userInfo.headImg,
          name: info.wxname || app.globalData.userInfo.name
        }
        wx.setStorageSync('userInfo', app.globalData.userInfo)
        const displayInfo = { ...app.globalData.userInfo }
        if (displayInfo.headImg) displayInfo.headImg = fixCdnUrl(displayInfo.headImg)
        this.setData({ userInfo: displayInfo })
        wx.showToast({ title: '头像已更新', icon: 'success' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }).catch(() => {
      this._uploadingAvatar = false
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
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

    const { request, fixCdnUrl } = require('../../utils/request')
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
        const displayInfo = { ...app.globalData.userInfo }
        if (displayInfo.headImg) displayInfo.headImg = fixCdnUrl(displayInfo.headImg)
        this.setData({
          showProfileSheet: false,
          userInfo: displayInfo
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

  closeProfileSheet() {
    wx.setStorageSync('profileDone', '1')
    this.setData({ showProfileSheet: false })
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
