// 按需查词增强 Worker（Cloudflare Worker，模块语法）
//
// 作用：小程序查词时，词库里没有的词由这里现问一次 Google Gemini，返回
// 「中文释义 + 2 个例句 + 1 条用法提示」。结果进 KV 缓存 30 天，同一个词只花一次配额。
//
// 为什么需要它（而不是前端直连 Google）：
//   1. API Key 不能进小程序：前端包会被反编译，Key 泄露 = 别人拿你的额度刷账单；
//   2. 国内直连 Google 不通：用户只需要连 ai.qy663.de5.net（已备案域名），
//      由 Cloudflare 出海去调 Google；
//   3. 同一个词被多人查时，KV 缓存把成本压到接近 0。
//
// 路由：GET /lookup?q=word&lang=en|ja|vi
// 绑定：AI_CACHE（KV 命名空间）、GEMINI_API_KEY（secret）
//
// 明确不做的事：不写词库、不落库到 data.json。AI 生成的内容只作为「查词参考」显示在页面上
// （页面标注「AI 生成，仅供参考」），词库仍然只能通过 git push + CI 测试上线。

// 模型名会被 Google 下线，所以按顺序试：先便宜的 flash-lite，不行再往上退。
// 改这里就能换模型，不用动逻辑。
// 2026-11 实测：gemini-2.0/2.5-flash 系列对新用户已经 404（"no longer available to new users"），
// gemini-3.8-flash 时常 503（high demand），所以列表里同时放 lite、latest 别名和主力款。
const MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.8-flash']
const MAX_Q = 40
const CACHE_TTL = 60 * 60 * 24 * 30   // 30 天
// 每个 IP 每天真调 Gemini 的次数上限（缓存命中不计数）。
// 目的是防止有人拿这个公开地址刷额度：小程序是公开的，Worker 地址也一样公开。
const DAILY_LIMIT = 300         // 每个出口 IP（一家人共用一个 WiFi 时共享这一份额度）
const DEVICE_DAILY_LIMIT = 120  // 每台设备：避免同一 WiFi 下一台机器把全家的额度吃光
const LIMIT_TTL = 60 * 60 * 24 * 2
const UA_OK = ['en', 'ja', 'vi', 'ko']

// 发音评测（/eval）：把用户的一段录音发给多模态模型，让它说人话式的定性反馈。
// 只给小程序的日语/越南语用户用——这两种语言没有可用的客观评测插件（智聆只支持中英文）。
// 录音每次不一样，没法缓存，所以日配额单独设一个小值。
const EVAL_DAILY_LIMIT = 60
const EVAL_DEVICE_LIMIT = 30
const EVAL_MAX_B64 = 400 * 1024      // 约 300KB 音频，正常 10 秒录音只有 20KB 左右
const EVAL_MAX_TEXT = 120
const EVAL_MIME = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-m4a', 'audio/webm', 'audio/ogg']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }, CORS, extra || {})
  })
}

// 每 IP 每天计数：KV 自增做不了原子操作，少量并发会少记几次——
// 这里只要拦住「刷」，不需要精确账本。
async function bumpLimit(env, ip, prefix, limit) {
  if (!env.AI_CACHE) return { allowed: true, used: 0 }
  const day = new Date().toISOString().slice(0, 10)
  const key = 'rl:' + (prefix || '') + day + ':' + ip
  try {
    const cur = await env.AI_CACHE.get(key)
    const n = cur ? (parseInt(cur, 10) || 0) : 0
    if (n >= (limit || DAILY_LIMIT)) return { allowed: false, used: n }
    await env.AI_CACHE.put(key, String(n + 1), { expirationTtl: LIMIT_TTL })
    return { allowed: true, used: n + 1 }
  } catch (e) {
    return { allowed: true, used: 0 }   // KV 出错就放行，别把功能弄死
  }
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
}

// 设备标识：客户端生成的一串随机字母数字（存在本机 settings 里），只用来分摊额度，
// 不含任何用户信息，也不落日志。格式不合法的直接当没有。
function deviceId(request) {
  const raw = request.headers.get('x-device-id') || ''
  return /^[a-z0-9-]{6,48}$/i.test(raw) ? raw : ''
}

