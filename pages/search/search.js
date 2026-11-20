const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const favorites = require('../../utils/favorites')
const {
  getWords, getLangMeta, getExamCategories, getWordsByCategory
} = require('../../utils/words')
const audio = require('../../utils/audio')
const aiLookup = require('../../utils/ai-lookup')

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
    favIds: [],
    visibleCount: 30,       // 增量渲染：先显示 30 条，下滑加载更多
    hasMore: false,
    aiLoading: false,       // 词库查不到时用 AI 现查一次（见 utils/ai-lookup.js）
    aiResult: null,
    aiError: ''
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
    // 不在这里 doSearch：首次进入 onLoad 之后紧接着就会 onShow（里面会搜），
    // 两处都搜等于白做一次 30 条结果的渲染。
  },

  onShow() {
    this.syncTheme()
    const lang = storage.getCurrentLang()
    if (lang !== this.data.lang) {
      this._applyLang(lang)
      this.setData({ catIndex: 0 })
    }
    this.refreshMeta()
    this.doSearch(true)
  },

  refreshMeta() {
    this.setData({
      historyList: favorites.history(this.data.lang),
      favIds: favorites.list(this.data.lang)
    })
  },

  // 输入防抖：以前每按一个键就全量 filter + setData 30 条结果（4.7KB），
  // 打一个 6 字母的词就是 6 次完整列表渲染，低端机上打字会掉帧。
  onInput(e) {
    this.setData({ keyword: e.detail.value })
    this.searchSoon()
  },

  searchSoon() {
    const that = this
    if (this._debounce) clearTimeout(this._debounce)
    this._debounce = setTimeout(function () {
      that._debounce = null
      that.doSearch(true)
    }, 200)
  },

  // 按搜索键才记历史，而不是每敲一个字都写 Storage
  onConfirm() {
    if (this._debounce) { clearTimeout(this._debounce); this._debounce = null }
    const kw = (this.data.keyword || '').trim()
    if (kw) {
      favorites.pushHistory(this.data.lang, kw)
      this.setData({ historyList: favorites.history(this.data.lang) })
    }
    this.doSearch(true)
  },

  clearKeyword() {
    this.setData({ keyword: '' }, () => this.doSearch(true))
  },

  onCatChange(e) {
    this.setData({ catIndex: Number(e.detail.value) }, () => this.doSearch(true))
  },

  setMode(e) {
    this.setData({ showMode: e.currentTarget.dataset.mode }, () => this.doSearch(true))
  },

  searchHistory(e) {
    this.setData({ keyword: e.currentTarget.dataset.kw }, () => this.doSearch(true))
  },

  clearHistory() {
    favorites.clearHistory(this.data.lang)
    this.refreshMeta()
    wx.showToast({ title: '已清空历史', icon: 'none' })
  },

  toggleFav(e) {
    const id = e.currentTarget.dataset.id
    favorites.toggle(this.data.lang, id)
    // 「只看收藏」模式下取消收藏必须重建列表（这条要消失）；
    // 其他模式下只更新星星状态——原来无条件 doSearch(true) 会把已加载的条数
    // 缩回 30、把展开的详情收起，收藏一个词像是把页面刷新了一遍。
    if (this.data.showMode === 'fav') { this.doSearch(true); return }
    this.setData({ favIds: favorites.list(this.data.lang) })
  },

  // reset=true 表示新查询（从头显示 30 条）；false 表示加载更多
  doSearch(reset) {
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
    const count = reset === false ? this.data.visibleCount : 30
    const shown = list.slice(0, count)
    const patch = {
      results: shown, resultCount: list.length,
      favIds: favorites.list(lang),
      visibleCount: count, hasMore: list.length > count
    }
    // 换关键词/切分类时把上一次的 AI 结果收掉，免得新查询下面还挂着旧词的释义
    if (reset !== false && (this.data.aiResult || this.data.aiError)) {
      patch.aiResult = null
      patch.aiError = ''
    }
    // 不再清 expandedId：加载更多、换关键词都不该把用户正在看的详情收起来
    this.setData(patch)
  },

  // 词库里没有的词：让 Worker 现查一次（Worker 拿着 Gemini Key 去问，Key 不在客户端）。
  // 结果只显示、不写词库——机器生成的释义必须有人看过才能进素材。
  askAi() {
    const kw = (this.data.keyword || '').trim()
    if (!kw) { wx.showToast({ title: '先输入一个词', icon: 'none' }); return }
    if (!aiLookup.configured()) { wx.showToast({ title: '这一版没配 AI 查词', icon: 'none' }); return }
    const that = this
    this.setData({ aiLoading: true, aiResult: null, aiError: '' })
    aiLookup.lookup(kw, this.data.lang, function (r) {
      if (!r.ok) {
        let msg = 'AI 查词失败，稍后再试'
        if (r.reason === 'network') msg = '网络不通，稍后再试'
        else if (r.reason === 'not-configured') msg = 'AI 查词还没配好'
        else if (r.reason === 'upstream') msg = 'AI 暂时没答上来，稍后再试'
        that.setData({ aiLoading: false, aiError: msg })
        return
      }
      if (!r.found) {
        that.setData({ aiLoading: false, aiError: 'AI 也没把握这个词，检查一下拼写' })
        return
      }
      that.setData({ aiLoading: false, aiResult: r })
    })
  },

  playAi() {
    const r = this.data.aiResult
    if (!r) return
    audio.speak(r.word || this.data.keyword, false, { lang: getLangMeta(this.data.lang).voice })
  },

  closeAi() {
    this.setData({ aiResult: null, aiError: '' })
  },

  loadMore() {
    if (!this.data.hasMore) return
    this.setData({ visibleCount: this.data.visibleCount + 30 }, () => this.doSearch(false))
  },

  toggleDetail(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? '' : id })
  },

  playWord(e) {
    const word = e.currentTarget.dataset.word
    if (!word) return
    if (this._player) this._player.destroy()
    this._player = audio.speak(word, false, { id: e.currentTarget.dataset.id })
  },

  onUnload() {
    if (this._debounce) { clearTimeout(this._debounce); this._debounce = null }
    if (this._player) { this._player.destroy(); this._player = null }
  }
})
