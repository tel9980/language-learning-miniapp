// 逐词高亮（K歌字幕式）：把文本按词切分，按音频时长比例分配每个词的显示时间。
// TTS 外链不返回词级时间戳，这里用词长加权估算，足够用于跟读提示；不影响录音与评分。

function tokenize(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean)
}

// 按词长加权分配时间，返回 [{start, end}]（毫秒）
function wordTimings(tokens, durationMs) {
  const weights = tokens.map(function (t) {
    return Math.max(1, String(t).replace(/[^A-Za-z0-9']/g, '').length)
  })
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
  const timings = wordTimings(tokens, opts.durationMs)
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
    stop() { clear(); if (opts.onWord) opts.onWord(-1) },
    destroy() { clear() }
  }
}

function toView(tokens, activeIdx) {
  return (tokens || []).map(function (t, i) {
    return { text: t, active: i === activeIdx }
  })
}

module.exports = { tokenize, wordTimings, createHighlighter, toView }
