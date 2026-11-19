// 音频工具：统一 TTS 地址生成 + 播放管理 + 发音源降级兜底
//
// 降级链：有道主源 → 有道 type 切换 → 百度翻译 TTS → 微信同声传译本地合成（需插件）
//
// 为什么要挂百度：有道 dictvoice 本质是「词典发音」接口，单词基本没问题，
// 但整句合成经常直接返回 500（body: {"msg":"returned null audio"}）。
// 实测库里 280 条整句文本约 235 条会被它拒绝，主源和备源（只切 type）会一起挂，
// 表现就是「点了没声音」。百度翻译的 gettts 免费、无需 key、整句稳定。

// 有道词典音地址（单词首选，音质最正）
// 实测：不加 le 参数时，任何日语文本都返回同一个 1920 字节的占位文件（hash 恒定，
// 听不出任何读音）；加上 le=jap 才会返回真正的日语合成音频（18-30KB，逐词不同）。
// 所以日语必须显式带上 le=jap，否则"有声音但没声音"。
// 判定「要不要按日语合成」：有假名或有汉字 ⇒ 按日语读（「家」「部屋」这类纯汉字词
// 不加 le 只会拿到 1920 字节的静音占位文件）。纯拉丁字母的文本一律按 lang 走，
// 否则界面切到日语后练英文词（"hello"）会被读成日式口音。
const KANJI_RE = /[\u4e00-\u9fff]/
function needJapaneseVoice(text) {
  return isJapaneseText(text) || KANJI_RE.test(text || '')
}
function ttsUrl(text, slow, lang) {
  const ja = needJapaneseVoice(text)
  return 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) +
    '&type=' + (slow ? 1 : 2) + (ja ? '&le=jap' : '')
}

// 百度翻译发音地址（整句兜底）
// lan: en / zh / jp(不支持，会 403)；spd: 3 正常，2 偏慢
function baiduUrl(text, slow, lang) {
  const lan = lang === 'ja_JP' ? 'jap' : 'en'
  return 'https://fanyi.baidu.com/gettts?lan=' + lan +
    '&text=' + encodeURIComponent(text) +
    '&spd=' + (slow ? 2 : 3) + '&source=web'
}

// 文本里有没有日文假名（用来判断该走哪条发音链，而不是看用户设置的语言）
const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff]/
function isJapaneseText(text) {
  return KANA_RE.test(String(text || ''))
}

// 同声传译 TTS 是否可用（注意：智聆插件没有 textToSpeech，不能算）
function pluginTtsAvailable() {
  try {
    const sc = require('./speech-score')
    return typeof sc.canTts === 'function' ? sc.canTts() : false
  } catch (e) { return false }
}

// 创建并管理一个 InnerAudioContext；返回控制器 {play, stop, destroy}
// opts: { onEnded, onError }  —— onError 在播放失败时回调，页面可据此降级
function createPlayer(opts) {
  opts = opts || {}
  let ctx = null
  function destroy() {
    if (ctx) { try { ctx.stop(); ctx.destroy() } catch (e) {} ctx = null }
  }
  function play(src) {
    destroy()
    ctx = wx.createInnerAudioContext()
    if (opts.onEnded) ctx.onEnded(opts.onEnded)
    if (opts.onError) ctx.onError(opts.onError)
    ctx.src = src
    ctx.play()
  }
  function stop() {
    if (ctx) { try { ctx.stop() } catch (e) {} }
  }
  return { play, stop, destroy }
}

// 带降级的发音播放
//
// 源顺序按「词 / 句」分流，避免整句一上来就撞有道的 500：
//   单词（<=2 词）→ 有道 → 有道备源 → 百度
//   整句（>2 词） → 百度 → 有道 → 有道备源
//   日语单词      → 有道 → 有道备源（百度 lan=jap 会 403，不试）
//   日语整句      → 同声传译插件（有道对日语句子同样 500，装了插件就直接上）
// 最后一级若同声传译插件可用，再用它的本地合成兜底。
//
// handlers.lang 可传 'en_US'/'ja_JP'；onFallback(source) 告知降级到哪一级
// 返回控制器，含 stop/destroy/retry，供页面在切词/离开时清理
function speak(text, slow, handlers) {
  handlers = handlers || {}
  const lang = handlers.lang || 'en_US'
  const raw = String(text || '').trim()
  // 按文本判断语种：用户把语言切到日语、但素材还是英文时，不能因此把百度排掉。
  // 用 needJapaneseVoice 而不是 isJapaneseText，纯汉字日语词（「家」「部屋」）才算日语，
  // 否则它会走英文分支、白撞一次百度 lan=jap 的 403。
  const jaText = needJapaneseVoice(raw)
  // 日文没有空格，按空白分词永远是 1 个"词"，会把整句误判成单词。
  // 日文改按字符长度近似：<= 6 个字符算单词，否则算整句。
  const words = jaText
    ? (raw.length > 6 ? 99 : 1)
    : raw.split(/\s+/).filter(Boolean).length
  const yd = { id: 'youdao', url: ttsUrl(text, slow, jaText ? 'ja_JP' : lang) }
  const ydBackup = { id: 'youdao-backup', url: ttsUrl(text, !slow, jaText ? 'ja_JP' : lang) }
  const bd = { id: 'baidu', url: baiduUrl(text, slow, lang) }

  let sources
  if (jaText) {
    // 日语：有道词典音对单词还行，但整句一样会 500。
    // 装了同声传译插件就让它直接上，省掉两次必然失败的请求。
    sources = (words > 2 && pluginTtsAvailable()) ? [] : [yd, ydBackup]
  } else if (words > 2) {
    sources = [bd, yd, ydBackup]
  } else {
    sources = [yd, ydBackup, bd]
  }

  let i = 0
  let triedPlugin = false
  let lastHost = ''

  const player = createPlayer({
    onEnded() { if (handlers.onEnded) handlers.onEnded() },
    onError() { next() }
  })

  function hostOf(id) { return id === 'baidu' ? 'baidu' : 'youdao' }

  function next() {
    if (i < sources.length) {
      const s = sources[i]
      i += 1
      const host = hostOf(s.id)
      // 只有跨主机（有道↔百度）才提示，同类换 type 静默，避免刷屏
      if (lastHost && host !== lastHost && handlers.onFallback) handlers.onFallback(s.id)
      lastHost = host
      player.play(s.url)
      return
    }
    if (!triedPlugin && pluginTtsAvailable()) {
      triedPlugin = true
      if (handlers.onFallback) handlers.onFallback('wesisi-tts')
      try {
        require('./speech-score').tts(text, lang, function (r) {
          if (r && r.ok && r.filename) player.play(r.filename)
          else if (handlers.onError) handlers.onError()
        })
      } catch (e) {
        if (handlers.onError) handlers.onError()
      }
      return
    }
    if (handlers.onError) handlers.onError()
  }

  next()
  return {
    stop: player.stop,
    destroy: player.destroy,
    retry() { i = 0; triedPlugin = false; lastHost = ''; next() }
  }
}

module.exports = { ttsUrl, baiduUrl, isJapaneseText, createPlayer, speak }
