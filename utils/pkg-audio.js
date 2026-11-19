// 代码包内音频 → 用户目录副本
//
// 为什么需要这一层（真机报错实录）：
//   [InnerAudio] operateAudio fail: errMsg="operateAudio:fail:access denied, appId=wx..."
// 也就是 InnerAudioContext **不能直接播代码包内的 mp3**（开发者工具里能播，真机上被拒绝）。
// 官方给的路子是：先把包内文件读成二进制、写进用户目录，再用用户目录的路径去播。
// 所以离线音频（英语 148 条在主包、日语 353 条在分包）第一次播放时都要复制一份。
//
// 设计要点：
//   · 复制是「按需」的：只复制真正播到的那几条（单条 5–6KB），不一次性全搬；
//   · 复制一次就记住，第二次直接播副本，不再读包；
//   · 副本是可重建的缓存，体积上限取自 utils/file-budget.js（默认 2MB），
//     超了按最久未修改优先删掉（录音是不可再生的用户资产，优先级更高）。
const budget = require('./file-budget')

const DIR_NAME = 'pkg-audio'
const MAX_BYTES = budget.PKG_AUDIO_BYTES

// 包内路径 → 可播路径。只放内存（进程重启后重新复制即可，副本还在就不会重读包）
const _ready = {}

function fsm() {
  return wx.getFileSystemManager()
}

function basePath() {
  // 极端情况下（没有 wx.env 的老环境/测试桩）直接当作不可用，
  // 由调用方退回在线链，而不是抛异常把整个播放打断。
  return (wx && wx.env && wx.env.USER_DATA_PATH) || ''
}

function dirPath() {
  const b = basePath()
  return b ? b + '/' + DIR_NAME : ''
}

// 包内路径变成扁平文件名：`/packageJa/ja/js015.mp3` → `packageJa_ja_js015.mp3`
function nameOf(p) {
  return String(p).replace(/^\/+/, '').replace(/[^\w.\-]/g, '_')
}

function sizeOf(path) {
  try {
    const st = fsm().statSync(path)
    // 老基础库 stat 返回 { size }，新的是 { stats: { size } }
    const s = st && (st.size != null ? st.size : (st.stats && st.stats.size))
    return typeof s === 'number' ? s : 0
  } catch (e) {
    return 0
  }
}

function mtimeOf(path) {
  try {
    const st = fsm().statSync(path)
    const t = st && (st.lastModifiedTime != null ? st.lastModifiedTime : (st.stats && st.stats.lastModifiedTime))
    return typeof t === 'number' ? t : 0
  } catch (e) {
    return 0
  }
}

function ensureDir() {
  try { fsm().mkdirSync(dirPath(), true) } catch (e) { /* 已存在 */ }
}

// 读取代码包内的文件字节。两种写法都试：带前导斜杠 / 不带（不同基础库要求不一样）
function readPackageFile(p) {
  const f = fsm()
  const tries = [p, String(p).replace(/^\/+/, '')]
  for (let i = 0; i < tries.length; i++) {
    try { return f.readFileSync(tries[i]) } catch (e) { /* 试下一种 */ }
  }
  return null
}

function listCopies() {
  let names = []
  try { names = fsm().readdirSync(dirPath()) || [] } catch (e) { return [] }
  return names.map(function (n) {
    const p = dirPath() + '/' + n
    return { path: p, size: sizeOf(p), at: mtimeOf(p) }
  })
}

// 副本总量超限就删最旧的（保证至少留一个，免得刚复制完就把自己删了）
function trim(keepPath) {
  const all = listCopies()
  let total = all.reduce(function (s, x) { return s + x.size }, 0)
  if (total <= MAX_BYTES) return total
  const sorted = all.slice().sort(function (a, b) { return a.at - b.at })
  for (let i = 0; i < sorted.length && total > MAX_BYTES; i++) {
    if (sorted[i].path === keepPath) continue
    if (all.length <= 1) break
    try { fsm().unlinkSync(sorted[i].path) } catch (e) { continue }
    total -= sorted[i].size
  }
  return total
}

// 把一个包内音频路径变成「能播的」路径。失败返回空串（调用方据此退回在线链）。
function ensure(pkgPath) {
  if (!pkgPath) return ''
  if (_ready[pkgPath]) return _ready[pkgPath]
  if (!basePath()) return ''
  const dest = dirPath() + '/' + nameOf(pkgPath)
  try {
    if (sizeOf(dest) > 0) {
      _ready[pkgPath] = dest
      return dest
    }
    const data = readPackageFile(pkgPath)
    if (!data) {
      console.error('[pkg-audio] 读不到代码包内的音频', pkgPath)
      return ''
    }
    ensureDir()
    fsm().writeFileSync(dest, data)
    if (sizeOf(dest) <= 0) {
      console.error('[pkg-audio] 复制后文件大小异常', pkgPath, dest)
      return ''
    }
    _ready[pkgPath] = dest
    trim(dest)
    return dest
  } catch (e) {
    console.error('[pkg-audio] 复制代码包音频失败', pkgPath, e && (e.errMsg || e.message || e))
    return ''
  }
}

function totalBytes() {
  return listCopies().reduce(function (s, x) { return s + x.size }, 0)
}

function clear() {
  listCopies().forEach(function (x) {
    try { fsm().unlinkSync(x.path) } catch (e) {}
  })
  Object.keys(_ready).forEach(function (k) { delete _ready[k] })
}

module.exports = { ensure, totalBytes, clear, trim, MAX_BYTES, DIR_NAME, nameOf }
