// 在线素材：从配置的静态 JSON 地址拉取词库/句子，带本地缓存 + 静默降级。
// 设计目标：拉不到 / 没配置 / 测试号阶段，一律无感使用内置词库，绝不阻断练习。
const STORAGE_KEY = 'lp_online_data_v1'

// ⬇️ 这里填你备案域名的 JSON 地址，按优先级从前往后填，例如：
// const DATA_URLS = [
//   'https://你的备案域名.com/yuban/data.json',                  // 主源（如阿里云 OSS）
//   'https://yuban-data.tel9980-fb9.workers.dev/data.json'        // 备源（Cloudflare，已在线上）
// ]
// 留空数组 [] 表示不启用在线更新（默认，完全离线）。
// 主源挂了会自动试下一个，全挂就静默用内置词库，绝不阻断练习。
const DATA_URLS = []

// 兼容旧写法：DATA_URL 就是主源（导出时动态取，改了 DATA_URLS 立刻生效）

// 进程内缓存：getOverride 会被 getWords/getSentences 高频调用，避免每次读 Storage
let _cacheLoaded = false
let _cacheVal = null

function sources() {
  return (DATA_URLS || []).filter(function (u) {
    return typeof u === 'string' && u.indexOf('https://') === 0
  })
}

function configured() {
  return sources().length > 0
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

// 启动时异步检查更新；cb(result) 可选，result={ok,updated,reason,source}
// 按 DATA_URLS 顺序逐个尝试：主源失败（网络/坏数据）自动换备源，全挂就静默降级。
function checkUpdate(cb) {
  const list = sources()
  if (!list.length) { if (cb) cb({ ok: false, reason: 'not-configured' }); return }
  let i = 0

  function done(r) { if (cb) cb(r) }

  function tryNext(lastReason) {
    if (i >= list.length) { done({ ok: false, reason: lastReason || 'network' }); return }
    const url = list[i++]
    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      success(res) {
        try {
          if (res.statusCode !== 200 || !res.data || typeof res.data !== 'object') throw new Error('bad-response')
          const d = res.data
          if (!d.words && !d.sentences && !d.dialogues) throw new Error('empty-data')
          const old = getCache()
          const payload = { data: d, fetchedAt: Date.now(), source: url }
          // 版本号相同则跳过写入，避免无谓覆盖
          if (old && old.data && d.version && old.data.version === d.version) {
            done({ ok: true, updated: false, reason: 'same-version', source: url })
            return
          }
          saveCache(payload)
          done({ ok: true, updated: true, source: url })
        } catch (e) {
          tryNext('bad-data')
        }
      },
      fail() {
        // 静默降级：换下一个源，最终用缓存或内置数据，不打扰用户
        tryNext('network')
      }
    })
  }

  tryNext()
}

// 清缓存，回到内置词库
module.exports = {
  get DATA_URL() { return DATA_URLS[0] || '' },
  DATA_URLS,
  sources,
  configured,
  getOverride,
  checkUpdate,
  getCache
}
