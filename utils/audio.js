// 音频工具：统一 TTS 地址生成 + 播放管理 + 发音源降级兜底
//
// 预生成音频（日语全部、英语的句子与台词）走 utils/local-audio.js 里的 CDN 地址，不占智聆配额。
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
  // 韩语必须带 le=ko：不带的话有道返回的是 0.1 秒的空音（200 但没声音）
  const le = ja ? '&le=jap' : (isKoreanText(text) ? '&le=ko' : '')
  return 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) +
    '&type=' + (slow ? 1 : 2) + le
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

// 越南语：没有任何在线合成源可用（有道/百度都没越南语音色，同声传译只支持中英文），
// 所有越南语发音都来自预生成 mp3。所以碰到「没有本地音频的越南语文本」时不该去撞网络，
// 直接报错让页面提示，省掉几次注定失败的请求和 8 秒看门狗。
// 用「越南语特有字母 + 声调符号」判断，而不是看用户设置的语言——设置切到越南语、
// 素材还是英语时，英语仍要能正常走在线合成。
const VI_RE = /[ăâđêôơưĂÂĐÊÔƠƯ]|[àáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i
function isVietnameseText(text) {
  return VI_RE.test(String(text || ''))
}

// 韩语：整句同样没有在线源（有道 500、百度 lan=kor 对整句失败），只能靠预生成 mp3；
// 单个词有道能读，但必须带 le=ko（见 ttsUrl）。用谚文范围判断，不看用户设置的语言。
const HANGUL_RE = /[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]/
function isKoreanText(text) {
  return HANGUL_RE.test(String(text || ''))
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

// 预生成音频（CDN 上的 mp3）：先落盘缓存，第二次起零网络。
//
// 为什么必须缓存：一句要听 4~6 次（标准 → 慢速 → AB 复读 → 影子三段），
// 每条 5~7KB，流播就得每次走一遍网络，弱网上「点了半天才出声」全集中在这里。
// CDN 的 cache-control 是 max-age=14400 + must-revalidate，靠平台 HTTP 缓存不可靠。
// 下载失败（域名没配、断网）就退回流播，行为不比以前差。
function playRemote(url, slow, handlers, onFail) {
  let lp = null
  let dlTimer = null
  let destroyed = false
  let triedStream = false

  function start(src, kind) {
    if (destroyed) return
    lp = createPlayer({
      rate: slow ? 0.75 : 1,
      onPlay() { if (handlers.onPlay) handlers.onPlay() },
      onEnded: handlers.onEnded,
      onDuration(ms) { if (handlers.onDuration) handlers.onDuration(ms) },
      onError(err) {
        const msg = String((err && err.errMsg) || err || '')
        // 本地文件播不了（开发者工具常见 operateAudio:fail:access denied，
        // 也可能是缓存文件被系统清掉了）：先当坏缓存丢掉，再直接流播 CDN 兜一次。
        // 不这么做的话，一条坏缓存会让这个词一直「读不出来」，直到手动清缓存。
        if (kind !== 'url') {
          if (ttsCache.fileOf(url) === src) ttsCache.forget(url)
          console.error('[audio] CDN 音频本地播放失败', kind, url, msg)
          if (!triedStream && !destroyed) {
            triedStream = true
            start(url, 'url')
            return
          }
        }
        console.error('[audio] CDN 预生成音频播放失败', url, msg)
        if (onFail) onFail(err)
        else if (handlers.onError) handlers.onError(err)
      }
    })
    lp.play(src)
  }

  function stream() {
    console.warn('[audio] CDN 音频下载失败，改为直接流播', url)
    triedStream = true
    start(url, 'url')
  }

  function tryCache() {
    const loc = ttsCache.fileOf(url)
    if (loc) { start(loc, 'cache'); return true }
    return false
  }

  function download() {
    if (typeof wx.downloadFile !== 'function') { start(url, 'url'); return }
    let done = false
    dlTimer = setTimeout(function () {
      if (done) return
      done = true
      if (!destroyed) stream()
    }, DOWNLOAD_TIMEOUT)
    wx.downloadFile({
      url: url,
      success(res) {
        if (done) return
        done = true
        clearTimeout(dlTimer)
        if (destroyed) return
        if (res.statusCode === 200 && res.tempFilePath) {
          const loc = ttsCache.store(url, res.tempFilePath)
          start(loc || res.tempFilePath, loc ? 'cache' : 'temp')
        } else {
          stream()
        }
      },
      fail() {
        if (done) return
        done = true
        clearTimeout(dlTimer)
        if (!destroyed) stream()
      }
    })
  }

  if (!tryCache()) download()

  return {
    remote: true,
    stop() { if (lp) lp.stop() },
    destroy() {
      destroyed = true
      clearTimeout(dlTimer)
      if (lp) lp.destroy()
    },
    retry() {
      destroyed = false
      triedStream = false
      if (lp) lp.destroy()
      lp = null
      if (!tryCache()) download()
    }
  }
}

// 预取：把下一条的预生成音频先下到缓存里（不播）。
// 用户点「下一句」时文件已经在本地，切换是瞬时的；失败什么都不做。
function prefetch(id, lang) {
  const url = id ? localAudio.remoteFor(id) : ''
  if (!url) return
  if (ttsCache.fileOf(url)) return
  if (typeof wx.downloadFile !== 'function') return
  const downloadNow = function () {
    wx.downloadFile({
      url: url,
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) ttsCache.store(url, res.tempFilePath)
      },
      fail() {}
    })
  }
  // 只在 WiFi 下预取：平均每条 6.4KB，一场 100 张就是 640KB 用户流量，
  // 而预取只是「提前一点」——点播本来就是按需下载，不值得替用户花这笔钱。
  if (typeof wx.getNetworkType !== 'function') { downloadNow(); return }
  wx.getNetworkType({
    success(res) { if (res && res.networkType === 'wifi') downloadNow() },
    fail() {}
  })
}

