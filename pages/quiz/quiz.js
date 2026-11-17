const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const { getWords } = require('../../utils/words')

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

Page({
  behaviors: [theme],
  data: {
    queue: [], index: 0, total: 10, current: null,
    selected: '', spellInput: '', revealed: false, isRight: false,
    correctCount: 0, wrongCount: 0, finished: false, accuracy: 0,
    progress: 0, indexLetters: ['A', 'B', 'C', 'D']
  },
  onShow() {
    this.syncTheme(); this.buildQuiz() },
  buildQuiz() {
    const lang = storage.getCurrentLang()
    const words = shuffle(getWords(lang)).slice(0, 10)
    const all = getWords(lang)
    const queue = words.map(w => {
      if (Math.random() < 0.6) {
        // 选择题：4 个释义选项
        const distractors = shuffle(all.filter(x => x.id !== w.id)).slice(0, 3).map(x => x.meaning)
        return {
          type: 'choice', question: w.word, answer: w.meaning,
          options: shuffle([w.meaning].concat(distractors)), example: w.example + ' ' + w.exampleCn
        }
      }
      // 拼写题
      return {
        type: 'spell', question: w.meaning, answer: w.word, example: w.example + ' ' + w.exampleCn
      }
    })
    this.setData({
      queue, total: queue.length, index: 0, current: queue[0] || null,
      selected: '', spellInput: '', revealed: false, isRight: false,
      correctCount: 0, wrongCount: 0, finished: false, accuracy: 0, progress: 0
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
    storage.quizAnswer(right)
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
