const theme = require('../../utils/theme')
const shareCopy = require('../../utils/share-copy')
const storage = require('../../utils/storage')
const { getWords } = require('../../utils/words')
const kidMode = require('../../utils/kid-mode')
const sentences = require('../../utils/sentences')
const sentenceProgress = require('../../utils/sentence-progress')
const { getLangMeta } = require('../../utils/lang')
const quiz = require('../../utils/quiz')
const dictation = require('../../utils/dictation')
const audio = require('../../utils/audio')
const practiceTimer = require('../../utils/practice-timer')
const pageTimers = require('../../utils/page-timers')
const screen = require('../../utils/screen')
const badges = require('../../utils/badges')

const ROUND = 10

Page({
  behaviors: [theme],
  data: {
    mode: 'word',              // word | sent | dlg
    queue: [], index: 0, total: 0, current: null,
    input: '', revealed: false, isRight: false,
    correctCount: 0, wrongCount: 0, finished: false, accuracy: 0, progress: 0,
    playing: false, hasAnswer: false
  },

  onLoad() {
    // ⚠️ 必须先 syncTheme 再 build。isKid 是 theme behavior 在 syncTheme 里写进 data 的，
    // 而微信的生命周期是 onLoad → onShow——原先 onLoad 里直接 build()，
    // 那一刻 isKid 还是 behavior 的默认 false，儿童模式的分类过滤等于没生效，
    // 孩子第一次进听写照样抽到四级/考研词（切模式后才对，因为 switchMode 里 build 在 onShow 之后）。
    this.syncTheme()
    this.build()
  },
  onShow() {
    this.syncTheme()
    // 语种变了要重出一轮（第十二轮）：以前 onShow 什么都不判断，
    // 听写到一半切到日语，回来还在听写英语。
    // 顺带把儿童模式的变化也覆盖了（onLoad 里已经先 syncTheme 再 build，
    // 但那是首次；这里处理「中途切模式」）。
    // build() 会把这一轮的语种/模式记进 _builtLang/_builtKid
    const lang = storage.getCurrentLang()
    const kid = !!this.data.isKid
    if (this._builtLang && (this._builtLang !== lang || this._builtKid !== kid)) this.build()
    practiceTimer.start(kid)
    // 屏幕常亮（第十一轮）：听写要思考，手也不动，息屏就白想
    screen.on()
  },
  onHide() { pageTimers.clear(this); screen.off(); this.stopAudio(); practiceTimer.stop(); storage.flushAll() },
  onUnload() { pageTimers.clear(this); screen.off(); this.stopAudio(); practiceTimer.stop(); storage.flushAll() },
  // 定时器登记（第十一轮）：进页 300ms 后自动播第一题，跳页时得清掉
  later(fn, ms) { return pageTimers.later(this, fn, ms) },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.mode) return
    this.stopAudio()
    this.setData({ mode }, () => this.build())
  },

  build() {
    const lang = storage.getCurrentLang()
    // 记下这一轮是按哪个语种 / 哪种模式出的，onShow 靠它判断要不要重出
    this._builtLang = lang
    this._builtKid = !!this.data.isKid
    const now = Date.now()
    let queue = []
    if (this.data.mode === 'dlg') {
      // 整段对话逐句听写：把一组对话的台词按顺序排成队列，最多 ROUND 句
      const ds = sentences.getDialogues(lang)
      const start = ds.length ? (this._dlgCursor || 0) % ds.length : 0
      this._dlgCursor = start + 1
      for (let i = 0; i < ds.length && queue.length < ROUND; i++) {
        const d = ds[(start + i) % ds.length]
        d.lines.forEach(function (l) {
          if (queue.length >= ROUND) return
          queue.push({
            id: 'dl_' + l.id, word: l.text, meaning: l.cn, kind: 'dialogue',
            example: l.text, role: l.role || '', scene: d.scene || ''
          })
        })
      }
    } else if (this.data.mode === 'sent') {
      const all = sentences.getAllItems(lang)
      const prog = sentenceProgress.all()
      queue = quiz.pickSentences(all, prog, now, ROUND).map(function (it) {
        return { id: it.id, word: it.word, meaning: it.meaning, kind: 'sentence', example: it.word }
      })
    } else {
      // 儿童模式只从适龄分类出题（不然会听写「财务」「考研」的词）
      const all = kidMode.allowedWords(getWords(lang), kidMode.isKidOf(this))
      const prog = storage.getProgress()
      queue = quiz.pickWords(all, prog, now, ROUND).map(function (w) {
        return { id: w.id, word: w.word, meaning: w.meaning, kind: 'word', example: w.example }
      })
    }
    this.setData({
      queue, index: 0, total: queue.length, current: queue[0] || null,
      input: '', revealed: false, isRight: false, hasAnswer: false,
      correctCount: 0, wrongCount: 0, finished: false, accuracy: 0,
      progress: 0, playing: false
    })
    // 进来直接放第一题的音频，少点一次
    if (queue[0]) this.later(() => this.play(), 300)
  },

  play() {
    const cur = this.data.current
    if (!cur) return
    const that = this
    this.stopAudio()
    this._player = audio.speak(cur.word, false, {
      id: cur.id,
      lang: getLangMeta(storage.getCurrentLang()).voice,
      onLoading(on) { that.setData({ playing: !!on }) },
      onStop() { that.setData({ playing: false }) },
      onError() {
        that.setData({ playing: false })
        wx.showToast({ title: '这句暂时读不出来，点一下再试', icon: 'none' })
      }
    })
  },

  stopAudio() {
    if (this._player) {
      try { this._player.stop() } catch (e) {}
      this._player = null
    }
  },

  onInput(e) { this.setData({ input: e.detail.value }) },

  submit() {
    if (this.data.revealed) return
    const val = String(this.data.input || '').trim()
    if (!val) return
    const cur = this.data.current
    const right = dictation.isAnswerRight(val, cur.word)
    this.record(right)
  },

  showAnswer() {
    if (this.data.revealed) return
    this.record(false, true)
  },

  record(right, gaveUp) {
    const cur = this.data.current
    if (!cur) return
    // 写出答案就算复习过：单词进 FSRS，句子进句子调度表（同一套口径，见 README）
    if (cur.kind === 'sentence' || cur.kind === 'dialogue') {
      sentenceProgress.review(cur.id, right ? 5 : 0, 'dictation')
    } else {
      storage.review(cur.id, right ? 2 : 0)
      // 同上：听写答对也算「真的记住了」，销掉一格错词标记
      if (right) storage.clearLapse(cur.id)
    }
    // 徽章解锁提示（第十二轮）：以前只有统计页会算，解锁了当时看不到
    badges.check()
    this.setData({
      revealed: true, isRight: right,
      hasAnswer: gaveUp && !right,
      correctCount: this.data.correctCount + (right ? 1 : 0),
      wrongCount: this.data.wrongCount + (right ? 0 : 1),
      progress: Math.round(((this.data.index + 1) / Math.max(1, this.data.total)) * 100)
    })
  },

  next() {
    const i = this.data.index + 1
    if (i < this.data.total) {
      const nxt = this.data.queue[i + 1]
      if (nxt && nxt.id) audio.prefetch(nxt.id)
      this.setData({ index: i, current: this.data.queue[i], input: '', revealed: false, isRight: false, hasAnswer: false }, () => this.play())
      return
    }
    const done = this.data.correctCount + this.data.wrongCount
    this.setData({ finished: true, accuracy: done ? Math.round((this.data.correctCount / done) * 100) : 0, playing: false })
  },

  restart() {
    this.stopAudio()
    this.build()
  },

  goLearn() {
    wx.switchTab({ url: '/pages/learn/learn' })
  },
  onShareAppMessage() {
    const st = storage.getStats() || {}
    const lang = storage.getCurrentLang()
    return { title: shareCopy.title({ lang: lang, streak: st.streak, mastered: storage.getMasteredCount(lang) }), path: '/pages/dictation/dictation' }
  },
})
