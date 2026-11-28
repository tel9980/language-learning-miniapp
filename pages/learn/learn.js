const theme = require('../../utils/theme')
const shareCopy = require('../../utils/share-copy')
const nav = require('../../utils/nav')
const storage = require('../../utils/storage')
const { getWords, getLangMeta, getExamCategories } = require('../../utils/words')
const audio = require('../../utils/audio')
const localAudio = require('../../utils/local-audio')
const kidMode = require('../../utils/kid-mode')
const practiceTimer = require('../../utils/practice-timer')

// 首帧语言名（第十轮）：初始 data 原来写死 langName: '英语'，onShow 才覆盖，
// 学日语的用户每次进页面都会先闪一下「英语」。这里在模块加载时就按当前语种算好。
const _firstLangMeta = getLangMeta(storage.getCurrentLang())

Page({
  behaviors: [theme],
  data: {
    mode: 'due', dueCount: 0, current: null, flipped: false,
    queueLen: 0, index: 0, langName: _firstLangMeta.name, tts: _firstLangMeta.tts, totalWords: 0,
    catNames: ['全部分类'], catIndex: 0, catValue: '', catEmpty: false,
    knownCount: 0, nextDue: 0
  },
  onShow() {
    // 让右上角菜单里出现「分享到朋友圈」（第十轮）
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] })
    }
    this.syncTheme()
    // 儿童模式要统计练习时长（15 / 30 分钟休息提醒），只计前台时间
    practiceTimer.start(this.data.isKid)
    // 离线音频优先流播 CDN（见 utils/audio.js），不预载分包——
    // 预载要拉 1–3MB，而真机上读分包文件还可能失败，不如按需。
    const intent = nav.takeIntent('pages/learn/learn')
    if (intent && intent.mode && intent.mode !== this.data.mode) {
      this.setData({ mode: intent.mode })
    }
    // 这一轮还没学完就接着学：以前 onShow 一律 load() → 队列重置、index 归零，
    // 学到第 40 张切去查词页再回来又从第 1 张开始。
    // 只刷新计数（可能在别的页面做了题，到期数变了），不动队列与当前卡。
    if (this._queue && this._queue.length && this.data.current && this._roundSig === this._sig()) {
      this.setData({ dueCount: storage.getDueWords(storage.getCurrentLang()).length })
      return
    }
    this.load()
  },
  // 一轮的范围指纹：模式 / 语种 / 分类，任一变了才重新排队列
  _sig() {
    return [this.data.mode, storage.getCurrentLang(), this.data.catValue || ''].join('|')
  },
  load() {
    const lang = storage.getCurrentLang()
    const meta = getLangMeta(lang)
    const dueWords = storage.getDueWords(lang)
    // 分类下拉：全部 + 当前语种的词库分类（新词可以按类学，不用从头排到尾）
    // 儿童模式只留适龄分类：四级/六级/考研/雅思托福/财务/工作/科技 全藏起来。
    // 之前孩子一进来排在最前面的是 abandon / accommodate，纯粹是被分类顺序坑了。
    const isKid = !!this.data.isKid
    const cats = isKid ? kidMode.filterCategories(getExamCategories(lang)) : getExamCategories(lang)
    const catNames = ['全部分类'].concat(cats.map(c => c.name + '(' + c.count + ')'))
    this._catValues = [''].concat(cats.map(c => c.name))
    const saved = storage.getSettings().learnCat || ''
    let catIndex = this._catValues.indexOf(saved)
    if (catIndex < 0) {
      // 儿童模式默认落在「日常」；家长以前存过的分类若被藏掉，也退回日常而不是全部
      const pref = isKid ? kidMode.KID_DEFAULT_CAT : ''
      const i = this._catValues.indexOf(pref)
      catIndex = i >= 0 ? i : 0
    }
    this.setData({
      langName: meta.name, tts: meta.tts,
      // 儿童模式下总数也要跟着分类过滤走，否则会显示「共 800 词」但只学得到一半
      totalWords: kidMode.allowedWords(getWords(lang), isKid).length,
      dueCount: dueWords.length,
      catNames: catNames, catIndex: catIndex, catValue: this._catValues[catIndex],
      knownCount: storage.getKnownIds().length,
      nextDue: dueWords.length,
      queueLen: 0, index: 0, current: null, flipped: false
    })
    this.buildQueue()
  },
  onCatChange(e) {
    const idx = Number(e.detail.value) || 0
    const value = (this._catValues || [''])[idx] || ''
    storage.setLearnCat(value)
    this.setData({ catIndex: idx, catValue: value }, () => this.buildQueue())
  },
  buildQueue() {
    const lang = storage.getCurrentLang()
    let list
    if (this.data.mode === 'due') {
      list = storage.getDueWords(lang)
    } else {
      list = storage.getNewWords(lang, 5, this.data.catValue || '')
    }
    // 队列只在页面内部流转，不进 data：400 词的队列约 60KB，
    // 每次都塞进 setData 会让切页明显发卡，页面其实只需要「当前」和「共几条」。
    this._queue = list
    this._roundSig = this._sig()
    this.setData({
      queueLen: list.length,
      index: 0,
      current: list[0] || null,
      flipped: false,
      catEmpty: this.data.mode === 'new' && !list.length
    })
    // 预取下一条的预生成音频（单词的 mp3 也是 CDN 上的，见 utils/audio.js 的 prefetch）
    if (list[1]) audio.prefetch(list[1].id)
  },
  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode }, () => this.buildQueue())
  },
  // 第九轮：学完新词后的下一步出口
  goSpeak() { nav.go('/pages/speak/speak') },
  goStats() { nav.go('/pages/stats/stats') },
  flip() {
    // 刚滑动过就不要当成点击（同一次抬手会先 touchend 再 tap）
    if (this._swiped) return
    this.setData({ flipped: !this.data.flipped })
  },
  speak() {
    const w = this.data.current
    if (!w) return
    const lang = storage.getCurrentLang()
    if (this._player && this._player.destroy) this._player.destroy()
    this._player = audio.speak(w.word, false, {
      id: w.id,
      lang: getLangMeta(lang).voice,
      onError: function () {
        wx.showToast({ title: '朗读需联网或配置同声传译插件', icon: 'none' })
      }
    })
  },
  rate(e) {
    const q = Number(e.currentTarget.dataset.q)
    const w = this.data.current
    if (!w) return
    storage.review(w.id, q)
    this._advance()
  },
  // 「早就认识」：这词不用学，直接推到最远间隔，别再当新词推给我
  markKnown() {
    const w = this.data.current
    if (!w) return
    storage.markKnown(w.id)
    wx.showToast({ title: '已标记认识，不再出现在新词里', icon: 'none' })
    this._advance()
  },
  // 撤销：把标记过的词退回没学过（统计页的入口也调这里）
  restoreKnown() {
    const n = storage.restoreKnown()
    if (!n) { wx.showToast({ title: '没有标记过的词', icon: 'none' }); return }
    wx.showToast({ title: '已恢复 ' + n + ' 个词', icon: 'none' })
    this.load()
  },
  _advance() {
    const queue = this._queue || []
    const nextIndex = this.data.index + 1
    if (nextIndex < queue.length) {
      this.setData({ index: nextIndex, current: queue[nextIndex], flipped: false })
      if (queue[nextIndex + 1]) audio.prefetch(queue[nextIndex + 1].id)
    } else {
      wx.showToast({ title: '本轮完成！', icon: 'success' })
      setTimeout(() => this.load(), 600)
    }
  },
  // ---- 滑动手势 ----
  // 没翻面时左右滑 = 翻面（都表示「让我看看答案」）；
  // 翻面后右滑 = 记得，左滑 = 不记得。和下面的三个按钮等价。
  onTouchStart(e) {
    const t = e.touches && e.touches[0]
    this._touch0 = t ? { x: t.clientX, y: t.clientY } : null
  },
  onTouchEnd(e) {
    const t0 = this._touch0
    this._touch0 = null
    const t = e.changedTouches && e.changedTouches[0]
    if (!t0 || !t) return
    const dx = t.clientX - t0.x
    const dy = t.clientY - t0.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return   // 竖着划 / 幅度太小，当点击
    this._swiped = true
    setTimeout(() => { this._swiped = false }, 300)
    if (!this.data.flipped) { this.setData({ flipped: true }); return }
    this.rate({ currentTarget: { dataset: { q: dx > 0 ? 5 : 0 } } })
  },
  onHide() { practiceTimer.stop(); storage.flushAll() },
  onUnload() {
    practiceTimer.stop()
    // 评分是延迟落盘的，离开页面前必须冲一次，否则最后几张卡会丢
    storage.flushAll()
    if (this._player && this._player.destroy) this._player.destroy()
    this._player = null
  },
  onShareAppMessage() {
    const st = storage.getStats() || {}
    const lang = storage.getCurrentLang()
    return { title: shareCopy.title({ lang: lang, streak: st.streak, mastered: storage.getMasteredCount(lang) }), path: '/pages/learn/learn' }
  },
  // 朋友圈（第十轮）：原来 17 页只有统计页支持分享到朋友圈。
  onShareTimeline() {
    const st = storage.getStats() || {}
    const lang = storage.getCurrentLang()
    return { title: shareCopy.title({ lang: lang, streak: st.streak, mastered: storage.getMasteredCount(lang) }) }
  },
})