// 额度：先看设备，再看出口 IP。
// 以前只按 IP 算，一家人共用同一个 WiFi 就是一个池子，谁查猛了别人就没额度，
// 而提示只写「明天再来」，用户根本不知道是被自己家另一台手机用掉的。
async function takeQuota(env, request, prefix, ipLimit, devLimit) {
  const dev = deviceId(request)
  if (dev) {
    const d = await bumpLimit(env, dev, prefix + 'd:', devLimit)
    if (!d.allowed) return { allowed: false, scope: 'device', limit: devLimit }
  }
  const ip = await bumpLimit(env, clientIp(request), prefix, ipLimit)
  if (!ip.allowed) return { allowed: false, scope: 'network', limit: ipLimit }
  return { allowed: true }
}

const LANG_NAME = { en: '英语', ja: '日语', vi: '越南语', ko: '韩语' }
function buildPrompt(q, lang) {
  const isJa = lang === 'ja'
  const isVi = lang === 'vi'
  const isKo = lang === 'ko'
  const langName = LANG_NAME[lang] || '英语'
  return [
    '你是一位严谨的' + langName + '老师，正在为一个中国学习者解释一个词。',
    '词：' + q,
    '请只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字。字段：',
    '{',
    '  "found": true 或 false（这个词是否真实存在、不是你编的）,',
    '  "word": "规范写法（' + langName + '原文）",',
    '  "phonetic": "音标或读音（' + (isJa ? '罗马音' : (isVi ? '带声调符号的越南语写法 + 近似 IPA' : (isKo ? '韩国官方罗马字转写 Revised Romanization' : 'IPA，带斜杠'))) + '）",',
    '  "meaning": "中文释义，词性缩写开头，最多 40 字",',
    '  "examples": [{"text": "' + langName + '例句", "cn": "中文翻译"}],  // 恰好 2 条，日常场景',
    '  "tip": "一条最容易犯的错或用法提醒，中文，最多 50 字"',
    '}',
    '如果这个词不存在或你不确定，返回 {"found": false}，不要编造。'
  ].join('\n')
}

async function askGemini(env, q, lang) {
  let lastErr = null
  for (let i = 0; i < MODELS.length; i++) {
    try {
      return await askModel(env, MODELS[i], q, lang)
    } catch (e) {
      lastErr = e
      // 换模型有用的情况：模型下线(404)、临时过载(503)、本模型配额用完(429)；
      // 参数错(400)、鉴权错(403) 换哪个都一样，直接抛。
      if (!/ 404| 429| 503|NOT_FOUND|overloaded/.test(String(e && e.message))) throw e
    }
  }
  throw lastErr || new Error('gemini unavailable')
}

async function askModel(env, MODEL, q, lang) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    MODEL + ':generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(q, lang) }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
    })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error('gemini ' + res.status + ': ' + text.slice(0, 200))
  }
  const data = await res.json()
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts) || []
  const raw = parts.map(function (p) { return p.text || '' }).join('')
  if (!raw) throw new Error('gemini returned empty text')
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    // 模型偶尔会包一层 ```json，兜一下
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('gemini returned non-json')
    obj = JSON.parse(m[0])
  }
  return normalize(obj, q, lang)
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function normalize(obj, q, lang) {
  if (!obj || obj.found === false) return { ok: true, found: false, q: q, lang: lang }
  const ex = Array.isArray(obj.examples) ? obj.examples : []
  return {
    ok: true,
    found: true,
    q: q,
    lang: lang,
    word: str(obj.word, 40) || q,
    phonetic: str(obj.phonetic, 40),
    meaning: str(obj.meaning, 80),
    examples: ex.slice(0, 3).map(function (e) {
      return { text: str(e && e.text, 160), cn: str(e && e.cn, 160) }
    }).filter(function (e) { return e.text }),
    tip: str(obj.tip, 120),
    source: 'ai'
  }
}


// ---------- 发音评测（/eval） ----------
//
// 为什么要它：智聆只有中英文，日语和越南语没有客观评分，用户只能自己凭感觉。
// 多模态模型听一段录音能给「哪里不对」的具体话，这比一个假分数有用得多。
// 明确不做的事：不给 0-100 分——模型不懂音素对齐，打出来的分比没有更糟。

const EVAL_LANG_NAME = { en: '英语', ja: '日语', vi: '越南语', ko: '韩语' }

