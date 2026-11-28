// 本地存储 + 复习调度（SM-2 风格动态间隔，见 utils/fsrs.js）
const { getWords } = require('./words')
const wordRank = require('./word-rank')
const fsrs = require('./fsrs')
const profile = require('./profile')
const logger = require('./logger')

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
    settings: { lang: 'en', dailyGoal: 20, feedbackEnabled: true, guideSeen: false, aiEvalAgreed: false, voiceprintAgreed: false, voiceprintAgreedAt: '', guardianAgreed: false, guardianAgreedAt: '', kidAiUnlocked: false, kidAiUnlockedAt: '', kidRest: '' },
    daily: {},
    custom: [],
    theme: { fontScale: 1, darkMode: false }
  }
}

// 进程内缓存：read/write 是全部业务数据的必经点，命中后省掉重复的同步 Storage 读。
// key 用 nsKey 后的完整名（含档案id），切换档案天然隔离；write 时同步刷新，
// 外部绕过本模块直写 Storage 的地方（全家包导入/删档案）须显式调用 invalidate()。
const _cache = {}
// 拷贝一层嵌套：我们的数据结构都是「map → 条目对象」或「数组 → 条目对象」，
// 只拷外层的话条目仍然与缓存共享引用，调用方写 prog[id].level = x 会静默改脏缓存
// （改了却没落盘，下次读到的和磁盘上不一致）。所以对值/元素再拷一层。
function clone(v) {
  // 注意：这里原来对嵌套值只做 Object.assign({}, x)，数组会被摊成 {'0':…,'1':…}
  // 的普通对象 —— 于是 settings.knownIds 这类「对象里的数组」读出来就不是数组了，
  // Array.isArray 判假，表现为「写进去了但读不到」。改为递归，数组仍是数组。
  if (Array.isArray(v)) {
    return v.map(function (x) {
      return (x && typeof x === 'object') ? clone(x) : x
    })
  }
  if (v && typeof v === 'object') {
    const out = {}
    Object.keys(v).forEach(function (k) {
      const x = v[k]
      out[k] = (x && typeof x === 'object') ? clone(x) : x
    })
    return out
  }
  return v
}

// ---- 延迟落盘（写入合并） ----
// review()/quizAnswer() 每评一张卡要写 progress+stats+daily 三个 key，
// progress 是全量 map：学满 440 词时单次 30.9KB，每点一下卡片就同步重写一遍。
// 这里把热路径的写改成「内存立即生效、磁盘攒一批再落」：
//   · 读永远读缓存，所以写完全立刻可见，不会读到旧值；
//   · 1.5s 空闲、攒够 12 次、页面 onHide/onUnload、App 进后台、导入/导出前都会 flush；
//   · 最坏情况只丢最后 1.5s 内的评分（代价换掉每卡 31KB 的同步写）。
// 设置类、自建素材、导入这类「低频且必须马上生效」的写仍走 write() 立即落盘。
const _dirty = {}
// init() 是否已经为本档案跑过（见 init 注释）
let _initedFor = ''
let _flushTimer = null
let _pendingOps = 0
const FLUSH_DELAY = 1500
const FLUSH_MAX_OPS = 12

