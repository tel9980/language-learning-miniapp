// 今日待练：把 FSRS 到期词、口语重点项、错词本合成一个清单，每天打开就知道练什么。
const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const { getWords, getLangMeta } = require('../../utils/words')

Page({
  behaviors: [theme],
  data: {
    lang: 'en', langName: '英语',
    items: [], total: 0,
    dueCount: 0, focusCount: 0, wrongCount: 0,
    allDone: false
  },

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

    this.setData({
      items: items, total: items.length,
      dueCount: dueCount, focusCount: focusItems.length, wrongCount: wrongCount,
      allDone: items.length === 0
    })
  },

  // 点单项跳到对应练习页
  goItem(e) {
    const url = e.currentTarget.dataset.target
    if (url) wx.navigateTo({ url: url })
  },
  goLearn() { wx.navigateTo({ url: '/pages/learn/learn?mode=due' }) },
  goSpeak() { wx.navigateTo({ url: '/pages/speak/speak?focus=1' }) },
  goWrong() { wx.navigateTo({ url: '/pages/wrong/wrong' }) }
})
