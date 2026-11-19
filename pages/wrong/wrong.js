const theme = require('../../utils/theme')
const audio = require('../../utils/audio')
const storage = require('../../utils/storage')
const { getWords, getLangMeta } = require('../../utils/words')
const pager = require('../../utils/pager')

const INTERVALS = storage.INTERVALS

Page({
  behaviors: [theme],
  data: {
    lang: 'en',
    langName: '英语',
    items: [],
    total: 0,
    expandedId: '',
    mode: 'list', // list | review
    reviewIndex: 0,
    reviewTotal: 0,
    showAnswer: false,
    current: null,
    doneCount: 0,
    hasMore: false,
    _audio: null
  },

  // 完整错词表留在实例上，setData 只传当前片段
  _all: null,
  _pager: pager.create(30),

  onLoad() {
    const lang = storage.getCurrentLang()
    this.setData({ lang: lang, langName: getLangMeta(lang).name })
    this.refresh()
  },

  onShow() {
    this.syncTheme()
    const lang = storage.getCurrentLang()
    if (lang !== this.data.lang) {
      this.setData({ lang: lang, langName: getLangMeta(lang).name })
    }
    if (this.data.mode === 'list') this.refresh()
  },

  refresh() {
    const prog = storage.getProgress()
    const words = getWords(this.data.lang)
    const items = []
    words.forEach(function (w) {
      const p = prog[w.id]
      if (p && p.lapses > 0) {
        items.push({
          id: w.id, word: w.word, phonetic: w.phonetic,
          meaning: w.meaning, example: w.example, exampleCn: w.exampleCn,
          lapses: p.lapses, level: p.level,
          interval: INTERVALS[Math.min(p.level, INTERVALS.length - 1)]
        })
      }
    })
    items.sort(function (a, b) { return b.lapses - a.lapses })
    this._all = items
    this._pager.reset(items.length)
    this.setData({
      items: this._pager.slice(items), total: items.length,
      hasMore: this._pager.hasMore, expandedId: ''
    })
  },

  loadMore() {
    if (!this._pager.more()) return
    this.setData({ items: this._pager.slice(this._all || []), hasMore: this._pager.hasMore })
  },

  toggleDetail(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? '' : id })
  },

  playWord(e) {
    const word = e.currentTarget.dataset.word
    if (!word) return
    const lang = storage.getCurrentLang()
    if (this._audio && this._audio.destroy) this._audio.destroy()
    this._audio = audio.speak(word, false, { id: e.currentTarget.dataset.id, lang: lang === 'ja' ? 'ja_JP' : 'en_US' })
  },

  startReview() {
    if (!this.data.total) return
    this.setData({ mode: 'review', reviewIndex: 0, doneCount: 0, showAnswer: false })
    this.loadCurrent()
  },

  loadCurrent() {
    const item = this.data.items[this.data.reviewIndex]
    if (!item) { this.finishReview(); return }
    this.setData({ current: item, showAnswer: false, reviewTotal: this.data.items.length })
  },

  showAnswer() {
    this.setData({ showAnswer: true })
  },

  grade(e) {
    const q = Number(e.currentTarget.dataset.q)
    const cur = this.data.current
    if (!cur) return
    storage.review(cur.id, q)
    const next = this.data.reviewIndex + 1
    if (next >= this.data.items.length) {
      this.setData({ doneCount: this.data.items.length })
      this.finishReview()
    } else {
      this.setData({ reviewIndex: next, showAnswer: false })
      this.loadCurrent()
    }
  },

  finishReview() {
    this.setData({ mode: 'done' })
  },

  backToList() {
    this.setData({ mode: 'list', expandedId: '' }, this.refresh)
  },

  onUnload() {
    if (this._audio) {
      this._audio.destroy()
      this._audio = null
    }
  }
})
