// 生成 Worker 脚本：把 deploy/data.json 内联进去，部署时只需上传这一个文件。
// 用法：node deploy/cf/build-worker.js
//
// 为什么不现读 data.json：Worker 运行在 Cloudflare 边缘，没有文件系统，
// 静态资源要么用 Static Assets 要么内联。137KB 的 JSON 内联进脚本完全没问题
// （Free 计划脚本上限 3MB），而且响应时直接吐字符串，连 JSON.parse 都省了。
const fs = require('fs')
const path = require('path')

const dataPath = path.join(__dirname, '..', 'data.json')
const raw = fs.readFileSync(dataPath, 'utf8')
const d = JSON.parse(raw)
const n = function (a) { return Array.isArray(a) ? a.length : 0 }
const w = d.words || {}, s = d.sentences || {}, g = d.dialogues || {}

const stats = {
  version: d.version,
  generatedAt: d.generatedAt,
  en: { words: n(w.en), sentences: n(s.en), dialogues: n(g.en) },
  ja: { words: n(w.ja), sentences: n(s.ja), dialogues: n(g.ja) }
}

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>语伴 · 在线词库</title>
<style>body{margin:0;padding:32px 20px;font:15px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1F2430;background:#F5F7FB}
.card{max-width:640px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 6px 24px rgba(31,36,48,.08)}
h1{margin:0 0 4px;font-size:20px}.sub{color:#8A94A6;font-size:13px;margin-bottom:20px}
dl{display:grid;grid-template-columns:96px 1fr;gap:8px 12px;margin:0}dt{color:#8A94A6;font-size:13px}dd{margin:0}
code{background:#F1F4FA;padding:2px 6px;border-radius:6px;font-size:13px}.ok{color:#16A34A}
.tip{margin-top:20px;padding-top:16px;border-top:1px solid #EEF1F7;color:#8A94A6;font-size:13px}</style></head>
<body><div class="card">
<h1>语伴 · 在线词库（Cloudflare 备用源）</h1>
<div class="sub">供小程序启动时拉取素材，本身就是一份静态 JSON。</div>
<dl>
<dt>状态</dt><dd><span class="ok">✅ 运行中</span></dd>
<dt>版本号</dt><dd>${stats.version}</dd>
<dt>生成时间</dt><dd>${stats.generatedAt}</dd>
<dt>英语</dt><dd>${stats.en.words} 词 / ${stats.en.sentences} 句 / ${stats.en.dialogues} 组对话</dd>
<dt>日语</dt><dd>${stats.ja.words} 词 / ${stats.ja.sentences} 句 / ${stats.ja.dialogues} 组对话</dd>
<dt>数据文件</dt><dd><code>/data.json</code></dd>
</dl>
<div class="tip">小程序里把 <code>utils/online-data.js</code> 的 <code>DATA_URLS</code> 指到本域名的 <code>/data.json</code>，
并在小程序后台把域名加进 <b>request 合法域名</b>。真机要求域名已 ICP 备案（<code>*.workers.dev</code> 备不了案，只适合开发者工具里用）。</div>
</div></body></html>`

const code = `// 自动生成，不要手改 —— 改素材后跑 node deploy/cf/build-worker.js
// 生成时间：${new Date().toISOString()}
const VERSION = ${JSON.stringify(stats.version)}
const DATA_TEXT = ${JSON.stringify(raw)}
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': '*'
}
const HTML = ${JSON.stringify(html)}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS })
    }
    // 目标地址：/data.json（/yuban/data.json 也认，方便和 OSS 上的路径一致）
    if (url.pathname === '/data.json' || url.pathname === '/yuban/data.json') {
      return new Response(request.method === 'HEAD' ? null : DATA_TEXT, {
        headers: Object.assign({}, CORS, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=60',
          'etag': '"' + VERSION + '"'
        })
      })
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML, {
        headers: Object.assign({}, CORS, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' })
      })
    }
    return new Response('Not Found', { status: 404, headers: CORS })
  }
}
`

const out = path.join(__dirname, 'worker.js')
fs.writeFileSync(out, code)
console.log('✅ 已生成:', out, Math.round(code.length / 1024) + 'KB')
console.log('   version:', stats.version, '| en', stats.en.words, '词', stats.en.sentences, '句 | ja', stats.ja.words, '词', stats.ja.sentences, '句')
