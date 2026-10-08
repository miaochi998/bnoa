#!/bin/sh
set -e

echo "=========================================="
echo "  BNOA Backend - Starting..."
echo "=========================================="

# 等待数据库就绪
echo "等待数据库连接..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" > /dev/null 2>&1; then
    echo "数据库已就绪"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "等待数据库... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "警告: 数据库连接超时，尝试继续启动..."
fi

# 执行数据库迁移（必须成功，否则不启动应用，避免 500 错误）
echo "执行数据库迁移..."
if ! npx prisma migrate deploy; then
  echo "错误: 数据库迁移失败，应用将不启动。请检查数据库连接与迁移文件后重试。"
  exit 1
fi
echo "数据库迁移完成"

# 初始化数据（仅首次部署时执行）
SEED_MARKER="/app/.seed_completed"
if [ ! -f "$SEED_MARKER" ]; then
  echo "首次部署，执行数据初始化..."
  if [ -f "dist/prisma/seed.js" ]; then
    node dist/prisma/seed.js 2>&1 && {
      touch "$SEED_MARKER"
      echo "数据初始化完成"
    } || {
      echo "警告: 数据初始化失败，尝试继续启动..."
    }
  else
    echo "警告: 未找到 seed 文件，跳过数据初始化"
  fi
else
  echo "数据已初始化，跳过 seed"
fi

echo "启动应用..."
exec node dist/src/main
