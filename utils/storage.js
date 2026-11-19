// 本地存储 + 复习调度（SM-2 风格动态间隔，见 utils/fsrs.js）
const { getWords } = require('./words')
const fsrs = require('./fsrs')
const profile = require('./profile')

const KEY_PROGRESS = 'lp_progress_v1'   // { [wordId]: { level, ef, reps, lapses, dueAt } }
const KEY_STATS    = 'lp_stats_v1'      // 累计统计
const KEY_SETTINGS = 'lp_settings_v1'   // 设置
const KEY_DAILY    = 'lp_daily_v1'      // { 'YYYY-MM-DD': { learned, reviewed, correct, total } }
const KEY_CUSTOM   = 'lp_custom_items_v1' // 用户自建跟读素材
const KEY_THEME    = 'lp_theme_v1'      // 无障碍主题状态（字号/深色）

// 复习间隔（天）：level 0..5，level 越高间隔越长
const INTERVALS = [0, 1, 2, 4, 7, 15, 30]

function todayKey(d) {
  const t = d || new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const day = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaults() {
  return {
    progress: {},
    stats: { totalLearned: 0, totalReviews: 0, totalCorrect: 0, streak: 0, lastActive: '', firstDay: '' },
    settings: { lang: 'en', dailyGoal: 20, feedbackEnabled: true, guideSeen: false },
    daily: {},
    custom: [],
    theme: { fontScale: 1, darkMode: false }
  }
}

// 进程内缓存：read/write 是全部业务数据的必经点，命中后省掉重复的同步 Storage 读。
// key 用 nsKey 后的完整名（含档案id），切换档案天然隔离；write 时同步刷新，
// 外部绕过本模块直写 Storage 的地方（全家包导入/删档案）须显式调用 invalidate()。
const _cache = {}
function clone(v) {
  if (Array.isArray(v)) return v.slice()
  if (v && typeof v === 'object') return Object.assign({}, v)
  return v
}
function invalidate() { Object.keys(_cache).forEach(function (k) { delete _cache[k] }) }

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

// 写入失败（存储空间满 / 序列化异常）不能静默吞掉：否则用户以为进度存上了，
// 下次打开却回退。这里只提示一次，避免每写一次弹一次。
let _writeWarned = false
function write(key, value) {
  const k = profile.nsKey(key)
  _cache[k] = value
  try {
    wx.setStorageSync(k, JSON.stringify(value))
  } catch (e) {
    if (typeof console !== 'undefined' && console.error) console.error('[storage] 写入失败', k, e)
    if (!_writeWarned) {
      _writeWarned = true
      try {
        if (typeof wx.showModal === 'function') {
          wx.showModal({
            title: '保存失败',
            content: '本地存储写入失败（可能是空间已满）。这次的学习记录可能没保存上，建议先到「统计 → 导出进度」备份，再清理一些旧录音。',
            showCancel: false
          })
        }
      } catch (e2) {}
    }
  }
}

function rawHas(key) {
  try { return !!wx.getStorageSync(profile.nsKey(key)) } catch (e) { return false }
}

function init() {
  // 把升级前的老数据搬到默认档案，只做一次
  profile.migrateLegacy([KEY_PROGRESS, KEY_STATS, KEY_SETTINGS, KEY_DAILY, KEY_CUSTOM, KEY_THEME,
    'lp_speak_records_v1', 'lp_speak_focus_v1', 'lp_speak_daily_v1', 'lp_recordings_v1'])
  profile.list() // 确保默认档案存在
  const d = defaults()
  d.stats.firstDay = todayKey()
  if (!rawHas(KEY_SETTINGS)) write(KEY_SETTINGS, d.settings)
  if (!rawHas(KEY_STATS)) write(KEY_STATS, d.stats)
  if (!rawHas(KEY_DAILY)) write(KEY_DAILY, d.daily)
  if (!rawHas(KEY_PROGRESS)) write(KEY_PROGRESS, d.progress)
  if (!rawHas(KEY_CUSTOM)) write(KEY_CUSTOM, d.custom)
  if (!rawHas(KEY_THEME)) write(KEY_THEME, d.theme)
  // 老用户补齐新增设置字段
  const s = getSettings()
  let changed = false
  if (s.feedbackEnabled == null) { s.feedbackEnabled = true; changed = true }
  if (s.guideSeen == null) { s.guideSeen = false; changed = true }
  if (changed) write(KEY_SETTINGS, s)
}

function getSettings() { return read(KEY_SETTINGS, defaults().settings) }
function setLang(lang) { const s = getSettings(); s.lang = lang; write(KEY_SETTINGS, s) }
function getCurrentLang() { return getSettings().lang || 'en' }
function setDailyGoal(n) { const s = getSettings(); s.dailyGoal = n; write(KEY_SETTINGS, s) }
function setFeedbackEnabled(v) { const s = getSettings(); s.feedbackEnabled = !!v; write(KEY_SETTINGS, s) }
function setGuideSeen(v) { const s = getSettings(); s.guideSeen = !!v; write(KEY_SETTINGS, s) }
function setLearnCat(cat) { const s = getSettings(); s.learnCat = cat || ''; write(KEY_SETTINGS, s) }

// 无障碍主题
function getTheme() { return read(KEY_THEME, defaults().theme) }
function setFontScale(scale) { const t = getTheme(); t.fontScale = scale; write(KEY_THEME, t) }
function setDarkMode(on) { const t = getTheme(); t.darkMode = !!on; write(KEY_THEME, t) }

// 自建跟读素材：{ id, text, cn, scene, lang, createdAt }
function getCustomItems(lang) {
  const all = read(KEY_CUSTOM, [])
  return lang ? all.filter(function (x) { return x.lang === lang }) : all
}
function addCustomItems(items) {
  const all = read(KEY_CUSTOM, [])
  const seen = {}
  all.forEach(function (x) { seen[x.id] = true })
  let added = 0
  items.forEach(function (it) {
    if (!it || !it.text) return
    const id = 'cu_' + Date.now() + '_' + (added + Math.floor(Math.random() * 1000))
    if (seen[id]) return
    all.unshift({
      id: id, text: it.text, cn: it.cn || '', scene: it.scene || '我的素材',
      lang: it.lang || 'en', createdAt: Date.now()
    })
    added++
  })
  write(KEY_CUSTOM, all)
  return added
}
function removeCustomItem(id) {
  write(KEY_CUSTOM, read(KEY_CUSTOM, []).filter(function (x) { return x.id !== id }))
}

function getProgress() { return read(KEY_PROGRESS, {}) }
function getStats() { return read(KEY_STATS, defaults().stats) }
function getDaily() { return read(KEY_DAILY, {}) }

// 取待复习词：已学过且 dueAt <= 现在
function getDueWords(lang) {
  const prog = getProgress()
  const words = getWords(lang)
  const now = Date.now()
  return words.filter(w => {
    const p = prog[w.id]
    return p && p.dueAt <= now
  })
}

// 取新词：未学过的。传 category 时只取该分类（不传 = 全部）
// 不传分类时严格按词库数组顺序取，考试词会永远排在最前面；
// 想学「日常」「旅行」这类场景词，必须由页面传分类下来。
function getNewWords(lang, limit, category) {
  const prog = getProgress()
  const words = getWords(lang)
  const fresh = words.filter(w => !prog[w.id] && (!category || w.category === category))
  return limit ? fresh.slice(0, limit) : fresh
}

// 复习打分：quality 0=不记得 3=模糊 5=记得（兼容口语三档 0/1/2）
function review(wordId, quality) {
  const prog = getProgress()
  const stats = getStats()
  const daily = getDaily()
  const tk = todayKey()
  const old = prog[wordId] || { level: 0, reps: 0, lapses: 0, ef: 2.5, dueAt: Date.now() }
  const p = Object.assign({}, old)

  // 用 fsrs 计算动态间隔
  const sched = fsrs.schedule(old, quality)
  p.level = sched.level
  p.ef = sched.ef
  p.reps = sched.reps
  p.lapses = sched.lapses
  p.dueAt = fsrs.dueAt(sched.intervalDays)
  prog[wordId] = p

  // 累计统计
  stats.totalReviews += 1
  if (sched.quality >= 1) stats.totalCorrect += 1
  if (sched.quality >= 1 && old.reps === 0) stats.totalLearned += 1

  // 连续打卡
  if (stats.lastActive !== tk) {
    const y = new Date(tk + 'T00:00:00'); y.setDate(y.getDate() - 1)
    stats.streak = (stats.lastActive === todayKey(y)) ? stats.streak + 1 : 1
    stats.lastActive = tk
    if (!stats.firstDay) stats.firstDay = tk
  }

  // 当日统计
  const d = daily[tk] || { learned: 0, reviewed: 0, correct: 0, total: 0 }
  d.reviewed += 1
  d.total += 1
  if (sched.quality >= 1) d.correct += 1
  if (sched.quality >= 1 && old.reps === 0) d.learned += 1
  daily[tk] = d

  write(KEY_PROGRESS, prog)
  write(KEY_STATS, stats)
  write(KEY_DAILY, daily)
  return p
}

// 测验记录一道题（不改 dueAt，独立统计正确率）
function quizAnswer(correct) {
  const stats = getStats()
  const daily = getDaily()
  const tk = todayKey()
  stats.totalReviews += 1
  if (correct) stats.totalCorrect += 1
  const d = daily[tk] || { learned: 0, reviewed: 0, correct: 0, total: 0 }
  d.total += 1
  if (correct) d.correct += 1
  daily[tk] = d
  write(KEY_STATS, stats)
  write(KEY_DAILY, daily)
}

function getToday() {
  const d = getDaily()
  return d[todayKey()] || { learned: 0, reviewed: 0, correct: 0, total: 0 }
}

// 掌握度：level>=4 视为掌握
function getMasteredCount(lang) {
  const prog = getProgress()
  return getWords(lang).filter(w => prog[w.id] && prog[w.id].level >= 4).length
}

// 导出全部学习数据：返回可序列化的普通对象（v2 含口语数据）
function exportData() {
  let speak = null
  try { speak = require('./speaking').exportData() } catch (e) {}
  return {
    format: 'yuban-lang-backup',
    version: 3,
    exportedAt: new Date().toISOString(),
    progress: getProgress(),
    stats: getStats(),
    settings: getSettings(),
    daily: getDaily(),
    custom: getCustomItems(),
    theme: getTheme(),
    speak: speak
  }
}

// 迁移：把 v1（无 ef 字段）的 progress 补齐 ef 默认值
function migrateProgress(prog) {
  if (!prog || typeof prog !== 'object') return {}
  Object.keys(prog).forEach(id => {
    if (prog[id].ef == null) prog[id].ef = 2.5
    if (prog[id].level > 8) prog[id].level = 8
  })
  return prog
}

// 导入学习数据：校验格式 + 版本迁移后覆盖本地存储，返回 {ok, reason}
function importData(data) {
  if (!data || typeof data !== 'object') return { ok: false, reason: '数据格式不正确' }
  if (data.format !== 'yuban-lang-backup') return { ok: false, reason: '不是语伴的备份数据' }
  if (!data.progress || !data.stats || !data.settings || !data.daily) {
    return { ok: false, reason: '备份内容不完整' }
  }
  write(KEY_PROGRESS, migrateProgress(data.progress))
  write(KEY_STATS, data.stats)
  write(KEY_SETTINGS, data.settings)
  write(KEY_DAILY, data.daily)
  // v3：恢复自建素材与主题
  if (data.custom) write(KEY_CUSTOM, data.custom)
  if (data.theme) write(KEY_THEME, data.theme)
  // v2：恢复口语数据
  if (data.speak && data.version >= 2) {
    try { require('./speaking').importData(data.speak) } catch (e) {}
  }
  return { ok: true, version: data.version || 1 }
}

module.exports = {
  init, todayKey, getSettings, setLang, getCurrentLang, setDailyGoal,
  setFeedbackEnabled, setGuideSeen, setLearnCat, getTheme, setFontScale, setDarkMode,
  getCustomItems, addCustomItems, removeCustomItem,
  getProgress, getStats, getDaily, getDueWords, getNewWords, getToday,
  review, quizAnswer, getMasteredCount, INTERVALS,
  exportData, importData, migrateProgress, invalidate
}
