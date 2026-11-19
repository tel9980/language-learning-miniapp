const theme = require('../../utils/theme')
const nav = require('../../utils/nav')
const storage = require('../../utils/storage')
const { getWords, getLangMeta, getExamCategories } = require('../../utils/words')
const audio = require('../../utils/audio')

Page({
  behaviors: [theme],
  data: {
    mode: 'due', dueCount: 0, current: null, flipped: false,
    queueLen: 0, index: 0, langName: '英语', tts: 'en-US', totalWords: 0,
    catNames: ['全部分类'], catIndex: 0, catValue: '', catEmpty: false
  },
  onShow() {
    this.syncTheme()
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
    const cats = getExamCategories(lang)
    const catNames = ['全部分类'].concat(cats.map(c => c.name + '(' + c.count + ')'))
    this._catValues = [''].concat(cats.map(c => c.name))
    const saved = storage.getSettings().learnCat || ''
    let catIndex = this._catValues.indexOf(saved)
    if (catIndex < 0) catIndex = 0
    this.setData({
      langName: meta.name, tts: meta.tts,
      totalWords: getWords(lang).length,
      dueCount: dueWords.length,
      catNames: catNames, catIndex: catIndex, catValue: this._catValues[catIndex],
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
  },
  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode }, () => this.buildQueue())
  },
  flip() { this.setData({ flipped: !this.data.flipped }) },
  speak() {
    const w = this.data.current
    if (!w) return
    const lang = storage.getCurrentLang()
    if (this._player && this._player.destroy) this._player.destroy()
    this._player = audio.speak(w.word, false, {
      id: w.id,
      lang: lang === 'ja' ? 'ja_JP' : 'en_US',
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
    const queue = this._queue || []
    const nextIndex = this.data.index + 1
    if (nextIndex < queue.length) {
      this.setData({ index: nextIndex, current: queue[nextIndex], flipped: false })
    } else {
      wx.showToast({ title: '本轮完成！', icon: 'success' })
      setTimeout(() => this.load(), 600)
    }
  },
  onHide() { storage.flushAll() },
  onUnload() {
    // 评分是延迟落盘的，离开页面前必须冲一次，否则最后几张卡会丢
    storage.flushAll()
    if (this._player && this._player.destroy) this._player.destroy()
    this._player = null
  }
})
