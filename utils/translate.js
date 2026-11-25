// 对练：我说中文，它给我目标语言的说法
//
// 为什么放在「情景对话」里面、而不是做一个独立的翻译页：
//   1. 这个小程序的主体是个人、类目是教育。独立翻译入口容易被审核判成「工具类应用」，
//      和现有类目冲突（插件类目那条驳回已经吃过一次亏）；
//   2. 脱离场景的翻译对学语言没多大用。真实需要的是「在这个场景里，这句话怎么说」，
//      所以请求里会带上场景名和目标台词，模型给的说法才不会跑偏；
//   3. 四语都能用（英/日/越/韩），而微信同声传译插件的 translate 只支持中英。
//
// 隐私边界：只有用户在对练模式里主动点「开始说」、并且已经同意声纹授权，才会读录音发出去。
// Worker 不落盘、不缓存（每次录音都不一样），上传的是 mp3 的 base64，约 20-40KB。
const device = require('./device')

const ENDPOINT = 'https://ai.qy663.de5.net/translate'
const MAX_B64 = 400 * 1024      // 与 Worker 的 TR_MAX_B64 保持一致
const TIMEOUT = 25000

const MIME = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg'
}

function mimeOf(filePath) {
  const m = String(filePath || '').match(/\.([a-z0-9]+)(?:\?|$)/i)
  return (m && MIME[m[1].toLowerCase()]) || 'audio/mpeg'
}

function readBase64(filePath) {
  return new Promise(function (resolve) {
    let fs = null
    try { fs = wx.getFileSystemManager() } catch (e) { fs = null }
    if (!fs || !filePath) { resolve(''); return }
    fs.readFile({
      filePath: filePath,
      encoding: 'base64',
      success(res) { resolve(res && res.data ? String(res.data) : '') },
      fail() { resolve('') }
    })
  })
}

function fail(code, message) {
  return { ok: false, error: code, message: message || '' }
}

// 把 Worker 的错误码翻成人话（页面直接显示，不用再判断一遍）
function explain(code, fallback) {
  if (code === 'rate-limited') return fallback || '今天的对练次数用完了，明天再来。'
  if (code === 'audio-too-long') return '说太长啦，一句就够。'
  if (code === 'text-too-long') return '这句太长，对练只支持一句话。'
  if (code === 'unclear') return '这句没听清，靠近一点再说一次。'
  if (code === 'not-configured') return '对练还没配好，先跟着标准音读吧。'
  if (code === 'network') return '连不上 AI，检查网络后再试。'
  if (code === 'timeout') return 'AI 想太久没回话，再点一次试试。'
  return '这次没听明白，再说一次。'
}

// opts: { filePath, to, scene, hint } → resolve({ ok, text, translation, note })
// 也支持只用文本：{ text, to }（没录音时的兜底，测试里也用它）
function sayWhat(opts) {
  opts = opts || {}
  const to = String(opts.to || 'en')
  const plain = String(opts.text || '').trim()
  const payloadBase = {
    to: to,
    scene: String(opts.scene || '').slice(0, 20),
    hint: String(opts.hint || '').slice(0, 60)
  }

  function send(payload) {
    return new Promise(function (resolve) {
      wx.request({
        url: ENDPOINT,
        method: 'POST',
        timeout: TIMEOUT,
        header: { 'content-type': 'application/json', 'x-device-id': device.id() },
        data: payload,
        success(res) {
          const data = res && res.data
          if (data && data.ok && data.translation) {
            resolve({ ok: true, text: data.text || '', translation: data.translation, note: data.note || '' })
            return
          }
          const code = (data && data.error) || ('http-' + ((res && res.statusCode) || 0))
          resolve(fail(code, explain(code, data && data.message)))
        },
        fail(err) {
          const msg = String((err && err.errMsg) || '')
          const code = /timeout/i.test(msg) ? 'timeout' : 'network'
          resolve(fail(code, explain(code)))
        }
      })
    })
  }

  if (!opts.filePath) {
    if (!plain) return Promise.resolve(fail('no-recording', '先录一句再点这里'))
    return send(Object.assign({ text: plain }, payloadBase))
  }
  return readBase64(opts.filePath).then(function (b64) {
    if (!b64) return fail('no-recording', '录音文件读不出来，重录一次')
    if (b64.length > MAX_B64) return fail('audio-too-long', explain('audio-too-long'))
    return send(Object.assign({ audio: b64, mime: mimeOf(opts.filePath) }, payloadBase))
  })
}

module.exports = { sayWhat, explain, mimeOf, ENDPOINT }
