const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const favorites = require('../../utils/favorites')
const {
  getWords, getLangMeta, getExamCategories, getWordsByCategory
} = require('../../utils/words')
const sentences = require('../../utils/sentences')
const nav = require('../../utils/nav')
const audio = require('../../utils/audio')
const aiLookup = require('../../utils/ai-lookup')

// 句子/对话台词/自建素材各显示多少条（词库那边有「加载更多」，这两栏够看就行）
const SEC_LIMIT = 20

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
    // 有关键词时顺带搜句子/对话台词（sentResults）和自己存的素材（customResults）：
    // 以前只搜词库，库里的 340 条句子和「我的素材」在搜索里根本不存在。
    sentResults: [], sentCount: 0, sentDots: '',
    customResults: [], customCount: 0,
    aiLoading: false,       // 词库查不到时用 AI 现查一次（见 utils/ai-lookup.js）
    aiResult: null,
    aiError: '',
    aiSaved: false          // 已经存进「我的素材」，按钮变灰防重复点
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

    // 句子 / 对话台词 / 我的素材：只在有关键词时搜。
    // 没有关键词时这三栏没有意义（会把整个句库铺满屏幕），词库那边本来就能按分类翻。
    const hits = kw ? this._searchExtras(lang, kw) : { sent: [], custom: [] }
    patch.sentResults = hits.sent.slice(0, SEC_LIMIT)
    patch.sentCount = hits.sent.length
    patch.sentDots = hits.sent.length > SEC_LIMIT ? '只显示前 ' + SEC_LIMIT + ' 条，输入更具体的关键词可缩小范围' : ''
    patch.customResults = hits.custom.slice(0, SEC_LIMIT)
    patch.customCount = hits.custom.length

    // 换关键词/切分类时把上一次的 AI 结果收掉，免得新查询下面还挂着旧词的释义
    if (reset !== false && (this.data.aiResult || this.data.aiError)) {
      patch.aiResult = null
      patch.aiError = ''
      patch.aiSaved = false
    }
    // 不再清 expandedId：加载更多、换关键词都不该把用户正在看的详情收起来
    this.setData(patch)
  },

  // 词库以外的两类内容：句子库（含对话台词）、自建素材
  _searchExtras(lang, kw) {
    const sent = sentences.getAllItems(lang).filter(function (it) {
      return (it.word || '').toLowerCase().indexOf(kw) >= 0 ||
        (it.meaning || '').toLowerCase().indexOf(kw) >= 0 ||
        (it.scene || '').toLowerCase().indexOf(kw) >= 0
    })
    const custom = storage.getCustomItems(lang).filter(function (it) {
      return (it.text || '').toLowerCase().indexOf(kw) >= 0 ||
        (it.cn || '').toLowerCase().indexOf(kw) >= 0 ||
        (it.scene || '').toLowerCase().indexOf(kw) >= 0
    }).map(function (it) {
      // 自建素材存的是 { text, cn }，这里归一化成和句子一样的 { word, meaning }，模板只写一套
      return { id: it.id, word: it.text, meaning: it.cn, scene: it.scene, kind: 'custom' }
    })
    return { sent: sent, custom: custom }
  },

  // 句子/自建素材的「去跟读」：把这一条单独组成队列练（口语页 mode: one）
  practiceOne(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    nav.go('/pages/speak/speak', { item: id })
  },

  // 词库里没有的词：让 Worker 现查一次（Worker 拿着 Gemini Key 去问，Key 不在客户端）。
  // 结果只显示、不写词库——机器生成的释义必须有人看过才能进素材。
  askAi() {
    const kw = (this.data.keyword || '').trim()
    if (!kw) { wx.showToast({ title: '先输入一个词', icon: 'none' }); return }
    if (!aiLookup.configured()) { wx.showToast({ title: '这一版没配 AI 查词', icon: 'none' }); return }
    const that = this
    this.setData({ aiLoading: true, aiResult: null, aiError: '', aiSaved: false })
    aiLookup.lookup(kw, this.data.lang, function (r) {
      if (!r.ok) {
        let msg = 'AI 查词失败，稍后再试'
        if (r.reason === 'offline') msg = '现在没有网络，连上网后再查'
        else if (r.reason === 'network') msg = '网络不通，稍后再试'
        else if (r.reason === 'not-configured') msg = 'AI 查词还没配好'
        else if (r.reason === 'upstream') msg = 'AI 暂时没答上来，稍后再试'
        else if (r.reason === 'rate-limited') msg = '今天的 AI 查词次数用完了，明天再来（先看看词库里有没有）'
        else if (r.reason === 'query-too-long') msg = '这个词太长了，换个短一点的'
        that.setData({ aiLoading: false, aiError: msg })
        return
      }
      if (!r.found) {
        that.setData({ aiLoading: false, aiError: 'AI 也没把握这个词，检查一下拼写' })
        return
      }
      that.setData({ aiLoading: false, aiResult: r, aiSaved: false })
    })
  },

  playAi() {
    const r = this.data.aiResult
    if (!r) return
    audio.speak(r.word || this.data.keyword, false, { lang: getLangMeta(this.data.lang).voice })
  },

  // AI 查到的东西只能看不能练，等于白查 —— 存成自建素材就能进口语页练、也能在导入页删。
  // 注意：写的是自建素材（cu_ 前缀），不是词库，所以不会污染 FSRS 的词表。
  saveAi() {
    const r = this.data.aiResult
    if (!r || !r.word) return
    if (this.data.aiSaved) { wx.showToast({ title: '已经存过啦', icon: 'none' }); return }
    const ex = (r.examples && r.examples[0]) || null
    storage.addCustomItems([{
      text: r.word,
      cn: r.meaning || '',
      scene: 'AI 查词',
      lang: this.data.lang
    }])
    if (ex && ex.text) {
      // 例句也存一条：跟读时有整句比只有单词有用得多
      storage.addCustomItems([{ text: ex.text, cn: ex.cn || '', scene: 'AI 查词', lang: this.data.lang }])
    }
    this.setData({ aiSaved: true })
    wx.showToast({ title: '已存入「我的素材」', icon: 'success' })
  },

  closeAi() {
    this.setData({ aiResult: null, aiError: '', aiSaved: false })
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
    this._player = audio.speak(word, false, {
      id: e.currentTarget.dataset.id,
      lang: getLangMeta(this.data.lang).voice
    })
  },

  onUnload() {
    if (this._debounce) { clearTimeout(this._debounce); this._debounce = null }
    if (this._player) { this._player.destroy(); this._player = null }
  }
})
