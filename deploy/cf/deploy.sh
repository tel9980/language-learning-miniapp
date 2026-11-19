#!/usr/bin/env bash
# 把 deploy/cf/ 发布到 Cloudflare Pages（项目名 yuban-data）
#
# 第一次用需要环境变量：
#   export CLOUDFLARE_API_TOKEN=...   # 权限：Cloudflare Pages:Edit
#   export CLOUDFLARE_ACCOUNT_ID=...  # 账号 ID，控制台右下角可见
#
# 用法：bash deploy/cf/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "❌ 没设 CLOUDFLARE_API_TOKEN。"
  echo "   1) 到 https://dash.cloudflare.com/profile/api-tokens 建 token（模板选 Cloudflare Pages:Edit）"
  echo "   2) export CLOUDFLARE_API_TOKEN=xxx"
  echo "   或者直接在控制台拖拽上传：Workers & Pages → Create → Pages → Upload assets，选 deploy/cf 目录"
  exit 1
fi

echo "→ 先刷新词库 JSON"
node ../export-data.js

echo "→ 发布到 Cloudflare Pages"
npx --yes wrangler@latest pages deploy . --project-name yuban-data --branch main --commit-dirty=true

echo "✅ 完成。地址形如 https://yuban-data.pages.dev/data.json"
