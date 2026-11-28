// AI 听音反馈（定性，不打分）
//
// 为什么需要它：智聆口语评测只支持中文和英文，日语和越南语没有客观评分，
// 用户练完只能自己凭感觉。这里把一小段录音发给自己的 Worker，
// 让多模态模型听一遍，用中文说清楚「哪里不对」——不给 0-100 的分数，
// 因为模型不懂音素对齐，打出来的分比没有分更误导。
//
// 隐私边界：只有用户点了「AI 听听」并且同意上传，才会读录音文件发出去。
// Worker 不落盘、不缓存（每次录音都不一样），上传的是 mp3 的 base64，约 20-40KB。
const device = require('./device')
const net = require('./net')

const ENDPOINT = 'https://ai.qy663.de5.net/eval'
const MAX_B64 = 400 * 1024      // 与 Worker 的 EVAL_MAX_B64 保持一致
// 第九轮：25 秒太长，缩到 12 秒（正常 2–4 秒就回）
const TIMEOUT = 12000

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

// 读成 base64。老基础库的 FileSystemManager 一定有 readFile，失败就走 err 分支。
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
  if (code === 'rate-limited') return fallback || '今天的 AI 评测次数用完了，明天再来。'
  if (code === 'audio-too-long') return '这段录音太长了，十秒以内最合适。'
  if (code === 'text-too-long') return '这句太长，AI 评测只支持短句。'
  if (code === 'not-configured') return 'AI 评测还没配好，先用自评吧。'
  if (code === 'offline') return '现在没有网络，连上网后再试一次。'
  if (code === 'network') return '连不上 AI，检查网络后再试。'
  if (code === 'timeout') return 'AI 想太久没回话，再点一次试试。'
  return 'AI 这次没听明白，换个词再试试。'
}

// opts: { filePath, text, lang } → resolve({ ok, verdict, issues, tip }) 或 { ok:false, error, message }
function evaluate(opts) {
  opts = opts || {}
  const text = String(opts.text || '').trim()
  if (!text) return Promise.resolve(fail('empty-text', '这条没有可读的文本'))
  if (!opts.filePath) return Promise.resolve(fail('no-recording', '先录一遍再让 AI 听'))
  if (!net.isOnline()) return Promise.resolve(fail('offline', explain('offline')))
  return readBase64(opts.filePath).then(function (b64) {
    if (!b64) return fail('no-recording', '录音文件读不出来，重录一次')
    if (b64.length > MAX_B64) return fail('audio-too-long', explain('audio-too-long'))
    return new Promise(function (resolve) {
      wx.request({
        url: ENDPOINT,
        method: 'POST',
        timeout: TIMEOUT,
        header: { 'content-type': 'application/json', 'x-device-id': device.scopedId() },
        data: { audio: b64, mime: mimeOf(opts.filePath), text: text, lang: opts.lang || 'en' },
        success(res) {
          const data = res && res.data
          if (data && data.ok && data.verdict) {
            resolve({
              ok: true,
              verdict: data.verdict,
              issues: Array.isArray(data.issues) ? data.issues : [],
              tip: data.tip || ''
            })
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
  })
}

module.exports = { evaluate, explain, mimeOf, ENDPOINT }
