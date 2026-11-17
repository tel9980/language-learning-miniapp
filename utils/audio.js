// 音频工具：统一 TTS 地址生成 + 播放管理 + 发音源降级兜底
// 降级链：有道主源 → 有道 type 切换 → 微信同声传译本地合成（需插件，静默降级）

function ttsUrl(text, slow) {
  return 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=' + (slow ? 1 : 2)
}

// 检测同声传译 TTS 是否可用
function pluginTtsAvailable() {
  try { return require('./speech-score').isSupported() } catch (e) { return false }
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

// 带降级的发音播放：有道主源 → 有道备源 → 同声传译本地合成
// handlers.lang 可传 'en_US'/'ja_JP' 供同声传译合成用；onFallback(source) 告知降级到哪一级
// 返回控制器，含 stop/destroy，供页面在切词/离开时清理
function speak(text, slow, handlers) {
  handlers = handlers || {}
  const mainUrl = ttsUrl(text, slow)
  const backupUrl = ttsUrl(text, !slow)
  let triedBackup = false
  let triedPlugin = false
  const player = createPlayer({
    onEnded() { if (handlers.onEnded) handlers.onEnded() },
    onError() {
      if (!triedBackup) {
        triedBackup = true
        if (handlers.onFallback) handlers.onFallback('youdao-backup')
        player.play(backupUrl)
      } else if (!triedPlugin && pluginTtsAvailable()) {
        triedPlugin = true
        if (handlers.onFallback) handlers.onFallback('wesisi-tts')
        try {
          require('./speech-score').tts(text, handlers.lang, function (r) {
            if (r && r.ok && r.filename) player.play(r.filename)
            else if (handlers.onError) handlers.onError()
          })
        } catch (e) {
          if (handlers.onError) handlers.onError()
        }
      } else if (handlers.onError) {
        handlers.onError()
      }
    }
  })
  player.play(mainUrl)
  return player
}

module.exports = { ttsUrl, createPlayer, speak }
