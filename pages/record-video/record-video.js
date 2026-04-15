const { request, uploadFile } = require('../../utils/request')
const config = require('../../config/index')
const app = getApp()

Page({
  data: {
    // 状态机: idle | recording | paused | preview | uploading
    status: 'idle',

    // 相机
    devicePosition: 'back',
    flashMode: 'off',

    // 能力检测
    supportPause: false,
    supportZoom: false,
    cameraError: false,

    // 缩放
    zoomValue: 10,
    zoomDisplay: '1.0',

    // 计时器
    timerDisplay: '00:00',
    elapsedSeconds: 0,

    // 引导提示
    showGuide: true,

    // 暂停按钮延迟显示
    showPauseBtn: false,

    // 预览
    videoPath: '',
    durationDisplay: '',

    // 位置信息
    longitude: '',
    latitude: '',

    // 上传
    uploading: false,
    uploadProgress: 0,

    // 布局
    statusBarHeight: 0,

    showPhoneModal: false
  },

  onLoad() {
    // 获取状态栏高度
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })

    // 能力检测
    this.setData({
      supportPause: wx.canIUse('CameraContext.pauseRecord'),
      supportZoom: wx.canIUse('CameraContext.setZoom')
    })

    // 请求相机权限
    wx.authorize({
      scope: 'scope.camera',
      fail: () => {
        wx.showModal({
          title: '需要相机权限',
          content: '请在设置中开启相机权限以录制视频',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            } else {
              this.setData({ cameraError: true })
            }
          }
        })
      }
    })

    // 进入页面立即获取位置
    this._fetchLocation()
  },

  onReady() {
    this.cameraCtx = wx.createCameraContext()
    this._timerInterval = null
    this._guideTimer = null
  },

  // 相机初始化完成后自动开始录制
  onCameraReady() {
    if (this.data.status === 'idle') {
      this.startRecord()
    }
  },

  onUnload() {
    this._stopTimer()
    this._clearGuideTimer()
    const s = this.data.status
    if (s === 'recording' || s === 'paused') {
      this.cameraCtx.stopRecord({ success() {}, fail() {} })
    }
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload()
    }
  },

  // ========== 相机错误 ==========
  onCameraError(e) {
    console.error('Camera init error:', e.detail)
    this.setData({ cameraError: true })
    wx.showToast({ title: '相机初始化失败，将使用系统相机', icon: 'none', duration: 2000 })
  },

  // ========== 录制控制 ==========
  startRecord() {
    if (this.data.cameraError) {
      this._fallbackRecord()
      return
    }

    this.setData({
      elapsedSeconds: 0,
      timerDisplay: '00:00',
      showGuide: true,
      showPauseBtn: false
    })

    this.cameraCtx.startRecord({
      timeout: 300,
      timeoutCallback: (res) => {
        this._onRecordComplete(res)
      },
      success: () => {
        this.setData({ status: 'recording' })
        this._startTimer()

        // 5秒后隐藏引导并显示暂停按钮
        this._guideTimer = setTimeout(() => {
          this.setData({ showGuide: false, showPauseBtn: true })
          this._guideTimer = null
        }, 5000)

        if (wx.enableAlertBeforeUnload) {
          wx.enableAlertBeforeUnload({ message: '录制中，确定要退出吗？' })
        }
      },
      fail: (err) => {
        console.error('startRecord fail:', err)
        this.setData({ status: 'idle', showGuide: true })
        wx.showToast({ title: '录制启动失败，请重试', icon: 'none' })
      }
    })
  },

  // 暂停按钮：停止录制并进入预览
  stopRecord() {
    const s = this.data.status
    if (s !== 'recording' && s !== 'paused') return

    if (this.data.elapsedSeconds < 5) {
      const remaining = 5 - this.data.elapsedSeconds
      wx.showToast({ title: '视频至少需要5秒，还需' + remaining + '秒', icon: 'none' })
      return
    }

    this._stopTimer()
    this._clearGuideTimer()
    this.cameraCtx.stopRecord({
      success: (res) => {
        this._onRecordComplete(res)
      },
      fail: (err) => {
        console.error('stopRecord fail:', err)
        wx.showToast({ title: '停止录制失败', icon: 'none' })
      }
    })
  },

  _onRecordComplete(res) {
    this._stopTimer()
    this._clearGuideTimer()
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload()

    const dur = this.data.elapsedSeconds
    const min = String(Math.floor(dur / 60)).padStart(2, '0')
    const sec = String(dur % 60).padStart(2, '0')

    this.setData({
      status: 'preview',
      videoPath: res.tempVideoPath,
      durationDisplay: min + ':' + sec,
      showGuide: false
    })
  },

  // ========== 计时器 ==========
  _startTimer() {
    if (this._timerInterval) return
    this._timerInterval = setInterval(() => {
      const elapsed = this.data.elapsedSeconds + 1
      const min = String(Math.floor(elapsed / 60)).padStart(2, '0')
      const sec = String(elapsed % 60).padStart(2, '0')
      this.setData({ elapsedSeconds: elapsed, timerDisplay: min + ':' + sec })

      // 达到最大时长，由 camera 的 timeoutCallback 处理停止
      // 这里只停计时器，避免和 timeoutCallback 竞争
      if (elapsed >= 300) {
        this._stopTimer()
      }
    }, 1000)
  },

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval)
      this._timerInterval = null
    }
  },

  _clearGuideTimer() {
    if (this._guideTimer) {
      clearTimeout(this._guideTimer)
      this._guideTimer = null
    }
  },

  // ========== 缩放控制 ==========
  onZoomChange(e) {
    const val = e.detail.value
    const zoom = val / 10
    this.setData({ zoomValue: val, zoomDisplay: zoom.toFixed(1) })
    if (this.data.supportZoom && this.cameraCtx) {
      this.cameraCtx.setZoom({ zoom })
    }
  },

  // ========== 摄像头切换 ==========
  switchCamera() {
    const s = this.data.status
    if (s !== 'idle' && s !== 'recording') return
    const newPos = this.data.devicePosition === 'back' ? 'front' : 'back'
    this.setData({ devicePosition: newPos, zoomValue: 10, zoomDisplay: '1.0' })
    if (this.data.supportZoom && this.cameraCtx) {
      this.cameraCtx.setZoom({ zoom: 1 })
    }
  },

  // ========== 返回 ==========
  goBack() {
    const s = this.data.status
    if (s === 'recording' || s === 'paused') {
      wx.showModal({
        title: '提示',
        content: '录制中，确定要退出吗？视频将不会保存。',
        success: (res) => {
          if (res.confirm) {
            this._stopTimer()
            this.cameraCtx.stopRecord({ success() {}, fail() {} })
            if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload()
            wx.navigateBack()
          }
        }
      })
    } else {
      wx.navigateBack()
    }
  },

  // ========== 预览与上传 ==========
  reRecord() {
    this.setData({
      status: 'idle',
      videoPath: '',
      durationDisplay: '',
      showGuide: true,
      showPauseBtn: false,
      zoomValue: 10,
      zoomDisplay: '1.0'
    })
    // 重拍：自动重新开始录制
    this.startRecord()
  },

  uploadVideo() {
    if (this.data.uploading) return

    // 检查手机号是否已绑定
    const phoneBound = wx.getStorageSync('phoneBound')
    if (!phoneBound) {
      this._pendingUpload = true
      this.setData({ showPhoneModal: true })
      return
    }

    this._doUpload()
  },

  _doUpload() {
    this.setData({ uploading: true, uploadProgress: 0 })

    const lng = this.data.longitude
    const lat = this.data.latitude

    uploadFile(this.data.videoPath, (progress) => {
      this.setData({ uploadProgress: progress })
    }).then(res => {
      const fileUrl = res.data.url || res.data
      const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
      return request({
        url: '/api/v1/wx/accid/newAdd?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
        method: 'POST',
        data: { url: fileUrl, lng: lng, lat: lat }
      })
    }).then(res => {
      this.setData({ uploading: false })
      if (res && res.errorCode === 5003) {
        wx.removeStorageSync('phoneBound')
        wx.showModal({
          title: '需要授权手机号',
          content: '上传记录需要先授权手机号，请返回首页完成授权后再上传',
          showCancel: false,
          confirmText: '我知道了'
        })
        return
      }
      if (res && res.errorCode !== 0) {
        wx.showToast({ title: res.errorMsg || '上传失败，请重试', icon: 'none' })
        return
      }
      wx.requestSubscribeMessage({
        tmplIds: [config.subscribeTemplateId],
        success() { },
        fail() { },
        complete: () => {
          wx.redirectTo({
            url: '/pages/share-result/share-result?type=video'
          })
        }
      })
    }).catch(() => {
      this.setData({ uploading: false })
      wx.showToast({ title: '上传失败，请重试', icon: 'none' })
    })
  },

  // 手机号授权回调
  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      this.setData({ showPhoneModal: false })
      // 用户拒绝，提示但不阻塞上传
      wx.showToast({ title: '未绑定手机号将影响奖励领取', icon: 'none' })
      if (this._pendingUpload) {
        this._pendingUpload = false
        setTimeout(() => this._doUpload(), 1500)
      }
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
          wx.showToast({ title: data.errorMsg || '绑定失败', icon: 'none' })
        }
        this.setData({ showPhoneModal: false })
        // 绑定后继续上传
        if (this._pendingUpload) {
          this._pendingUpload = false
          setTimeout(() => this._doUpload(), 1000)
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
  },

  closePhoneModal() {
    this.setData({ showPhoneModal: false })
    // 用户跳过，提示但继续上传
    if (this._pendingUpload) {
      this._pendingUpload = false
      wx.showToast({ title: '未绑定手机号将影响奖励领取', icon: 'none' })
      setTimeout(() => this._doUpload(), 1500)
    }
  },

  // ========== 获取位置 ==========
  _fetchLocation() {
    const cached = app.globalData.location
    if (cached) {
      this.setData({ longitude: cached.lng, latitude: cached.lat })
      return
    }
    wx.getLocation({
      type: 'gcj02',
      success: (loc) => {
        app.globalData.location = { lng: loc.longitude, lat: loc.latitude }
        this.setData({ longitude: loc.longitude, latitude: loc.latitude })
      },
      fail: () => {
        this.setData({ longitude: '', latitude: '' })
      }
    })
  },

  // ========== 降级方案 ==========
  _fallbackRecord() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['camera'],
      maxDuration: 300,
      camera: 'back',
      success: (res) => {
        const file = res.tempFiles[0]
        const dur = Math.round(file.duration)
        if (dur < 5) {
          wx.showToast({ title: '视频需要至少5秒，当前' + dur + '秒', icon: 'none' })
          return
        }
        const min = String(Math.floor(dur / 60)).padStart(2, '0')
        const sec = String(dur % 60).padStart(2, '0')
        this.setData({
          status: 'preview',
          videoPath: file.tempFilePath,
          durationDisplay: min + ':' + sec
        })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '录制失败，请重试', icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
