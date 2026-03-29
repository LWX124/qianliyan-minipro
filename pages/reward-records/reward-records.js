const { request } = require('../../utils/request')

Page({
  data: {
    list: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadMore()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  onPullDownRefresh() {
    this.setData({ list: [], page: 1, hasMore: true })
    this.loadMore().finally(() => wx.stopPullDownRefresh())
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return Promise.resolve()
    this.setData({ loading: true })
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    return request({
      url: '/api/v1/wx/reward/list',
      method: 'GET',
      data: { thirdSessionKey, page: this.data.page, pageSize: 10 }
    }).then(res => {
      const items = (res.data && res.data.list) || []
      this.setData({
        list: this.data.list.concat(items),
        page: this.data.page + 1,
        hasMore: items.length === 10,
        loading: false
      })
    }).catch(() => {
      this.setData({ loading: false })
    })
  }
})