// ---- 进度表分片 ----
// review() 每评一张卡都要落一次 progress，而 progress 是全量 map：学满 440 词时
// 序列化 31.4KB（实测），整表重写就是一次 31KB 的同步写。
// 这里按 wordId 的哈希把进度表拆成 8 片，一次只写改动所在的那一片（约 4KB）。
// 内存里仍保留合并视图 _progress 作为唯一真相，读永远读它，所以对页面完全透明。
const progressKeys = require('./progress-keys')
const PROGRESS_SHARDS = progressKeys.SHARDS
const shardIndexOf = progressKeys.shardIndexOf
const shardKeyAt = progressKeys.shardKeyAt
let _progress = null            // 合并视图（null 表示还没从分片加载）
// 取某一片的当前内容（值仍是 _progress 里的同一批对象引用，改了会一起变）
function shardSliceOf(index) {
  const out = {}
  const ids = Object.keys(_progress || {})
  for (let i = 0; i < ids.length; i++) {
    if (shardIndexOf(ids[i]) === index) out[ids[i]] = _progress[ids[i]]
  }
  return out
}
// 不走 _cache 直读：分片只在启动时读一次，没必要在缓存里留一份 31KB 的副本
function readPlain(key, fallback) {
  try {
    const v = wx.getStorageSync(profile.nsKey(key))
    return v ? JSON.parse(v) : fallback
  } catch (e) { return fallback }
}
// 把整张表写成分片（导入、老数据迁移用；热路径走 writeDeferred 只写单片）
function writeProgressAll(map) {
  _progress = map || {}
  for (let i = 0; i < PROGRESS_SHARDS; i++) {
    const slice = shardSliceOf(i)
    if (Object.keys(slice).length) write(shardKeyAt(i), slice)
    else {
      const k = profile.nsKey(shardKeyAt(i))
      if (k in _cache) delete _cache[k]
      try { wx.removeStorageSync(k) } catch (e) { logger.warn('[storage] 清理分片失败', k, e) }
    }
  }
  // 老版本的单表 key 必须清掉，否则下次启动会把它当老数据再并进来
  const legacyKey = profile.nsKey(KEY_PROGRESS)
  if (legacyKey in _cache) delete _cache[legacyKey]
  try { wx.removeStorageSync(legacyKey) } catch (e) { logger.warn('[storage] 清理老单表失败', e) }
}
function loadProgress() {
  if (_progress) return _progress
  const merged = {}
  let shardSeen = false
  for (let i = 0; i < PROGRESS_SHARDS; i++) {
    const part = readPlain(shardKeyAt(i), null)
    if (part && typeof part === 'object') {
      shardSeen = true
      Object.assign(merged, part)
    }
  }
  // 老版本把整张表存在一个 key 里：读出来合并进分片，然后删掉旧 key 腾出空间（一次性）
  const legacy = readPlain(KEY_PROGRESS, null)
  if (legacy && typeof legacy === 'object') {
    Object.assign(merged, legacy)
    _progress = merged
    writeProgressAll(merged)
    return _progress
  }
  _progress = merged
  if (shardSeen) _progress = merged
  return _progress
}

