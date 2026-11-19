// 口语练习数据层：练习记录、重点复练清单、口语统计、每日打卡（纯本地 Storage）
// 支持单词 id、句子 id（st_/dl_ 前缀）统一记录。多档案：key 经 profile 命名空间隔离。
const { getWords } = require('./words')
const profile = require('./profile')

const KEY_RECORDS  = 'lp_speak_records_v1'
const KEY_FOCUS    = 'lp_speak_focus_v1'
const KEY_DAILY    = 'lp_speak_daily_v1'   // { 'YYYY-MM-DD': { count, good } }

// 进程内缓存（key 经 nsKey 含档案id，切换档案天然隔离）
const _cache = {}

// 和 utils/storage.js 保持一致：读出的是「一层嵌套的拷贝」。
// 原来这里直接返回缓存本体，调用方写 getRecords()[id].times++ 会静默改脏缓存
// （内存变了但没落盘，下次读到的和磁盘上不一致），两个模块语义不一致本身就是坑。
function clone(v) {
  if (Array.isArray(v)) {
    return v.map(function (x) { return (x && typeof x === 'object') ? Object.assign({}, x) : x })
  }
  if (v && typeof v === 'object') {
    const out = {}
    Object.keys(v).forEach(function (k) {
      const x = v[k]
      out[k] = (x && typeof x === 'object') ? Object.assign({}, x) : x
    })
    return out
  }
  return v
}

function read(key, fallback) {
  const k = profile.nsKey(key)
  if (k in _cache) return _cache[k] == null ? fallback : clone(_cache[k])
  try {
    const v = wx.getStorageSync(k)
    const val = v ? JSON.parse(v) : fallback
    _cache[k] = val
    return clone(val)
  } catch (e) {
    return fallback
  }
}

// ---- 延迟落盘（与 utils/storage.js 同一套策略）----
// record() 每练一条要写 records+focus+daily 三个 key，records 会随练习量增长到几十 KB，
// 攒一批再落盘，避免每练一句就同步重写整张表。
const _dirty = {}
let _flushTimer = null
let _pendingOps = 0
const FLUSH_DELAY = 1500
const FLUSH_MAX_OPS = 12

function _persist(k, value) {
  try { wx.setStorageSync(k, JSON.stringify(value)) } catch (e) {
    if (typeof console !== 'undefined' && console.error) console.error('[speaking] 写入失败', k, e)
  }
}
function flush() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null }
  _pendingOps = 0
  const keys = Object.keys(_dirty)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    delete _dirty[k]
    _persist(k, _cache[k])
  }
  return keys.length
}
function write(key, value) {
  const k = profile.nsKey(key)
  _cache[k] = value
  delete _dirty[k]
  _persist(k, value)
}
function writeDeferred(key, value) {
  const k = profile.nsKey(key)
  _cache[k] = value
  _dirty[k] = true
  _pendingOps += 1
  if (_pendingOps >= FLUSH_MAX_OPS) { flush(); return }
  if (!_flushTimer && typeof setTimeout === 'function') _flushTimer = setTimeout(flush, FLUSH_DELAY)
}
function invalidate() {
  flush()
  Object.keys(_cache).forEach(function (k) { delete _cache[k] })
}
function todayKey(d) {
  const t = d || new Date()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const day = String(t.getDate()).padStart(2, '0')
  return `${t.getFullYear()}-${m}-${day}`
}

// 记录一次口语练习：q 0=需重点练 1=基本流利 2=很流利
function record(itemId, q, score) {
  const records = read(KEY_RECORDS, {})
  const focus = read(KEY_FOCUS, {})
  const daily = read(KEY_DAILY, {})
  const old = records[itemId] || { times: 0, good: 0, lastAt: 0, bestScore: 0 }
  records[itemId] = {
    times: old.times + 1,
    good: old.good + (q >= 1 ? 1 : 0),
    lastAt: Date.now(),
    bestScore: Math.max(old.bestScore || 0, score || 0)
  }
  if (q === 0) focus[itemId] = (focus[itemId] || 0) + 1
  else delete focus[itemId]           // 说流利了就移出重点清单

  // 每日打卡
  const tk = todayKey()
  const d = daily[tk] || { count: 0, good: 0 }
  d.count += 1
  if (q >= 1) d.good += 1
  daily[tk] = d

  writeDeferred(KEY_RECORDS, records)
  writeDeferred(KEY_FOCUS, focus)
  writeDeferred(KEY_DAILY, daily)
  return records[itemId]
}

function getRecords() { return read(KEY_RECORDS, {}) }
function getFocus() { return read(KEY_FOCUS, {}) }
function getDaily() { return read(KEY_DAILY, {}) }

// 今日口语统计：练习数、流利数
function getToday() {
  const d = getDaily()[todayKey()] || { count: 0, good: 0 }
  return d
}

// 重点复练条目表（词 + 句子），按重点次数降序，带对象。
// 传入 items 列表（单词与 getAllItems 句子的合并），按 id 匹配。
function getFocusItems(items) {
  const focus = getFocus()
  return (items || [])
    .filter(it => focus[it.id] > 0)
    .map(it => Object.assign({}, it, { focusCount: focus[it.id] }))
    .sort((a, b) => b.focusCount - a.focusCount)
}
// 兼容旧调用：只返回单词重点表
function getFocusWords(lang) {
  return getFocusItems(getWords(lang))
}


// 统计汇总（words 之外的句子条目数由页面传入 allItems）
function getSummary(lang, allItems) {
  const records = getRecords()
  const items = allItems || getWords(lang)
  let practiced = 0, fluent = 0
  items.forEach(w => {
    const r = records[w.id]
    if (r) { practiced += 1; fluent += r.good > 0 ? 1 : 0 }
  })
  let speakTimes = 0
  Object.keys(records).forEach(k => { speakTimes += records[k].times || 0 })
  return {
    practiced, fluent,
    focus: Object.keys(getFocus()).length,
    speakTimes,
    dialogues: (allItems || []).filter(it => it.id.indexOf('dl_') >= 0 && records[it.id]).length
  }
}

// 导出/导入（供 storage.exportData v2 使用）
function exportData() {
  return { records: getRecords(), focus: getFocus(), daily: getDaily() }
}
function importData(data) {
  if (!data || !data.records) return
  write(KEY_RECORDS, data.records || {})
  write(KEY_FOCUS, data.focus || {})
  write(KEY_DAILY, data.daily || {})
}

module.exports = {
  record, getRecords, getFocus, getDaily, getToday, getFocusItems, getFocusWords,
  getSummary, exportData, importData, invalidate, flush
}
