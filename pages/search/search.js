const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const favorites = require('../../utils/favorites')
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
    resultCount: 0,
    showMode: 'all', // all | fav
    historyList: [],
    favIds: []
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
    this.refreshMeta()
    this.doSearch()
  },

  onShow() {
    this.syncTheme()
    const lang = storage.getCurrentLang()
    if (lang !== this.data.lang) {
      this._applyLang(lang)
      this.setData({ catIndex: 0 })
    }
    this.refreshMeta()
    this.doSearch()
  },

  refreshMeta() {
    this.setData({
      historyList: favorites.history(this.data.lang),
      favIds: favorites.list(this.data.lang)
    })
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

  setMode(e) {
    this.setData({ showMode: e.currentTarget.dataset.mode }, this.doSearch)
  },

  searchHistory(e) {
    this.setData({ keyword: e.currentTarget.dataset.kw }, this.doSearch)
  },

  clearHistory() {
    favorites.clearHistory(this.data.lang)
    this.refreshMeta()
    wx.showToast({ title: '已清空历史', icon: 'none' })
  },

  toggleFav(e) {
    const id = e.currentTarget.dataset.id
    favorites.toggle(this.data.lang, id)
    this.refreshMeta()
    this.doSearch()
  },

  doSearch() {
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const lang = this.data.lang
    const catInfo = this.data.catInfo[this.data.catIndex - 1]
    const cat = catInfo ? catInfo.name : ''
    let words = getWordsByCategory(lang, cat)
    // 只看收藏
    if (this.data.showMode === 'fav') {
      const favs = favorites.list(lang)
      words = words.filter(w => favs.indexOf(w.id) >= 0)
    }
    const list = words.filter(function (w) {
      if (!kw) return true
      return (w.word || '').toLowerCase().indexOf(kw) >= 0 ||
        (w.meaning || '').toLowerCase().indexOf(kw) >= 0 ||
        (w.example || '').toLowerCase().indexOf(kw) >= 0
    })
    // 有关键词时记入历史
    if (kw) {
      favorites.pushHistory(lang, this.data.keyword.trim())
      this.setData({ historyList: favorites.history(lang) })
    }
    this.setData({ results: list, resultCount: list.length, expandedId: '', favIds: favorites.list(lang) })
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
