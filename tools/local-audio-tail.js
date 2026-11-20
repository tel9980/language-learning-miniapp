// ---- 运行时接口（下面这段被 tools/gen-local-audio.js 原样拼进 utils/local-audio.js）----

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

// 素材 id 属于哪个语种；没有返回空串
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

// 音频在 CDN 上的地址（Pages 部署时会把 audio-src/ 原样铺成 /audio/ 与 /audio-en/）。
// mp3 不进代码包：真机上 FileSystemManager 读不到分包内的文件、InnerAudioContext 也不允许
// 直接播包内 mp3（日志「[pkg-audio] 读不到代码包内的音频」「operateAudio:fail:access denied」），
// 所以随包音频的唯一可用路径就是这条 CDN 流播。
function remoteFor(id) {
  if (!id) return ''
  const langs = Object.keys(REGION)
  const ids = idCandidates(id)
  for (let li = 0; li < langs.length; li++) {
    const r = REGION[langs[li]]
    if (!r.remote) continue
    for (let ii = 0; ii < ids.length; ii++) {
      if (r.ids[ids[ii]]) return r.remote + ids[ii] + '.mp3'
    }
  }
  return ''
}

// 这个 id 有没有现成音频（本地缓存或 CDN 都算）
function has(id) { return !!remoteFor(id) }

function countOf(lang) { return REGION[lang] ? REGION[lang].count : 0 }
function stats() {
  const out = {}
  Object.keys(REGION).forEach(function (k) {
    out[k] = { count: REGION[k].count, bytes: REGION[k].bytes }
  })
  return out
}

const count = Object.keys(REGION).reduce(function (a, k) { return a + REGION[k].count }, 0)

module.exports = {
  REGION: REGION,
  idCandidates: idCandidates,
  remoteFor: remoteFor,
  has: has,
  langOf: langOf,
  countOf: countOf,
  stats: stats,
  count: count
}
