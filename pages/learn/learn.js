const theme = require('../../utils/theme')
const nav = require('../../utils/nav')
const storage = require('../../utils/storage')
const { getWords, getLangMeta } = require('../../utils/words')
const audio = require('../../utils/audio')

Page({
  behaviors: [theme],
  data: {
    mode: 'due', dueCount: 0, current: null, flipped: false,
    queue: [], index: 0, langName: '英语', tts: 'en-US', totalWords: 0
  },
  onShow() {
    this.syncTheme()
    const intent = nav.takeIntent('pages/learn/learn')
    if (intent && intent.mode && intent.mode !== this.data.mode) {
      this.setData({ mode: intent.mode })
    }
    this.load()
  },
  load() {
    const lang = storage.getCurrentLang()
    const meta = getLangMeta(lang)
    const dueWords = storage.getDueWords(lang)
    this.setData({
      langName: meta.name, tts: meta.tts,
      totalWords: getWords(lang).length,
      dueCount: dueWords.length,
      queue: [], index: 0, current: null, flipped: false
    })
    this.buildQueue()
  },
  buildQueue() {
    const lang = storage.getCurrentLang()
    const words = this.data.mode === 'due'
      ? storage.getDueWords(lang)
      : storage.getNewWords(lang, 5)
    this.setData({ queue: words, index: 0, current: words[0] || null, flipped: false })
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
    const nextIndex = this.data.index + 1
    if (nextIndex < this.data.queue.length) {
      this.setData({ index: nextIndex, current: this.data.queue[nextIndex], flipped: false })
    } else {
      wx.showToast({ title: '本轮完成！', icon: 'success' })
      setTimeout(() => this.load(), 600)
    }
  }
})
