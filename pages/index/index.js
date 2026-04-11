const { request } = require('../../utils/request')
const config = require('../../config/index')
const app = getApp()

Page({
  data: {
    showWelfareModal: false,
    showPhoneModal: false,       // 手机号授权弹窗
    showProfileSheet: false,     // 头像昵称授权弹窗
    wxAvatarUrl: '',             // 授权后的头像
    statusBarHeight: 20,
    navBarHeight: 64
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarHeight = sysInfo.statusBarHeight || 20
    const navBarHeight = statusBarHeight + 44
    this.setData({ statusBarHeight, navBarHeight })
  },

  onShow() {
    this._requestLocation()
    // 登录完成后依次检查：头像昵称 → 手机号
    this._waitLoginThenCheck()
  },

  // 等登录完成后再检查资料
  _waitLoginThenCheck() {
    if (app.globalData.isCheckingLogin) {
      this._checkTimer = setInterval(() => {
        if (!app.globalData.isCheckingLogin) {
          clearInterval(this._checkTimer)
          this._checkProfileAndPhone()
        }
      }, 100)
    } else {
      this._checkProfileAndPhone()
    }
  },

  onHide() {
    if (this._checkTimer) clearInterval(this._checkTimer)
  },

  // 检查头像昵称 → 手机号
  _checkProfileAndPhone() {
    if (!app.globalData.isLogin) return

    const userInfo = app.globalData.userInfo || {}
    const profileDone = wx.getStorageSync('profileDone')

    // 1. 先检查头像昵称
    if (!userInfo.headImg && !userInfo.name && !profileDone) {
      // 获取微信头像昵称用于展示
      this._setTabBarHidden(true)
      this.setData({ showProfileSheet: true })
      return  // 头像昵称确认后会自动检查手机号
    }

    // 2. 再检查手机号
    this._checkPhoneBound()
  },

  // ---- 头像昵称弹窗 ----
  onProfileMaskTap() {
    // 点击遮罩不关闭，必须授权
  },

  // 微信头像授权回调 - 获取到真实头像后上传保存
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return

    this.setData({ wxAvatarUrl: avatarUrl })

    const { uploadFile } = require('../../utils/request')
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
      if (res.errorCode === 0) {
        const info = res.data || {}
        app.globalData.userInfo.headImg = info.headImg || app.globalData.userInfo.headImg
        app.globalData.userInfo.name = info.wxname || app.globalData.userInfo.name
        wx.setStorageSync('userInfo', app.globalData.userInfo)
        wx.setStorageSync('profileDone', '1')
        this.setData({ showProfileSheet: false })

        // 接着检查手机号
        setTimeout(() => {
          this._checkPhoneBound()
        }, 300)
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  },

  // ---- 手机号绑定 ----
  _checkPhoneBound() {
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    if (!thirdSessionKey) return

    const phoneBound = wx.getStorageSync('phoneBound')
    if (phoneBound) {
      this._setTabBarHidden(false)
      return
    }

    request({
      url: '/api/v1/wx/user/get',
      method: 'GET',
      data: { thirdSessionKey }
    }).then(res => {
      if (res.errorCode === 0 && res.data && res.data.phone) {
        wx.setStorageSync('phoneBound', '1')
        this._setTabBarHidden(false)
      } else {
        this._setTabBarHidden(true)
        this.setData({ showPhoneModal: true })
      }
    }).catch(() => {
      this._setTabBarHidden(false)
    })
  },

  // 微信手机号授权回调
  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      // 用户拒绝，不关闭弹窗，提示必须绑定
      wx.showToast({ title: '需要绑定手机号才能使用', icon: 'none' })
      return
    }
    const code = e.detail.code
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    wx.showLoading({ title: '绑定中...' })
    wx.request({
      url: config.baseUrl + '/api/v1/wx/user/bindPhone',
      method: 'POST',
      header: { 'content-type': 'application/x-www-form-urlencoded' },
      data: 'thirdSessionKey=' + encodeURIComponent(thirdSessionKey) + '&code=' + encodeURIComponent(code),
      success: (res) => {
        wx.hideLoading()
        const data = res.data || {}
        if (data.errorCode === 0) {
          wx.setStorageSync('phoneBound', '1')
          wx.showToast({ title: '手机号绑定成功', icon: 'success' })
        } else {
          wx.showToast({ title: data.errorMsg || '绑定失败，请重试', icon: 'none' })
        }
        this._setTabBarHidden(false)
        this.setData({ showPhoneModal: false })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
  },

  // 控制系统 tabBar 显隐
  _setTabBarHidden(hidden) {
    if (hidden) {
      wx.hideTabBar({ animation: false })
    } else {
      wx.showTabBar({ animation: false })
    }
  },

  // 请求地理位置权限
  _requestLocation() {
    if (app.globalData.location) return

    wx.getSetting({
      success: (res) => {
        const locationAuth = res.authSetting['scope.userLocation']
        if (locationAuth === undefined) {
          this._getLocation()
        } else if (locationAuth === false) {
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
      fail: () => {}
    })
  },

  goRecordVideo() {
    wx.navigateTo({ url: '/pages/record-video/record-video' })
  },

  goTakePhoto() {
    wx.navigateTo({ url: '/pages/take-photo/take-photo' })
  },

  goUploadHistory() {
    if (!app.globalData.isLogin) {
      app.login({
        success: () => wx.navigateTo({ url: '/pages/upload-history/upload-history' }),
        fail: (msg) => wx.showToast({ title: msg || '登录失败', icon: 'none' })
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
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
