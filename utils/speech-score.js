// 发音评测
//
// 主路径：智聆口语评测插件（ihearing-eval, provider wx63d6102e26f0a3f8）
//   它自己录音 + 直接返回发音准确度/流畅度/完整度，以及逐词的匹配情况，
//   比「先识别成文字、再在本地算文字相似度」准得多——后者只要识别器猜对了词
//   就给满分，发音含糊也照样高分，本质是「识别准确率」不是「发音准确度」。
//
// 备用路径：微信同声传译（WechatSI）实时转文字 + 本地 Levenshtein 相似度。
//
// 两者都不可用（未添加插件 / 该语种不支持 / 调用失败）→ 静默降级为纯自评，
// 绝不阻断练习。

// ---------- 智聆口语评测 ----------
const EVAL_PLUGIN = 'ihearing-eval'   // 提供方 appid wx63d6102e26f0a3f8，见 app.json 的 plugins
const MAX_CONTENT_WORDS = 15 // 插件限制：content 不超过 15 个词
const DEFAULT_SCORE_COEFF = 1.5 // [1.0, 4.0]，1.0 最宽松；对学习者偏宽松一点更友好

let evalPlugin = null
let evalState = 'unknown' // unknown | ready | unavailable

function getEvalPlugin() {
  if (evalPlugin) return evalPlugin
  if (evalState === 'unavailable') return null
  try {
    evalPlugin = requirePlugin(EVAL_PLUGIN) // 未添加插件时这里会抛错
    evalState = evalPlugin ? 'ready' : 'unavailable'
    return evalPlugin
  } catch (e) {
    evalState = 'unavailable'
    return null
  }
}

// 智聆目前只提供中英文评测，日语不支持 → 日语继续走自评
function supportsLang(lang) {
  return lang !== 'ja'
}

// 按文本判断能不能评测：素材是英文、用户却把语言切到日语时，仍然应该能评测
const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff]/
function canEvaluateText(text) {
  if (KANA_RE.test(String(text || ''))) return false
  return getEvalPlugin() != null
}

function canEvaluate(lang) {
  if (!supportsLang(lang)) return false
  return getEvalPlugin() != null
}

// ---------- 微信同声传译（备用） ----------
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

// 任意一种评测方式可用即返回 true。
// 传 lang 时按语种判断：智聆只认中英文，日语只能靠同声传译（不挑语种）。
function isSupported(lang) {
  if (lang) {
    if (canEvaluate(lang)) return true
    return getPlugin() != null
  }
  return getEvalPlugin() != null || getPlugin() != null
}

// 归一化：小写、去标点、去多余空格
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}，。！？；：、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countWords(s) {
  const t = normalizeText(s)
  return t ? t.split(' ').length : 0
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

// 插件返回的分数字段偶尔缺失或为字符串，统一成 0..100 的数字
function num(v) {
  const n = Number(v)
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

// 单词模式看准确度；句子模式再掺入完整度和流畅度（漏词、卡顿都该扣分）
function scoreOf(result, mode) {
  const acc = num(result.pron_accuracy)
  if (mode === 'word') return Math.round(acc)
  const comp = num(result.pron_completion)
  const flu = num(result.pron_fluency)
  return Math.round(acc * 0.7 + comp * 0.2 + flu * 0.1)
}

// tag: 0 匹配 / 1 插入 / 2 删除 / 3 替代 / 4 oov / 5 unknown
const TAG_TEXT = { 1: '多读', 2: '漏读', 3: '读错', 4: '生词', 5: '未识别' }

function wrongWordsOf(result) {
  const words = Array.isArray(result && result.words) ? result.words : []
  return words
    .filter(w => w && Number(w.tag) !== 0)
    .map(w => ({
      word: w.word || '',
      tag: Number(w.tag),
      tagText: TAG_TEXT[Number(w.tag)] || '',
      accuracy: Math.round(num(w.pron_accuracy))
    }))
}

// 创建一个评测器：{ supported, start, stop, evalMode }
// opts: { text, lang, scoreCoeff, onStart, onResult({score, accuracy, fluency, completion, filePath, wrongWords}), onError(res) }
//
// ⚠️ 插件内部自己调用 wx.getRecorderManager()（全局单例）来录音，会给它挂
// onStop/onStart/onError。所以走插件时**不要**再自己开 RecorderManager，
// 否则两边的回调会互相覆盖。录音文件从 onResult 的 filePath 拿。
function createEvaluator(opts) {
  opts = opts || {}
  const unsupported = { supported: false, evalMode: 'word', start() {}, stop() {} }
  const p = getEvalPlugin()
  if (!p || typeof p.getRecordRecognitionManager !== 'function') return unsupported

  const text = String(opts.text || '')
  if (!text.trim()) return unsupported
  if (countWords(text) > MAX_CONTENT_WORDS) return unsupported // 太长插件不收，交给自评

  let manager
  try { manager = p.getRecordRecognitionManager() } catch (e) { return unsupported }
  if (!manager || typeof manager.start !== 'function') return unsupported

  const evalMode = countWords(text) <= 1 ? 'word' : 'sentence'

  manager.onStart = function () {
    if (opts.onStart) opts.onStart()
  }
  manager.onStop = function (res) {
    const result = (res && res.result) || {}
    const score = scoreOf(result, evalMode)
    if (opts.onResult) {
      opts.onResult({
        score: score,
        accuracy: Math.round(num(result.pron_accuracy)),
        fluency: Math.round(num(result.pron_fluency)),
        completion: Math.round(num(result.pron_completion)),
        filePath: (res && res.tempFilePath) || '',
        wrongWords: wrongWordsOf(result)
      })
    }
  }
  manager.onError = function (res) {
    if (opts.onError) opts.onError(res)
  }

  return {
    supported: true,
    evalMode: evalMode,
    start() {
      try {
        manager.start({
          content: text,
          evalMode: evalMode,
          scoreCoeff: opts.scoreCoeff || DEFAULT_SCORE_COEFF,
          duration: 60000
        })
      } catch (e) {
        if (opts.onError) opts.onError(e)
      }
    },
    stop() {
      try { manager.stop() } catch (e) {}
    }
  }
}

// 同声传译的实时识别器（备用路径）：{ start, stop, supported }
// 重要：WechatSI 的识别管理器是从麦克风"实时录音识别"，不能识别已有录音文件。
// opts: { targetText, lang, onResult({score, recognized}), onError() }
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

// 同声传译 TTS 是否可用（智聆只有评测、没有合成，所以单独判断）
function canTts() {
  const p = getPlugin()
  return !!(p && typeof p.textToSpeech === 'function')
}

// 同声传译 TTS 合成：文字 → 本地临时音频文件，作为外链发音全挂时的最终备用发音源
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

module.exports = {
  EVAL_PLUGIN,
  MAX_CONTENT_WORDS,
  isSupported,
  canEvaluate,
  canEvaluateText,
  supportsLang,
  countWords,
  normalizeText,
  similarity,
  scoreOf,
  wrongWordsOf,
  createEvaluator,
  createRecognizer,
  canTts,
  tts
}
