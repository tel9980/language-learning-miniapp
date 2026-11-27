// 在线素材：从配置的静态 JSON 地址拉取词库/句子，带本地缓存 + 静默降级。
// 设计目标：拉不到 / 没配置 / 测试号阶段，一律无感使用内置词库，绝不阻断练习。
const STORAGE_KEY = 'lp_online_data_v1'

// 在线词库地址，按优先级从前往后填：
//   主源：自己的备案域名（Cloudflare Worker，已上线）
//   以后想加 OSS 或其他镜像，往数组后面追加即可，主源失败会自动换下一个
// 留空数组 [] 表示不启用在线更新（完全离线）。
// 全挂就静默用内置词库，绝不阻断练习。
//
// ⚠️ 这个域名必须加进小程序后台的 request 合法域名，否则真机上拉不到（会静默回退）。
// ⚠️ *.workers.dev 不是备案域名、加不进白名单，所以这里只放备案域名；
//    仅开发者工具里可用：https://yuban-data.tel9980-fb9.workers.dev/data.json
const DATA_URLS = [
  'https://yb.qy663.de5.net/data.json'
]

// 版本探针（约 200 字节）。启动时先要它，版本没变就完全不碰上面那个 400KB 的整包。
// 以前是每次检查（最多每 6 小时）都 GET 整包只为比一个 version 字段 ——
// 实测 409165B / gzip 128KB，每用户每月白跑约 15MB，还和首屏抢带宽。
// 探针拉不到（老 CDN / 换域名）自动退回「直接拉整包」，行为与以前一致，不会卡住更新。
const VERSION_URLS = [
  'https://yb.qy663.de5.net/version.json'
]


// 检查频率：每 6 小时最多联网一次。
// 每次启动都拉一遍整包（约 134KB）只为比较一个版本号，纯浪费——线上是
// Cache-Control: max-age=0, must-revalidate，等于每次都真的传输。
// 词库一年改几次，滞后 6 小时完全无所谓；想立刻更新可以去「统计」页点「立即检查」。
const CHECK_INTERVAL = 6 * 60 * 60 * 1000

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
// opts.force = true 绕过节流（页面上的「立即检查」用这个）。
function versionSources() {
  return (VERSION_URLS || []).filter(function (u) {
    return typeof u === 'string' && u.indexOf('https://') === 0
  })
}

// 取线上版本号。成功返回字符串，失败返回 ''（调用方据此退回直接拉整包）。
// 用 wx.request 而不是 downloadFile：只要几十字节，走 request 能省一次落盘。
function probeVersion(next) {
  const list = versionSources()
  if (!list.length) { next(''); return }
  let i = 0
  function attempt() {
    if (i >= list.length) { next(''); return }
    const url = list[i++]
    wx.request({
      url: url,
      method: 'GET',
      timeout: 4000,
      success(res) {
        try {
          if (res.statusCode !== 200 || !res.data) throw new Error('bad')
          const d = res.data
          const v = (typeof d === 'string') ? d : d.version
          if (!v || typeof v !== 'string') throw new Error('bad')
          next(v)
        } catch (e) { attempt() }
      },
      fail() { attempt() }
    })
  }
  attempt()
}

// 启动时异步检查更新；cb(result) 可选，result={ok,updated,reason,source}
// 按 DATA_URLS 顺序逐个尝试：主源失败（网络/坏数据）自动换备源，全挂就静默降级。
// opts.force = true 绕过节流（页面上的「立即检查」用这个）。
function checkUpdate(cb, opts) {
  const list = sources()
  if (!list.length) { if (cb) cb({ ok: false, reason: 'not-configured' }); return }
  const force = !!(opts && opts.force)
  const cached = getCache()
  if (!force && cached && cached.checkedAt && Date.now() - cached.checkedAt < CHECK_INTERVAL) {
    if (cb) cb({ ok: true, updated: false, reason: 'throttled', source: cached.source || '' })
    return
  }
  let i = 0

  function done(r) { if (cb) cb(r) }

  // 只更新「上次检查时间」，不动数据（节流才有意义）
  function touch(reason, source) {
    const old = getCache()
    if (old && old.data) {
      saveCache({ data: old.data, fetchedAt: old.fetchedAt, checkedAt: Date.now(), source: source || old.source || '' })
    }
    done({ ok: true, updated: false, reason: reason, source: source || '' })
  }

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
          const now = Date.now()
          const payload = { data: d, fetchedAt: now, checkedAt: now, source: url }
          // 版本号相同则不覆盖数据，只更新「上次检查时间」，节流才有意义
          if (old && old.data && d.version && old.data.version === d.version) {
            saveCache({ data: old.data, fetchedAt: old.fetchedAt, checkedAt: now, source: url })
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

  // 先问版本号：一致就收工（省掉 128KB），不一致或问不到才去拉整包
  probeVersion(function (online) {
    const old = getCache()
    const local = (old && old.data && old.data.version) ? old.data.version : ''
    if (online && local && online === local) { touch('same-version'); return }
    tryNext()
  })
}

// 清缓存，回到内置词库
module.exports = {
  get DATA_URL() { return DATA_URLS[0] || '' },
  get VERSION_URL() { return VERSION_URLS[0] || '' },
  DATA_URLS,
  VERSION_URLS,
  sources,
  configured,
  CHECK_INTERVAL,
  getOverride,
  checkUpdate,
  getCache
}
