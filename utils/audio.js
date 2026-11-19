// 音频工具：统一 TTS 地址生成 + 播放管理 + 发音源降级兜底
//
// 日语素材优先播随包发布的离线音频（utils/local-audio.js），不联网也不占配额。
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
const localAudio = require('./local-audio')
const ttsCache = require('./tts-cache')
const pkgAudio = require('./pkg-audio')

// 单次下载的看门狗时长：wx.downloadFile 没有 timeout 参数，默认要等 60 秒才失败，
// 弱网下用户看到的就是「点了没反应」。8 秒还没下完就放弃这个源、换下一个（有道↔百度）。
// 这个值要明显长于正常首包时间（实测整句 200~400ms、分包音频约 1s），又不能长到让人觉得卡死。
const DOWNLOAD_TIMEOUT = 8000
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
    // 本地音频只有正常语速一版，慢速用变速播放实现（网络源靠 URL 参数区分，不受影响）
    if (opts.rate && opts.rate !== 1) {
      try { ctx.playbackRate = opts.rate } catch (e) {}
    }
    // 真实播放起点：逐词高亮不能从「点下去」开始计时 ——
    // 网络源第一次要点下载（几百毫秒，弱网更久），字幕会先跑完、声音后到。
    // 老基础库没有 onPlay 时退化为立即回调，行为和以前一致。
    if (opts.onPlay) {
      if (typeof ctx.onPlay === 'function') {
        ctx.onPlay(function () { try { opts.onPlay() } catch (e) {} })
      } else {
        try { opts.onPlay() } catch (e) {}
      }
    }
    // 真实时长：逐词高亮按它对齐，比按字数估算准得多。
    // duration 在部分机型上要 canplay 之后才可读，所以延后一拍取。
    // 变速播放时实际耗时是 duration/rate，这里一并换算成「播放实际耗时」。
    if (opts.onDuration && typeof ctx.onCanplay === 'function') {
      ctx.onCanplay(function () {
        setTimeout(function () {
          const cur = ctx
          if (!cur || !(cur.duration > 0)) return
          const rate = opts.rate && opts.rate > 0 ? opts.rate : 1
          try { opts.onDuration(cur.duration * 1000 / rate) } catch (e) {}
        }, 200)
      })
    }
    ctx.play()
  }
  function stop() {
    if (ctx) { try { ctx.stop() } catch (e) {} }
  }
  return { play, stop, destroy }
}

