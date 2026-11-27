// 多档案：一家人共用一台设备时，各人有各人独立的进度/统计/录音。
// 做法：所有业务数据的 Storage key 加 "@档案id" 命名空间；老数据自动迁移到默认档案。
//
// 性能：current()/list() 每次被调用原本都要同步读 Storage + JSON.parse，
// 而 nsKey()（所有业务读写的必经之路）又依赖 current()。这里做进程内缓存，
// 所有变更入口显式失效；外部直接写 KEY_LIST/KEY_CURRENT 的地方（全家包导入）
// 必须调用 invalidate()。缓存只省同步读，不缓存业务数据本身。
const KEY_LIST = 'lp_profiles_v1'
const KEY_CURRENT = 'lp_profile_current_v1'
const DEFAULT_ID = 'p_default'

// darkMode 传 null = 不动用户的深色设置（儿童模式以前写死 false，晚上切过去屏幕会突然变白）
// kid: true 是给 theme.js 看的：它会加上 .theme-kid 类，整页放大（见 app.wxss）
const MODES = {
  normal: { name: '标准', fontScale: 1, darkMode: false },
  kid:    { name: '儿童', fontScale: 1, darkMode: null, kid: true },
  elder:  { name: '长辈', fontScale: 1.35, darkMode: false }
}

let _listCache = null
let _currentCache = null

function rawRead(key, fallback) {
  try { const v = wx.getStorageSync(key); return v ? JSON.parse(v) : fallback } catch (e) { return fallback }
}
function rawWrite(key, value) {
  try { wx.setStorageSync(key, JSON.stringify(value)) } catch (e) {}
}

// 档案列表：首次自动建默认档案（命中缓存时零 Storage 读）
function list() {
  if (_listCache) return _listCache
  let arr = rawRead(KEY_LIST, null)
  if (!Array.isArray(arr) || arr.length === 0) {
    arr = [{ id: DEFAULT_ID, name: '我', avatar: '😀', mode: 'normal', createdAt: Date.now() }]
    rawWrite(KEY_LIST, arr)
  }
  _listCache = arr
  return arr
}

function current() {
  if (_currentCache && list().some(function (p) { return p.id === _currentCache })) return _currentCache
  let id = ''
  try { id = wx.getStorageSync(KEY_CURRENT) } catch (e) {}
  if (!id || !list().some(function (p) { return p.id === id })) {
    id = DEFAULT_ID
    try { wx.setStorageSync(KEY_CURRENT, id) } catch (e) {}
  }
  _currentCache = id
  return id
}

function get(id) {
  return list().find(function (p) { return p.id === (id || current()) }) || null
}
function currentProfile() { return get(current()) }

function switchTo(id) {
  if (!get(id)) return false
  try { wx.setStorageSync(KEY_CURRENT, id) } catch (e) {}
  _currentCache = id
  applyMode(id)
  return true
}

function add(name, mode) {
  const arr = list().slice()
  const id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  arr.push({
    id: id,
    name: (name || ('成员' + (arr.length + 1))).slice(0, 12),
    avatar: ['😀', '🐱', '🦊', '🐼', '🐯', '🌸'][arr.length % 6],
    mode: MODES[mode] ? mode : 'normal',
    createdAt: Date.now()
  })
  rawWrite(KEY_LIST, arr)
  _listCache = arr
  return id
}

function rename(id, name) {
  const arr = list().slice()
  const p = arr.find(function (x) { return x.id === id })
  if (!p || !name) return false
  p.name = String(name).slice(0, 12)
  rawWrite(KEY_LIST, arr)
  _listCache = arr
  return true
}

function setMode(id, mode) {
  const arr = list().slice()
  const p = arr.find(function (x) { return x.id === id })
  if (!p || !MODES[mode]) return false
  p.mode = mode
  rawWrite(KEY_LIST, arr)
  _listCache = arr
  if (id === current()) applyMode(id)
  return true
}

// 切换"标准/儿童/长辈"时给该档案预设字号与深色
function applyMode(id) {
  const p = get(id)
  if (!p) return
  const m = MODES[p.mode] || MODES.normal
  try {
    const theme = require('./storage')
    theme.setFontScale(m.fontScale)
    if (typeof m.darkMode === 'boolean') theme.setDarkMode(m.darkMode)
  } catch (e) {}
}

