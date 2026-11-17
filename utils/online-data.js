// 在线素材：从配置的静态 JSON 地址拉取词库/句子，带本地缓存 + 静默降级。
// 设计目标：拉不到 / 没配置 / 测试号阶段，一律无感使用内置词库，绝不阻断练习。
const STORAGE_KEY = 'lp_online_data_v1'

// ⬇️ 这里填你备案域名的 JSON 地址，例如：
// const DATA_URL = 'https://你的域名.com/yuban/data.json'
// 留空 '' 表示不启用在线更新（默认，完全离线）。
const DATA_URL = ''

// 进程内缓存：getOverride 会被 getWords/getSentences 高频调用，避免每次读 Storage
let _cacheLoaded = false
let _cacheVal = null

function configured() {
  return !!(typeof DATA_URL === 'string' && DATA_URL.indexOf('https://') === 0)
}

function getCache() {
  if (_cacheLoaded) return _cacheVal
  try { _cacheVal = wx.getStorageSync(STORAGE_KEY) || null } catch (e) { _cacheVal = null }
  _cacheLoaded = true
  return _cacheVal
}

function saveCache(payload) {
  _cacheVal = payload
  _cacheLoaded = true
  try { wx.setStorageSync(STORAGE_KEY, payload) } catch (e) {}
}

// 供 words.js / sentences.js 读取覆盖数据：{ words: {en:[...]}, sentences: {...}, dialogues: {...}, version }
function getOverride() {
  const cache = getCache()
  return (cache && cache.data) ? cache.data : null
}

// 启动时异步检查更新；cb(result) 可选，result={ok,updated,reason}
function checkUpdate(cb) {
  if (!configured()) { if (cb) cb({ ok: false, reason: 'not-configured' }); return }
  wx.request({
    url: DATA_URL,
    method: 'GET',
    timeout: 8000,
    success(res) {
      try {
        if (res.statusCode !== 200 || !res.data || typeof res.data !== 'object') throw new Error('bad-response')
        const d = res.data
        if (!d.words && !d.sentences && !d.dialogues) throw new Error('empty-data')
        const old = getCache()
        const payload = { data: d, fetchedAt: Date.now() }
        // 版本号相同则跳过写入，避免无谓覆盖
        if (old && old.data && d.version && old.data.version === d.version) {
          if (cb) cb({ ok: true, updated: false, reason: 'same-version' })
          return
        }
        saveCache(payload)
        if (cb) cb({ ok: true, updated: true })
      } catch (e) {
        if (cb) cb({ ok: false, reason: 'bad-data' })
      }
    },
    fail(err) {
      // 静默降级：用缓存或内置数据，不打扰用户
      if (cb) cb({ ok: false, reason: 'network' })
    }
  })
}

// 清缓存，回到内置词库
function clearCache() {
  _cacheLoaded = true
  _cacheVal = null
  try { wx.removeStorageSync(STORAGE_KEY) } catch (e) {}
}

module.exports = { DATA_URL, configured, getOverride, checkUpdate, clearCache, getCache }
