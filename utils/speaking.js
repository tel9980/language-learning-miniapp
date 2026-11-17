// 口语练习数据层：练习记录、重点复练清单、口语统计、每日打卡（纯本地 Storage）
// 支持单词 id、句子 id（st_/dl_ 前缀）统一记录。
const { getWords } = require('./words')

const KEY_RECORDS  = 'lp_speak_records_v1'
const KEY_FOCUS    = 'lp_speak_focus_v1'
const KEY_DAILY    = 'lp_speak_daily_v1'   // { 'YYYY-MM-DD': { count, good } }

function read(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    return v ? JSON.parse(v) : fallback
  } catch (e) {
    return fallback
  }
}
function write(key, value) {
  try { wx.setStorageSync(key, JSON.stringify(value)) } catch (e) {}
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

  write(KEY_RECORDS, records)
  write(KEY_FOCUS, focus)
  write(KEY_DAILY, daily)
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

// 把某条从重点清单移除
function clearFocus(itemId) {
  const focus = getFocus()
  delete focus[itemId]
  write(KEY_FOCUS, focus)
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
  clearFocus, getSummary, exportData, importData
}
