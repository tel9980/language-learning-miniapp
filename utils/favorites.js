// 生词收藏夹 + 搜索历史：按档案隔离，存本地 Storage。
const profile = require('./profile')
const KEY_FAV = 'lp_favorites_v1'
const KEY_HISTORY = 'lp_search_history_v1'
const MAX_HISTORY = 20

function read(key, fallback) {
  try { const v = wx.getStorageSync(profile.nsKey(key)); return v ? JSON.parse(v) : fallback } catch (e) { return fallback }
}
function write(key, value) {
  try { wx.setStorageSync(profile.nsKey(key), JSON.stringify(value)) } catch (e) {}
}

// 收藏：按语种存 id 数组
function list(lang) {
  const all = read(KEY_FAV, {})
  return all[lang] || []
}
function add(lang, id) {
  const all = read(KEY_FAV, {})
  const arr = all[lang] || []
  if (arr.indexOf(id) < 0) { arr.push(id); all[lang] = arr; write(KEY_FAV, all) }
  return true
}
function remove(lang, id) {
  const all = read(KEY_FAV, {})
  all[lang] = (all[lang] || []).filter(function (x) { return x !== id })
  write(KEY_FAV, all)
}
function toggle(lang, id) {
  if (list(lang).indexOf(id) >= 0) { remove(lang, id); return false }
  add(lang, id); return true
}
function isFav(lang, id) { return list(lang).indexOf(id) >= 0 }

// 搜索历史：最新在前，去重，最多 20 条
function history(lang) {
  const all = read(KEY_HISTORY, {})
  return all[lang] || []
}
function pushHistory(lang, keyword) {
  keyword = String(keyword || '').trim()
  if (!keyword) return
  const all = read(KEY_HISTORY, {})
  let arr = all[lang] || []
  arr = [keyword].concat(arr.filter(function (x) { return x !== keyword })).slice(0, MAX_HISTORY)
  all[lang] = arr; write(KEY_HISTORY, all)
}
function clearHistory(lang) {
  const all = read(KEY_HISTORY, {})
  all[lang] = []
  write(KEY_HISTORY, all)
}

module.exports = { list, add, remove, toggle, isFav, history, pushHistory, clearHistory }
