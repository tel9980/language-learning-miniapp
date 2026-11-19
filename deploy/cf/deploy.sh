#!/usr/bin/env bash
# 把 deploy/cf/ 发布到 Cloudflare Pages（项目 yuban-data，线上域名 yb.qy663.de5.net）
#
# 用法：bash deploy/cf/deploy.sh
#
# token 来源（按顺序找）：
#   1) 环境变量 CLOUDFLARE_API_TOKEN
#   2) 本机文件 ~/.dsh/cf-token
# token 需要的权限：Cloudflare Pages:Edit（本机那个已配好）
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -f "$HOME/.dsh/cf-token" ]; then
    CLOUDFLARE_API_TOKEN="$(cat "$HOME/.dsh/cf-token")"
  else
    echo "❌ 找不到 token。设置环境变量 CLOUDFLARE_API_TOKEN，或写到 ~/.dsh/cf-token"
    echo "   权限模板：Cloudflare Pages:Edit（模板名 'Edit Cloudflare Workers' 不包含 Pages）"
    exit 1
  fi
fi
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-fb907fe08010a1b319f68be568331ce5}"

echo "→ 先刷新词库 JSON（deploy/data.json 与 deploy/cf/data.json）"
( cd .. && node export-data.js )

echo "→ 把日语离线音频铺到 CDN（分包加载失败时的兜底源）"
rm -rf audio audio-en && mkdir -p audio audio-en
cp ../packageJa/ja/*.mp3 audio/
cp ../packageEn/en/*.mp3 audio-en/
echo "   日语 $(ls audio | wc -l | tr -d ' ') 个 mp3，$(du -sh audio | cut -f1)"
echo "   英语 $(ls audio-en | wc -l | tr -d ' ') 个 mp3，$(du -sh audio-en | cut -f1)"

echo "→ 发布到 Cloudflare Pages"
npx --yes wrangler@3 pages deploy . --project-name yuban-data --branch main --commit-dirty=true

echo "→ 验证线上"
node -e '
const u = "https://yb.qy663.de5.net/data.json";
fetch(u, { headers: { "User-Agent": "deploy-check" } })
  .then(r => r.text().then(t => {
    if (r.status !== 200) { console.log("❌ HTTP " + r.status); process.exit(1) }
    const d = JSON.parse(t);
    console.log("✅ " + u + " → " + d.version +
      "｜en " + d.words.en.length + " 词 / " + d.sentences.en.length + " 句" +
      "｜ja " + d.words.ja.length + " 词 / " + d.sentences.ja.length + " 句");
  }))
  .catch(e => { console.log("❌ 拉取失败：" + e.message); process.exit(1) });
'
