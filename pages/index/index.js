const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const { getLangMeta } = require('../../utils/words')

const app = getApp()

Page({
  data: {
    stats: {}, today: {}, mastered: 0, dueCount: 0,
    lang: 'en', langName: '英语', langFlag: '🇬🇧',
    dailyGoal: 20, goalPercent: 0, goalTip: '',
    speakCount: 0, focusCount: 0
  },
  onShow() {
    storage.init()
    this.refresh()
  },
  refresh() {
    const lang = storage.getCurrentLang()
    const meta = getLangMeta(lang)
    const stats = storage.getStats()
    const today = storage.getToday()
    const dueCount = storage.getDueWords(lang).length
    const mastered = storage.getMasteredCount(lang)
    const dailyGoal = storage.getSettings().dailyGoal || 20
    const goalPercent = Math.min(100, Math.round(today.reviewed / dailyGoal * 100))
    const goalTip = goalPercent >= 100 ? '🎉 今日目标已达成，太棒了！' : `再复习 ${Math.max(0, dailyGoal - today.reviewed)} 个就完成今日目标啦`
    const speakCount = speaking.getToday().count
    const focusCount = speaking.getFocusWords(lang).length
    app.globalData.lang = lang
    this.setData({ stats, today, dueCount, mastered, lang, langName: meta.name, langFlag: meta.flag, dailyGoal, goalPercent, goalTip, speakCount, focusCount })
  },
  switchLang() {
    const langs = ['en', 'ja']
    const cur = this.data.lang
    const next = langs[(langs.indexOf(cur) + 1) % langs.length]
    storage.setLang(next)
    wx.showToast({ title: '已切换到 ' + getLangMeta(next).name, icon: 'none' })
    this.refresh()
  },
  goSpeak() { wx.navigateTo({ url: '/pages/speak/speak' }) },
  goLearn() { wx.navigateTo({ url: '/pages/learn/learn' }) },
  goQuiz()  { wx.navigateTo({ url: '/pages/quiz/quiz' }) },
  goStats() { wx.navigateTo({ url: '/pages/stats/stats' }) },
  goSearch() { wx.navigateTo({ url: '/pages/search/search' }) },
  goWrong() { wx.navigateTo({ url: '/pages/wrong/wrong' }) },
  goRecordings() { wx.navigateTo({ url: '/pages/recordings/recordings' }) }
})
