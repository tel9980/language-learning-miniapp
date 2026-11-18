// 今日待练：把 FSRS 到期词、口语重点项、错词本合成一个清单，每天打开就知道练什么。
const theme = require('../../utils/theme')
const nav = require('../../utils/nav')
const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const { getWords, getLangMeta } = require('../../utils/words')
const pager = require('../../utils/pager')

Page({
  behaviors: [theme],
  data: {
    lang: 'en', langName: '英语',
    items: [], total: 0,
    dueCount: 0, focusCount: 0, wrongCount: 0,
    allDone: false, hasMore: false
  },

  // 完整清单留在实例上，setData 只传当前该渲染的片段（大清单不卡）
  _all: null,
  _pager: pager.create(30),

  onLoad() {
    const lang = storage.getCurrentLang()
    this.setData({ lang: lang, langName: getLangMeta(lang).name })
  },
  onShow() {
    this.syncTheme()
    const lang = storage.getCurrentLang()
    if (lang !== this.data.lang) this.setData({ lang: lang, langName: getLangMeta(lang).name })
    this.refresh()
  },

  refresh() {
    const lang = this.data.lang
    const words = getWords(lang)
    const prog = storage.getProgress()
    const now = Date.now()
    const items = []

    // 1) FSRS 到期词（学过且 dueAt<=now）
    let dueCount = 0
    words.forEach(function (w) {
      const p = prog[w.id]
      if (p && p.dueAt <= now) {
        dueCount++
        items.push({ id: w.id, label: w.word, sub: w.meaning, type: 'due', typeName: '复习', target: '/pages/learn/learn?mode=due' })
      }
    })

    // 2) 口语重点项（词 + 句 + 对话台词）
    const allItems = words.concat(sentences.getAllItems(lang))
    const focusItems = speaking.getFocusItems(allItems)
    focusItems.forEach(function (it) {
      items.push({ id: 'f_' + it.id, label: it.word, sub: '重点复练 ×' + it.focusCount, type: 'focus', typeName: '口语', target: '/pages/speak/speak?focus=1' })
    })

    // 3) 错词本（lapses>0）
    let wrongCount = 0
    words.forEach(function (w) {
      const p = prog[w.id]
      if (p && p.lapses > 0) {
        wrongCount++
        items.push({ id: 'w_' + w.id, label: w.word, sub: '答错 ' + p.lapses + ' 次', type: 'wrong', typeName: '错词', target: '/pages/wrong/wrong' })
      }
    })

    this._all = items
    this._pager.reset(items.length)
    this.setData({
      items: this._pager.slice(items), total: items.length, hasMore: this._pager.hasMore,
      dueCount: dueCount, focusCount: focusItems.length, wrongCount: wrongCount,
      allDone: items.length === 0
    })
  },

  loadMore() {
    if (!this._pager.more()) return
    this.setData({
      items: this._pager.slice(this._all || []),
      hasMore: this._pager.hasMore
    })
  },

  // 点单项跳到对应练习页（tabBar 页走 switchTab + 意图传参）
  goItem(e) {
    const type = e.currentTarget.dataset.type
    if (type === 'due') return this.goLearn()
    if (type === 'focus') return this.goSpeak()
    nav.go('/pages/wrong/wrong')
  },
  goLearn() { nav.go('/pages/learn/learn', { mode: 'due' }) },
  goSpeak() { nav.go('/pages/speak/speak', { focus: 1 }) },
  goWrong() { nav.go('/pages/wrong/wrong') }
})
