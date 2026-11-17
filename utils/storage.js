// 本地存储 + 复习调度（SM-2 风格动态间隔，见 utils/fsrs.js）
const { getWords } = require('./words')
const fsrs = require('./fsrs')

const KEY_PROGRESS = 'lp_progress_v1'   // { [wordId]: { level, ef, reps, lapses, dueAt } }
const KEY_STATS    = 'lp_stats_v1'      // 累计统计
const KEY_SETTINGS = 'lp_settings_v1'   // 设置
const KEY_DAILY    = 'lp_daily_v1'      // { 'YYYY-MM-DD': { learned, reviewed, correct, total } }

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
    settings: { lang: 'en', dailyGoal: 20 },
    daily: {}
  }
}

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

function init() {
  const d = defaults()
  d.stats.firstDay = todayKey()
  if (!wx.getStorageSync(KEY_SETTINGS)) write(KEY_SETTINGS, d.settings)
  if (!wx.getStorageSync(KEY_STATS)) write(KEY_STATS, d.stats)
  if (!wx.getStorageSync(KEY_DAILY)) write(KEY_DAILY, d.daily)
  if (!wx.getStorageSync(KEY_PROGRESS)) write(KEY_PROGRESS, d.progress)
}

function getSettings() { return read(KEY_SETTINGS, defaults().settings) }
function setLang(lang) { const s = getSettings(); s.lang = lang; write(KEY_SETTINGS, s) }
function getCurrentLang() { return getSettings().lang || 'en' }
function setDailyGoal(n) { const s = getSettings(); s.dailyGoal = n; write(KEY_SETTINGS, s) }

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

// 取新词：未学过的
function getNewWords(lang, limit) {
  const prog = getProgress()
  const words = getWords(lang)
  const fresh = words.filter(w => !prog[w.id])
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
    version: 2,
    exportedAt: new Date().toISOString(),
    progress: getProgress(),
    stats: getStats(),
    settings: getSettings(),
    daily: getDaily(),
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
  // v2：恢复口语数据
  if (data.speak && data.version === 2) {
    try { require('./speaking').importData(data.speak) } catch (e) {}
  }
  return { ok: true, version: data.version || 1 }
}

module.exports = {
  init, todayKey, getSettings, setLang, getCurrentLang, setDailyGoal,
  getProgress, getStats, getDaily, getDueWords, getNewWords, getToday,
  review, quizAnswer, getMasteredCount, INTERVALS,
  exportData, importData, migrateProgress
}
