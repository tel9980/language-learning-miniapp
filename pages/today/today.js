// 今日待练：把 FSRS 到期词、口语重点项、错词本合成一个清单，每天打开就知道练什么。
const theme = require('../../utils/theme')
const nav = require('../../utils/nav')
const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const { getWords, getLangMeta } = require('../../utils/words')
const audio = require('../../utils/audio')
const pager = require('../../utils/pager')
const sentenceProgress = require('../../utils/sentence-progress')
// 儿童模式：待练清单要按适龄分类过滤（b78fd89 漏了这一行，导致整页 ReferenceError）
const kidMode = require('../../utils/kid-mode')

Page({
  behaviors: [theme],
  data: {
    lang: 'en', langName: '英语',
    items: [], total: 0,
    dueCount: 0, focusCount: 0, wrongCount: 0, sentDueCount: 0,
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
    // 儿童模式：待练清单也只放适龄的词，别把考试词推给孩子
    const words = kidMode.allowedWords(getWords(lang), kidMode.isKidOf(this))
    const prog = storage.getProgress()
    const now = Date.now()
    const items = []

    // 1) FSRS 到期词（学过且 dueAt<=now）
    let dueCount = 0
    words.forEach(function (w) {
      const p = prog[w.id]
      if (p && p.dueAt <= now) {
        dueCount++
        items.push({ id: w.id, say: w.word, sayId: w.id, label: w.word, sub: w.meaning, type: 'due', typeName: '复习', target: '/pages/learn/learn?mode=due' })
      }
    })

    // 2) 句子到期复习（句子/台词有自己的调度表，见 utils/sentence-progress.js）
    //    只把「练过且到点」的句子放进来，没练过的句子不刷屏；
    //    清单里最多 10 条，超出的补一条「还有 N 条」，点进去按整队列练完
    //    （以前超出的部分直接在界面上消失，用户不知道还有多少没复习）。
    const sentItems = sentences.getAllItems(lang)
    const sentProg = sentenceProgress.all()
    const sentDue = []
    sentItems.forEach(function (it) {
      const p = sentProg[it.id]
      if (p && p.dueAt && p.dueAt <= now) sentDue.push({ item: it, p: p })
    })
    const sentDueCount = sentDue.length
    sentDue.slice(0, 10).forEach(function (x) {
      const it = x.item
      items.push({
        id: 's_' + it.id, say: it.word, sayId: it.id, label: it.word,
        sub: '句子复习' + (x.p.lapses > 0 ? ' · 错过 ' + x.p.lapses + ' 次' : ''),
        type: 'sent', typeName: '句子', target: 'due'
      })
    })
    if (sentDue.length > 10) {
      items.push({
        id: 's_more', say: '', sayId: '', label: '还有 ' + (sentDue.length - 10) + ' 条到期句子',
        sub: '点这里按顺序练完', type: 'sentmore', typeName: '句子', target: 'due'
      })
    }

    // 3) 口语重点项（词 + 句 + 对话台词）
    const allItems = words.concat(sentItems)
    const focusItems = speaking.getFocusItems(allItems)
    focusItems.forEach(function (it) {
      items.push({ id: 'f_' + it.id, say: it.word, sayId: it.id, label: it.word, sub: '重点复练 ×' + it.focusCount, type: 'focus', typeName: '口语', target: '/pages/speak/speak?focus=1' })
    })

    // 4) 错词本（lapses>0）
    let wrongCount = 0
    words.forEach(function (w) {
      const p = prog[w.id]
      if (p && p.lapses > 0) {
        wrongCount++
        items.push({ id: 'w_' + w.id, say: w.word, sayId: w.id, label: w.word, sub: '答错 ' + p.lapses + ' 次', type: 'wrong', typeName: '错词', target: '/pages/wrong/wrong' })
      }
    })

    this._all = items
    this._pager.reset(items.length)
    this.setData({
      items: this._pager.slice(items), total: items.length, hasMore: this._pager.hasMore,
      dueCount: dueCount, focusCount: focusItems.length, wrongCount: wrongCount,
      sentDueCount: sentDueCount,
      allDone: items.length === 0
    })
  },

  // 清单里直接听一条：以前看到想听的内容必须跳去对应练习页才能听。
  // 带上素材 id 是为了让日语素材走随包离线音频（0 请求、断网可用）。
  playItem(e) {
    const ds = e.currentTarget.dataset
    const text = ds.text
    if (!text || !String(text).trim()) return
    this.stopPlay()
    this._player = audio.speak(text, false, {
      id: ds.id,
      lang: getLangMeta(this.data.lang).voice,
      onError() { wx.showToast({ title: '这句暂时读不出来，点一下再试', icon: 'none' }) }
    })
  },
  stopPlay() {
    if (this._player) { try { this._player.destroy() } catch (e) {} this._player = null }
  },
  onHide() { this.stopPlay() },
  onUnload() { this.stopPlay() },

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
    if (type === 'sent' || type === 'sentmore') return this.goSpeakDue()
    nav.go('/pages/wrong/wrong')
  },
  goLearn() { nav.go('/pages/learn/learn', { mode: 'due' }) },
  goSpeak() { nav.go('/pages/speak/speak', { focus: 1 }) },
  goSpeakDue() { nav.go('/pages/speak/speak', { due: 1 }) },
  goWrong() { nav.go('/pages/wrong/wrong') }
})
