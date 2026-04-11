const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    showWelfareModal: false,
    showPhoneModal: false,   // 手机号授权弹窗
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
    // 登录完成后检查是否已绑定手机号
    this._checkPhoneBound()
  },

  // 检查是否已绑定手机号，未绑定则弹出授权
  _checkPhoneBound() {
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    if (!thirdSessionKey) return  // 未登录，等登录后再检查

    // 本地标记：已绑定过则不再弹
    const phoneBound = wx.getStorageSync('phoneBound')
    if (phoneBound) return

    request({
      url: '/api/v1/wx/user/get',
      method: 'GET',
      data: { thirdSessionKey }
    }).then(res => {
      if (res.errorCode === 0 && res.data && res.data.phone) {
        // 已绑定，本地记录
        wx.setStorageSync('phoneBound', '1')
      } else {
        // 未绑定，弹出授权弹窗，同时隐藏 tabBar
        this._setTabBarHidden(true)
        this.setData({ showPhoneModal: true })
      }
    }).catch(() => {
      // 查询失败忽略，不影响正常使用
    })
  },

  // 微信手机号授权回调
  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      // 用户拒绝授权
      wx.showToast({ title: '未授权手机号，部分功能受限', icon: 'none' })
      this._setTabBarHidden(false)
      this.setData({ showPhoneModal: false })
      return
    }
    const code = e.detail.code
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    wx.showLoading({ title: '绑定中...' })
    // bindPhone 后端用 @RequestParam，需用 form 格式而非 JSON
    wx.request({
      url: require('../../config/index').baseUrl + '/api/v1/wx/user/bindPhone',
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
        this._setTabBarHidden(false)
        this.setData({ showPhoneModal: false })
      }
    })
  },

  // 跳过手机号绑定
  skipPhoneBind() {
    this._setTabBarHidden(false)
    this.setData({ showPhoneModal: false })
    wx.showToast({ title: '可在上传时再次授权', icon: 'none' })
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
