#!/usr/bin/env bash
# 内容发布：把 src/content、src/data、public/covers 的改动提交并推送（触发线上重新部署）
# 用法: npm run publish "add: 新的读书笔记"   （不带引号说明则用时间戳）
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:-content: update $(date '+%Y-%m-%d %H:%M')}"
git add src/content src/data public/covers
if git diff --cached --quiet; then
  echo "没有待发布的内容改动（src/content / src/data / public/covers 均无变化）"
  exit 0
fi
git commit -q -m "$MSG"
git push -q origin HEAD
echo "✅ 已发布：$MSG"
echo "⏳ Actions 构建中，约 1-2 分钟后 https://chushan2019.github.io/stanleyhome/ 生效"
