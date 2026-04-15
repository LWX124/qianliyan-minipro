Page({
  data: {
    type: 'video',    // 'video' | 'photo'
    mediaPath: ''     // 视频路径或照片路径
  },

  onLoad(options) {
    const type = options.type || 'video'
    const mediaPath = options.mediaPath ? decodeURIComponent(options.mediaPath) : ''
    this.setData({ type, mediaPath })
  },

  // 立即分享 — 由 <button open-type="share"> 触发
  onShareAppMessage() {
    return {
      title: '一起拍事故，领取现金奖励！',
      path: '/pages/index/index'
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
