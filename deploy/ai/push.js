// 部署「按需查词增强」Worker（脚本名 yuban-ai）
//
// 用法：
//   GEMINI_API_KEY=xxxx node deploy/ai/push.js        # 首次：建 KV、传脚本、设 secret、绑域名
//   node deploy/ai/push.js                            # 之后只更新代码（secret 已存在则不重设）
//
// 需要权限：Workers Scripts:Edit、Workers KV Storage:Edit、DNS:Edit、Workers Routes:Edit
// Token 来源（按优先级）：$CLOUDFLARE_API_TOKEN → $CF_API_TOKEN → 本机 ~/.dsh/cf-token
// Gemini Key 来源（按优先级）：$GEMINI_API_KEY → 本机 ~/.dsh/gemini-key
//
// 做完这件事之后，小程序侧还要在「开发管理 → 服务器域名 → request 合法域名」里加上
// https://ai.qy663.de5.net，否则真机上请求会被拦掉。
const fs = require('fs')
const os = require('os')
const path = require('path')

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || 'fb907fe08010a1b319f68be568331ce5'
const SCRIPT = process.env.AI_WORKER_NAME || 'yuban-ai'
const DOMAIN = process.env.AI_DOMAIN || 'ai.qy663.de5.net'
const ZONE_NAME = process.env.ZONE || 'qy663.de5.net'
const KV_TITLE = process.env.AI_KV_TITLE || 'yuban-ai-cache'
const API = 'https://api.cloudflare.com/client/v4'

function token() {
  const env = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN
  if (env) return env.trim()
  const p = path.join(os.homedir(), '.dsh', 'cf-token')
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  throw new Error('找不到 Cloudflare token：设置 CLOUDFLARE_API_TOKEN，或写到 ~/.dsh/cf-token')
}
function geminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const p = path.join(os.homedir(), '.dsh', 'gemini-key')
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  return ''
}

async function cf(pathname, opts) {
  // 注意合并顺序：先摊开 opts，再覆盖 headers —— 反过来写会让 opts.headers
  // 整个替换掉带 Authorization 的表头，Cloudflare 于是回 9106 "Missing X-Auth-Key"。
  const o = opts || {}
  const res = await fetch(API + pathname, Object.assign({}, o, {
    headers: Object.assign({ Authorization: 'Bearer ' + token() }, o.headers || {})
  }))
  const body = await res.json().catch(function () { return {} })
  if (!res.ok || body.success === false) {
    const err = JSON.stringify((body && body.errors) || body).slice(0, 400)
    throw new Error((opts && opts.method || 'GET') + ' ' + pathname + ' → ' + res.status + ' ' + err)
  }
  return body.result
}

async function ensureKv() {
  try {
    return await ensureKvUnsafe()
  } catch (e) {
    // token 没有 Workers KV Storage 权限时不阻断部署：Worker 没绑 KV 就走「不缓存」分支，
    // 客户端自己还有 40 条本地缓存。想补上：控制台 → My Profile → API Tokens → 加
    // Account → Workers KV Storage:Edit → Roll 出新值 → 更新 ~/.dsh/cf-token 后重跑本脚本。
    console.log('⚠️ 没有 KV 权限，跳过 KV 绑定（Worker 仍可用，只是不共享缓存）')
    console.log('   ' + String(e && e.message || e).slice(0, 160))
    return ''
  }
}

async function ensureKvUnsafe() {
  const list = await cf('/accounts/' + ACCOUNT + '/storage/kv/namespaces?per_page=100')
  const hit = (list || []).filter(function (n) { return n.title === KV_TITLE })[0]
  if (hit) return hit.id
  const created = await cf('/accounts/' + ACCOUNT + '/storage/kv/namespaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: KV_TITLE })
  })
  console.log('✅ 新建 KV 命名空间:', KV_TITLE, created.id)
  return created.id
}

async function upload(kvId) {
  const code = fs.readFileSync(path.join(__dirname, 'worker.js'), 'utf8')
  const bindings = kvId ? [{ type: 'kv_namespace', name: 'AI_CACHE', namespace_id: kvId }] : []
  const metadata = {
    main_module: 'worker.js',
    compatibility_date: '2026-01-01',
    bindings: bindings
  }
  const fd = new FormData()
  fd.set('metadata', JSON.stringify(metadata))
  fd.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js')
  await cf('/accounts/' + ACCOUNT + '/workers/scripts/' + SCRIPT, { method: 'PUT', body: fd })
  console.log('✅ 已上传 Worker 脚本:', SCRIPT)
}

async function hasSecret(name) {
  try {
    const list = await cf('/accounts/' + ACCOUNT + '/workers/scripts/' + SCRIPT + '/secrets')
    return (list || []).some(function (s) { return s.name === name })
  } catch (e) {
    return false   // 老账号可能没有 list 权限，当成没有 → 重新设一次（幂等覆盖）
  }
}

