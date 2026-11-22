// 口语页的「队列 + 进度 + 位置签名」三件纯逻辑。
//
// 为什么抽出来：pages/speak/speak.js 曾长到 31KB、43 个方法，改一处要通读全文。
// 这里只搬「给定输入算出结果」的部分（不碰 setData、不碰录音器、不碰播放器），
// 页面留着编排与交互，模块有了单测就能锁住进度文案这类容易回归的细节。
const storage = require('./storage')
const speaking = require('./speaking')
const sentences = require('./sentences')
const custom = require('./custom-items')
const { getWords } = require('./words')

// 汇总某语种下全部可跟读条目（词 + 句 + 对话台词 + 自建）
function allItems(lang) {
  // 自建素材存的是 { text, cn }，练习页统一按 { word, meaning } 取值，必须归一化
  const mine = custom.toPracticeItems(storage.getCustomItems(lang))
  return getWords(lang).concat(sentences.getAllItems(lang)).concat(mine)
}

// 按「模式 + 分类/场景」拼队列：没练过的排前面，练过的排后面。
// 这样每轮开局总是遇到新内容，练过的不会反复挡在前面。
function buildQueue(opts) {
  const o = opts || {}
  const lang = o.lang || storage.getCurrentLang()
  const track = o.track || 'word'
  const level = o.levelName || '全部'
  const sceneIndex = o.sceneIndex || 0
  let pool = []
  if (track === 'word') {
    pool = getWords(lang).map(w => Object.assign({}, w, { kind: 'word' }))
  } else if (track === 'sentence') {
    pool = sentences.getSentences(lang, level === '全部' ? null : level).map(s => sentences.toItem(s, 'st'))
  } else if (track === 'custom') {
    pool = custom.toPracticeItems(storage.getCustomItems(lang))
  } else {
    const list = level === '全部' ? sentences.getDialogues(lang) : sentences.getDialogues(lang, level)
    const dlg = list[sceneIndex]
    pool = dlg ? dlg.lines.map(l => sentences.toItem(Object.assign({ scene: dlg.scene, level: dlg.level }, l), 'dl')) : []
  }
  // 没有 word 的条目练不了（舞台空白、发音念不出来），一律不进队列
  pool = pool.filter(w => w && w.word)
  const records = speaking.getRecords()
  const fresh = pool.filter(w => !records[w.id])
  const done = pool.filter(w => records[w.id])
  return fresh.concat(done)
}

// 进度显示：条目少时用圆点，条目多（几十上百）时改用进度条，
// 避免为每个条目都渲染一个 view 节点（220 词 = 220 个节点，明显拖慢渲染）
function progress(index, total) {
  const n = total || 0
  const showDots = n > 0 && n <= 20
  const dots = []
  if (showDots) for (let i = 0; i < n; i++) dots.push(i)
  return {
    showDots,
    dots,
    progressText: n ? (Math.min(index + 1, n) + ' / ' + n) : '0 / 0',
    progressPercent: n ? Math.round((index + 1) / n * 100) : 0
  }
}

// 队列签名：切换分类/场景/语种/模式时队列会重建，靠它判断「能不能沿用上次位置」
function signature(state) {
  const s = state || {}
  return [s.track, s.levelIndex, s.sceneIndex, storage.getCurrentLang(), s.mode].join('|')
}

module.exports = { allItems, buildQueue, progress, signature }
