// 按需查词增强：词库里没有的词，问一次 deploy/ai 那个 Worker（Worker 再去问 Gemini）
//
// 三条铁律：
//   1. 只做「查词参考」，不写词库。AI 生成的内容可能有错，进词库必须走 git push + CI 测试；
//   2. 页面必须标「AI 生成，仅供参考」，别让用户以为是词典释义；
//   3. Key 不在客户端：小程序只认识 https://ai.qy663.de5.net，Gemini 的 Key 在 Worker secret 里。
//
// 缓存：本地留 40 条（同一个词反复查不再花钱），Worker 侧还有 KV 缓存 30 天。

const device = require('./device')

const AI_URLS = ['https://ai.qy663.de5.net/lookup']
const CACHE_KEY = 'lp_ai_lookup_v1'
const MAX_CACHE = 40
const TIMEOUT = 15000

function configured() { return AI_URLS.length > 0 && /^https:/.test(AI_URLS[0] || '') }

function cacheAll() {
  try {
    const v = wx.getStorageSync(CACHE_KEY)
    return v && typeof v === 'object' ? v : {}
  } catch (e) {
    return {}
  }
}

function keyOf(word, lang) { return (lang || 'en') + ':' + String(word || '').trim().toLowerCase() }

function fromCache(word, lang) {
  const hit = cacheAll()[keyOf(word, lang)]
  return hit && hit.meaning ? hit : null
}

function saveCache(word, lang, payload) {
  const all = cacheAll()
  all[keyOf(word, lang)] = {
    word: payload.word, phonetic: payload.phonetic, meaning: payload.meaning,
    examples: payload.examples || [], tip: payload.tip, at: Date.now()
  }
  const keys = Object.keys(all).sort(function (a, b) { return (all[b].at || 0) - (all[a].at || 0) })
  keys.slice(MAX_CACHE).forEach(function (k) { delete all[k] })
  try { wx.setStorageSync(CACHE_KEY, all) } catch (e) {}
}

// cb({ ok, found, word, phonetic, meaning, examples: [{text, cn}], tip, cached, reason })
function lookup(word, lang, cb) {
  const q = String(word || '').trim()
  if (!q) { cb({ ok: false, reason: 'empty' }); return }
  if (!configured()) { cb({ ok: false, reason: 'not-configured' }); return }

  const hit = fromCache(q, lang)
  if (hit) {
    cb({ ok: true, found: true, cached: true, word: hit.word, phonetic: hit.phonetic,
      meaning: hit.meaning, examples: hit.examples, tip: hit.tip })
    return
  }

  wx.request({
    url: AI_URLS[0] + '?q=' + encodeURIComponent(q) + '&lang=' + (lang || 'en'),
    method: 'GET',
    timeout: TIMEOUT,
    // 设备标识：服务端用它分摊额度（同一 WiFi 下几台手机不至于互相挤占）
    header: { 'x-device-id': device.scopedId() },
    success(res) {
      const d = res && res.data
      if (res.statusCode !== 200 || !d || !d.ok) {
        cb({ ok: false, reason: (d && d.error) || 'bad-response', status: res.statusCode })
        return
      }
      if (d.found) saveCache(q, lang, d)
      cb(d)
    },
    fail() { cb({ ok: false, reason: 'network' }) }
  })
}

function clearCache() {
  try { wx.removeStorageSync(CACHE_KEY) } catch (e) {}
  return true
}

module.exports = { lookup: lookup, configured: configured, clearCache: clearCache, AI_URLS: AI_URLS, MAX_CACHE: MAX_CACHE }
