// 网络发音缓存：同一句话第二次要听，直接放本地文件，不再走网络。
//
// 真实场景：一句话练三遍（标准音 → 慢速 → AB 复读）就是 3~4 次请求，
// 弱网每次 200~400ms，用户听到的是「点了半天才出声」。缓存后除第一次外都是 0 请求。
//
// 只缓存网络源（有道 / 百度）下载到的 mp3；日语随包音频本来就在本地（utils/local-audio.js），
// 不经过这里。
//
// 缓存额度来自 utils/file-budget.js：本地文件空间是录音和缓存共用的一份 10MB，
// 录音分 6MB、这里分 2.5MB（大约 400 句短句），按最近最少使用淘汰。
// 两端共用一个账本，就不会再出现「两个模块各自按整份配额估算、谁后写谁静默失败」。
const budget = require('./file-budget')
const MAX_BYTES = budget.TTS_BYTES
const KEY = 'lp_tts_cache_v1'   // 设备级缓存，不分档案（同一个设备上音源是共享的）
const DIR_NAME = 'tts'
let _index = null               // { [hash]: { path, size, at } }

function fs() {
  try { return wx.getFileSystemManager() } catch (e) { return null }
}
function dirPath() {
  const base = (wx.env && wx.env.USER_DATA_PATH) || ''
  return base ? base + '/' + DIR_NAME : ''
}
// 文件名用 URL 的 32 位哈希：URL 里含文本与语速，天然区分「同句不同速」
function hashOf(url) {
  const s = String(url || '')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0x7fffffff
  return h.toString(36) + '_' + s.length.toString(36)
}
function loadIndex() {
  if (_index) return _index
  let raw = ''
  try { raw = wx.getStorageSync(KEY) } catch (e) {}
  try { _index = raw ? JSON.parse(raw) : {} } catch (e) { _index = {} }
  return _index
}
function saveIndex() {
  try { wx.setStorageSync(KEY, JSON.stringify(_index || {})) } catch (e) {}
}
function ensureDir() {
  const f = fs()
  const dir = dirPath()
  if (!f || !dir) return false
  try { f.accessSync(dir) } catch (e) {
    try { f.mkdirSync(dir, true) } catch (e2) { return false }
  }
  return true
}
function exists(path) {
  const f = fs()
  if (!f || !path) return false
  try { f.accessSync(path); return true } catch (e) { return false }
}

// 命中返回本地路径，否则返回 ''
function fileOf(url) {
  const idx = loadIndex()
  const hit = idx[hashOf(url)]
  if (!hit || !hit.path) return ''
  if (!exists(hit.path)) {
    delete idx[hashOf(url)]      // 文件被系统清掉了，顺手把索引也清干净
    saveIndex()
    return ''
  }
  hit.at = Date.now()            // 记录使用时间，供 LRU 淘汰
  return hit.path
}

function totalBytes() {
  const idx = loadIndex()
  let n = 0
  Object.keys(idx).forEach(function (k) { n += idx[k].size || 0 })
  return n
}

// 按「最久未使用」淘汰到上限以内。
// limit 可选：录音写失败时会被要求压到更小的额度（见 utils/recordings.js），
// 此时不能只看默认上限，否则「压过了但没压够」。
function trim(limit) {
  const cap = typeof limit === 'number' && limit >= 0 ? limit : MAX_BYTES
  const idx = loadIndex()
  const keys = Object.keys(idx)
  let total = 0
  keys.forEach(function (k) { total += idx[k].size || 0 })
  if (total <= cap) return 0
  const f = fs()
  const ordered = keys.slice().sort(function (a, b) { return (idx[a].at || 0) - (idx[b].at || 0) })
  let dropped = 0
  for (let i = 0; i < ordered.length && total > cap; i++) {
    const k = ordered[i]
    const e = idx[k]
    if (f && e && e.path) { try { f.unlinkSync(e.path) } catch (err) {} }
    total -= (e && e.size) || 0
    delete idx[k]
    dropped += 1
  }
  saveIndex()
  return dropped
}

// 把下载到的临时文件复制进缓存目录。
// 注意必须「复制」不能「移动」（wx.saveFile / saveFileSync 都是移动语义）：
// 传进来的临时文件正在被播放器播放，移走就等于把正在播的文件删掉。
function store(url, tempFilePath) {
  const f = fs()
  if (!f || !tempFilePath || !ensureDir()) return ''
  const hash = hashOf(url)
  const idx = loadIndex()
  const target = dirPath() + '/' + hash + '.mp3'
  let size = 0
  try {
    f.copyFileSync(tempFilePath, target)
    try { size = f.statSync(target).size || 0 } catch (e) {}
  } catch (e) {
    console.warn('[tts-cache] 缓存写入失败', e)
    return ''
  }
  idx[hash] = { path: target, size: size, at: Date.now() }
  saveIndex()
  trim()
  return target
}

// 丢掉单条（缓存文件损坏 / 播放失败时用）：删文件 + 删索引
function forget(url) {
  const idx = loadIndex()
  const hash = hashOf(url)
  const e = idx[hash]
  if (!e) return
  const f = fs()
  if (f && e.path) { try { f.unlinkSync(e.path) } catch (err) {} }
  delete idx[hash]
  saveIndex()
}

function clear() {
  const idx = loadIndex()
  const f = fs()
  Object.keys(idx).forEach(function (k) {
    if (f && idx[k].path) { try { f.unlinkSync(idx[k].path) } catch (e) {} }
  })
  _index = {}
  saveIndex()
}

module.exports = { fileOf, store, forget, trim, clear, totalBytes, hashOf, MAX_BYTES }
