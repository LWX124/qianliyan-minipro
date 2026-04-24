const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    type: 'video',     // 'video' | 'photo'
    videoUrl: ''
  },

  onLoad(options) {
    const type = options.type || 'video'
    const videoUrl = app.globalData.lastUploadedVideoUrl || ''
    this.setData({ type, videoUrl })
  },

  // 立即分享 — 由 <button open-type="share"> 触发
  onShareAppMessage() {
    // 记录分享动作（乐观计数，fire-and-forget）
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    if (thirdSessionKey) {
      request({
        url: '/api/v1/wx/share/record?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
        method: 'POST'
      }).catch(() => {})
    }

    const userId = app.globalData.userInfo.userId || ''
    return {
      title: '一起拍事故，领取现金奖励！',
      path: '/pages/index/index?fromUserId=' + userId
    }
  },

  // 重新拍照/重新拍摄
  onRetake() {
    const url = this.data.type === 'video'
      ? '/pages/record-video/record-video'
      : '/pages/take-photo/take-photo'
    wx.redirectTo({ url })
  },

  // 查看视频 → 上传记录页
  onViewHistory() {
    wx.redirectTo({ url: '/pages/upload-history/upload-history' })
  }
})
