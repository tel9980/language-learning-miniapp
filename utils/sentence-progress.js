// 句子 / 台词 / 自建素材的复习调度（与单词进度分开存）。
//
// 为什么单独一个模块、而不是塞进 storage 的 progress 表：
//   1. 单词进度是按 id 分 8 片存的（见 progress-keys.js），句子 id 长得多、条数少，
//      塞进去会让分片函数和备份格式都跟着改；
//   2. 句子的评分来源和单词不同（口语评测的发音分 / 测验的答题对错），
//      两边混在一张表里以后不好查「为什么这句明天就要复习」。
//
// 写法沿用 storage 的「延迟落盘」：一次练习要写的内容很少，但用户在口语页
// 连续点「再练一次」时会连着写好几次，攒 1.2 秒一起落盘更划算。
const profile = require('./profile')
const fsrs = require('./fsrs')

const KEY = 'lp_sent_progress_v1'
const FLUSH_DELAY = 1200

let _cache = null
let _dirty = false
let _timer = null

function nsKey() { return profile.nsKey(KEY) }

function clone(v) {
  const out = {}
  Object.keys(v || {}).forEach(function (k) { out[k] = Object.assign({}, v[k]) })
  return out
}

function load() {
  if (_cache) return _cache
  let raw = null
  try { raw = wx.getStorageSync(nsKey()) } catch (e) { raw = null }
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch (e) { raw = null }
  }
  _cache = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
  return _cache
}

function persist() {
  if (_timer) { clearTimeout(_timer); _timer = null }
  if (!_dirty) return 0
  _dirty = false
  try {
    wx.setStorageSync(nsKey(), JSON.stringify(load()))
  } catch (e) {
    // 写不进去只影响下次到期时间，不影响当次练习结果，所以不打断用户
    console.error('[sentence-progress] 写入失败', e)
  }
  return 1
}

function schedule() {
  _dirty = true
  if (_timer || typeof setTimeout !== 'function') return
  _timer = setTimeout(function () { _timer = null; persist() }, FLUSH_DELAY)
}

function get(id) {
  const p = load()[id]
  return p ? Object.assign({}, p) : null
}

function all() { return clone(load()) }

// quality: 0 忘了 / 1 勉强 / 2 顺利（和 fsrs.normalize 的口径一致）
// from: 'speak' 口语评测 / 'quiz' 测验 / 'manual' 手动
function review(id, quality, from) {
  if (!id) return null
  const map = load()
  const old = map[id] || { level: 0, reps: 0, lapses: 0, ef: 2.5, dueAt: Date.now() }
  const sched = fsrs.schedule(old, quality)
  const p = {
    level: sched.level,
    ef: sched.ef,
    reps: sched.reps,
    lapses: sched.lapses,
    intervalDays: sched.intervalDays,
    dueAt: fsrs.dueAt(sched.intervalDays),
    lastQ: sched.quality,
    lastFrom: from || 'manual',
    at: Date.now()
  }
  map[id] = p
  schedule()
  return p
}

function dueIds(items, now) {
  const map = load()
  const t = now || Date.now()
  const out = []
  ;(items || []).forEach(function (it) {
    const id = it && it.id
    if (!id) return
    const p = map[id]
    if (p && p.dueAt && p.dueAt > t) return
    out.push(id)
  })
  return out
}

// 汇总：学过多少条、现在到期多少条（页面顶部展示用）
function summary(items, now) {
  const map = load()
  const t = now || Date.now()
  let learned = 0, due = 0
  ;(items || []).forEach(function (it) {
    const p = it && it.id ? map[it.id] : null
    if (!p) { due++; return }
    learned++
    if (!p.dueAt || p.dueAt <= t) due++
  })
  return { learned: learned, due: due, total: (items || []).length }
}

function flush() { return persist() }

function invalidate() {
  if (_timer) { clearTimeout(_timer); _timer = null }
  _cache = null
  _dirty = false
}

module.exports = {
  KEY: KEY, FLUSH_DELAY: FLUSH_DELAY,
  review: review, get: get, all: all, dueIds: dueIds, summary: summary,
  flush: flush, invalidate: invalidate
}
