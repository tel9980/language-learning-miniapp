const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const { getWords } = require('../../utils/words')
const sentences = require('../../utils/sentences')
const sentenceProgress = require('../../utils/sentence-progress')
const { getLangMeta } = require('../../utils/lang')
const quiz = require('../../utils/quiz')
const dictation = require('../../utils/dictation')
const audio = require('../../utils/audio')

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

  onLoad() { this.build() },
  onShow() { this.syncTheme() },
  onHide() { this.stopAudio(); storage.flushAll() },
  onUnload() { this.stopAudio(); storage.flushAll() },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.mode) return
    this.stopAudio()
    this.setData({ mode }, () => this.build())
  },

  build() {
    const lang = storage.getCurrentLang()
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
      const all = getWords(lang)
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
    if (queue[0]) setTimeout(() => this.play(), 300)
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
    }
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
  }
})
