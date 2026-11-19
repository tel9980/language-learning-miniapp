# 在线词库 · Cloudflare Pages（已上线）

**线上地址：<https://yb.qy663.de5.net/data.json>** —— Cloudflare Pages + 已备案域名。

- Pages 项目名：`yuban-data`（默认域名 `yuban-data.pages.dev`）
- 版本号是**内容指纹**（`c` + sha1 前 13 位）：词库没改就不变版本，用户不会白拉一份同样的 134KB
- 响应头：`Access-Control-Allow-Origin: *`、`Cache-Control: public, max-age=0, must-revalidate` + ETag
  （所以要更新是**立刻**生效，不需要等缓存过期）
- 与仓库 `deploy/data.json` **逐字节一致**（部署脚本最后一步会自己验一遍）

## 一条命令发布

```bash
bash deploy/cf/deploy.sh
```

它会：① 重新导出 `deploy/data.json` 与 `deploy/cf/data.json` → ② `wrangler pages deploy` →
③ 拉一次线上地址，打印版本号和各语种条数（版本不对会直接报错退出）。

token 自动从 `~/.dsh/cf-token` 读，也可以用环境变量 `CLOUDFLARE_API_TOKEN` 覆盖。
权限需要 **Cloudflare Pages:Edit**（注意 `*.pages.dev` 和 Pages 是两套接口，只有 Workers 权限不够）。

> ⚠️ Cloudflare 的规则：**修改一个已有 token 的权限，必须点「Roll / 重新生成」拿到新值才生效**，
> 旧值仍然只带旧权限。本次就卡在这里（权限勾了、值没换 → 一直 403）。

不想碰 token 也可以手动传：把 `deploy/cf/` 下的 `index.html`、`data.json`、`_headers`、`404.html`
打包成 zip，控制台 → Workers & Pages → Create → **Pages → Upload assets** → 拖进去，项目名填 `yuban-data`。

## 目录内容

```
deploy/cf/
├── index.html         ← 人看的说明页（读 data.json 显示版本与条数）
├── data.json          ← 词库本体（由 deploy/export-data.js 自动同步过来，别手改）
├── 404.html           ← 自定义 404
├── _headers           ← Pages 响应头（只加 CORS，其它交给 Pages 默认）
├── deploy.sh          ← ⭐ 一条命令发布 + 自检
├── build-worker.js    ← （旧方案）把 data.json 内联成 worker.js
├── push-worker.js     ← （旧方案）上传 Worker 并打开 workers.dev 路由
├── setup-domain.js    ← （旧方案）给 Worker 挂域名：CNAME + Worker 路由
└── README.md
```

## 域名是怎么挂上的

`yb` → `yuban-data.pages.dev` 的 **proxied CNAME** + Pages 项目里的 **Custom domain**
（Pages 侧登记在 `POST /accounts/{acc}/pages/projects/yuban-data/domains`）。

**一个 hostname 只能挂一个来源**：Worker 路由和 Pages 自定义域不能同时指向同一域名，
同时存在时 Worker 路由优先，Pages 永远收不到请求。切换时顺序是：
先删 Worker 路由 → 再加 Pages 自定义域（或反过来）。

## 旧方案：Worker（保留，可作自测）

`build-worker.js` + `push-worker.js` 会把 data.json 内联进脚本（约 157KB，远低于 Worker 1MB 上限）
直接提供同样的 JSON：

- 地址：<https://yuban-data.tel9980-fb9.workers.dev/data.json>
- 但 `*.workers.dev` **不是备案域名**，加不进小程序白名单，**只适合自测**
- Worker 首次上传后 `workers.dev` 路由默认是关的，访问会 `404 error code: 1042`，
  `push-worker.js` 里已经带上了打开它的调用

## 备案这道坎（已解决）

小程序真机要求 request 合法域名**做过 ICP 备案**。`qy663.de5.net` 是已备案域名，
`yb.qy663.de5.net` 走的就是它，所以真机可用——**前提是**去微信公众平台 →
开发管理 → 开发设置 → 服务器域名 → **request 合法域名**里加上：

```
https://yb.qy663.de5.net
```

没加也不影响练习：客户端拉不到会静默回退到内置词库，只是「改了词库不更新」。
开发者工具里可以先勾掉「校验合法域名」自测。

## 顺带托管的日语音频

发布时 `deploy.sh` / CI 会把 `packageJa/ja/*.mp3`（353 条、约 1.8MB）复制到 `deploy/cf/audio/`、把 `packageEn/en/*.mp3`（148 条、约 0.95MB）复制到 `deploy/cf/audio-en/` 一起发布，线上地址形如
`https://yb.qy663.de5.net/audio/js015.mp3`。

用途：小程序里日语音频在 `packageJa` 分包，个别真机上 `wx.loadSubpackage` 会失败；这时客户端改流播这份 CDN 副本
（`utils/local-audio.js` 的 `remoteFor()`），避免「点了没声音」。`deploy/cf/audio/` 不进仓库（见 `.gitignore`），
每次发布由脚本从分包目录现铺。
