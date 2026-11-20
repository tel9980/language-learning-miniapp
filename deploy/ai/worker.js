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
// 路由：GET /lookup?q=word&lang=en|ja
// 绑定：AI_CACHE（KV 命名空间）、GEMINI_API_KEY（secret）
//
// 明确不做的事：不写词库、不落库到 data.json。AI 生成的内容只作为「查词参考」显示在页面上
// （页面标注「AI 生成，仅供参考」），词库仍然只能通过 git push + CI 测试上线。

// 模型名会被 Google 下线（gemini-2.0-flash 已经 404 了），所以按顺序试：
// 先便宜的 flash-lite，不行再往上退。改这里就能换模型，不用动逻辑。
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.8-flash']
const MAX_Q = 40
const CACHE_TTL = 60 * 60 * 24 * 30   // 30 天
const UA_OK = ['en', 'ja']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

function buildPrompt(q, lang) {
  const isJa = lang === 'ja'
  const langName = isJa ? '日语' : '英语'
  return [
    '你是一位严谨的' + langName + '老师，正在为一个中国学习者解释一个词。',
    '词：' + q,
    '请只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字。字段：',
    '{',
    '  "found": true 或 false（这个词是否真实存在、不是你编的）,',
    '  "word": "规范写法（' + langName + '原文）",',
    '  "phonetic": "音标或读音（' + (isJa ? '罗马音' : 'IPA，带斜杠') + '）",',
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

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
