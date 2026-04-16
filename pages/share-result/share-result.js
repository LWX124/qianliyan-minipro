const { request } = require('../../utils/request')

Page({
  data: {
    type: 'video'     // 'video' | 'photo'
  },

  onLoad(options) {
    const type = options.type || 'video'
    this.setData({ type })
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

    const app = getApp()
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