// 带降级的发音播放
//
// 源顺序按「词 / 句」分流，避免整句一上来就撞有道的 500：
//   单词（<=2 词）→ 有道 → 有道备源 → 百度
//   整句（>2 词） → 百度 → 有道 → 有道备源
//   日语单词      → 有道 → 有道备源（百度 lan=jap 会 403，不试）
//   日语整句      → 同声传译插件（有道对日语句子同样 500，装了插件就直接上）
//   越南语        → 只用预生成 mp3（没有任何在线源），没有音频就老实报错
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

  // 预生成音频（日语/英语的句子、台词、日语单词）：见 utils/local-audio.js。
  // 唯一可用路径 = 流播 CDN 上的同一批 mp3（InnerAudioContext 播 URL 不受域名白名单限制）。
  // 为什么不打进代码包：真机实测 FileSystemManager 读不到分包内的文件（日志
  // 「[pkg-audio] 读不到代码包内的音频 /packageJa/ja/js001.mp3」），InnerAudioContext 也不允许
  // 直接播包内 mp3（operateAudio:fail:access denied）——打进包既播不了，又白占 3.8MB 上传体积
  // 和用户下载流量，所以 mp3 放在仓库 audio-src/ 由 CI 发到 CDN，代码包里一条都不留。
  const region = handlers.id ? localAudio.langOf(handlers.id) : ''
  if (handlers.id && region) {
    const remoteUrl = localAudio.remoteFor(handlers.id)
    let cur = null
    let net = null
    let destroyed = false

    function toNetwork() {
      if (destroyed) return
      net = runNetwork()
    }

    if (remoteUrl) cur = playRemote(remoteUrl, slow, handlers, toNetwork)
    else toNetwork()

    return {
      bundled: true,
      stop() { destroyed = true; if (cur && cur.stop) cur.stop(); if (net && net.stop) net.stop() },
      destroy() { destroyed = true; if (cur && cur.destroy) cur.destroy(); if (net && net.destroy) net.destroy() },
      retry() {
        if (handlers.onLoading) handlers.onLoading(false)
        if (net && net.retry) return net.retry()
        if (cur && cur.retry) return cur.retry()
      }
    }
  }

  return runNetwork()

  // 网络发音链（本地音频不可用时走这里）
  function runNetwork() {
    let sources
    if (isVietnameseText(raw)) {
      // 越南语没有在线源，只有预生成 mp3（上面的 localAudio 分支）。走到这里说明
      // 这条文本没有对应音频（比如 AI 现查的词），直接失败并由页面给准确提示。
      sources = []
    } else if (jaText) {
      // 日语：有道 dictvoice 只有「词」能出声（且必须带 le=jap），整句返回 0 字节或 500；
      // 百度 lan=jap 是 403；同声传译的 textToSpeech 只支持中英文。
      // 所以整句不去撞必然失败的请求，直接交给插件兜底、插件不行就报错让页面提示。
      sources = (words > 2) ? [] : [yd, ydBackup]
    } else if (isKoreanText(raw)) {
      // 韩语整句没有在线源，别去撞必然失败的请求；单个词有道带 le=ko 能读
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
    // 当前源 + 是否已经用「直连 URL」重试过：下载下来的临时文件播不了时（真机偶发、
    // 开发者工具常见 operateAudio:fail:access denied），同一个源改成直接流播再试一次，
    // 而不是白白丢掉这个源跳到下一个——否则百度+有道全都「下载成功但播不出」，直接报错。
    let curSource = null
    let triedDirect = false

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
          next()
          return
        }
        // 下载下来的临时文件播不了：同一个源改成直连 URL 再试一次
        if (curSource && !triedDirect) {
          triedDirect = true
          console.warn('[audio] 临时文件播放失败，改为直连这个源 ' + curSource.id)
          player.play(curSource.url)
          return
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
      curSource = s
      triedDirect = false
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
        triedDirect = true          // 已经在直连了，onError 不用再重试同一个源
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

module.exports = { ttsUrl, baiduUrl, isJapaneseText, needJapaneseVoice, isVietnameseText, isKoreanText, createPlayer, speak, prefetch, DOWNLOAD_TIMEOUT }
