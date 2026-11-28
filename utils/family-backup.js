// 全家包备份：把一家人的所有档案一次性导出/导入，换手机/换设备不用一个个迁。
// 与 storage.exportData()（单档案）互补：这里导出"所有档案 + 全局数据"。
// 注意：录音文件是设备本地路径，无法跨设备搬运；导入后录音条目会保留但需重录声音。
const profile = require('./profile')
const progressKeys = require('./progress-keys')

const FORMAT = 'yuban-family-backup'
const VERSION = 1
const KEY_PROFILES = 'lp_profiles_v1'
const KEY_CURRENT = 'lp_profile_current_v1'
const KEY_COMMENTS = 'lp_family_comments_v1'
const KEY_REMINDER = 'lp_reminder_v1'

// 每个档案需要备份的业务 key（不含在线词库缓存，它是全局可重建的）
const PROFILE_KEYS = [
  'lp_progress_v1', 'lp_stats_v1', 'lp_settings_v1', 'lp_daily_v1',
  'lp_custom_items_v1', 'lp_theme_v1', 'lp_speak_records_v1',
  'lp_speak_focus_v1', 'lp_speak_daily_v1', 'lp_recordings_v1', 'lp_sent_progress_v1'
]

function rawGet(key) {
  try { return wx.getStorageSync(key) } catch (e) { return '' }
}
function rawSet(key, value) {
  try { wx.setStorageSync(key, value) } catch (e) { console.warn('[family-backup] 写备份数据失败', key, e) }
}
function rawRemove(key) {
  try { wx.removeStorageSync(key) } catch (e) { console.warn('[family-backup] 删备份数据失败', key, e) }
}
// 进度表在存储里按分片存放（见 utils/progress-keys.js），备份文件里仍保持
// 「整表」形状：这样新老备份互认，导入时再按当前分片规则拆开写。
function readProgressOf(profileId) {
  const merged = {}
  const legacy = parse(rawGet(profile.nsKey('lp_progress_v1', profileId)), null)
  if (legacy && typeof legacy === 'object') Object.assign(merged, legacy)
  progressKeys.shardKeys().forEach(function (k) {
    const part = parse(rawGet(profile.nsKey(k, profileId)), null)
    if (part && typeof part === 'object') Object.assign(merged, part)
  })
  return merged
}
function writeProgressOf(profileId, map) {
  const buckets = []
  for (let i = 0; i < progressKeys.SHARDS; i++) buckets.push({})
  Object.keys(map || {}).forEach(function (id) {
    buckets[progressKeys.shardIndexOf(id)][id] = map[id]
  })
  for (let i = 0; i < progressKeys.SHARDS; i++) {
    const key = profile.nsKey(progressKeys.shardKeyAt(i), profileId)
    if (Object.keys(buckets[i]).length) rawSet(key, JSON.stringify(buckets[i]))
    else rawRemove(key)
  }
  // 老整表 key 必须清掉，否则下次启动会被当成老数据再并进来
  rawRemove(profile.nsKey('lp_progress_v1', profileId))
}

function parse(v, fallback) {
  if (!v) return fallback
  try { return typeof v === 'string' ? JSON.parse(v) : v } catch (e) { return fallback }
}

// 导出全部档案 + 全局数据
function exportAll() {
  const profiles = profile.list()
  const data = {}
  profiles.forEach(function (p) {
    const bag = {}
    PROFILE_KEYS.forEach(function (k) {
      const v = rawGet(profile.nsKey(k, p.id))
      if (v) bag[k] = parse(v, null)
    })
    // 进度表：分片合并成整表再放进备份
    const mergedProgress = readProgressOf(p.id)
    if (Object.keys(mergedProgress).length) bag.lp_progress_v1 = mergedProgress
    else delete bag.lp_progress_v1
    // 录音只保留元数据，剔除本机路径，避免误导
    if (bag.lp_recordings_v1 && Array.isArray(bag.lp_recordings_v1)) {
      bag.lp_recordings_v1 = bag.lp_recordings_v1.map(function (r) {
        const c = Object.assign({}, r); delete c.filePath; return c
      })
    }
    data[p.id] = bag
  })
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    profiles: profiles,
    current: profile.current(),
    data: data,
    global: {
      comments: parse(rawGet(KEY_COMMENTS), {}),
      reminder: parse(rawGet(KEY_REMINDER), null)
    }
  }
}