function evalPrompt(text, lang) {
  return [
    '你是' + (EVAL_LANG_NAME[lang] || '英语') + '发音教练。下面这段录音是一个中国学习者在朗读这句话：',
    '"' + text + '"',
    '',
    '请仔细听这段录音，只做定性判断，不要打分。严格返回这个 JSON 结构：',
    '{"verdict":"一句话总评，中文，25 字以内",',
    ' "issues":["具体问题，中文，每个 20 字以内"],',
    ' "tip":"一条最值得改的建议，中文，30 字以内"}',
    '',
    '要求：',
    '1. issues 最多 3 条，只说能从录音里听出来的问题（声调/音调、长短音、辅音、元音、语速、吞音、断句）；',
    '2. 听不出来的方面不要编，宁可少写；录音明显没声音或听不清时，verdict 写"没听清，录得近一点再试一次"，issues 给空数组；',
    '3. 不要复述原句，不要给分数，不要用英文回答。'
  ].join('\n')
}

async function askEval(env, b64, mime, text, lang) {
  let lastErr = null
  for (let i = 0; i < MODELS.length; i++) {
    const MODEL = MODELS[i]
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      MODEL + ':generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: evalPrompt(text, lang) },
            { inlineData: { mimeType: mime, data: b64 } }
          ]
        }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    })
    if (!res.ok) {
      const body = await res.text()
      lastErr = new Error('gemini ' + res.status + ': ' + body.slice(0, 160))
      // 模型下线/过载才换下一个，参数错误换模型也没用
      if (/ 404| 429| 503|NOT_FOUND|overloaded|high demand/i.test(' ' + res.status + ' ' + body)) continue
      throw lastErr
    }
    const data = await res.json()
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) || []
    const raw = parts.map(function (p) { return p.text || '' }).join('')
    if (!raw) { lastErr = new Error('gemini returned empty text'); continue }
    let obj
    try { obj = JSON.parse(raw) } catch (e) {
      const m = raw.match(/\{[\s\S]*\}/)
      if (!m) { lastErr = new Error('gemini returned non-json'); continue }
      try { obj = JSON.parse(m[0]) } catch (e2) { lastErr = new Error('gemini returned bad json'); continue }
    }
    return normalizeEval(obj)
  }
  throw lastErr || new Error('no model available')
}

function cut(v, n) {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}

function normalizeEval(obj) {
  const issues = Array.isArray(obj && obj.issues) ? obj.issues : []
  return {
    ok: true,
    verdict: cut(obj && obj.verdict, 60) || '听到了，但没听出具体问题。',
    issues: issues.filter(function (x) { return String(x || '').trim() }).slice(0, 3).map(function (x) { return cut(x, 40) }),
    tip: cut(obj && obj.tip, 60),
    source: 'ai'
  }
}

// ---------- 对练（/translate）----------
// 用户说一句中文，返回目标语言里最自然的说法。和 /eval 一样把录音交给多模态模型，
// 区别在输出是「这句话怎么说」而不是「你读得准不准」。
// 只挂在「口语练习 → 情景对话」的对练模式里，不做独立翻译页（个人主体 + 教育类目，
// 独立翻译入口容易被判成工具类应用而驳回）。
const TR_DAILY_LIMIT = 120
const TR_DEVICE_LIMIT = 60
const TR_MAX_B64 = 400 * 1024
const TR_MAX_TEXT = 200

function trPrompt(to, scene, hint) {
  const toName = LANG_NAME[to] || '英语'
  return [
    '你是口语陪练。用户在学' + toName + '，刚才说了一句话（通常是中文，也可能夹外语或带口音）。',
    scene ? '当前场景：' + scene : '',
    hint ? '这个场景的标准台词是：' + hint : '',
    '请只输出一个 JSON 对象，不要 markdown，不要任何解释文字。字段：',
    '{',
    '  "text": "用户刚才说的原话（转写成中文，去掉「嗯、那个」这类口头语）",',
    '  "translation": "这句话在' + toName + '里最自然的说法（口语，别用书面语，一句话）",',
    '  "note": "一条提醒：指出中式表达、或给出更地道的选项，中文，最多 40 字；没有就留空字符串"',
    '}',
    '如果实在听不清，返回 {"text": "", "translation": "", "note": "没听清"}，不要编。'
  ].filter(Boolean).join('\n')
}

