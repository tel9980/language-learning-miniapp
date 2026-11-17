// 发音评分：微信同声传译插件（WechatSI）实时语音转文字 → 与目标文本比对
// 重要：WechatSI 的识别管理器是从麦克风"实时录音识别"，不能识别已有录音文件。
// 因此在 speak 页录音时并行启动识别器：RecorderManager 负责存音频/回放，识别器负责出分数。
// 插件是"可选增强"：未添加/未授权/识别失败一律静默降级为纯自评，绝不阻断练习。

let plugin = null
let pluginState = 'unknown' // unknown | ready | unavailable

function getPlugin() {
  if (plugin) return plugin
  if (pluginState === 'unavailable') return null
  try {
    plugin = requirePlugin('WechatSI') // 未添加插件时这里会抛错
    pluginState = plugin ? 'ready' : 'unavailable'
    return plugin
  } catch (e) {
    pluginState = 'unavailable'
    return null
  }
}

function isSupported() { return getPlugin() != null }

// 归一化：小写、去标点、去多余空格
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}，。！？；：、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Levenshtein 相似度 0..1
function similarity(a, b) {
  a = normalizeText(a); b = normalizeText(b)
  if (!a || !b) return 0
  if (a === b) return 1
  const m = a.length, n = b.length
  let prev = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1); cur[0] = i
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return Math.max(0, 1 - prev[n] / Math.max(m, n))
}

// 创建一个实时识别器控制器：{ start, stop, supported }
// opts: { lang, onResult({score, recognized}), onError() }
// 与 RecorderManager 并行调用：录音开始 → start()；录音停止 → stop()，结果走 onResult。
function createRecognizer(opts) {
  opts = opts || {}
  const p = getPlugin()
  if (!p || typeof p.getRecordRecognitionManager !== 'function') {
    return { supported: false, start() {}, stop() {} }
  }
  let manager
  try { manager = p.getRecordRecognitionManager() } catch (e) {
    return { supported: false, start() {}, stop() {} }
  }
  let stopped = false
  manager.onStop = function (res) {
    const text = (res && res.result) || ''
    const score = opts.targetText ? Math.round(similarity(text, opts.targetText) * 100) : null
    if (opts.onResult) opts.onResult({ score, recognized: text })
  }
  manager.onError = function () {
    if (opts.onError) opts.onError()
  }
  return {
    supported: true,
    start() {
      stopped = false
      try {
        manager.start({
          lang: opts.lang || 'en_US',
          duration: 60000
        })
      } catch (e) {
        if (opts.onError) opts.onError()
      }
    },
    stop() {
      if (stopped) return
      stopped = true
      try { manager.stop() } catch (e) {}
    }
  }
}

// 同声传译 TTS 合成：文字 → 本地临时音频文件，作为有道外链全挂时的最终备用发音源
// cb({ok, filename})；插件未添加/合成失败一律 ok:false，调用方静默降级
function tts(text, lang, cb) {
  const p = getPlugin()
  if (!p || typeof p.textToSpeech !== 'function') { cb && cb({ ok: false }); return }
  try {
    p.textToSpeech({
      lang: lang || 'en_US',
      ttsContent: String(text || ''),
      success(res) { cb && cb({ ok: true, filename: res && res.filename }) },
      fail() { cb && cb({ ok: false }) }
    })
  } catch (e) {
    cb && cb({ ok: false })
  }
}

module.exports = { isSupported, normalizeText, similarity, createRecognizer, tts }
