const config = require('./config/index')

App({
  globalData: {
    isLogin: false,           // 登录状态
    isCheckingLogin: false,   // 启动时登录中
    userInfo: {               // 用户信息
      userId: 0,
      name: '',
      headImg: ''
    },
    thirdSessionKey: '',      // token
    isLoggingIn: false,       // 登录中标志
    loginCallbacks: [],       // 登录回调队列
    location: null,           // 缓存的位置信息 { lng, lat }
    isNewUser: true            // 是否新用户
  },

  onLaunch() {
    this.restoreLoginState()
  },

  // 尝试从本地缓存恢复登录状态
  restoreLoginState() {
    const cachedSession = wx.getStorageSync('thirdSessionKey')
    const cachedUserInfo = wx.getStorageSync('userInfo')
    if (cachedSession) {
      console.log('[restoreLoginState] 发现本地缓存 session，尝试恢复')
      this.globalData.isNewUser = false
      this.globalData.thirdSessionKey = cachedSession
      this.globalData.isLogin = true
      if (cachedUserInfo) {
        this.globalData.userInfo = cachedUserInfo
      }
      // 后台静默验证 session 是否仍有效
      this.globalData.isCheckingLogin = true
      this.validateSession({
        success: () => {
          console.log('[restoreLoginState] session 有效')
          this.globalData.isCheckingLogin = false
        },
        fail: () => {
          console.log('[restoreLoginState] session 已过期，重新登录')
          this.globalData.isLogin = false
          this.globalData.isCheckingLogin = false
          this.performLogin()
        }
      })
    } else {
      this.performLogin()
    }
  },

  // 验证已有 session 是否有效
  validateSession(options = {}) {
    wx.request({
      url: config.baseUrl + '/api/v1/wx/user/stats',
      method: 'GET',
      data: { thirdSessionKey: this.globalData.thirdSessionKey },
      success: (res) => {
        if (res.data.errorCode === 0) {
          options.success && options.success()
        } else {
          // session 无效，清除缓存
          this.logout()
          options.fail && options.fail()
        }
      },
      fail: () => {
        options.fail && options.fail()
      }
    })
  },

  // 执行登录操作
  performLogin() {
    console.log('[performLogin] 开始自动登录')
    this.globalData.isCheckingLogin = true
    this.login({
      success: () => {
        console.log('[performLogin] 自动登录成功')
        this.globalData.isCheckingLogin = false
      },
      fail: (msg) => {
        console.error('[performLogin] 自动登录失败:', msg)
        this.globalData.isCheckingLogin = false
        // 登录失败不阻塞用户使用，进入游客模式
      }
    })
  },

  // 控制当前页面的自定义 loading
  _showPageLoading(text) {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (page) page.setData({ showLoginLoading: true, loginLoadingText: text || '登录中' })
  },

  _hidePageLoading() {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (page) page.setData({ showLoginLoading: false })
  },

  // 统一登录方法
  login(options = {}) {
    // 如果正在登录中，将回调加入队列
    if (this.globalData.isLoggingIn) {
      this.globalData.loginCallbacks.push(options)
      return
    }

    this.globalData.isLoggingIn = true

    this._showPageLoading('登录中')

    wx.login({
      success: (res) => {
        console.log('[login] wx.login success, code:', res.code)
        if (!res.code) {
          this._hidePageLoading()
          this.globalData.isLoggingIn = false
          options.fail && options.fail('获取微信code失败')
          this.globalData.loginCallbacks.forEach(cb => {
            cb.fail && cb.fail('获取微信code失败')
          })
          this.globalData.loginCallbacks = []
          return
        }
        wx.request({
            url: config.baseUrl + '/api/v1/wx/getSession',
            method: 'GET',
            data: { code: res.code },
            success: (loginRes) => {
              console.log('[login] 后端返回:', JSON.stringify(loginRes.data))
              this._hidePageLoading()
              this.globalData.isLoggingIn = false

              if (loginRes.data.errorCode === 0 && loginRes.data.data && loginRes.data.data.sessionId) {
                const sessionId = loginRes.data.data.sessionId
                const userData = loginRes.data.data

                this.globalData.thirdSessionKey = sessionId
                this.globalData.isLogin = true
                this.globalData.userInfo = {
                  userId: userData.userId || 0,
                  name: userData.wxname || '',
                  headImg: userData.headImg || ''
                }

                wx.setStorageSync('thirdSessionKey', sessionId)
                wx.setStorageSync('userInfo', this.globalData.userInfo)

                // 执行当前回调
                options.success && options.success()

                // 执行队列中的所有回调
                this.globalData.loginCallbacks.forEach(cb => {
                  cb.success && cb.success()
                })
                this.globalData.loginCallbacks = []
              } else {
                const errMsg = '登录失败(errorCode:' + loginRes.data.errorCode + ')'
                options.fail && options.fail(errMsg)
                this.globalData.loginCallbacks.forEach(cb => {
                  cb.fail && cb.fail(errMsg)
                })
                this.globalData.loginCallbacks = []
              }
            },
            fail: (err) => {
              console.error('[login] 请求后端失败:', JSON.stringify(err))
              this._hidePageLoading()
              this.globalData.isLoggingIn = false

              options.fail && options.fail('登录请求失败')
              this.globalData.loginCallbacks.forEach(cb => {
                cb.fail && cb.fail('登录请求失败')
              })
              this.globalData.loginCallbacks = []
            }
          })
      },
      fail: (err) => {
        this._hidePageLoading()
        this.globalData.isLoggingIn = false

        options.fail && options.fail('wx.login 失败')
        this.globalData.loginCallbacks.forEach(cb => {
          cb.fail && cb.fail('wx.login 失败')
        })
        this.globalData.loginCallbacks = []
      }
    })
  },

  // 登出方法
  logout() {
    wx.removeStorageSync('thirdSessionKey')
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('profileDone')
    wx.removeStorageSync('phoneBound')
    this.globalData.isLogin = false
    this.globalData.thirdSessionKey = ''
    this.globalData.userInfo = { userId: 0, name: '', headImg: '' }
    this.globalData.loginCallbacks = []
  },

  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
