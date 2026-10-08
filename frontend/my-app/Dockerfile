# BNOA Frontend - Production Dockerfile
# 多阶段构建，使用 Next.js standalone 输出

# ============================================
# 依赖安装阶段
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# 复制依赖文件（利用 Docker 缓存层）
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci --legacy-peer-deps

# ============================================
# 构建阶段
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源码（v0.1.1 - 确保包含 page.tsx 重定向修复）
COPY . .

# 设置构建时环境变量
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 构建应用
RUN npm run build

# ============================================
# 生产阶段
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# 安装必要的系统工具
RUN apk add --no-cache curl tini && rm -rf /var/cache/apk/*

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 复制构建产物（standalone 模式只需要这些文件）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# 使用 tini 作为 init 进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动命令
CMD ["node", "server.js"]
