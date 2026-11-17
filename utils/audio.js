// 音频工具：统一 TTS 地址生成 + 播放管理 + 发音源降级兜底
// 发音源：主=有道 dictvoice；备=有道 type 切换（同为外链但不同参数，主源挂时有机会救回）
// 若接入微信同声传译插件，可由页面把 pluginTTS 作为更高优先级备用源注入（见 speech-score.js）

function ttsUrl(text, slow) {
  return 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=' + (slow ? 1 : 2)
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

// 带降级的发音播放：先主源，onError 时自动切备用源（换 type 参数）
// 返回控制器，含 stop/destroy，供页面在切词/离开时清理
function speak(text, slow, handlers) {
  handlers = handlers || {}
  const mainUrl = ttsUrl(text, slow)
  const backupUrl = ttsUrl(text, !slow)
  let triedBackup = false
  const player = createPlayer({
    onEnded() { if (handlers.onEnded) handlers.onEnded() },
    onError() {
      if (!triedBackup) {
        triedBackup = true
        if (handlers.onFallback) handlers.onFallback()
        player.play(backupUrl)
      } else if (handlers.onError) {
        handlers.onError()
      }
    }
  })
  player.play(mainUrl)
  return player
}

module.exports = { ttsUrl, createPlayer, speak }
