const { request, uploadFile } = require('../../utils/request')

Page({
  data: {
    status: 'idle', // idle | recording | preview
    seconds: 0,
    timerDisplay: '00:00',
    videoPath: '',
    uploading: false,
    uploadProgress: 0
  },

  cameraCtx: null,
  timer: null,

  onReady() {
    this.cameraCtx = wx.createCameraContext()
  },

  startRecord() {
    const that = this
    this.cameraCtx.startRecord({
      timeout: 300,
      timeoutCallback: (res) => {
        // 录制超时自动停止
        that.clearTimer()
        that.setData({ status: 'preview', videoPath: res.tempVideoPath })
      },
      success: () => {
        this.setData({ status: 'recording', seconds: 0 })
        this.startTimer()
      },
      fail: (err) => {
        wx.showToast({ title: '无法启动录制，请检查相机权限', icon: 'none' })
      }
    })
  },

  stopRecord() {
    if (this.data.seconds < 10) {
      wx.showToast({ title: '视频需要至少10秒', icon: 'none' })
      return
    }
    this.cameraCtx.stopRecord({
      success: (res) => {
        this.clearTimer()
        this.setData({ status: 'preview', videoPath: res.tempVideoPath })
      }
    })
  },

  cancelRecord() {
    this.cameraCtx.stopRecord({
      success: () => {},
      fail: () => {}
    })
    this.clearTimer()
    this.setData({ status: 'idle', seconds: 0, timerDisplay: '00:00' })
  },

  reRecord() {
    this.setData({ status: 'idle', videoPath: '', seconds: 0, timerDisplay: '00:00' })
  },

  startTimer() {
    this.timer = setInterval(() => {
      const s = this.data.seconds + 1
      const min = String(Math.floor(s / 60)).padStart(2, '0')
      const sec = String(s % 60).padStart(2, '0')
      this.setData({ seconds: s, timerDisplay: `${min}:${sec}` })
    }, 1000)
  },

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  uploadVideo() {
    this.setData({ uploading: true, uploadProgress: 0 })

    // 获取地理位置
    let lng = '', lat = ''
    wx.getLocation({
      type: 'gcj02',
      success: (loc) => {
        lng = loc.longitude
        lat = loc.latitude
      },
      complete: () => {
        // 无论定位成功与否都继续上传
        uploadFile(this.data.videoPath, (progress) => {
          this.setData({ uploadProgress: progress })
        }).then(res => {
          const fileUrl = res.data.url || res.data
          return request({
            url: '/AccidentRecord/addVideo',
            method: 'POST',
            data: {
              video: fileUrl,
              type: 2,
              source: require('../../config/index').source,
              lng: lng,
              lat: lat
            }
          })
        }).then(() => {
          this.setData({ uploading: false })
          wx.showToast({ title: '上传成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }).catch(err => {
          this.setData({ uploading: false })
          wx.showToast({ title: '上传失败，请重试', icon: 'none' })
        })
      }
    })
  },

  onCameraError(e) {
    wx.showToast({ title: '相机初始化失败', icon: 'none' })
  },

  onUnload() {
    this.clearTimer()
  }
})
