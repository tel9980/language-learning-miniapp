// 逐词高亮（K歌字幕式）：把文本按词切分，按音频时长比例分配每个词的显示时间。
// TTS 外链不返回词级时间戳，这里用词长加权估算，足够用于跟读提示；不影响录音与评分。
//
// 日语：日语没有空格，按空格切会把整句当成一个 token，高亮等于失效。
// 所以含假名的文本改用 TinySegmenter（18KB 纯 JS，见 utils/tiny-segmenter.js）切分。

const TinySegmenter = require('./tiny-segmenter')
const _jpSegmenter = new TinySegmenter()

const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff]/
const KANJI_RE = /[\u4e00-\u9fff]/

function hasKana(text) { return KANA_RE.test(String(text || '')) }
function isJapaneseish(text) { return hasKana(text) || KANJI_RE.test(String(text || '')) }

function tokenize(text) {
  const s = String(text || '').trim()
  if (!s) return []
  if (hasKana(s)) {
    // 含假名 → 日语，用形态切分；标点会被单独切成 token，高亮时正好停顿一下
    return _jpSegmenter.segment(s)
      .map(function (t) { return String(t).trim() }).filter(Boolean)
  }
  return s.split(/\s+/).filter(Boolean)
}

// 单个 token 的时长权重：日语按字符数（音拍近似），英语按字母数字数
function weightOf(t) {
  const s = String(t)
  if (isJapaneseish(s)) return Math.max(1, s.length)
  return Math.max(1, s.replace(/[^A-Za-z0-9']/g, '').length)
}

// 按词长加权分配时间，返回 [{start, end}]（毫秒）
function wordTimings(tokens, durationMs) {
  const weights = tokens.map(weightOf)
  const total = weights.reduce(function (a, b) { return a + b }, 0) || 1
  let acc = 0
  return weights.map(function (w) {
    const d = Math.max(220, Math.round((durationMs || tokens.length * 450) * w / total))
    const item = { start: acc, end: acc + d }
    acc += d
    return item
  })
}

// 创建高亮控制器：{ start, stop, destroy }
// opts: { tokens, durationMs, onWord(index), onDone() }
function createHighlighter(opts) {
  opts = opts || {}
  const tokens = opts.tokens || []
  let timings = wordTimings(tokens, opts.durationMs)
  let timer = null
  let t0 = 0
  let idx = -1

  function clear() {
    if (timer) { clearInterval(timer); timer = null }
  }
  function tick() {
    const elapsed = Date.now() - t0
    let cur = -1
    for (let i = 0; i < timings.length; i++) {
      if (elapsed >= timings[i].start && elapsed < timings[i].end) { cur = i; break }
    }
    if (cur === -1 && elapsed >= (timings.length ? timings[timings.length - 1].end : 0)) {
      clear()
      if (opts.onDone) opts.onDone()
      return
    }
    if (cur !== idx) {
      idx = cur
      if (opts.onWord) opts.onWord(idx)
    }
  }
  return {
    start() {
      clear()
      idx = -1
      t0 = Date.now()
      if (opts.onWord) opts.onWord(-1)
      timer = setInterval(tick, 60)
    },
    // 拿到音频真实时长后重排时间表：估算值换成实测值，高亮不会越走越偏。
    // 不重置起点，保持当前播放进度。
    retime(durationMs) {
      const next = wordTimings(tokens, durationMs)
      if (!next.length) return
      timings = next
    },
    stop() { clear(); if (opts.onWord) opts.onWord(-1) },
    destroy() { clear() }
  }
}

// 生成渲染用的 token 列表。空格自己带在 text 里：
// 英语 token 后面补一个空格，日语不补（日语本来就不写空格）。
function toView(tokens, activeIdx) {
  const list = tokens || []
  const ja = list.some(function (t) { return isJapaneseish(t) })
  return list.map(function (t, i) {
    return { text: ja ? t : t + ' ', active: i === activeIdx }
  })
}

module.exports = { tokenize, wordTimings, weightOf, createHighlighter, toView, hasKana, isJapaneseish }
