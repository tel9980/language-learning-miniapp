// 把 deploy/cf/worker.js 传到 Cloudflare Workers（脚本名 yuban-data）
//
// 用法：
//   node deploy/cf/build-worker.js     # 先由 deploy/data.json 生成 worker.js
//   node deploy/cf/push-worker.js      # 再上传
//
// Token 来源（按优先级）：
//   $CLOUDFLARE_API_TOKEN / $CF_API_TOKEN  →  本机 ~/.dsh/cf-token
// 需要权限：Account → Workers Scripts:Edit（Pages:Edit 不需要，走的是 Workers API）
const fs = require('fs')
const os = require('os')
const path = require('path')

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || 'fb907fe08010a1b319f68be568331ce5'
const SCRIPT = process.env.WORKER_NAME || 'yuban-data'

function token() {
  const env = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN
  if (env) return env.trim()
  const p = path.join(os.homedir(), '.dsh', 'cf-token')
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  throw new Error('找不到 Cloudflare token：设置 CLOUDFLARE_API_TOKEN，或写到 ~/.dsh/cf-token')
}

async function main() {
  const codePath = path.join(__dirname, 'worker.js')
  if (!fs.existsSync(codePath)) throw new Error('还没生成 worker.js，先跑 node deploy/cf/build-worker.js')
  const code = fs.readFileSync(codePath, 'utf8')
  const metadata = {
    main_module: 'worker.js',
    compatibility_date: '2026-01-01',
    bindings: []
  }
  const fd = new FormData()
  fd.set('metadata', JSON.stringify(metadata))
  fd.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js')

  const url = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/workers/scripts/' + SCRIPT
  const res = await fetch(url, { method: 'PUT', headers: { Authorization: 'Bearer ' + token() }, body: fd })
  const body = await res.json().catch(function () { return {} })
  if (!res.ok || !body.success) {
    console.error('❌ 上传失败', res.status, JSON.stringify(body.errors || body).slice(0, 400))
    process.exit(1)
  }
  console.log('✅ 已上传脚本:', SCRIPT, '| modified:', body.result && body.result.modified_on)

  // 打开 workers.dev 路由：脚本传上去了但没开这个开关的话，
  // 访问 *.workers.dev 会返回 404 error code: 1042。这里是幂等的，重复打开没关系。
  const subUrl = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/workers/scripts/' + SCRIPT + '/subdomain'
  const on = await fetch(subUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, previews_enabled: false })
  }).then(function (r) { return r.json() }).catch(function () { return {} })
  if (on && on.success) console.log('✅ workers.dev 路由已启用')
  else console.error('⚠️ 未能启用 workers.dev 路由，手去控制台勾一下（Settings → Domains & Routes）')
  const sub = await fetch('https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/workers/subdomain', {
    headers: { Authorization: 'Bearer ' + token() }
  }).then(function (r) { return r.json() }).catch(function () { return {} })
  const subdomain = sub && sub.result && sub.result.subdomain
  if (subdomain) {
    console.log('   线上地址：https://' + SCRIPT + '.' + subdomain + '.workers.dev/data.json')
    console.log('   说明页　：https://' + SCRIPT + '.' + subdomain + '.workers.dev/')
  }
}

main().catch(function (e) { console.error('❌', e.message); process.exit(1) })
