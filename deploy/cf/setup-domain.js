// 把 Worker 挂到自己的备案域名上（一次性配置，幂等，重复跑没问题）
//
//   node deploy/cf/setup-domain.js                 # 默认 yb.qy663.de5.net
//   DOMAIN=data.你的域名.com node deploy/cf/setup-domain.js
//
// 做两件事：
//   1. 加一条 proxied CNAME：yb → yuban-data.tel9980-fb9.workers.dev
//   2. 给这个 hostname 加 Worker 路由：yb.qy663.de5.net/* → yuban-data
//
// 第 2 步是必须的：只有 CNAME 没有路由时，Cloudflare 会把它当成普通源站去连
// workers.dev 的公网地址，结果是 522 超时（本次就踩到了）。
const fs = require('fs')
const os = require('os')
const path = require('path')

const ZONE_NAME = process.env.ZONE || 'qy663.de5.net'
const DOMAIN = process.env.DOMAIN || 'yb.qy663.de5.net'
const WORKER = process.env.WORKER_NAME || 'yuban-data'
const WORKERS_DEV_HOST = WORKER + '.tel9980-fb9.workers.dev'

function token() {
  const env = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN
  if (env) return env.trim()
  return fs.readFileSync(path.join(os.homedir(), '.dsh', 'cf-token'), 'utf8').trim()
}

const T = token()
async function api(p, method, body) {
  const res = await fetch('https://api.cloudflare.com/client/v4' + p, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const j = await res.json().catch(function () { return {} })
  if (!res.ok || !j.success) {
    const msg = ((j.errors || [])[0] || {}).message || ('HTTP ' + res.status)
    throw new Error(method + ' ' + p + ' 失败：' + msg)
  }
  return j.result
}

async function main() {
  const zones = await api('/zones?name=' + ZONE_NAME)
  if (!zones.length) throw new Error('账号里找不到 zone：' + ZONE_NAME)
  const zoneId = zones[0].id
  console.log('zone:', ZONE_NAME, zoneId)

  // 1. CNAME（已存在就跳过；指向不对就先删再建）
  const label = DOMAIN.slice(0, DOMAIN.length - ZONE_NAME.length - 1)
  const recs = await api('/zones/' + zoneId + '/dns_records?type=CNAME&name=' + DOMAIN)
  if (recs.length) {
    const r = recs[0]
    if (r.content === WORKERS_DEV_HOST && r.proxied) {
      console.log('✅ CNAME 已存在:', DOMAIN, '→', r.content)
    } else {
      await api('/zones/' + zoneId + '/dns_records/' + r.id, 'PUT',
        { type: 'CNAME', name: label, content: WORKERS_DEV_HOST, proxied: true, ttl: 1 })
      console.log('🔁 CNAME 已改正:', DOMAIN, '→', WORKERS_DEV_HOST)
    }
  } else {
    await api('/zones/' + zoneId + '/dns_records', 'POST',
      { type: 'CNAME', name: label, content: WORKERS_DEV_HOST, proxied: true, ttl: 1, comment: '语伴在线词库（Worker）' })
    console.log('✅ 已建 CNAME:', DOMAIN, '→', WORKERS_DEV_HOST)
  }

  // 2. Worker 路由（有 CNAME 没路由 = 522 超时）
  const pattern = DOMAIN + '/*'
  const routes = await api('/zones/' + zoneId + '/workers/routes')
  const hit = routes.find(function (x) { return x.pattern === pattern })
  if (hit && hit.script === WORKER) {
    console.log('✅ 路由已存在:', pattern, '→', hit.script)
  } else if (hit) {
    await api('/zones/' + zoneId + '/workers/routes/' + hit.id, 'PUT', { pattern: pattern, script: WORKER })
    console.log('🔁 路由已改指:', pattern, '→', WORKER)
  } else {
    await api('/zones/' + zoneId + '/workers/routes', 'POST', { pattern: pattern, script: WORKER })
    console.log('✅ 已建路由:', pattern, '→', WORKER)
  }

  console.log('')
  console.log('线上地址：https://' + DOMAIN + '/data.json')
  console.log('说明页　：https://' + DOMAIN + '/')
  console.log('记得把这个域名加进小程序后台的 request 合法域名。')
}

main().catch(function (e) { console.error('❌', e.message); process.exit(1) })