// 合并两张表：字典按 id 合并（导入覆盖同 id），数组按 id 去重追加
function mergeMap(local, incoming) {
  const a = parse(local, null), b = incoming
  if (b == null) return a
  if (Array.isArray(b)) {
    const base = Array.isArray(a) ? a.slice() : []
    const ids = {}; base.forEach(function (x) { if (x && x.id) ids[x.id] = true })
    b.forEach(function (x) {
      if (!x) return
      if (x.id && ids[x.id]) {
        const i = base.findIndex(function (y) { return y && y.id === x.id })
        if (i >= 0) base[i] = x
      } else { base.push(x); if (x.id) ids[x.id] = true }
    })
    return base
  }
  if (typeof b === 'object') return Object.assign({}, (a && typeof a === 'object' ? a : {}), b)
  return b
}

function writeBag(profileId, bag, mode) {
  PROFILE_KEYS.forEach(function (k) {
    if (!(k in bag)) return
    if (k === 'lp_progress_v1') {
      const incoming = bag[k] && typeof bag[k] === 'object' ? bag[k] : {}
      writeProgressOf(profileId, mode === 'merge' ? Object.assign(readProgressOf(profileId), incoming) : incoming)
      return
    }
    const key = profile.nsKey(k, profileId)
    let value = bag[k]
    if (mode === 'merge') value = mergeMap(rawGet(key), value)
    rawSet(key, typeof value === 'string' ? value : JSON.stringify(value))
  })
}

// 导入：mode='overwrite' 清空后覆盖；'merge' 与现有数据合并
// 返回 {ok, count, reason}
function importAll(payload, mode) {
  mode = mode === 'merge' ? 'merge' : 'overwrite'
  if (!payload || payload.format !== FORMAT) return { ok: false, reason: '不是语伴全家包备份' }
  if (!Array.isArray(payload.profiles) || !payload.data) return { ok: false, reason: '备份内容不完整' }

  if (mode === 'overwrite') {
    // 先清掉现有所有档案的命名空间数据
    profile.list().forEach(function (p) {
      PROFILE_KEYS.forEach(function (k) { rawRemove(profile.nsKey(k, p.id)) })
      progressKeys.shardKeys().forEach(function (k) { rawRemove(profile.nsKey(k, p.id)) })
    })
    rawRemove(KEY_COMMENTS); rawRemove(KEY_REMINDER)
  }

  // 写档案列表（overwrite 直接替换；merge 按 id 合并）
  let profiles
  if (mode === 'merge') {
    profiles = profile.list().slice()
    const ids = {}; profiles.forEach(function (p) { ids[p.id] = true })
    payload.profiles.forEach(function (p) {
      if (!p || !p.id) return
      const i = profiles.findIndex(function (x) { return x.id === p.id })
      if (i >= 0) profiles[i] = p
      else { profiles.push(p); ids[p.id] = true }
    })
  } else {
    profiles = payload.profiles.slice()
  }
  if (profiles.length) rawSet(KEY_PROFILES, JSON.stringify(profiles))

  // 写每个档案的数据
  const count = payload.profiles.length
  payload.profiles.forEach(function (p) {
    if (p && p.id && payload.data[p.id]) writeBag(p.id, payload.data[p.id], mode)
  })

  // 全局数据
  if (payload.global) {
    if (payload.global.comments) {
      const v = mode === 'merge' ? mergeMap(rawGet(KEY_COMMENTS), payload.global.comments) : payload.global.comments
      rawSet(KEY_COMMENTS, JSON.stringify(v))
    }
    if (payload.global.reminder) rawSet(KEY_REMINDER, JSON.stringify(payload.global.reminder))
  }

  // 当前档案：仅当指向的档案存在时恢复
  if (payload.current && profiles.some(function (p) { return p.id === payload.current })) {
    try { wx.setStorageSync(KEY_CURRENT, payload.current) } catch (e) { console.warn('[family-backup] 恢复当前档案失败', e) }
  }

  // 本模块绕过 storage/speaking 直写了 Storage，必须让两者的进程内缓存失效，
  // 同时清掉 profile 自身的 list/current 缓存，否则导入后页面可能读到旧数据。
  try { profile.invalidate() } catch (e) {}
  try { require('./storage').invalidate() } catch (e) {}
  try { require('./speaking').invalidate() } catch (e) {}

  return { ok: true, count: count, mode: mode }
}

module.exports = { exportAll, importAll, FORMAT, VERSION, PROFILE_KEYS }
