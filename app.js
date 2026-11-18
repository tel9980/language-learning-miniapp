const storage = require('./utils/storage')
const onlineData = require('./utils/online-data')

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
    // 异步检查在线素材更新（未配置域名时自动 no-op，不影响启动速度与使用）
    onlineData.checkUpdate()
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
  },
  // ---- 兜底：小程序没有错误边界，页面里抛异常会直接白屏且无提示 ----
  onError(err) {
    if (typeof console !== 'undefined' && console.error) console.error('[app] 未捕获错误', err)
  },
  onUnhandledRejection(res) {
    if (typeof console !== 'undefined' && console.error) console.error('[app] 未处理的 Promise 拒绝', res && res.reason)
  },
  // 页面路径不存在（例如手改分享路径、旧版链接）时回首页，而不是停在错误页
  onPageNotFound(res) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[app] 页面不存在', res && res.path)
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