// 真正落盘。写失败（空间满 / 序列化异常）不能静默吞掉：否则用户以为进度存上了，
// 下次打开却回退。这里只提示一次，避免每写一次弹一次。
let _writeWarned = false
function _persist(k, value) {
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

// 把攒着的脏 key 一次性落盘
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

function invalidate() {
  // 换档案 / 导入 / 删档案前先把脏数据落盘，否则缓存清掉就永久丢失
  flush()
  try { require('./sentence-progress').invalidate() } catch (e) {}
  Object.keys(_cache).forEach(function (k) { delete _cache[k] })
  _progress = null      // 分片的合并视图一并作废，下次读会重新加载
  _initedFor = ''
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

// 立即落盘：设置、主题、自建素材、导入导出这类低频但必须马上生效的写走这里
function write(key, value) {
  const k = profile.nsKey(key)
  _cache[k] = value
  delete _dirty[k]      // 已经有更新的值了，别让之前攒的旧值盖回来
  _persist(k, value)
}

// 延迟落盘：只给「每点一下卡片就写一次」的热路径用
function writeDeferred(key, value) {
  const k = profile.nsKey(key)
  _cache[k] = value
  _dirty[k] = true
  _pendingOps += 1
  if (_pendingOps >= FLUSH_MAX_OPS) { flush(); return }
  if (!_flushTimer && typeof setTimeout === 'function') {
    _flushTimer = setTimeout(flush, FLUSH_DELAY)
  }
}

function rawHas(key) {
  try { return !!wx.getStorageSync(profile.nsKey(key)) } catch (e) { return false }
}

// init() 要连着问 5 个 key「在不在」。以前是 5 次 getStorageSync（跨线程桥调用，
// 真机每次约 0.05–0.3ms）。wx.getStorageInfoSync 一次就能拿到全部 key 名，
// 1 次调用换 5 次 —— 名字对了就说明在，不必再读值。
// 取不到（老基础库 / 测试桩没实现）就退回逐条读。
function keyChecker() {
  try {
    const info = wx.getStorageInfoSync && wx.getStorageInfoSync()
    const keys = (info && info.keys) || null
    if (!keys) return rawHas
    const set = {}
    keys.forEach(function (k) { set[k] = true })
    return function (key) { return !!set[profile.nsKey(key)] }
  } catch (e) {
    return rawHas
  }
}

// init() 会被首页 onShow 反复调用（每次切回首页都会走一遍）。它做的事
// （扫老 key、补默认值、补设置字段）都是幂等的「第一次才需要」的活，
// 所以按档案 id 记住是否已初始化，重复调用直接返回，省掉每次十几条同步 Storage 读。
function init() {
  const pid = profile.current()
  if (_initedFor === pid) return
  _initedFor = pid
  // 把升级前的老数据搬到默认档案，只做一次
  profile.migrateLegacy([KEY_PROGRESS, KEY_STATS, KEY_SETTINGS, KEY_DAILY, KEY_CUSTOM, KEY_THEME,
    'lp_speak_records_v1', 'lp_speak_focus_v1', 'lp_speak_daily_v1', 'lp_recordings_v1'])
  profile.list() // 确保默认档案存在
  const d = defaults()
  d.stats.firstDay = todayKey()
  const has = keyChecker()
  if (!has(KEY_SETTINGS)) write(KEY_SETTINGS, d.settings)
  if (!has(KEY_STATS)) write(KEY_STATS, d.stats)
  if (!has(KEY_DAILY)) write(KEY_DAILY, d.daily)
  loadProgress()   // 进度表按分片懒加载，老版本单表在这里自动拆片
  if (!has(KEY_CUSTOM)) write(KEY_CUSTOM, d.custom)
  if (!has(KEY_THEME)) write(KEY_THEME, d.theme)
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
// AI 听音评测需要把录音上传，必须用户亲口同意一次才记下来（问过一次就不再问）
function setAiEvalAgreed(v) { const s = getSettings(); s.aiEvalAgreed = !!v; write(KEY_SETTINGS, s) }
// 声纹授权：微信审核要求「独立的《声纹授权协议》+ 取得用户授权同意后才能采集」。
// 同意时间一起记下来（审核方可能要看「何时取得同意」），撤回时清空。
function getVoiceprintAgreed() { return !!getSettings().voiceprintAgreed }
function setVoiceprintAgreed(v) {
  const s = getSettings()
  s.voiceprintAgreed = !!v
  s.voiceprintAgreedAt = v ? todayKey() : ''
  write(KEY_SETTINGS, s)
}
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

function getProgress() { return clone(loadProgress()) }
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
// 「新词按词频排序」的排序结果缓存。
// 以前每次进学习页/首页都对整张词库排一次序（480 条实测 0.61ms）。
// 词库数组是模块级单例（内置或在线替换后换新数组），所以用「同一个数组对象」
// 作为缓存键就够了：在线词库一旦替换整个数组，键就不相等，缓存自动失效。
let _rankCache = { src: null, order: null }
function rankedWords(words) {
  if (_rankCache.src === words && _rankCache.order) return _rankCache.order
  // 高频优先：词库数组是字母序，直接 slice 会让新用户第一天撞上 abandon / accommodate
  // 这种低频难词。按 ECDICT 词频排名升序（数字越小越常用），表里没有的（日语词、
  // 超低频词）rankOf 返回 Infinity，稳定排序后仍保持词库原顺序。
  const order = words.slice().sort((a, b) => wordRank.rankOf(a.id) - wordRank.rankOf(b.id))
  _rankCache = { src: words, order: order }
  return order
}

function getNewWords(lang, limit, category) {
  const prog = getProgress()
  const words = getWords(lang)
  const out = []
  const ordered = rankedWords(words)   // 已按词频排好，这里只是过滤，O(n) 不再排序
  for (let i = 0; i < ordered.length; i++) {
    const w = ordered[i]
    if (prog[w.id]) continue
    if (category && w.category !== category) continue
    out.push(w)
    if (limit && out.length >= limit) break
  }
  return out
}

// 「早就认识」：不是「这次记得」，而是「这词我压根不用学」。
// 学新词的时候给一个不评分的出口 —— 800 词里 book/keep/street 这类词，
// 用户必须点一次「记得」才能过卡，等于被迫做无意义的复习，这也是「学不下去」的主因之一。
// 做法：直接推到最远间隔，并记进 settings.knownIds 以便撤销。
// 这个入口只在新词模式出现，所以被标记的词一定还没被考过，撤销时删掉进度是安全的。
const KNOWN_AHEAD_DAYS = 180
const KNOWN_MAX = 3000

function knownIdsOf(settings) {
  const ids = (settings && settings.knownIds)
  return Array.isArray(ids) ? ids : []
}

function markKnown(wordId) {
  if (!wordId) return null
  const prog = loadProgress()
  const old = prog[wordId] || { level: 0, reps: 0, lapses: 0, ef: 2.5, dueAt: Date.now() }
  const p = Object.assign({}, old)
  p.level = 5
  p.known = true
  p.dueAt = Date.now() + KNOWN_AHEAD_DAYS * 24 * 3600 * 1000
  prog[wordId] = p

  // 进度仍然只写改动所在的那一片（与 review 同一条热路径策略）
  const shard = shardIndexOf(wordId)
  writeDeferred(shardKeyAt(shard), shardSliceOf(shard))

  const s = getSettings()
  const ids = knownIdsOf(s)
  if (ids.indexOf(wordId) < 0) ids.push(wordId)
  while (ids.length > KNOWN_MAX) ids.shift()
  s.knownIds = ids
  write(KEY_SETTINGS, s)      // 设置类必须马上生效，否则退出页面再进来会看不到撤销入口
  return p
}

function getKnownIds() {
  return knownIdsOf(getSettings()).slice()
}

// 撤销「早就认识」：把标记过的词退回「没学过」，下次学新词会重新出现。
function restoreKnown() {
  const s = getSettings()
  const ids = knownIdsOf(s)
  if (!ids.length) return 0
  const prog = loadProgress()
  const touched = {}
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (prog[id]) {
      delete prog[id]
      touched[shardIndexOf(id)] = true
    }
  }
  // 只重写动过的分片；某一片被清空时要把 key 删掉，留个 "{}" 会白占空间
  Object.keys(touched).forEach(function (k) {
    const index = Number(k)
    const slice = shardSliceOf(index)
    const full = profile.nsKey(shardKeyAt(index))
    if (Object.keys(slice).length) {
      write(shardKeyAt(index), slice)
    } else {
      delete _cache[full]
      delete _dirty[full]
      try { wx.removeStorageSync(full) } catch (e) { logger.warn('[storage] 删除空分片失败', full, e) }
    }
  })
  s.knownIds = []
  write(KEY_SETTINGS, s)
  return ids.length
}

// 复习打分：quality 0=不记得 3=模糊 5=记得（兼容口语三档 0/1/2）
function review(wordId, quality) {
  const prog = loadProgress()   // 直接用合并视图，避免 440 条整表克隆
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

  // 热路径：延迟落盘（见 writeDeferred 注释），读到的仍是内存里的最新值。
  // 进度只写改动所在的那一片：整表 31.4KB，单片约 4KB。
  const shard = shardIndexOf(wordId)
  writeDeferred(shardKeyAt(shard), shardSliceOf(shard))
  writeDeferred(KEY_STATS, stats)
  writeDeferred(KEY_DAILY, daily)
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
  writeDeferred(KEY_STATS, stats)
  writeDeferred(KEY_DAILY, daily)
}

function getToday() {
  const d = getDaily()
  return d[todayKey()] || { learned: 0, reviewed: 0, correct: 0, total: 0 }
}

// ---------- 练习时长（儿童模式的休息提醒要用） ----------
// 每日数据里原来只有 learned/reviewed/correct/total，没有时长，所以做不了「练了多久」。
// 只累加秒数，不记任何内容；写入同样走延迟落盘，不新增同步写。
function addPracticeSeconds(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0))
  if (!n) return 0
  const daily = getDaily()
  const tk = todayKey()
  const d = daily[tk] || { learned: 0, reviewed: 0, correct: 0, total: 0 }
  d.practiceSec = (d.practiceSec || 0) + n
  daily[tk] = d
  writeDeferred(KEY_DAILY, daily)
  return d.practiceSec
}

