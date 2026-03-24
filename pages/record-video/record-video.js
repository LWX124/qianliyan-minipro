const { request, uploadFile } = require('../../utils/request')

Page({
  data: {
    status: 'idle', // idle | preview
    videoPath: '',
    durationDisplay: '',
    uploading: false,
    uploadProgress: 0
  },

  startRecord() {
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

  reRecord() {
    this.setData({ status: 'idle', videoPath: '', durationDisplay: '' })
  },

  uploadVideo() {
    this.setData({ uploading: true, uploadProgress: 0 })

    let lng = '', lat = ''
    wx.getLocation({
      type: 'gcj02',
      success: (loc) => {
        lng = loc.longitude
        lat = loc.latitude
      },
      complete: () => {
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

  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
