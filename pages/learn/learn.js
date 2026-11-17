const storage = require('../../utils/storage')
const { getWords, getLangMeta } = require('../../utils/words')

Page({
  data: {
    mode: 'due', dueCount: 0, current: null, flipped: false,
    queue: [], index: 0, langName: '英语', tts: 'en-US', totalWords: 0
  },
  onShow() { this.load() },
  load() {
    const lang = storage.getCurrentLang()
    const meta = getLangMeta(lang)
    const dueWords = storage.getDueWords(lang)
    this.setData({
      langName: meta.name, tts: meta.tts,
      totalWords: getWords(lang).length,
      dueCount: dueWords.length,
      queue: [], index: 0, current: null, flipped: false
    })
    this.buildQueue()
  },
  buildQueue() {
    const lang = storage.getCurrentLang()
    const words = this.data.mode === 'due'
      ? storage.getDueWords(lang)
      : storage.getNewWords(lang, 5)
    this.setData({ queue: words, index: 0, current: words[0] || null, flipped: false })
  },
  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode }, () => this.buildQueue())
  },
  flip() { this.setData({ flipped: !this.data.flipped }) },
  speak() {
    const w = this.data.current
    if (!w) return
    // 微信同声传译/朗读取词插件未启用时，用 web-api 兜底不可行，这里用内置 TTS 能力提示
    // 真机发音依赖「微信同声传译」插件；无插件时给出引导
    if (wx.createInnerAudioContext) {
      // 使用有道词典外链朗读（公开 TTS 接口），无需插件
      const url = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(w.word) + '&type=2'
      const audio = wx.createInnerAudioContext()
      audio.src = url
      audio.play()
      audio.onError(() => {
        wx.showToast({ title: '朗读需联网或配置同声传译插件', icon: 'none' })
      })
    }
  },
  rate(e) {
    const q = Number(e.currentTarget.dataset.q)
    const w = this.data.current
    if (!w) return
    storage.review(w.id, q)
    const nextIndex = this.data.index + 1
    if (nextIndex < this.data.queue.length) {
      this.setData({ index: nextIndex, current: this.data.queue[nextIndex], flipped: false })
    } else {
      wx.showToast({ title: '本轮完成！', icon: 'success' })
      setTimeout(() => this.load(), 600)
    }
  }
})
