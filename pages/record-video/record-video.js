const { request, uploadFile } = require('../../utils/request')
const config = require('../../config/index')
const app = getApp()

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

    const doUpload = (lng, lat) => {
      uploadFile(this.data.videoPath, (progress) => {
        this.setData({ uploadProgress: progress })
      }).then(res => {
        const fileUrl = res.data.url || res.data
        const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
        return request({
          url: '/api/v1/wx/accid/newAdd?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
          method: 'POST',
          data: {
            url: fileUrl,
            lng: lng,
            lat: lat
          }
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
      }).catch(err => {
        this.setData({ uploading: false })
        wx.showToast({ title: '上传失败，请重试', icon: 'none' })
      })
    }

    // 优先使用缓存位置
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

  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
})
