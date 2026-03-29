const { request } = require('../../utils/request')

Page({
  data: {
    records: [],
    loading: false,
    page: 1,
    hasMore: true
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
      // 预览视频
      wx.previewMedia({
        sources: [{ url: item.video, type: 'video' }]
      })
    } else if (item.accImg) {
      // 预览图片
      const urls = item.accImg.split(',')
      wx.previewImage({ urls })
    }
  }
})
