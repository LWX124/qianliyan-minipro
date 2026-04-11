const { request } = require('../../utils/request')

Page({
  data: {
    records: [],
    loading: false,
    page: 1,
    hasMore: true,
    playingVideo: ''
  },

  onShow() {
    this.setData({ page: 1, hasMore: true })
    this.loadRecords()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadRecords().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadRecords()
  },

  loadRecords() {
    this.setData({ loading: true })
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    return request({
      url: '/api/v1/wx/accid/list',
      method: 'GET',
      data: { thirdSessionKey, page: this.data.page, pageSize: 20 }
    }).then(res => {
      const list = (res.data && res.data.list) || []
      // 标记转账是否过期（超过24小时）
      const now = Date.now()
      list.forEach(item => {
        if (item.billStatus == 2 && item.transferTime) {
          const transferTs = new Date(item.transferTime.replace(/-/g, '/')).getTime()
          item.transferExpired = (now - transferTs) > 24 * 60 * 60 * 1000
        } else if (item.billStatus == 2 && item.createTime) {
          // 兜底：用 createTime 判断
          const createTs = new Date(item.createTime.replace(/-/g, '/')).getTime()
          item.transferExpired = (now - createTs) > 24 * 60 * 60 * 1000
        } else {
          item.transferExpired = false
        }
      })
      const hasMore = list.length >= 20
      if (this.data.page === 1) {
        this.setData({ records: list, loading: false, hasMore })
      } else {
        this.setData({ records: this.data.records.concat(list), loading: false, hasMore })
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  viewDetail(e) {
    const item = e.currentTarget.dataset.item
    if (item.video) {
      this.setData({ playingVideo: item.video })
      // 等 video 组件渲染后请求全屏
      setTimeout(() => {
        const videoCtx = wx.createVideoContext('fullscreenVideo', this)
        videoCtx.requestFullScreen({ direction: 0 })
      }, 100)
    } else if (item.accImg) {
      const urls = item.accImg.split(',')
      wx.previewImage({ urls })
    }
  },

  onVideoFullscreenChange(e) {
    // 退出全屏时清除视频
    if (!e.detail.fullScreen) {
      this.setData({ playingVideo: '' })
    }
  },

  confirmReceive(e) {
    const item = e.currentTarget.dataset.item
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    wx.showLoading({ title: '请稍候...' })
    request({
      url: '/api/v1/wx/accid/transferPackage',
      method: 'GET',
      data: { thirdSessionKey, accid: item.id }
    }).then(res => {
      wx.hideLoading()
      if (res.errorCode !== 0 || !res.data) {
        wx.showToast({ title: res.errorMsg || '获取转账信息失败', icon: 'none' })
        return
      }
      const { mchId, appId, packageInfo } = res.data
      wx.requestMerchantTransfer({
        mchId: mchId,
        appId: appId,
        package: packageInfo,
        success: () => {
          // 通知后端用户已确认收款（POST + @RequestParam 需要拼到 URL query）
          const confirmSessionKey = wx.getStorageSync('thirdSessionKey') || ''
          request({
            url: '/api/v1/wx/accid/confirmTransfer?thirdSessionKey=' + encodeURIComponent(confirmSessionKey) + '&accid=' + item.id,
            method: 'POST'
          }).finally(() => {
            wx.showToast({ title: '收款成功', icon: 'success' })
            this.setData({ page: 1, hasMore: true })
            this.loadRecords()
          })
        },
        fail: (err) => {
          console.log('confirmReceive fail', err)
          wx.showToast({ title: '收款取消或失败', icon: 'none' })
        }
      })
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  }
})
