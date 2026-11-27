const theme = require('../../utils/theme')
const nav = require('../../utils/nav')
const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const profile = require('../../utils/profile')
const family = require('../../utils/family')
const { getLangMeta, LANG_KEYS } = require('../../utils/lang')
const modePicker = require('../../utils/mode-picker')

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
  // 首页直接改当前档案的显示模式（儿童模式找不到入口，就因为它只在「家人档案」里）
  openMode() {
    const that = this
    modePicker.pick(function () {
      that.syncTheme()
      that.refresh()
    })
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
    const langs = LANG_KEYS
    const cur = this.data.lang
    const next = langs[(langs.indexOf(cur) + 1) % langs.length]
    storage.setLang(next)
    wx.showToast({ title: '已切换到 ' + getLangMeta(next).name, icon: 'none' })
    this.refresh()
  },
  // 首页也能转发：带上打卡天数，比干巴巴的「一个学外语的小程序」更容易被点开
  onShareAppMessage() {
    const st = storage.getStats() || {}
    const mastered = storage.getMasteredCount(storage.getCurrentLang())
    const title = (st.streak || mastered)
      ? '我在「语伴」连续打卡 ' + (st.streak || 0) + ' 天，掌握了 ' + mastered + ' 个词，一起来练英语口语吧'
      : '来和我一起练英语口语｜语伴'
    return { title: title, path: '/pages/index/index' }
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