// 删除档案：清理其命名空间下的数据与录音文件；默认档案/最后一个不可删
function remove(id) {
  const arr = list().slice()
  if (id === DEFAULT_ID || arr.length <= 1) return { ok: false, reason: '默认档案不能删除' }
  const p = arr.find(function (x) { return x.id === id })
  if (!p) return { ok: false, reason: '档案不存在' }
  // 进度表按分片存放（见 utils/progress-keys.js），删档案时要连分片一起清，
  // 否则每次删档案都会留下 8 个分片占着 10MB 配额不放。
  const baseKeys = ['lp_progress_v1'].concat(require('./progress-keys').shardKeys()).concat([
    'lp_stats_v1', 'lp_settings_v1', 'lp_daily_v1',
    'lp_custom_items_v1', 'lp_theme_v1', 'lp_speak_records_v1', 'lp_speak_focus_v1',
    'lp_speak_daily_v1', 'lp_recordings_v1', 'lp_sent_progress_v1'])
  baseKeys.forEach(function (k) {
    try { wx.removeStorageSync(nsKey(k, id)) } catch (e) {}
  })
  // 录音物理文件
  try {
    const recs = rawRead(nsKey('lp_recordings_v1', id), [])
    recs.forEach(function (r) { if (r.filePath) wx.removeSavedFile({ filePath: r.filePath, fail() {} }) })
  } catch (e) {}
  rawWrite(KEY_LIST, arr.filter(function (x) { return x.id !== id }))
  _listCache = arr.filter(function (x) { return x.id !== id })
  if (current() === id) {
    try { wx.setStorageSync(KEY_CURRENT, DEFAULT_ID) } catch (e) {}
    _currentCache = DEFAULT_ID
    applyMode(DEFAULT_ID)
  }
  // 清掉被删档案可能残留的业务数据值缓存
  try { require('./storage').invalidate() } catch (e) {}
  try { require('./speaking').invalidate() } catch (e) {}
  return { ok: true }
}

// 命名空间 key：业务模块统一通过它读写，做到档案间数据隔离
function nsKey(baseKey, profileId) {
  return baseKey + '@' + (profileId || current())
}

// 老数据迁移：把无命名空间的旧 key 搬到默认档案（只搬一次，之后删除旧 key）
// 迁移完打一个标记：否则 storage.init() 每次被调用都要扫 10 个老 key，
// 而首页每次 onShow 都会调 init()，等于每次回首页 10 次白读。
const KEY_MIGRATED = 'lp_migrated_v1'
function migrateLegacy(baseKeys) {
  try { if (wx.getStorageSync(KEY_MIGRATED)) return false } catch (e) {}
  const keys = baseKeys || ['lp_progress_v1', 'lp_stats_v1', 'lp_settings_v1', 'lp_daily_v1',
    'lp_custom_items_v1', 'lp_theme_v1', 'lp_speak_records_v1', 'lp_speak_focus_v1',
    'lp_speak_daily_v1', 'lp_recordings_v1']
  keys.forEach(function (k) {
    try {
      const old = wx.getStorageSync(k)
      if (!old) return
      const target = nsKey(k, DEFAULT_ID)
      if (!wx.getStorageSync(target)) wx.setStorageSync(target, old)
      wx.removeStorageSync(k)
    } catch (e) {}
  })
  try { wx.setStorageSync(KEY_MIGRATED, '1') } catch (e) {}
  return true
}

function modes() { return MODES }

// 当前档案是不是儿童模式（页面用它决定隐藏 AI 入口、过滤分类）
function isKid(id) {
  const p = get(id || current())
  return !!(p && p.mode === 'kid')
}

// 外部（全家包导入等）直接改了 KEY_LIST / KEY_CURRENT 后必须调用，避免缓存陈旧
function invalidate() { _listCache = null; _currentCache = null }

module.exports = {
  list, current, get, currentProfile, switchTo, add, rename, setMode, remove, isKid,
  nsKey, migrateLegacy, modes, DEFAULT_ID, invalidate
}
