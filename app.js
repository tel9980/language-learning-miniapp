const storage = require('./utils/storage')

App({
  globalData: {
    lang: 'en',
    theme: { fontScale: 1, darkMode: false }
  },
  onLaunch() {
    storage.init()
    this.globalData.lang = storage.getCurrentLang()
    this.globalData.theme = storage.getTheme()
    this.applyTheme()
  },
  applyTheme() {
    const t = this.globalData.theme || { fontScale: 1, darkMode: false }
    try {
      wx.setStorageSync('lp_theme_applied', t)
      // 字号：通过设置页面根字体大小实现（各页 rpx 不受影响，文字用 rpx 的会自动继承 page 的 font-size 缩放无效，
      // 这里用 body 级 class 由各页 container 读取；真正生效在 pages 的 onShow 里读 this.data.fontScale 绑定 style）。
    } catch (e) {}
  },
  // 供页面读取当前主题
  getTheme() { return this.globalData.theme || { fontScale: 1, darkMode: false } },
  refreshTheme() {
    this.globalData.theme = storage.getTheme()
    this.applyTheme()
  }
})
