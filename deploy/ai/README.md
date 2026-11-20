# 按需查词增强（Cloudflare Worker + Google Gemini）

> 部署凭据：token 从 `~/.dsh/cf-token` 读（与 `deploy/cf/` 同一个文件，权限 600），
> 环境变量 `CLOUDFLARE_API_TOKEN` 可覆盖，账号 ID 默认是 `deploy/ai/push.js` 里的常量。
> 需要的权限：Workers Scripts:Edit、Workers KV Storage:Edit、DNS + Workers routes（读/写）。
> KV 命名空间 `yuban-ai-cache` 用来缓存查询结果（30 天），没有这个权限也能部署，只是不缓存。

小程序查词页遇到词库里没有的词时，可以点「🤖 用 AI 查」：请求打到这个 Worker，
Worker 拿 Gemini Key 去问 Google，返回**中文释义 + 2 个例句 + 1 条用法提示**，
页面上标「AI 生成，仅供参考」，**不写进词库**。

## 为什么需要 Worker（不能前端直连 Google）

| 问题 | 直连 Google | 走这个 Worker |
| --- | --- | --- |
| API Key 存放 | 在小程序包里，会被反编译拿走刷账单 | 在 Worker secret 里，客户端看不到 |
| 国内可达性 | 用户直连 Google 不通 | 用户只连 `ai.qy663.de5.net`（备案域名），Worker 出海去调 Google |
| 成本控制 | 每次查都花钱 | 同一个词进 KV 缓存 30 天，只花一次 |
| 出错面 | 小程序里报错没人看得见 | Worker 日志能看到 upstream 报错 |

## 文件

| 文件 | 作用 |
| --- | --- |
| `worker.js` | Worker 本体（模块语法）。`GET /lookup?q=<词>&lang=en\|ja` |
| `push.js` | 一键部署：建 KV 命名空间 → 传脚本 → 设 `GEMINI_API_KEY` → 建 CNAME + Worker 路由（幂等，可反复跑） |

## 部署

```bash
# Key 放在环境变量或 ~/.dsh/gemini-key（不要写进仓库、不要写进小程序）
GEMINI_API_KEY=xxxx node deploy/ai/push.js
```

脚本做的事（全部幂等，可以反复跑）：

1. `GET /accounts/{acc}/storage/kv/namespaces` 找 `yuban-ai-cache`，没有就建；
2. 上传 `worker.js` 为脚本 `yuban-ai`，绑定 `AI_CACHE`（KV）；
3. 设 secret `GEMINI_API_KEY`（已存在则跳过，除非显式给了环境变量）；
4. 建 `ai` 的 **proxied CNAME** 指向 `yuban-ai.<subdomain>.workers.dev`，再加 Worker 路由
   `ai.qy663.de5.net/*` → `yuban-ai`。
   ⚠️ 只建 CNAME 不建路由会返回 **522**（Cloudflare 会把它当普通源站去连 workers.dev 公网地址），
   和当初挂 `yb.qy663.de5.net` 踩的是同一个坑；
   `POST /workers/domains`（Custom Domain 接口）在这个 token 下报
   405 `Method not allowed for this authentication scheme`，所以走 CNAME + 路由。

## 已经踩过的三个坑（都在 push.js 里处理了）

1. **`cf()` 合并顺序错会把 Authorization 头吃掉**：先 `Object.assign({headers}, opts)` 再摊开 `opts`，
   `opts.headers` 会把整张表头替换掉 → Cloudflare 回 `9106 Missing X-Auth-Key`。
   正确写法是先摊开 `opts`，再覆盖 `headers`。
2. **设 secret 的 REST 接口挑包体**：`PUT .../secrets` 用 multipart 会被本账号一直拒成
   `10026 Could not parse request body`（加不加 `type: secret_text` 都一样）→ 退回 `npx wrangler@3 secret put`。
3. **路由重复创建返回 409 / 10020**：脚本第二次跑必然撞上，按成功处理；DNS 与 KV 同理都是「先查再建」。

## 模型名会被 Google 下线

`gemini-2.0-flash` 已经 404（`This model ... is no longer available`），现在 Worker 里是
`const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.8-flash']`：
逐个试，只有 404（下线）/ 429（本模型配额）/ 503（过载）才换下一个，400/403 这类换模型也没用就直接抛；换模型不用改逻辑。

## 自测

```bash
curl 'https://ai.qy663.de5.net/lookup?q=invoice&lang=en'
curl 'https://ai.qy663.de5.net/lookup?q=領収書&lang=ja'
```

期望：`{"ok":true,"found":true,"word":"invoice","phonetic":"/ˈɪnvɔɪs/","meaning":"n. 发票；账单",...}`
第二次同样的词会带 `"cached":true`（KV 命中，不再消耗 Gemini 额度）。

没配 Key 时返回 `{"ok":false,"error":"not-configured"}`（503），其余功能不受影响。

## 还要手工做一件事

小程序后台 → **开发管理 → 开发设置 → 服务器域名 → request 合法域名**，加上：

```
https://ai.qy663.de5.net
```

不加的话真机上请求会被拦（开发者工具里能通、真机不行，是最容易误判的一类问题）。

## 额度与成本

- Gemini 免费额度足够「按需查词」：一个词只在第一次被查时消耗一次，之后 30 天走 KV；
- KV 免费额度 1GB / 1000 写/天，查词缓存远远用不到；
- Worker 免费额度 10 万次/天。真到顶了，是用户量真起来了，那时再谈付费。

## 边界（有意为之）

- **不写词库**：`utils/words.js` / `utils/sentences.js` 仍然只能改文件 + `git push`，
  CI 跑完 403 项单测才发布。机器生成的内容必须有人看过才能进素材。
- **不做对话/长文本**：只回答「一个词怎么讲」，避免变成通用聊天接口（那会带来内容合规与成本两头风险）。
- **不缓存否定结果**：拼错的词不会被永久钉在「查不到」上。
