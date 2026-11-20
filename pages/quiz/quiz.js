const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const { getWords } = require('../../utils/words')
const quiz = require('../../utils/quiz')
const sentences = require('../../utils/sentences')
const sentenceProgress = require('../../utils/sentence-progress')

Page({
  behaviors: [theme],
  data: {
    queue: [], index: 0, total: 10, current: null,
    selected: '', spellInput: '', revealed: false, isRight: false,
    correctCount: 0, wrongCount: 0, finished: false, accuracy: 0,
    progress: 0, indexLetters: ['A', 'B', 'C', 'D'], learnedCount: 0
  },
  onShow() {
    this.syncTheme()
    // 做了一半就接着做：以前每次 onShow 都 buildQuiz() 重新随机 10 题，
    // 做完 9 题切去查词页再回来，题目全换成新的，等于白做。
    if (this.data.queue.length && !this.data.finished) return
    this.buildQuiz()
  },
  onHide() { storage.flushAll() },
  onUnload() { storage.flushAll() },
  buildQuiz() {
    const lang = storage.getCurrentLang()
    const all = getWords(lang)
    const prog = storage.getProgress()
    const now = Date.now()
    // 句子题占 3 题（有句子素材时才出），其余是单词题：
    // 以前测验只考单词，练过的句子永远不会被考。
    const sentAll = sentences.getAllItems(lang)
    const sentProg = sentenceProgress.all()
    const SENT_Q = sentAll.length >= 4 ? 3 : 0
    const pickedSent = SENT_Q ? quiz.pickSentences(sentAll, sentProg, now, SENT_Q) : []
    const sentQueue = quiz.buildSentenceItems(pickedSent, sentAll, sentProg)
    // 优先考「今天到期的词」，其次学过没到期的，最后才是没学过的新词
    // （组题规则在 utils/quiz.js，有单元测试兜着）
    const picked = quiz.pickWords(all, prog, now, 10 - sentQueue.length)
    // 句子题混在单词题中间，别让它们全堆在开头或结尾
    const queue = quiz.shuffle(quiz.buildItems(picked, all, prog).concat(sentQueue))
    // 结果页要用：这组题里有多少是「学过的内容」（答完会写回复习计划）
    const learnedCount = queue.filter(q => q.learned).length
    this.setData({
      queue, total: queue.length, index: 0, current: queue[0] || null,
      selected: '', spellInput: '', revealed: false, isRight: false,
      correctCount: 0, wrongCount: 0, finished: false, accuracy: 0, progress: 0,
      learnedCount
    })
  },
  choose(e) {
    if (this.data.revealed) return
    this.setData({ selected: e.currentTarget.dataset.val })
  },
  onSpellInput(e) { this.setData({ spellInput: e.detail.value }) },
  submitChoice() {
    if (this.data.revealed || !this.data.selected) return
    const right = this.data.selected === this.data.current.answer
    this.record(right)
  },
  submitSpell() {
    if (this.data.revealed) return
    const val = (this.data.spellInput || '').trim().toLowerCase()
    if (!val) return
    const right = val === this.data.current.answer.toLowerCase()
    this.record(right)
  },
  record(right) {
    // 学过的词：写回复习计划（改到期时间、记错词本 lapses、累计统计），
    // 以前只调 quizAnswer() 加了个总计数器 —— 答错 10 个词，错词本一条都不会多。
    // 没学过的词只记总统计，不替「学新词」把它标成已学，否则今日待练会少一块。
    const cur = this.data.current
    if (cur && cur.kind === 'sentence') {
      // 句子写进句子调度表（utils/sentence-progress.js），不进单词的 FSRS 表
      if (cur.learned) sentenceProgress.review(cur.id, right ? 5 : 0, 'quiz')
    } else if (cur && cur.learned && cur.id) {
      storage.review(cur.id, right ? 2 : 0)
    } else {
      storage.quizAnswer(right)
    }
    this.setData({
      revealed: true, isRight: right,
      correctCount: this.data.correctCount + (right ? 1 : 0),
      wrongCount: this.data.wrongCount + (right ? 0 : 1)
    })
  },
  nextQuestion() {
    const i = this.data.index + 1
    if (i < this.data.total) {
      this.setData({
        index: i, current: this.data.queue[i], selected: '', spellInput: '',
        revealed: false, isRight: false,
        progress: Math.round(i / this.data.total * 100)
      })
    } else {
      const acc = Math.round(this.data.correctCount / this.data.total * 100)
      this.setData({ finished: true, accuracy: acc, progress: 100 })
    }
  },
  restart() { this.buildQuiz() },
  goStats() { wx.switchTab({ url: '/pages/stats/stats' }) }
})
