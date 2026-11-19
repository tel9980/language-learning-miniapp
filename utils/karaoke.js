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

// 创建高亮控制器：{ start, stop, retime, destroy }
// opts: { tokens, durationMs, onWord(index), onDone() }
//
// 定时策略：只在「下一个词边界」唤醒一次，而不是每 60ms 轮询一遍。
// 原来 setInterval(tick, 60)：3 秒音频要醒 50 次，20 句就是 1000 次定时器唤醒，
// 而实际只需要词边界那 8 次左右。改成边界驱动后，唤醒次数≈词数，
// 且边界靠 timings 精确计算，不会因为 60ms 粒度抖动而漏词。
function createHighlighter(opts) {
  opts = opts || {}
  const tokens = opts.tokens || []
  let timings = wordTimings(tokens, opts.durationMs)
  let timer = null
  let t0 = 0
  let idx = -1
  let done = true      // 没 start 之前不调度

  function clear() {
    if (timer) { clearTimeout(timer); timer = null }
  }
  function totalMs() { return timings.length ? timings[timings.length - 1].end : 0 }
  function indexAt(elapsed) {
    for (let i = 0; i < timings.length; i++) {
      if (elapsed >= timings[i].start && elapsed < timings[i].end) return i
    }
    return -1
  }
  function emit(cur) {
    if (cur === idx) return
    idx = cur
    if (opts.onWord) opts.onWord(idx)
  }
  // 预约下一次唤醒：下一个词的开始时刻（没有下一个就直接等到整段结束）
  function schedule() {
    clear()
    if (done) return
    const elapsed = Date.now() - t0
    const total = totalMs()
    if (!timings.length || elapsed >= total) { finish(); return }
    let nextAt = total
    for (let i = 0; i < timings.length; i++) {
      if (timings[i].start > elapsed) { nextAt = timings[i].start; break }
    }
    timer = setTimeout(tick, Math.max(0, nextAt - elapsed))
  }
  function tick() {
    timer = null
    if (done) return
    const elapsed = Date.now() - t0
    if (elapsed >= totalMs()) { finish(); return }
    emit(indexAt(elapsed))
    schedule()
  }
  // 播完别急着清高亮：让最后一个词停在亮着的状态（和原轮询版一致），
  // 由 stop() 负责清，否则结尾会闪一下、字幕跳回纯文本。
  function finish() {
    clear()
    if (done) return
    done = true
    if (opts.onDone) opts.onDone()
  }

  return {
    start() {
      clear()
      done = false
      idx = -1
      t0 = Date.now()
      if (opts.onWord) opts.onWord(-1)
      // 立刻点亮第一个词：只按「下一个边界」调度的话，第 0 个词的开始时刻
      // 就是 t=0，永远等不到「严格晚于当前时刻」的边界，第一个词会被跳过
      emit(indexAt(0))
      schedule()
    },
    // 拿到音频真实时长后重排时间表：估算值换成实测值，高亮不会越走越偏。
    // 不重置起点，保持当前播放进度，并重新预约边界。
    retime(durationMs) {
      const next = wordTimings(tokens, durationMs)
      if (!next.length) return
      timings = next
      if (done) return
      emit(indexAt(Date.now() - t0))
      schedule()
    },
    stop() {
      done = true
      clear()
      if (opts.onWord) opts.onWord(-1)
      idx = -1
    },
    destroy() { done = true; clear() }
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

// 只生成文本、不带 active：配合「只传下标」的渲染方式用。
// 高亮换词时只 setData 一个数字（16B），而不是整个 token 数组（长句 447B），
// 渲染层也只需重排 class，不用 diff 全部 text 节点。
function toPlain(tokens) {
  const list = tokens || []
  const ja = list.some(function (t) { return isJapaneseish(t) })
  return list.map(function (t) { return { text: ja ? t : t + ' ' } })
}

module.exports = { tokenize, wordTimings, weightOf, createHighlighter, toView, toPlain, hasKana, isJapaneseish }
