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

    // 预览
    videoPath: '',
    durationDisplay: '',

    // 上传
    uploading: false,
    uploadProgress: 0,

    // 布局
    statusBarHeight: 0
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
  },

  onReady() {
    this.cameraCtx = wx.createCameraContext()
    this._timerInterval = null
    this._guideTimer = null
  },

  onUnload() {
    this._stopTimer()
    if (this._guideTimer) {
      clearTimeout(this._guideTimer)
      this._guideTimer = null
    }
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
      showGuide: true
    })

    this.cameraCtx.startRecord({
      timeout: 300,
      timeoutCallback: (res) => {
        this._onRecordComplete(res)
      },
      success: () => {
        // camera 真正开始录制后再切换 UI 状态
        this.setData({ status: 'recording' })
        this._startTimer()

        // 5秒后隐藏引导
        this._guideTimer = setTimeout(() => {
          this.setData({ showGuide: false })
          this._guideTimer = null
        }, 5000)

        // 启用返回拦截
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

  pauseRecord() {
    if (!this.data.supportPause) return
    this.cameraCtx.pauseRecord({
      success: () => {
        this._stopTimer()
        this.setData({ status: 'paused' })
      }
    })
  },

  resumeRecord() {
    this.cameraCtx.resumeRecord({
      success: () => {
        this._startTimer()
        this.setData({ status: 'recording' })
      }
    })
  },

  stopRecord() {
    const s = this.data.status
    if (s !== 'recording' && s !== 'paused') return

    if (this.data.elapsedSeconds < 10) {
      const remaining = 10 - this.data.elapsedSeconds
      wx.showToast({ title: '视频至少需要10秒，还需' + remaining + '秒', icon: 'none' })
      return
    }
    this._stopTimer()
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
      zoomValue: 10,
      zoomDisplay: '1.0'
    })
  },

  uploadVideo() {
    if (this.data.uploading) return
    this.setData({ uploading: true, uploadProgress: 0 })

    const doUpload = (lng, lat) => {
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
      }).then(() => {
        this.setData({ uploading: false })
        wx.requestSubscribeMessage({
          tmplIds: [config.subscribeTemplateId],
          success() { },
          fail() { }
        })
        wx.showToast({ title: '上传成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      }).catch(() => {
        this.setData({ uploading: false })
        wx.showToast({ title: '上传失败，请重试', icon: 'none' })
      })
    }

    const cached = app.globalData.location
    if (cached) {
      doUpload(cached.lng, cached.lat)
    } else {
      wx.getLocation({
        type: 'gcj02',
        success: (loc) => {
          app.globalData.location = { lng: loc.longitude, lat: loc.latitude }
          doUpload(loc.longitude, loc.latitude)
        },
        fail: () => {
          doUpload('', '')
        }
      })
    }
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
        if (dur < 10) {
          wx.showToast({ title: '视频需要至少10秒，当前' + dur + '秒', icon: 'none' })
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
