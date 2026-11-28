const storage = require('./utils/storage')
const onlineData = require('./utils/online-data')
const logger = require('./utils/logger')
const chrome = require('./utils/chrome')

// 出错时取当前页面路径，实时日志里才分得清是哪个页面炸的
function currentRoute() {
  try {
    const pages = getCurrentPages()
    const p = pages[pages.length - 1]
    return p && p.route ? p.route : ''
  } catch (e) {
    return ''
  }
}

App({
  globalData: {
    lang: 'en',
    theme: { fontScale: 1, darkMode: false },
    // 第九轮：断网感知。以前全项目没有 wx.onNetworkStatusChange，
    // 用户在地铁里点 AI 查词要干等 15–25 秒才等到「再试一次」，
    // 而第 0.1 秒其实就已经断网了。这里维护一个全局在线标记，AI 请求前先看它。
    online: true
  },
  onLaunch() {
    storage.init()
    this.globalData.lang = storage.getCurrentLang()
    // 预生成音频全部放在 CDN（清单在 utils/local-audio.js，文件在
    // https://yb.qy663.de5.net/audio-*/ 下），**启动时不预载**：
    // 冷启动是用户最敏感的那一段，为了可能马上听不到的一句去拉 1–2MB 不划算。
    // 真正的预载点在口语/学习页 onShow（用户要去练了）以及 speak() 的按需挂起。
    // 注：项目没有分包（app.json 里没有 subpackages），别去分包目录里找音频。
    this.globalData.theme = storage.getTheme()
    this.applyTheme()
    // 异步检查在线素材更新（未配置域名时自动 no-op，不影响启动速度与使用）
    onlineData.checkUpdate()
    this.watchNetwork()
  },
  // 断网/恢复监听：UI 不弹窗打扰，只更新 globalData.online，由 AI 请求自己判断
  watchNetwork() {
    if (typeof wx.onNetworkStatusChange !== 'function') return
    try {
      const self = this
      wx.onNetworkStatusChange(function (res) {
        self.globalData.online = !!(res && res.isConnected)
      })
      if (typeof wx.getNetworkType === 'function') {
        wx.getNetworkType({
          success(res) { self.globalData.online = !(res && res.networkType === 'none') }
        })
      }
    } catch (e) {
      logger.warn('网络状态监听注册失败', e)
    }
  },
  // 供 utils 读取（AI 请求前问一句，比等 15 秒超时好）
  isOnline() {
    const o = this.globalData && this.globalData.online
    return o === undefined ? true : !!o
  },
  // 进后台时把攒着的评分落盘（写入合并的兜底，见 utils/storage.js 的 writeDeferred）
  onHide() {
    try { storage.flushAll() } catch (e) {}
  },
  // 主题落地。页面内部靠 themeClass 上的 CSS 类（见 app.wxss），
  // 但底部 tabBar 与窗口背景是**原生层**，不吃 wxss，必须走 API——第十四轮之前这里只有一句
  // 「写一个没人读的 storage key」，等于空转，所以深色模式下页面全黑、底栏还是一条白。
  applyTheme() {
    const t = this.globalData.theme || { fontScale: 1, darkMode: false }
    const dark = !!t.darkMode
    try {
      wx.setStorageSync('lp_theme_applied', t)
      // 字号不是靠改根 font-size 实现的（那样对 rpx 无效，第九轮踩过这个坑）：
      // app.wxss 里有 .theme-sm / .theme-lg / .theme-xl 三档，按倍率给出各关键类的 rpx 绝对值，
      // 页面 root 挂上 themeClass 就生效。深色同理，也是 themeClass 上的 .theme-dark。
    } catch (e) {}
    // 底部 tabBar 与窗口背景（具体取值与去重见 utils/chrome.js）
    chrome.apply(dark)
  },
  // 供页面读取当前主题
  getTheme() { return this.globalData.theme || { fontScale: 1, darkMode: false } },
  refreshTheme() {
    this.globalData.theme = storage.getTheme()
    this.applyTheme()
  },
  // ---- 兜底：小程序没有错误边界，页面里抛异常会直接白屏且无提示 ----
  // 错误同时写进微信「实时日志」（后台 → 运维中心 → 实时日志），否则真机崩溃
  // 只有用户自己知道，开发者这边一无所知。见 utils/logger.js。
  onError(err) {
    logger.error(logger.withPage(currentRoute(), '未捕获错误'), err)
  },
  onUnhandledRejection(res) {
    logger.error(logger.withPage(currentRoute(), '未处理的 Promise 拒绝'), res && res.reason)
  },
  // 页面路径不存在（例如手改分享路径、旧版链接）时回首页，而不是停在错误页
  onPageNotFound(res) {
    logger.warn('页面不存在', res && res.path)
    wx.reLaunch({ url: '/pages/index/index' })
  },
  // 内存告警：低端机上出现「录音没存下来 / 图片白屏」时，先看这里有没有记录
  onMemoryWarning(res) {
    logger.warn('内存告警 level=' + ((res && res.level) || '?'), currentRoute())
  }
})
