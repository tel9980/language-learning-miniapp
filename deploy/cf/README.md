# 在线词库 · Cloudflare 备用源

这个目录就是给 Cloudflare Pages 用的发布目录：里面只有三个文件（外加一份 `data.json`），
部署完你得到一个 https 地址，小程序拉 `data.json` 就能远程更新素材，不用重新提交版本。

```
deploy/cf/
├── data.json     ← 由 node deploy/export-data.js 自动同步（不要手改）
├── index.html    ← 人看的说明页，顺便验数据能不能读
├── _headers      ← 让 data.json 带正确的 Content-Type 和短缓存
├── deploy.sh     ← 一条命令发布（需要 API Token）
└── README.md     ← 本文件
```

## 为什么用 Pages 而不是 Workers

`data.json` 是一份 137KB 的静态文件，没有任何逻辑。
Pages 就是静态托管，免费额度不限请求数、不限流量（Workers 有每天 10 万次请求的限制）；
以后想加逻辑（比如按语种返回不同切片）再套一个 Worker 也不迟。

## 三种部署方式（选一个）

### 方式一：控制台拖拽（最简单，不需要装东西）

1. 登录 <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Upload assets**
2. 项目名填 `yuban-data`
3. 把 `deploy/cf` 这个**目录**整个拖进去 → Deploy
4. 拿到 `https://yuban-data.pages.dev/data.json`

以后更新：改素材 → `node deploy/export-data.js` → 再拖一次。

### 方式二：命令行（适合经常更新）

```bash
# 一次性的准备：建 token（模板选 Cloudflare Pages:Edit）
export CLOUDFLARE_API_TOKEN=你的token
export CLOUDFLARE_ACCOUNT_ID=你的账号ID

bash deploy/cf/deploy.sh
```

脚本会先跑 `node deploy/export-data.js` 刷新 JSON，再 `wrangler pages deploy` 发布。
产物地址形如 `https://yuban-data.pages.dev/data.json`。

### 方式三：接 GitHub 自动发布（改完推到仓库就自动上线）

Pages → **Connect to Git** → 选 `tel9980/language-learning-miniapp`
→ 构建设置：**Framework preset = None**，**Build command 留空**，**Build output directory = `deploy/cf`**

⚠️ 这条路的坑：GitHub 集成每次推送都会触发构建，而 `deploy/cf/data.json` 只有在本地跑过
`export-data.js` 并提交后才是新的。要么养成「导出 + 提交」的习惯，要么干脆用方式一/二。

## 接进小程序

打开 `utils/online-data.js`：

```js
const DATA_URLS = [
  'https://你的备案域名.com/yuban/data.json',   // 主源（OSS / 自己的服务器）
  'https://yuban-data.pages.dev/data.json'      // 备源（Cloudflare Pages）
]
```

代码会按顺序试：主源网络失败或数据不合法 → 自动换备源；全挂就静默用内置词库。
**留空数组 `[]` 就是不启用在线更新（默认，完全离线）。**

然后到微信公众平台 → 开发管理 → 开发设置 → 服务器域名，把用到的**所有**域名加进
**request 合法域名**（多个源就要加多个）。开发者工具里可以先关掉「校验合法域名」调试。

## ⚠️ 备案这道坎

微信小程序真机要求 request 合法域名**已完成 ICP 备案**，而 `*.pages.dev` 和 `*.workers.dev`
都不是你备案的域名，**备不了案 → 真机上永远加不进白名单**。

所以：

- **只想在开发者工具里试** → 直接填 `https://yuban-data.pages.dev/data.json`，勾掉「校验合法域名」即可，零成本。
- **要真机可用** → 必须把你自己**已备案**的域名 CNAME 到 Pages：
  Pages 项目 → **Custom domains** → 添加 `data.你的域名.com` → 按提示加 CNAME 记录。
  这时小程序里填的是 `https://data.你的域名.com/data.json`，`pages.dev` 那个地址只当备用/自测。

备案是域名层面的，不在 Cloudflare 侧 —— Cloudflare 只是把内容托管出去。

## 验证部署是否真的通了

三类自测，按需要选：

1. **浏览器**：打开 `https://你的地址/` ，页面会显示版本号、生成时间和词/句/对话条数。
   数据读不出来会红字提示。
2. **命令行**：

   ```bash
   curl -s https://你的地址/data.json | head -c 200
   curl -sI https://你的地址/data.json        # 看 Content-Type / Cache-Control / CORS
   ```

3. **小程序侧**：`utils/online-data.js` 里填好地址后，启动时 `app.js` 会调 `checkUpdate`，
   返回 `{ ok:true, updated:true, source:'https://...' }` 就说明拉到了（可以临时 `console.log` 看一眼）。

## 常见问题

**Q：改了词库，小程序还是旧的？**
看两处：`_headers` 里 `data.json` 的缓存是 60 秒，等一分钟；另外代码里有版本号比对，
`version` 相同就不覆盖本地缓存——`export-data.js` 每次导出都会生成新版本号，只要真的重新导出过就没问题。

**Q：免费额度会突然收费吗？**
Pages 免费套餐的静态请求不限量、不限带宽；只有 Functions（服务端渲染/接口）才有每日调用上限。
这个目录纯静态，不会触发。

**Q：Cloudflare 在国内速度行不行？**
`pages.dev` 的节点在境外，国内访问质量一般（这也是它更适合当「备源」而不是主源的原因）。
真机可用的前提本来就是你自己的备案域名，那时通常已经在国内 CDN 上了。

**Q：能直接放 OSS 就别折腾 CF 了？**
同意 —— OSS 主源 + CF 备源是最稳的组合：OSS 挂了/欠费/被限流时，小程序自动落到 CF。
