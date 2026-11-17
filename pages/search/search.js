const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const {
  getWords, getLangMeta, getExamCategories, getWordsByCategory
} = require('../../utils/words')
const audio = require('../../utils/audio')

Page({
  behaviors: [theme],
  data: {
    keyword: '',
    lang: 'en',
    langName: '英语',
    categories: ['全部'],
    catIndex: 0,
    catInfo: [],
    results: [],
    expandedId: '',
    resultCount: 0
  },

  _applyLang(lang) {
    const meta = getLangMeta(lang)
    const cats = getExamCategories(lang)
    this.setData({
      lang: lang,
      langName: meta.name,
      catInfo: cats,
      categories: ['全部'].concat(cats.map(c => `${c.name}(${c.count})`))
    })
  },

  onLoad() {
    const lang = storage.getCurrentLang()
    this._applyLang(lang)
    this.doSearch()
  },

  onShow() {
    this.syncTheme()
    const lang = storage.getCurrentLang()
    if (lang !== this.data.lang) {
      this._applyLang(lang)
      this.setData({ catIndex: 0 })
      this.doSearch()
    }
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value }, this.doSearch)
  },

  clearKeyword() {
    this.setData({ keyword: '' }, this.doSearch)
  },

  onCatChange(e) {
    this.setData({ catIndex: Number(e.detail.value) }, this.doSearch)
  },

  doSearch() {
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const catInfo = this.data.catInfo[this.data.catIndex - 1]
    const cat = catInfo ? catInfo.name : ''
    const words = getWordsByCategory(this.data.lang, cat)
    const list = words.filter(function (w) {
      if (!kw) return true
      return (w.word || '').toLowerCase().indexOf(kw) >= 0 ||
        (w.meaning || '').toLowerCase().indexOf(kw) >= 0 ||
        (w.example || '').toLowerCase().indexOf(kw) >= 0
    })
    this.setData({ results: list, resultCount: list.length, expandedId: '' })
  },

  toggleDetail(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? '' : id })
  },

  playWord(e) {
    const word = e.currentTarget.dataset.word
    if (!word) return
    if (this._player) this._player.destroy()
    this._player = audio.speak(word, false, {})
  },

  onUnload() {
    if (this._player) { this._player.destroy(); this._player = null }
  }
})