async function setSecret(name, value) {
  // 先试 REST 接口；Cloudflare 这个接口对 multipart 的校验很挑，某些账号会一直报
  // 10026 "Could not parse request body"（实测本账号就是），此时退回 wrangler ——
  // 它走的是同一套接口但组包方式不同，实测能成功。
  try {
    const fd = new FormData()
    fd.set('name', name)
    fd.set('text', value)
    fd.set('type', 'secret_text')
    await cf('/accounts/' + ACCOUNT + '/workers/scripts/' + SCRIPT + '/secrets', { method: 'PUT', body: fd })
    console.log('✅ 已设置 secret:', name)
    return
  } catch (e) {
    console.log('⚠️ REST 设 secret 失败，改用 wrangler:', String(e.message || e).slice(0, 120))
  }
  const { execFileSync } = require('child_process')
  execFileSync('npx', ['--yes', 'wrangler@3', 'secret', 'put', name, '--name', SCRIPT], {
    cwd: require('os').tmpdir(),
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: Object.assign({}, process.env, {
      CLOUDFLARE_API_TOKEN: token(), CLOUDFLARE_ACCOUNT_ID: ACCOUNT
    })
  })
  console.log('✅ 已设置 secret（wrangler）:', name)
}

async function ensureRoute(zoneId) {
  const routes = await cf('/zones/' + zoneId + '/workers/routes')
  const pattern = DOMAIN + '/*'
  if ((routes || []).some(function (r) { return r.pattern === pattern })) {
    console.log('✅ Worker 路由已存在:', pattern)
    return
  }
  try {
    await cf('/zones/' + zoneId + '/workers/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: pattern, script: SCRIPT })
    })
    console.log('✅ 新建 Worker 路由:', pattern, '→', SCRIPT)
  } catch (e) {
    // 409/10020 = 同一个 pattern 的路由已经存在（重复执行脚本时的正常情况）
    if (/ 409/.test(String(e && e.message))) {
      console.log('✅ Worker 路由已存在（409 视为成功）:', pattern)
      return
    }
    throw e
  }
}

async function ensureDns(zoneId, target) {
  const name = DOMAIN.split('.')[0]
  const records = await cf('/zones/' + zoneId + '/dns_records?per_page=100')
  const hit = (records || []).filter(function (r) { return r.name === DOMAIN })[0]
  if (hit) {
    if (hit.content === target && hit.proxied) {
      console.log('✅ DNS 已就位:', DOMAIN, '→', target)
      return
    }
    await cf('/zones/' + zoneId + '/dns_records/' + hit.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'CNAME', name: name, content: target, proxied: true, ttl: 1 })
    })
    console.log('✅ 已修正 DNS:', DOMAIN, '→', target)
    return
  }
  await cf('/zones/' + zoneId + '/dns_records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'CNAME', name: name, content: target, proxied: true, ttl: 1 })
  })
  console.log('✅ 新建 DNS:', DOMAIN, 'CNAME →', target, '(proxied)')
}

async function main() {
  const kvId = await ensureKv()
  await upload(kvId)

  const key = geminiKey()
  if (key) {
    if (await hasSecret('GEMINI_API_KEY')) {
      console.log('✅ GEMINI_API_KEY 已存在，跳过（要换 key 就设环境变量重跑）')
      if (process.env.GEMINI_API_KEY) await setSecret('GEMINI_API_KEY', key)
    } else {
      await setSecret('GEMINI_API_KEY', key)
    }
  } else {
    console.log('⚠️ 没找到 Gemini Key：设置 GEMINI_API_KEY 环境变量，或写到 ~/.dsh/gemini-key')
    console.log('   （没有 Key 时 /lookup 会返回 503 not-configured，其他功能不受影响）')
  }

  // 自定义域：CNAME 指向 workers.dev 子域 + Worker 路由接管（CNAME 指向脚本名的写法和
  // 「Worker Custom Domain」接口在这个 token 下都不可用，见 deploy/cf/README.md 的坑）
  const zone = (await cf('/zones?name=' + encodeURIComponent(ZONE_NAME)))[0]
  if (!zone) throw new Error('找不到 zone: ' + ZONE_NAME)
  const sub = await cf('/accounts/' + ACCOUNT + '/workers/subdomain')
  const target = SCRIPT + '.' + (sub && sub.subdomain) + '.workers.dev'
  await ensureDns(zone.id, target)
  await ensureRoute(zone.id)

  console.log('\n完成。自测：')
  console.log('  curl "' + 'https://' + DOMAIN + '/lookup?q=invoice&lang=en"')
  console.log('  curl "' + 'https://' + DOMAIN + '/lookup?q=領収書&lang=ja"')
  console.log('\n还差一步（手工）：小程序后台 → 开发管理 → 服务器域名 → request 合法域名加 https://' + DOMAIN)
}

main().catch(function (e) {
  console.error('❌ ' + (e && e.message || e))
  process.exit(1)
})
