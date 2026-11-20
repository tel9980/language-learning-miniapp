const theme = require('../../utils/theme')
const nav = require('../../utils/nav')
const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const profile = require('../../utils/profile')
const family = require('../../utils/family')
const { getLangMeta } = require('../../utils/lang')

const app = getApp()

Page({
  behaviors: [theme],
  data: {
    stats: {}, today: {}, mastered: 0, dueCount: 0,
    lang: 'en', langName: '英语', langFlag: '🇬🇧',
    dailyGoal: 20, goalPercent: 0, goalTip: '',
    speakCount: 0, focusCount: 0, unreadComments: 0,
    myName: '我', myAvatar: '😀', modeName: '标准'
  },
  onShow() {
    this.syncTheme()
    storage.init()
    this.refresh()
  },
  refresh() {
    const p = profile.currentProfile() || { name: '我', avatar: '😀', mode: 'normal' }
    const modeNames = { normal: '标准', kid: '儿童', elder: '长辈' }
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
    this.setData({ stats, today, dueCount, mastered, lang, langName: meta.name, langFlag: meta.flag, dailyGoal, goalPercent, goalTip, speakCount, focusCount, unreadComments: family.unreadComments(), myName: p.name, myAvatar: p.avatar, modeName: modeNames[p.mode] || '标准' })
  },
  switchLang() {
    const langs = ['en', 'ja']
    const cur = this.data.lang
    const next = langs[(langs.indexOf(cur) + 1) % langs.length]
    storage.setLang(next)
    wx.showToast({ title: '已切换到 ' + getLangMeta(next).name, icon: 'none' })
    this.refresh()
  },
  goSpeak() { nav.go('/pages/speak/speak') },
  goToday() { nav.go('/pages/today/today') },
  goLearn() { nav.go('/pages/learn/learn') },
  goQuiz()  { nav.go('/pages/quiz/quiz') },
  goDictation() { nav.go('/pages/dictation/dictation') },
  goStats() { nav.go('/pages/stats/stats') },
  goSearch() { nav.go('/pages/search/search') },
  goWrong() { nav.go('/pages/wrong/wrong') },
  goRecordings() { nav.go('/pages/recordings/recordings') },
  goProfiles() { nav.go('/pages/profiles/profiles') },
  goFamily() { nav.go('/pages/family/family') },
  goFamilyRecordings() { nav.go('/pages/family-recordings/family-recordings') },
  goShare() { nav.go('/pages/share/share') },
  goReminder() { nav.go('/pages/reminder/reminder') }
})