async function askTranslate(env, b64, mime, to, scene, hint) {
  // 没传录音时只发文本（体测/调试用）；传了录音就带上 inlineData 让模型听。
  // 名字别用 parts：循环体里解析响应已经有 const parts，同块内会撞 TDZ
  const reqParts = [{ text: trPrompt(to, scene, hint) }]
  if (b64) reqParts.push({ inlineData: { mimeType: mime, data: b64 } })
  let lastErr = null
  for (let i = 0; i < MODELS.length; i++) {
    const MODEL = MODELS[i]
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      MODEL + ':generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: reqParts }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
      })
    })
    if (!res.ok) {
      const body = await res.text()
      lastErr = new Error('gemini ' + res.status + ': ' + body.slice(0, 160))
      if (/ 404| 429| 503|NOT_FOUND|overloaded|high demand/i.test(' ' + res.status + ' ' + body)) continue
      throw lastErr
    }
    const data = await res.json()
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) || []
    const raw = parts.map(function (p) { return p.text || '' }).join('')
    if (!raw) { lastErr = new Error('gemini returned empty text'); continue }
    let obj
    try { obj = JSON.parse(raw) } catch (e) {
      const m = raw.match(/\{[\s\S]*\}/)
      if (!m) { lastErr = new Error('gemini returned non-json'); continue }
      try { obj = JSON.parse(m[0]) } catch (e2) { lastErr = new Error('gemini returned bad json'); continue }
    }
    return normalizeTr(obj)
  }
  throw lastErr || new Error('no model available')
}

function normalizeTr(obj) {
  const text = cut(obj && obj.text, 80)
  const translation = cut(obj && obj.translation, 120)
  // 模型听不清时会返回空 translation —— 这不是错误，如实告诉用户重说一次，
  // 别把「没听清」当成「翻译不出来」。
  if (!translation) {
    return { ok: false, error: 'unclear', message: '这句没听清，靠近一点再说一次', source: 'ai' }
  }
  return {
    ok: true,
    text: text,
    translation: translation,
    note: cut(obj && obj.note, 50),
    source: 'ai'
  }
}

async function handleTranslate(request, env) {
  if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'not-configured' }, 503)
  let body
  try { body = await request.json() } catch (e) { return json({ ok: false, error: 'bad-body' }, 400) }
  const b64 = String((body && body.audio) || '')
  const text = String((body && body.text) || '').trim()
  const to = UA_OK.indexOf(body && body.to) >= 0 ? body.to : 'en'
  const scene = cut(body && body.scene, 20)
  const hint = cut(body && body.hint, 60)
  let mime = String((body && body.mime) || 'audio/mpeg')
  if (EVAL_MIME.indexOf(mime) < 0) mime = 'audio/mpeg'
  if (!b64 && !text) return json({ ok: false, error: 'empty' }, 400)
  if (b64 && b64.length > TR_MAX_B64) return json({ ok: false, error: 'audio-too-long', message: '说太长啦，一句就够' }, 413)
  if (text.length > TR_MAX_TEXT) return json({ ok: false, error: 'text-too-long' }, 400)

  const limit = await takeQuota(env, request, 'tr:', TR_DAILY_LIMIT, TR_DEVICE_LIMIT)
  if (!limit.allowed) {
    return json({
      ok: false,
      error: 'rate-limited',
      message: limit.scope === 'device'
        ? '这台设备今天的对练次数用完了（每台每天 ' + limit.limit + ' 次），明天再来。'
        : '今天这个网络的对练次数用完了（同一网络每天 ' + limit.limit + ' 次），明天再来。'
    }, 429, { 'Cache-Control': 'no-store' })
  }

  let payload
  try {
    payload = await askTranslate(env, b64, mime, to, scene, hint)
  } catch (e) {
    return json({ ok: false, error: 'upstream', detail: String(e && e.message || e).slice(0, 200) }, 502)
  }
  return json(payload, 200, { 'Cache-Control': 'no-store' })
}

