Component({
  data: {
    selected: 0,
    hidden: false,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '申请',
        iconPath: '/images/tab-apply.png',
        selectedIconPath: '/images/tab-apply-active.png'
      },
      {
        pagePath: '/pages/mine/mine',
        text: '我的',
        iconPath: '/images/tab-mine.png',
        selectedIconPath: '/images/tab-mine-active.png'
      }
    ]
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]
      wx.switchTab({ url: item.pagePath })
    }
  }
})