function getPracticeSeconds() {
  const d = getDaily()[todayKey()]
  return (d && d.practiceSec) || 0
}

// ---------- 儿童模式的边界 ----------
// 默认零上传：儿童模式不碰智聆评测、不做语音识别、不用 AI 听音/对练。
// 家长确实要用，得先做「监护人确认」再单独解锁（见 pages/stats 的设置行）。
function getGuardianAgreed() {
  return !!getSettings().guardianAgreed
}
function setGuardianAgreed(v) {
  const s = getSettings()
  s.guardianAgreed = !!v
  s.guardianAgreedAt = v ? todayKey() : ''
  if (!v) { s.kidAiUnlocked = false; s.kidAiUnlockedAt = '' }
  write(KEY_SETTINGS, s)
}
function getKidAiUnlocked() {
  const s = getSettings()
  return !!(s.kidAiUnlocked && s.guardianAgreed)
}
function setKidAiUnlocked(v) {
  const s = getSettings()
  if (v && !s.guardianAgreed) return false
  s.kidAiUnlocked = !!v
  s.kidAiUnlockedAt = v ? todayKey() : ''
  write(KEY_SETTINGS, s)
  return true
}
// 休息提醒今天是否已经弹过（'15' / '30' 两个节点各弹一次）
function kidRestSeen(step) {
  const s = getSettings()
  return s.kidRest === todayKey() + ':' + step
}
function markKidRestSeen(step) {
  const s = getSettings()
  s.kidRest = todayKey() + ':' + step
  writeDeferred(KEY_SETTINGS, s)
}