async function handleEval(request, env) {
  if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'not-configured' }, 503)
  let body
  try { body = await request.json() } catch (e) { return json({ ok: false, error: 'bad-body' }, 400) }
  const b64 = String((body && body.audio) || '')
  const text = String((body && body.text) || '').trim()
  const lang = UA_OK.indexOf(body && body.lang) >= 0 ? body.lang : 'en'
  let mime = String((body && body.mime) || 'audio/mpeg')
  if (EVAL_MIME.indexOf(mime) < 0) mime = 'audio/mpeg'
  if (!b64) return json({ ok: false, error: 'empty-audio' }, 400)
  if (b64.length > EVAL_MAX_B64) return json({ ok: false, error: 'audio-too-long', message: '录音太长了，10 秒以内最合适' }, 413)
  if (!text) return json({ ok: false, error: 'empty-text' }, 400)
  if (text.length > EVAL_MAX_TEXT) return json({ ok: false, error: 'text-too-long' }, 400)

  const limit = await takeQuota(env, request, 'ev:', EVAL_DAILY_LIMIT, EVAL_DEVICE_LIMIT)
  if (!limit.allowed) {
    return json({
      ok: false,
      error: 'rate-limited',
      message: limit.scope === 'device'
        ? '这台设备今天的 AI 评测次数用完了（每台每天 ' + limit.limit + ' 次），明天再来。'
        : '今天的 AI 评测次数用完了（同一个网络每天 ' + limit.limit + ' 次），明天再来。'
    }, 429, { 'Cache-Control': 'no-store' })
  }

  let payload
  try {
    payload = await askEval(env, b64, mime, text, lang)
  } catch (e) {
    return json({ ok: false, error: 'upstream', detail: String(e && e.message || e).slice(0, 200) }, 502)
  }
  return json(payload, 200, { 'Cache-Control': 'no-store' })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    // 根路径给个人看的：这个域名不是网站，只有两个接口。
    // 不做成一类「健康检查要靠日志」的黑盒，打开就知道活着没、缓存和 Key 在不在。
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        service: '语伴 AI 助手',
        note: '这是接口地址，没有网页可看。小程序里不需要打开它。',
        endpoints: [
          { path: '/lookup?q=invoice&lang=en', method: 'GET', what: '查词（en / ja / vi）：释义 + 音标 + 例句' },
          { path: '/eval', method: 'POST', what: 'AI 听音：上传一段录音，返回定性反馈（不打分）' },
          { path: '/translate', method: 'POST', what: '对练：上传一段中文录音，返回目标语言怎么说' }
        ],
        cache: !!env.AI_CACHE,
        configured: !!env.GEMINI_API_KEY
      }, 200, { 'Cache-Control': 'no-store' })
    }

    if (url.pathname === '/eval') {
      if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405)
      return handleEval(request, env)
    }
    if (url.pathname === '/translate') {
      if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405)
      return handleTranslate(request, env)
    }
    if (url.pathname !== '/lookup') {
      return json({ ok: false, error: 'not-found' }, 404)
    }

    const q = (url.searchParams.get('q') || '').trim()
    const lang = UA_OK.indexOf(url.searchParams.get('lang')) >= 0 ? url.searchParams.get('lang') : 'en'
    if (!q) return json({ ok: false, error: 'empty-query' }, 400)
    if (q.length > MAX_Q) return json({ ok: false, error: 'query-too-long' }, 400)
    if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'not-configured' }, 503)

    const cacheKey = 'v1:' + lang + ':' + q.toLowerCase()
    if (env.AI_CACHE) {
      try {
        const hit = await env.AI_CACHE.get(cacheKey, 'json')
        if (hit) return json(Object.assign({ cached: true }, hit), 200, { 'Cache-Control': 'public, max-age=86400' })
      } catch (e) { /* 缓存坏了不影响主流程 */ }
    }

    const limit = await takeQuota(env, request, '', DAILY_LIMIT, DEVICE_DAILY_LIMIT)
    if (!limit.allowed) {
      const msg = limit.scope === 'device'
        ? '这台设备今天的 AI 查词次数用完了（每台设备每天 ' + limit.limit + ' 次），明天再来，或者先看词库里有没有。'
        : '今天的 AI 查词次数用完了（同一个网络每天 ' + limit.limit + ' 次，家里几台手机共用这一份），明天再来。'
      return json({ ok: false, error: 'rate-limited', message: msg }, 429, { 'Cache-Control': 'no-store' })
    }

    let payload
    try {
      payload = await askGemini(env, q, lang)
    } catch (e) {
      return json({ ok: false, error: 'upstream', detail: String(e && e.message || e).slice(0, 200) }, 502)
    }

    // 只缓存「查到了」的结果：否定结果也缓存会让拼错的词永远查不到
    if (env.AI_CACHE && payload.found) {
      try {
        await env.AI_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL })
      } catch (e) { /* 忽略 */ }
    }
    return json(payload)
  }
}
