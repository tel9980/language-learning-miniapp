// 测验组题：决定「考哪些词」和「题目长什么样」。
//
// 为什么单独抽一层：
//   原来 pages/quiz/quiz.js 的 buildQuiz() 是 `shuffle(getWords(lang)).slice(0, 10)`，
//   从全库随机抽 10 个 —— 学过的和从没见过的混在一起，做完既不知道在复习什么，
//   答错的词也不进复习计划（只加了一个总计数器）。抽题规则属于业务逻辑，
//   放在页面里没法写单元测试，所以挪到这里做成纯函数。
//
// 抽题顺序（重要）：
//   1. 今天到期的已学词 —— 这才是「该复习的东西」，排最前
//   2. 学过但还没到期 —— 凑数用，比塞生词好
//   3. 从没学过的新词 —— 垫底。刚装好、一个词没学时才会全靠这一段
// 是否把答题结果写回复习计划，由页面按 item.learned 决定（见 pages/quiz/quiz.js）。

// 选择题占比，其余出拼写题
const CHOICE_RATE = 0.6

function shuffle(arr, rnd) {
  const r = typeof rnd === 'function' ? rnd : Math.random
  const a = (arr || []).slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

// all: 全部词；prog: { [wordId]: { dueAt } }；now: 毫秒时间戳
// 返回最多 n 个词，按「到期 → 已学未到期 → 未学」三段拼起来
function pickWords(all, prog, now, n, rnd) {
  const p = prog || {}
  const t = typeof now === 'number' ? now : Date.now()
  const due = []
  const later = []
  const fresh = []
  ;(all || []).forEach(function (w) {
    if (!w || !w.id) return
    const rec = p[w.id]
    if (!rec) { fresh.push(w); return }
    if ((rec.dueAt || 0) <= t) due.push(w)
    else later.push(w)
  })
  return shuffle(due, rnd)
    .concat(shuffle(later, rnd), shuffle(fresh, rnd))
    .slice(0, typeof n === 'number' ? n : 10)
}

// 把选中的词变成题目。
// item.learned 标记「这个词此前学过」——页面据此决定答完要不要写回复习计划，
// 避免测验替「学新词」把生词标成已学（那样今日待练就少了一块）。
function buildItems(words, all, prog, rnd) {
  const r = typeof rnd === 'function' ? rnd : Math.random
  const p = prog || {}
  const pool = all || []
  return (words || []).map(function (w) {
    const learned = !!p[w.id]
    const example = w.example + ' ' + w.exampleCn
    if (r() < CHOICE_RATE) {
      // 干扰项要排除「释义相同的词」，否则会出现两个正确答案
      const distractors = shuffle(pool.filter(function (x) {
        return x.id !== w.id && x.meaning !== w.meaning
      }), r).slice(0, 3).map(function (x) { return x.meaning })
      return {
        id: w.id,
        learned: learned,
        type: 'choice',
        question: w.word,
        answer: w.meaning,
        options: shuffle([w.meaning].concat(distractors), r),
        example: example
      }
    }
    return {
      id: w.id,
      learned: learned,
      type: 'spell',
      question: w.meaning,
      answer: w.word,
      example: example
    }
  })
}

module.exports = { pickWords, buildItems, shuffle, CHOICE_RATE }