// 掌握度：level>=4 视为掌握
function getMasteredCount(lang) {
  const prog = getProgress()
  return getWords(lang).filter(w => prog[w.id] && prog[w.id].level >= 4).length
}

// 页面/App 只需要调这一个：把两个模块攒的脏数据一起落盘
function flushAll() {
  flush()
  try { require('./speaking').flush() } catch (e) { logger.warn('[storage] 口语数据落盘失败', e) }
  // 句子进度是独立模块（utils/sentence-progress.js），一并落盘
  try { require('./sentence-progress').flush() } catch (e) { logger.warn('[storage] 句子进度落盘失败', e) }
}

// 导出全部学习数据：返回可序列化的普通对象（v2 含口语数据）
function exportData() {
  flush()
  let speak = null
  try { speak = require('./speaking').exportData() } catch (e) { logger.warn('[storage] 导出时读口语数据失败', e) }
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
  writeProgressAll(migrateProgress(data.progress))
  write(KEY_STATS, data.stats)
  write(KEY_SETTINGS, data.settings)
  write(KEY_DAILY, data.daily)
  // v3：恢复自建素材与主题
  if (data.custom) write(KEY_CUSTOM, data.custom)
  if (data.theme) write(KEY_THEME, data.theme)
  // v2：恢复口语数据
  if (data.speak && data.version >= 2) {
    try { require('./speaking').importData(data.speak) } catch (e) { logger.warn('[storage] 导入口语数据失败', e) }
  }
  return { ok: true, version: data.version || 1 }
}

module.exports = {
  init, todayKey, getSettings, setLang, getCurrentLang, setDailyGoal,
  setFeedbackEnabled, setGuideSeen, setLearnCat, setAiEvalAgreed, getVoiceprintAgreed, setVoiceprintAgreed, getTheme, setFontScale, setDarkMode,
  addPracticeSeconds, getPracticeSeconds, getGuardianAgreed, setGuardianAgreed, getKidAiUnlocked, setKidAiUnlocked, kidRestSeen, markKidRestSeen,
  getCustomItems, addCustomItems, removeCustomItem,
  getProgress, getStats, getDaily, getDueWords, getNewWords, getToday,
  review, quizAnswer, getMasteredCount, INTERVALS,
  markKnown, getKnownIds, restoreKnown, KNOWN_AHEAD_DAYS,
  exportData, importData, migrateProgress, invalidate, flush,
  FLUSH_DELAY, flushAll, PROGRESS_SHARDS, writeProgressAll
}
