# 在线词库更新部署指南（阿里云 OSS）

> 目标：把词库/句子放到**你已备案的域名**上，以后加词改句只改一个 JSON 文件，**不用重新提交小程序版本**。
> 拉不到时小程序自动用内置词库，**完全无感**，不影响现在的使用。

---

## 原理（30 秒看懂）

```
你的域名/yuban/data.json  ←  deploy/data.json（我导出的词库）
        ↑ 小程序启动时 wx.request 拉一次，存本地缓存
        ↑ 拉不到 / 没网 / 没配置 → 自动用 App 内置词库（现状不变）
```

微信要求：域名必须 **已备案 + https**。你的域名在阿里云备案了，满足。

---

## 第一步：建 OSS 存储桶（免费额度够个人用）

1. 打开 [阿里云 OSS 控制台](https://oss.console.aliyun.com/) → 「Bucket 列表」→「创建 Bucket」。
2. 填写：
   - **Bucket 名称**：全局唯一，例如 `yourname-yuban`（自己起，别跟人重）
   - **地域**：选离你近的，如「华东1（杭州）」
   - **读写权限**：选 **公共读**（这样小程序才能匿名拉取 JSON）
3. 创建完成。

## 第二步：上传词库文件

1. 进入刚建的 Bucket →「文件管理」→「上传文件」。
2. 上传本项目的 `deploy/data.json`（我已导出好：英语 440 词 / 112 句 / 8 组对话，日语 100 词 / 100 句 / 8 组对话）。
3. 上传后点文件右侧「详情」，复制 **URL**（形如 `https://yourname-yuban.oss-cn-hangzhou.aliyuncs.com/data.json`）。

> ⚠️ 这个 OSS 默认域名**可能没备案**（阿里云 OSS 默认域名是共享的，备案状态跟你的域名无关）。**一定要用你自己备案的域名绑定**（下一步），否则微信不认。

## 第三步：绑定你备案的域名（关键！）

1. OSS Bucket →「传输管理」→「域名管理」→「绑定域名」→ 填你**已备案的域名**（或用子域名，如 `data.你的域名.com`，子域名通常也覆盖在主域名备案下）。
2. 按提示做 **CNAME 解析**：去你域名 DNS 控制台（阿里云云解析 DNS）加一条 CNAME 记录，指向 OSS 给你的地址。
3. 如果是 HTTPS，需要在 OSS 绑定** SSL 证书**（阿里云可申请免费证书，个人网站够用）。
4. 绑定完成后，你的词库地址就是：
   ```
   https://data.你的域名.com/data.json
   ```
   浏览器打开能看到一坨 JSON 文字就成功了。

## 第四步：告诉我地址，我改代码

把上面这个 **https 地址**发给我，我填进 `utils/online-data.js` 的 `DATA_URL`，重新打包给你。
（留空 `''` 时=不启用，完全离线；填上才启用在线更新。）

## 第五步：小程序后台加白名单（真机/发布需要）

微信公众平台 →「开发管理」→「开发设置」→「服务器域名」→ **request 合法域名** 里添加：
```
https://data.你的域名.com
```
> 开发者工具里可勾选「不校验合法域名」先调试；真机预览和上线必须配好这个。测试号自己玩可先跳过。

---

## 以后如何更新词库（这才是意义所在）

1. 改 App 里的 `utils/words.js` / `utils/sentences.js`。
2. 跑一条命令重新导出：
   ```bash
   node deploy/export-data.js
   ```
3. 把新生成的 `deploy/data.json` 覆盖上传到 OSS。
4. 小程序下次启动自动拉到新数据（版本号变化时更新缓存）。

> 全程不用重新提交小程序版本、不用等审核。

---

## 费用与坑

- **个人使用：0 元**。OSS 公共读 + 少量流量在免费额度内；免费 SSL 证书。
- **最大坑**：OSS 默认域名没备案 → 必须绑你自己的备案域名（第三步）。
- **备用方案**：如果你有现成服务器/网站，直接在网站根目录放 `data.json` 即可，跳过 OSS 全部步骤。

---

## 备用源：Cloudflare Pages（可选）

OSS 欠费、被限流、或者临时想替换文件时，可以再放一份到 Cloudflare Pages 当备源，
小程序会自动降级过去。做法见 **[deploy/cf/README.md](deploy/cf/README.md)**：

```bash
node deploy/export-data.js        # 同时刷新 deploy/data.json 和 deploy/cf/data.json
bash deploy/cf/deploy.sh          # 需要 CLOUDFLARE_API_TOKEN
```

把两个地址都填进 `utils/online-data.js` 的 `DATA_URLS`（主源在前），两个域名都要加进
**request 合法域名**。注意 `*.pages.dev` 无法备案，真机可用仍需你自己的备案域名 CNAME 到 Pages。