// 直接流播一个远程 mp3（不经过 downloadFile：真机上 InnerAudioContext 播网络音频
// 不受 downloadFile 合法域名限制）。分包加载失败时用它播 CDN 上的同一批离线音频。
function playRemote(url, slow, handlers) {
  let lp = null
  function start() {
    lp = createPlayer({
      rate: slow ? 0.75 : 1,
      onPlay() { if (handlers.onPlay) handlers.onPlay() },
      onEnded: handlers.onEnded,
      onDuration(ms) { if (handlers.onDuration) handlers.onDuration(ms) },
      onError(err) {
        console.error('[audio] CDN 离线音频播放失败', url, err && (err.errMsg || err))
        if (handlers.onError) handlers.onError(err)
      }
    })
    lp.play(url)
  }
  start()
  return {
    remote: true,
    stop() { if (lp) lp.stop() },
    destroy() { if (lp) lp.destroy() },
    retry() { start() }
  }
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

  // 随包音频优先：日语素材的 mp3 打在代码包里（见 utils/local-audio.js），
  // 播到就是 0 请求、0 配额、断网可用。真出问题（文件缺失/解码失败）再退回网络链。
  const localPath = handlers.id ? localAudio.pathFor(handlers.id) : ''
  // 日语音频在分包里，分包没加载完时 pathFor 返回空串。日语整句又没有可用的在线源
  // （有道只支持词、百度 403、同声传译只支持中英文），所以这里不能直接退在线链，
  // 而是等分包加载完再播本地文件——否则用户看到的就是「日语句子读不出来」。
  if (handlers.id && !localPath && !handlers._waitedJa &&
      localAudio.langOf(handlers.id) === 'ja' && !localAudio.isReady('ja')) {
    if (handlers.onLoading) handlers.onLoading(true)
    let cancelled = false
    let inner = null
    localAudio.ensureLoaded('ja').then(function () {
      if (cancelled) { if (handlers.onLoading) handlers.onLoading(false); return }
      const again = Object.assign({}, handlers, { _waitedJa: true })
      if (handlers.onLoading) handlers.onLoading(false)
      if (!localAudio.pathFor(handlers.id)) {
        // 分包没起来（个别真机会加载失败/超时）：同一批音频在 CDN 上也有一份，直接流播。
        const remote = localAudio.remoteFor(handlers.id)
        if (remote) {
          console.warn('[audio] 日语分包未就绪，改用 CDN 音频', handlers.id, remote)
          inner = playRemote(remote, slow, handlers)
          return
        }
      }
      inner = speak(text, slow, again)
    })
    return {
      pending: true,
      stop() { cancelled = true; if (inner && inner.stop) inner.stop() },
      destroy() { cancelled = true; if (inner && inner.destroy) inner.destroy() },
      retry() { if (inner && inner.retry) inner.retry() }
    }
  }
  if (localPath) {
    // 代码包内的 mp3 真机播不了（operateAudio:fail:access denied），
    // 必须先复制到用户目录再播；复制失败就直接走在线链，别让用户点了个寂寞。
    const playable = pkgAudio.ensure(localPath)
    if (!playable) {
      console.warn('[audio] 离线音频不可用，改用在线链', localPath)
      return runNetwork()
    }
    let lp = null
    let fellBack = false
    function playLocal() {
      lp = createPlayer({
        rate: slow ? 0.75 : 1,
        onPlay() { if (handlers.onPlay) handlers.onPlay() },
        onEnded: handlers.onEnded,
        onDuration(ms) { if (handlers.onDuration) handlers.onDuration(ms) },
        onError(err) {
          if (fellBack) return
          fellBack = true
          console.error('[audio] 本地音频播放失败，改用在线链', playable, err && (err.errMsg || err))
          if (lp) lp.destroy()
          const p = runNetwork()
          keep.push(p)
        }
      })
      lp.play(playable)
    }
    const keep = []
    playLocal()
    return {
      local: true,
      stop() { if (lp) lp.stop() },
      destroy() { if (lp) lp.destroy(); keep.forEach(function (p) { try { p.destroy() } catch (e) {} }) },
      retry() { if (fellBack) keep.forEach(function (p) { try { p.retry() } catch (e) {} }); else playLocal() }
    }
  }

  return runNetwork()

  // 网络发音链（本地音频不可用时走这里）
  function runNetwork() {
    let sources
    if (jaText) {
      // 日语：有道 dictvoice 只有「词」能出声（且必须带 le=jap），整句返回 0 字节或 500；
      // 百度 lan=jap 是 403；同声传译的 textToSpeech 只支持中英文。
      // 所以整句不去撞必然失败的请求，直接交给插件兜底、插件不行就报错让页面提示。
      sources = (words > 2) ? [] : [yd, ydBackup]
    } else if (words > 2) {
      sources = [bd, yd, ydBackup]
    } else {
      sources = [yd, ydBackup, bd]
    }

    let i = 0
    let triedPlugin = false
    let lastHost = ''

    // 记录「这次播的是缓存文件」，播放失败时好把坏缓存删掉、退回在线重试同一源
    let curCached = ''

    // 加载态 + 下载看门狗：同一次播放里只保存一份计时器，
    // 换源/停止/销毁都要把它清掉，否则迟到的回调会把已经切走的播放又拉起来。
    let loading = false
    let dlToken = 0        // 每次发起下载自增；回调里 token 对不上就丢弃
    let dlTimer = null

    function setLoading(on) {
      if (loading === on) return
      loading = on
      if (handlers.onLoading) { try { handlers.onLoading(on) } catch (e) {} }
    }
    function clearDownloadTimer() {
      if (dlTimer) { clearTimeout(dlTimer); dlTimer = null }
    }
    function teardown() {
      dlToken += 1
      clearDownloadTimer()
      setLoading(false)
    }
    const player = createPlayer({
      onPlay() { if (handlers.onPlay) handlers.onPlay() },
      onEnded() { if (handlers.onEnded) handlers.onEnded() },
      onDuration(ms) { if (handlers.onDuration) handlers.onDuration(ms) },
      onError() {
        if (curCached) {
          ttsCache.forget(curCached)
          curCached = ''
          i = Math.max(0, i - 1)   // 退回上一个源，改成在线下载重试
        }
        next()
      }
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
        playSource(s)
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
      console.error('[audio] 所有发音源都失败', { text: raw.slice(0, 40), id: handlers.id || '', ja: jaText, words: words })
      if (handlers.onError) handlers.onError()
    }

    // 播一个网络源：命中缓存就直接放本地文件（0 请求），否则先下载再播。
    // 下载而不是把 URL 直接丢给播放器，为的是顺手把音频存进缓存（utils/tts-cache.js），
    // 同一句下次再听就不用再联网了。
    //
    // 弱网保护：wx.downloadFile 没有 timeout 参数，默认要等 60 秒才回调失败，
    // 这段时间用户看到的是「点了没反应」。这里挂一个看门狗，超时就放弃当前源直接降级，
    // 同时把「正在加载」告诉页面（handlers.onLoading），至少让人知道它在等。
    function playSource(s) {
      const cached = ttsCache.fileOf(s.url)
      if (cached) {
        curCached = s.url
        dlToken += 1                 // 让还在飞的下载回调失效
        clearDownloadTimer()
        setLoading(false)
        player.play(cached)
        return
      }
      curCached = ''
      if (typeof wx.downloadFile !== 'function') { player.play(s.url); return }
      const token = ++dlToken
      let done = false
      setLoading(true)
      dlTimer = setTimeout(function () {
        dlTimer = null
        if (done || token !== dlToken) return
        done = true
        console.warn('[audio] 下载超时（' + DOWNLOAD_TIMEOUT + 'ms），先直连试试这个源', s.id)
        directThenNext(s)
      }, DOWNLOAD_TIMEOUT)
      function settle(res) {
        if (done || token !== dlToken) return
        done = true
        clearDownloadTimer()
        setLoading(false)
        if (res && res.statusCode === 200 && res.tempFilePath) {
          player.play(res.tempFilePath)
          ttsCache.store(s.url, res.tempFilePath)
        } else { directThenNext(s) }
      }
      try {
        wx.downloadFile({
          url: s.url,
          success(res) { settle(res) },
          fail() { settle(null) }
        })
      } catch (e) {
        // 连下载都起不来：退回让播放器自己去拉 URL（老基础库/异常情况）
        if (done || token !== dlToken) return
        done = true
        clearDownloadTimer()
        setLoading(false)
        s._direct = true
        player.play(s.url)
      }
    }

    // 下载这条路走不通时，直接把这个 URL 交给播放器流播一次。
    // 为什么需要：wx.downloadFile 受「downloadFile 合法域名」白名单限制，
    // 而 InnerAudioContext 播网络音频不校验域名。以前（没做缓存时）一直是直连，
    // 加了缓存以后一旦白名单没配全，就会出现「明明能上网却读不出这句」。
    // 每个源最多直连试一次，失败再由 player.onError → next() 换下一个源。
    function directThenNext(s) {
      if (s && !s._direct) {
        s._direct = true
        curCached = ''
        setLoading(false)
        console.warn('[audio] 下载失败/超时，改为直接流播', s.id)
        player.play(s.url)
        return
      }
      next()
    }

    next()
    return {
      stop() { teardown(); player.stop() },
      destroy() { teardown(); player.destroy() },
      retry() { teardown(); i = 0; triedPlugin = false; lastHost = ''; curCached = ''; next() }
    }
  }
}

module.exports = { ttsUrl, baiduUrl, isJapaneseText, needJapaneseVoice, createPlayer, speak, DOWNLOAD_TIMEOUT }
