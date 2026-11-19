# 在线词库 · Cloudflare（已上线，走备案域名）

**线上地址：<https://yb.qy663.de5.net/data.json>** —— 已备案域名 + Cloudflare Worker。

- 版本 `20261119072403`｜136983 字节｜440 英语词 / 100 日语词 / 112 + 100 句 / 16 组对话
- 响应头：`Content-Type: application/json; charset=utf-8`、`Access-Control-Allow-Origin: *`、
  `Cache-Control: public, max-age=60`、`ETag: "20261119072403"`
- 与仓库里 `deploy/data.json` **逐字节一致**（部署后实测比对）
- 说明页：<https://yb.qy663.de5.net/>
- 裸 workers.dev 地址也在跑同一份脚本（<https://yuban-data.tel9980-fb9.workers.dev/data.json>），
  但 `*.workers.dev` 不是备案域名、加不进小程序白名单，**只适合自测**。

## 域名是怎么挂上的（两样东西，缺一不可）

1. **proxied CNAME**：`yb` → `yuban-data.tel9980-fb9.workers.dev`
2. **Worker 路由**：`yb.qy663.de5.net/*` → `yuban-data`

只做第 1 步会返回 **522 超时**（本次就踩到了）：没有路由时 Cloudflare 把它当普通源站，
去连 workers.dev 的公网地址，连不上就 522。

两步都是幂等的，写成脚本了：

```bash
node deploy/cf/setup-domain.js                                    # 默认 yb.qy663.de5.net
DOMAIN=data.你的域名.com ZONE=你的域名.com node deploy/cf/setup-domain.js
```

（`qy663.de5.net` 这个 zone 已经在本账号里，所以脚本能直接建 DNS 记录和路由。）

## 为什么是 Worker，不是 Pages

本机 `~/.dsh/cf-token` 的权限是 **Workers Scripts:Edit + D1:Edit**；即便后来在控制台补了
Pages:Edit，这个 token 值调 Pages 接口**仍然 403**（改权限后要重新生成 token 值才会生效），
所以走 Worker 这条路，一条命令就能上。功能上两者等价——毕竟要发的只是一份静态 JSON。

对「发一个 JSON 文件」这件事，两者代价一样：整份 data.json 内联进脚本（128KB，
Free 计划脚本上限 3MB），响应时直接吐字符串，连 `JSON.parse` 都省了。

差别只在配额和地址：

| | Worker（当前用这个） | Pages |
|---|---|---|
| 免费额度 | 10 万次请求/天 | 静态请求不限量 |
| 地址 | `yuban-data.tel9980-fb9.workers.dev` | `yuban-data.pages.dev` |
| 需要的 token 权限 | Workers Scripts:Edit | Pages:Edit |

只有「每天被拉超过 10 万次」才会碰到 Worker 的额度上限 —— 按 20 人 × 每天启动 10 次算，
一天 200 次请求，用了 0.2%。真到那个量级时，任何方案都该换成正经 CDN 了。

## 目录里都有什么

```
deploy/cf/
├── data.json          ← 由 node deploy/export-data.js 自动同步（不要手改）
├── build-worker.js    ← 把 data.json 内联成 worker.js（含说明页 HTML）
├── push-worker.js     ← 上传到 Cloudflare（顺便打开 workers.dev 路由）
├── setup-domain.js    ← 把 Worker 挂到备案域名（CNAME + Worker 路由）
├── worker.js          ← 生成物，已 gitignore
├── index.html         ← Pages 方案用的说明页（Worker 方案不用）
├── _headers           ← Pages 方案用的响应头（Worker 方案不用）
├── deploy.sh          ← Pages 方案的一条命令发布（需要 Pages:Edit）
└── README.md          ← 本文件
```

## 更新词库（改完素材后）

```bash
node deploy/export-data.js        # 重新生成 deploy/data.json 和 deploy/cf/data.json
node deploy/cf/build-worker.js    # 内联成 worker.js
node deploy/cf/push-worker.js     # 上传（token 自动读 ~/.dsh/cf-token）
```

小程序的在线词库里 `version` 会跟着导出时间变，客户端比对版本号不同才覆盖本地缓存，
所以更新后用户下次启动就是新素材，**不用重新提交小程序版本**。

想绕过本机 token，也可以设 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 环境变量，
或者换个 `WORKER_NAME` 部署到别的脚本名。

## 接进小程序

打开 `utils/online-data.js`：

**已经接好了**，`utils/online-data.js` 里就是：

```js
const DATA_URLS = [
  'https://yb.qy663.de5.net/data.json'
]
```

按顺序试：失败或返回非法数据 → 自动换下一个；全挂就静默用内置词库或缓存。
以后想加阿里云 OSS 做主源，把它加在数组前面即可（多源降级已经支持）。

然后微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → 把用到的**所有**域名加进
**request 合法域名**（多个源就要加多条）。开发者工具里可以先勾掉「校验合法域名」。

## 备案这道坎（已经解决）

微信小程序真机要求 request 合法域名**已完成 ICP 备案**。`qy663.de5.net` 是已备案域名，
`yb.qy663.de5.net` 走的就是它，所以：

- ✅ **真机可用**——前提是去微信公众平台 → 开发管理 → 开发设置 → 服务器域名 →
  **request 合法域名**里加上 `https://yb.qy663.de5.net`。
- 开发者工具里可以先勾掉「校验合法域名」自测。
- 想换域名：改 `DATA_URLS` + 重跑 `setup-domain.js`（带 `DOMAIN` / `ZONE` 环境变量）。

## 想要 Pages 版本怎么办

两条路，任选：

1. **给 token 加 Pages:Edit 权限**，再 `bash deploy/cf/deploy.sh`（脚本会先导出再发布）。
2. **控制台拖拽**：Workers & Pages → Create → Pages → Upload assets，项目名 `yuban-data`，
   把 `deploy/cf` 目录拖进去。以后更新就是「导出 → 再拖一次」。

Pages 版地址会变成 `https://yuban-data.pages.dev/data.json`，功能与当前 Worker 完全等价。

## 常见问题

**Q：部署后访问返回 `404 error code: 1042`？**
脚本传上去了但 `workers.dev` 路由没打开。`push-worker.js` 现在会自动打开（幂等）；
手动的话是 Workers → yuban-data → Settings → Domains & Routes → 启用 workers.dev。

**Q：改了词库，小程序还是旧的？**
`Cache-Control` 是 60 秒，等一分钟；另外客户端有版本号比对，`export-data.js` 每次导出都会
生成新版本号，只要真的重新导出并上传了就会更新。

**Q：Cloudflare 在国内速度行不行？**
`workers.dev` 节点在境外，国内访问质量一般 —— 这也正是它适合当**备源**而不是主源的原因。
真机可用的前提本来就是你自己的备案域名，那时一般已经在国内 CDN 上了。

**Q：这个 Worker 会不会被乱用/烧钱？**
它只读、只返回一份固定 JSON，没有参数能触发额外计算，单次执行也就几毫秒 CPU。
Free 计划每天 10 万次请求，正常用不完。
