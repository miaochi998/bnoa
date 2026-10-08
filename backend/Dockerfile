# BNOA Backend - Production Dockerfile
# 多阶段构建，优化镜像大小

# ============================================
# 构建阶段
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制依赖文件（利用 Docker 缓存层）
COPY package.json package-lock.json ./

# 安装所有依赖（包括 devDependencies，构建需要）
RUN npm ci

# 复制 Prisma schema（单独复制以利用缓存）
COPY prisma ./prisma

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码
COPY src ./src
COPY tsconfig.json tsconfig.build.json nest-cli.json ./

# 构建应用
RUN npm run build

# 清理开发依赖，只保留生产依赖
RUN npm prune --production \
    && npm install prisma@$(node -p "require('./node_modules/@prisma/client/package.json').version") \
    && npx prisma generate

# 清理 Prisma 引擎（只保留当前平台）
RUN find node_modules/.prisma -name "libquery_engine-*" ! -name "*linux-musl*" -delete 2>/dev/null || true

# ============================================
# 生产阶段
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# 安装必要的系统工具
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs

# 复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# 复制启动脚本
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# 创建必要的目录
RUN mkdir -p /app/uploads /app/temp /app/logs \
    && chown -R nestjs:nodejs /app

# 切换到非 root 用户
USER nestjs

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

# 使用 tini 作为 init 进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动命令
CMD ["./docker-entrypoint.sh"]
