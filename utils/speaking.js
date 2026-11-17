// 口语练习数据层：练习记录、重点复练清单、口语统计（纯本地 Storage）
const { getWords } = require('./words')

const KEY_RECORDS  = 'lp_speak_records_v1'
const KEY_FOCUS    = 'lp_speak_focus_v1'

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
function record(wordId, q) {
  const records = read(KEY_RECORDS, {})
  const focus = read(KEY_FOCUS, {})
  const old = records[wordId] || { times: 0, good: 0, lastAt: 0 }
  records[wordId] = {
    times: old.times + 1,
    good: old.good + (q >= 1 ? 1 : 0),
    lastAt: Date.now()
  }
  if (q === 0) focus[wordId] = (focus[wordId] || 0) + 1
  else delete focus[wordId]           // 说流利了就移出重点清单
  write(KEY_RECORDS, records)
  write(KEY_FOCUS, focus)
  return records[wordId]
}

function getRecords() { return read(KEY_RECORDS, {}) }
function getFocus() { return read(KEY_FOCUS, {}) }

// 今日口语统计：练习数、流利数
function getToday() {
  const records = getRecords()
  const tk = todayKey()
  let count = 0, good = 0
  Object.keys(records).forEach(id => {
    const r = records[id]
    if (r.lastAt && todayKey(new Date(r.lastAt)) === tk) {
      count += r.times
      good += r.good
    }
  })
  return { count, good }
}

// 重点复练词表：按重点次数降序，带词对象
function getFocusWords(lang) {
  const focus = getFocus()
  return getWords(lang)
    .filter(w => focus[w.id] > 0)
    .map(w => Object.assign({}, w, { focusCount: focus[w.id] }))
    .sort((a, b) => b.focusCount - a.focusCount)
}

// 把某词从重点清单移除
function clearFocus(wordId) {
  const focus = getFocus()
  delete focus[wordId]
  write(KEY_FOCUS, focus)
}

// 累计口语统计
function getSummary(lang) {
  const records = getRecords()
  const words = getWords(lang)
  let practiced = 0, fluent = 0
  words.forEach(w => {
    const r = records[w.id]
    if (r) { practiced += 1; fluent += r.good > 0 ? 1 : 0 }
  })
  return { practiced, fluent, focus: Object.keys(getFocus()).length }
}

module.exports = {
  record, getRecords, getFocus, getToday, getFocusWords, clearFocus, getSummary
}
