const storage = require('./storage')
const profile = require('./profile')

// 无障碍主题 Behavior：页面引入后，root view 用 class="container {{themeClass}}" 即可生效。
// 字号通过 CSS 类覆盖常用文本尺寸；深色模式通过 .theme-dark 全局覆盖配色。
module.exports = Behavior({
  data: {
    themeClass: '',
    fontScale: 1,
    darkMode: false,
    // 儿童模式：页面用它隐藏 AI 入口、过滤分类（见 utils/profile.js 的 MODES.kid）
    isKid: false
  },
  methods: {
    syncTheme() {
      const t = storage.getTheme()
      let cls = ''
      const s = t.fontScale || 1
      if (s >= 1.3) cls += ' theme-xl'
      else if (s >= 1.14) cls += ' theme-lg'
      else if (s <= 0.9) cls += ' theme-sm'
      if (t.darkMode) cls += ' theme-dark'
      let kid = false
      try { kid = profile.isKid() } catch (e) {}
      if (kid) cls += ' theme-kid'
      this.setData({ themeClass: cls.trim(), fontScale: s, darkMode: !!t.darkMode, isKid: kid })
      // 原生层（tabBar / 窗口背景）不吃 wxss，在这里兜一次最稳：
      // app.onLaunch 时 tabBar 可能还没建好。重复调用由 utils/chrome.js 内部去重。
      try { require('./chrome').apply(!!t.darkMode) } catch (e) {}
    }
  }
})
