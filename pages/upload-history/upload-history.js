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
          wx.showToast({ title: '收款成功', icon: 'success' })
          this.setData({ page: 1, hasMore: true })
          this.loadRecords()
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
