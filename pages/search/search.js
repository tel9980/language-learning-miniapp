const storage = require('../../utils/storage')
const { getWords, getLangMeta } = require('../../utils/words')

Page({
  data: {
    keyword: '',
    lang: 'en',
    langName: '英语',
    categories: ['全部'],
    catIndex: 0,
    results: [],
    expandedId: '',
    resultCount: 0
  },

  onLoad() {
    const lang = storage.getCurrentLang()
    const meta = getLangMeta(lang)
    const words = getWords(lang)
    const catSet = []
    words.forEach(function (w) {
      if (catSet.indexOf(w.category) < 0) catSet.push(w.category)
    })
    this.setData({
      lang: lang,
      langName: meta.name,
      categories: ['全部'].concat(catSet),
      resultCount: words.length
    })
    this._audio = null
    this.doSearch()
  },

  onShow() {
    // 语种可能在首页切换过，进来时同步
    const lang = storage.getCurrentLang()
    if (lang !== this.data.lang) {
      const meta = getLangMeta(lang)
      const words = getWords(lang)
      const catSet = []
      words.forEach(function (w) {
        if (catSet.indexOf(w.category) < 0) catSet.push(w.category)
      })
      this.setData({
        lang: lang,
        langName: meta.name,
        categories: ['全部'].concat(catSet)
      })
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
    const cat = this.data.categories[this.data.catIndex]
    const words = getWords(this.data.lang)
    const list = words.filter(function (w) {
      const catOk = !cat || cat === '全部' || w.category === cat
      if (!catOk) return false
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
    const url = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(word) + '&type=2'
    if (!this._audio) this._audio = wx.createInnerAudioContext()
    this._audio.src = url
    this._audio.play()
  },

  onUnload() {
    if (this._audio) {
      this._audio.destroy()
      this._audio = null
    }
  }
})
