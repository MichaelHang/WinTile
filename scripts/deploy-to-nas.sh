#!/bin/bash
# ============================================================
# 本地开发机 → 飞牛NAS 一键同步更新
# ============================================================
# 使用方法（在你的开发机上）:
#   1. 修改下面的 NAS_USER 和 NAS_HOST
#   2. 每次改完代码运行: ./scripts/deploy-to-nas.sh
# ============================================================
#
# 前提条件:
#   - NAS 已开启 SSH
#   - 已设置 SSH 密钥认证（避免每次输密码）
# ============================================================

set -e

# ⚠️ 请修改为你的飞牛NAS 信息
NAS_USER="admin"
NAS_HOST="192.168.x.x"       # NAS IP 地址
NAS_PATH="/docker/hangzhou-mahjong"   # NAS 上的部署路径

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================"
echo "  杭州麻将 - 本地构建 → NAS 同步"
echo "========================================"

# 1. 构建
echo "🔨 重新构建..."
cd "$PROJECT_DIR"
npx vite build
echo "✅ 构建完成"

# 2. 上传 dist/
echo "📤 同步到 NAS..."
scp -r dist/* "$NAS_USER@$NAS_HOST:$NAS_PATH/dist/"
echo "✅ 同步完成"

# 3. 重启容器
echo "🐳 重启 Nginx 容器..."
ssh "$NAS_USER@$NAS_HOST" "cd $NAS_PATH && docker compose restart mahjong"
echo "✅ 容器已重启"

echo ""
echo "========================================"
echo "  ✅ 更新完成！"
echo "  🌐 http://$NAS_HOST:8888"
echo "========================================"