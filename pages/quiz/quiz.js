const theme = require('../../utils/theme')
const shareCopy = require('../../utils/share-copy')
const storage = require('../../utils/storage')
const { getWords } = require('../../utils/words')
const quiz = require('../../utils/quiz')
const sentences = require('../../utils/sentences')
const sentenceProgress = require('../../utils/sentence-progress')
const practiceTimer = require('../../utils/practice-timer')
const kidMode = require('../../utils/kid-mode')
const badges = require('../../utils/badges')

Page({
  behaviors: [theme],
  data: {
    queue: [], index: 0, total: 10, current: null,
    selected: '', spellInput: '', revealed: false, isRight: false,
    correctCount: 0, wrongCount: 0, finished: false, accuracy: 0,
    progress: 0, indexLetters: ['A', 'B', 'C', 'D'], learnedCount: 0,
    // 答错的题按原样留一份，结果页可以「重做错的这 N 题」。
    // 注意这跟「进错词本」是两件事：错词已经在 record() 里写回复习计划了，
    // 这里只是把刚才那几道题再摆一遍，让人当场把它纠正过来（短时记忆窗口内重练最有效）。
    wrongList: []
  },
  onShow() {
    // 让右上角菜单里出现「分享到朋友圈」（第十轮）
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] })
    }
    this.syncTheme()
    // 儿童模式统计练习时长（15 / 30 分钟休息提醒），只计前台时间
    practiceTimer.start(this.data.isKid)
    // 做了一半就接着做：以前每次 onShow 都 buildQuiz() 重新随机 10 题，
    // 做完 9 题切去查词页再回来，题目全换成新的，等于白做。
    // 但「接着做」只在模式没变时成立：切到儿童模式后，上一轮排好的成年题
    // 不能再继续考，必须按新范围重出一套。
    // 语种也要算进「接着做」的条件（第十二轮）：以前只看 isKid，
    // 做到第 5 题切到日语再回来，还是那 10 道英语题。
    const lang = storage.getCurrentLang()
    if (this.data.queue.length && !this.data.finished &&
        this._quizKid === !!this.data.isKid && this._quizLang === lang) return
    this.buildQuiz()
  },
  onHide() { practiceTimer.stop(); storage.flushAll() },
  onUnload() { practiceTimer.stop(); storage.flushAll() },
  buildQuiz() {
    const lang = storage.getCurrentLang()
    // 记下这套题是按哪种模式 + 哪个语种出的（见 onShow 的「接着做」判断）
    this._quizKid = !!this.data.isKid
    this._quizLang = lang
    // 儿童模式不考四级/六级/考研/财务/工作/科技那些词，出题范围跟学习页保持一致
    const all = kidMode.allowedWords(getWords(lang), this.data.isKid)
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
      learnedCount, wrongList: []
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
      // 答对一次就把错词本的「错 N 次」销掉一格（第十二轮）：以前 lapses 只增不减，
      // 一个词答错一次就永远留在错词本里，答对 20 次也出不来。
      if (right) storage.clearLapse(cur.id)
    } else {
      storage.quizAnswer(right)
    }
    // 徽章解锁提示（第十二轮）：以前只有统计页会算，解锁了当时看不到
    badges.check()
    const patch = {
      revealed: true, isRight: right,
      correctCount: this.data.correctCount + (right ? 1 : 0),
      wrongCount: this.data.wrongCount + (right ? 0 : 1)
    }
    if (!right) {
      const prev = this.data.wrongList || []
      // 同一题重做又错，不要重复塞进去
      const dup = prev.some(function (q) { return q && cur && q.type === cur.type && q.id === cur.id })
      if (!dup) patch.wrongList = prev.concat([cur])
    }
    this.setData(patch)
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

  // 只重做刚才答错的题，不再随机（重新随机等于把错的那几道又丢了）
  retryWrong() {
    const list = (this.data.wrongList || []).slice()
    if (!list.length) return
    this.setData({
      queue: list, total: list.length, index: 0, current: list[0],
      selected: '', spellInput: '', revealed: false, isRight: false,
      correctCount: 0, wrongCount: 0, finished: false, accuracy: 0, progress: 0,
      wrongList: [],
      learnedCount: list.filter(function (q) { return q && q.learned }).length
    })
  },
  goStats() { wx.switchTab({ url: '/pages/stats/stats' }) },
  goLearn() { wx.switchTab({ url: '/pages/learn/learn' }) },
  onShareAppMessage() {
    const st = storage.getStats() || {}
    const lang = storage.getCurrentLang()
    return { title: shareCopy.title({ lang: lang, streak: st.streak, mastered: storage.getMasteredCount(lang) }), path: '/pages/quiz/quiz' }
  },
  // 朋友圈（第十轮）：原来 17 页只有统计页支持分享到朋友圈。
  onShareTimeline() {
    const st = storage.getStats() || {}
    const lang = storage.getCurrentLang()
    return { title: shareCopy.title({ lang: lang, streak: st.streak, mastered: storage.getMasteredCount(lang) }) }
  },
})
