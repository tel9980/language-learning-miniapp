// ---- 运行时接口（下面这段被 tools/gen-local-audio.js 原样拼进 utils/local-audio.js）----

// 分包是否已经加载完：日语要等 wx.loadSubpackage 成功，英语在主包里恒为 true
const _ready = { ja: false, en: true }
let _pending = null

// 跟读队列里的素材 id 是「前缀_原始id」（句子 st_s001、对话台词 dl_d003_1），
// 而音频文件名用的是原始 id（s001 / d003_1）。两种都认，否则对话台词永远命中不了。
const ID_PREFIXES = ['st_', 'dl_', 'sp_']
function idCandidates(id) {
  const out = [id]
  for (let i = 0; i < ID_PREFIXES.length; i++) {
    const p = ID_PREFIXES[i]
    if (id.length > p.length && id.indexOf(p) === 0) out.push(id.slice(p.length))
  }
  return out
}

// 返回代码包内的音频路径；没有对应音频、或分包还没加载好时返回空字符串
function pathFor(id) {
  if (!id) return ''
  const langs = Object.keys(REGION)
  const ids = idCandidates(id)
  for (let li = 0; li < langs.length; li++) {
    const r = REGION[langs[li]]
    for (let ii = 0; ii < ids.length; ii++) {
      if (r.ids[ids[ii]]) return _ready[langs[li]] ? r.base + ids[ii] + '.mp3' : ''
    }
  }
  return ''
}

function has(id) { return !!pathFor(id) }

// 素材 id 属于哪个语种的离线包；没有返回空串
function langOf(id) {
  if (!id) return ''
  const langs = Object.keys(REGION)
  const ids = idCandidates(id)
  for (let li = 0; li < langs.length; li++) {
    for (let ii = 0; ii < ids.length; ii++) {
      if (REGION[langs[li]].ids[ids[ii]]) return langs[li]
    }
  }
  return ''
}

// 预载离线包。日语是分包，要在用户点播放之前先加载好；
// 返回 Promise<boolean>（true=可用）。没有 wx.loadSubpackage 的环境直接认为可用。
function ensureLoaded(lang) {
  const r = REGION[lang]
  if (!r) return Promise.resolve(false)
  if (_ready[lang]) return Promise.resolve(true)
  if (!r.name) { _ready[lang] = true; return Promise.resolve(true) }
  if (_pending) return _pending
  if (typeof wx === 'undefined' || typeof wx.loadSubpackage !== 'function') {
    _ready[lang] = true
    return Promise.resolve(true)
  }
  _pending = new Promise(function (resolve) {
    wx.loadSubpackage({
      name: r.name,
      success: function () {
        _ready[lang] = true
        _pending = null
        resolve(true)
      },
      fail: function (err) {
        // 加载失败不能当成致命错误：pathFor 继续返回空串，播放退回在线合成
        console.error('[local-audio] 离线包加载失败', r.name, err)
        _pending = null
        resolve(false)
      }
    })
  })
  return _pending
}

function isReady(lang) { return !!_ready[lang] }

function countOf(lang) { return REGION[lang] ? REGION[lang].count : 0 }
function stats() {
  const out = {}
  Object.keys(REGION).forEach(function (k) {
    out[k] = { count: REGION[k].count, bytes: REGION[k].bytes }
  })
  return out
}

const count = Object.keys(REGION).reduce(function (a, k) { return a + REGION[k].count }, 0)
const BASE = REGION.ja.base

module.exports = {
  REGION: REGION,
  BASE: BASE,
  idCandidates: idCandidates,
  pathFor: pathFor,
  has: has,
  langOf: langOf,
  ensureLoaded: ensureLoaded,
  isReady: isReady,
  countOf: countOf,
  stats: stats,
  count: count
}
