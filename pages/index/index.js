const { request } = require('../../utils/request')
const config = require('../../config/index')
const app = getApp()

Page({
  data: {
    showWelfareModal: false,
    showPhoneModal: false,       // 手机号授权弹窗
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
    this._checkPhoneForReturningUser()
  },

  // 老用户未绑手机：延迟5秒弹窗（首次游客不弹）
  _checkPhoneForReturningUser() {
    if (app.globalData.isNewUser) return
    if (app.globalData.isCheckingLogin) {
      this._phoneTimer = setInterval(() => {
        if (!app.globalData.isCheckingLogin) {
          clearInterval(this._phoneTimer)
          this._delayCheckPhone()
        }
      }, 100)
    } else {
      this._delayCheckPhone()
    }
  },

  _delayCheckPhone() {
    if (!app.globalData.isLogin) return
    const phoneBound = wx.getStorageSync('phoneBound')
    if (phoneBound) return

    this._phoneDelayTimer = setTimeout(() => {
      this._checkPhoneBound()
    }, 5000)
  },

  onHide() {
    if (this._phoneTimer) clearInterval(this._phoneTimer)
    if (this._phoneDelayTimer) clearTimeout(this._phoneDelayTimer)
  },

  // ---- 手机号绑定 ----
  _checkPhoneBound() {
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    if (!thirdSessionKey) return

    const phoneBound = wx.getStorageSync('phoneBound')
    if (phoneBound) return

    request({
      url: '/api/v1/wx/user/get',
      method: 'GET',
      data: { thirdSessionKey }
    }).then(res => {
      if (res.errorCode === 0 && res.data && res.data.phone) {
        wx.setStorageSync('phoneBound', '1')
      } else {
        this.setData({ showPhoneModal: true })
      }
    }).catch(() => {})
  },

  // 微信手机号授权回调
  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      this.setData({ showPhoneModal: false })
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
        this.setData({ showPhoneModal: false })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
  },

  closePhoneModal() {
    this.setData({ showPhoneModal: false })
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
