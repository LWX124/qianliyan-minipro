const config = require('./config/index')

App({
  globalData: {
    isLogin: false,           // 登录状态
    isCheckingLogin: true,    // 启动时验证 token 中
    userInfo: {               // 用户信息
      userId: 0,
      name: ''
    },
    thirdSessionKey: '',      // token
    isLoggingIn: false,       // 登录中标志
    loginCallbacks: []        // 登录回调队列
  },

  onLaunch() {
    this.autoLogin()
  },

  // 启动时自动登录
  autoLogin() {
    const token = wx.getStorageSync('thirdSessionKey')

    // 如果已有 token，先验证
    if (token) {
      wx.request({
        url: config.baseUrl + '/user/checkToken',
        header: {
          'THIRDSESSIONKEY': token,
          'X-Source': config.source
        },
        success: (res) => {
          if (res.data.code === 200) {
            // token 有效，直接使用
            this.globalData.isLogin = true
            this.globalData.userInfo = res.data.data
            this.globalData.thirdSessionKey = token
            this.globalData.isCheckingLogin = false
            console.log('[autoLogin] token 有效，已登录')
          } else {
            // token 无效，清除并重新登录
            wx.removeStorageSync('thirdSessionKey')
            wx.removeStorageSync('userId')
            this.globalData.isCheckingLogin = false
            this.performLogin()
          }
        },
        fail: () => {
          // 网络错误，尝试登录
          this.globalData.isCheckingLogin = false
          this.performLogin()
        }
      })
    } else {
      // 没有 token，直接登录
      this.globalData.isCheckingLogin = false
      this.performLogin()
    }
  },

  // 执行登录操作
  performLogin() {
    console.log('[performLogin] 开始自动登录')
    this.login({
      success: () => {
        console.log('[performLogin] 自动登录成功')
      },
      fail: (msg) => {
        console.error('[performLogin] 自动登录失败:', msg)
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

  // 启动时验证 token
  checkLoginStatus() {
    const token = wx.getStorageSync('thirdSessionKey')
    if (!token) {
      this.globalData.isLogin = false
      this.globalData.isCheckingLogin = false
      return
    }

    // 调用后端验证 token
    wx.request({
      url: config.baseUrl + '/user/checkToken',
      header: {
        'THIRDSESSIONKEY': token,
        'X-Source': config.source
      },
      success: (res) => {
        if (res.data.code === 200) {
          this.globalData.isLogin = true
          this.globalData.userInfo = res.data.data
          this.globalData.thirdSessionKey = token
        } else {
          // token 无效，清除
          wx.removeStorageSync('thirdSessionKey')
          wx.removeStorageSync('userId')
          this.globalData.isLogin = false
        }
        this.globalData.isCheckingLogin = false
      },
      fail: () => {
        // 网络错误，进入游客模式
        this.globalData.isLogin = false
        this.globalData.isCheckingLogin = false
        console.error('验证 token 失败，进入游客模式')
      }
    })
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
            url: config.baseUrl + '/user/wxMiniLogin',
            method: 'POST',
            data: { code: res.code, source: config.source },
            header: { 'content-type': 'application/json' },
            success: (loginRes) => {
              console.log('[login] 后端返回:', JSON.stringify(loginRes.data))
              this._hidePageLoading()
              // 先重置登录状态，避免回调执行时的竞态条件
              this.globalData.isLoggingIn = false

              if (loginRes.data.code === 200 && loginRes.data.data) {
                const data = loginRes.data.data

                // 验证必需字段
                if (!data.thirdSessionKey || !data.userId) {
                  options.fail && options.fail('登录数据不完整')
                  this.globalData.loginCallbacks.forEach(cb => {
                    cb.fail && cb.fail('登录数据不完整')
                  })
                  this.globalData.loginCallbacks = []
                  return
                }

                this.globalData.thirdSessionKey = data.thirdSessionKey
                this.globalData.userInfo = {
                  userId: data.userId,
                  name: data.name
                }
                this.globalData.isLogin = true

                wx.setStorageSync('thirdSessionKey', data.thirdSessionKey)
                wx.setStorageSync('userId', data.userId)

                // 执行当前回调
                options.success && options.success()

                // 执行队列中的所有回调
                this.globalData.loginCallbacks.forEach(cb => {
                  cb.success && cb.success()
                })
                this.globalData.loginCallbacks = []
              } else {
                // 执行当前回调
                options.fail && options.fail(loginRes.data.msg || '登录失败')

                // 执行队列中的所有回调
                this.globalData.loginCallbacks.forEach(cb => {
                  cb.fail && cb.fail(loginRes.data.msg || '登录失败')
                })
                this.globalData.loginCallbacks = []
              }
            },
            fail: (err) => {
              console.error('[login] 请求后端失败:', JSON.stringify(err))
              this._hidePageLoading()
              this.globalData.isLoggingIn = false

              // 执行当前回调
              options.fail && options.fail('登录请求失败')

              // 执行队列中的所有回调
              this.globalData.loginCallbacks.forEach(cb => {
                cb.fail && cb.fail('登录请求失败')
              })
              this.globalData.loginCallbacks = []
            }
          })
      },
      fail: (err) => {
        this._hidePageLoading()
        // 先重置登录状态
        this.globalData.isLoggingIn = false

        // 执行当前回调
        options.fail && options.fail('wx.login 失败')

        // 执行队列中的所有回调
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
    wx.removeStorageSync('userId')
    this.globalData.isLogin = false
    this.globalData.thirdSessionKey = ''
    this.globalData.userInfo = { userId: 0, name: '' }
    this.globalData.loginCallbacks = []
  },

  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
