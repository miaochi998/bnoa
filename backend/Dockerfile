# BNOA Backend - Production Dockerfile
# 多阶段构建，优化镜像大小：
#   prod-deps : 只安装生产依赖（npm ci --omit=dev）+ 生成 Prisma Client
#   builder   : 全量依赖 + 编译 TypeScript
#   runner    : 仅运行产物（生产依赖 node_modules + dist），不含任何 devDependencies

# ============================================
# 生产依赖阶段（只含 dependencies）
# ============================================
FROM node:20-alpine AS prod-deps

WORKDIR /app

# 复制依赖文件（利用 Docker 缓存层）
COPY package.json package-lock.json ./

# 只安装生产依赖：--omit=dev 严格按 package-lock.json 安装，不会带上 devDependencies
# （旧写法是 "npm ci + npm prune --production && npm install prisma@x"，
#   最后那句 npm install 不带 --omit=dev，会把 typescript/webpack/prettier 等 devDependencies 全部装回来）
RUN npm ci --omit=dev

# 复制 Prisma schema 并生成 Prisma Client
# prisma CLI 本身在 package.json 的 dependencies 中（^6.19.2），与 @prisma/client 同源同版本，
# 运行期 docker-entrypoint.sh 的 `npx prisma migrate deploy` 依赖它，因此无需再单独 npm install prisma
COPY prisma ./prisma
RUN npx prisma generate

# 清理 Prisma 引擎（只保留当前平台）
RUN find node_modules/.prisma -name "libquery_engine-*" ! -name "*linux-musl*" -delete 2>/dev/null || true

# 清理非本平台原生二进制：Alpine 是 musl，glibc（gnu）版本在容器内不可能被加载（实测约 45MB）
# 删除前已在同版本镜像内实测 require('sharp') 与 require('@napi-rs/canvas') 均正常
RUN set -eux; \
    rm -rf node_modules/@napi-rs/canvas-linux-*-gnu \
           node_modules/@napi-rs/canvas-linux-arm-gnueabihf \
           node_modules/@img/*linux-*

# 删除 npm 为 prisma/@prisma/client 的 optional peerDependency 自动安装的 typescript（约 23MB）
# 注意：它不是 devDependencies 残留（npm ci --omit=dev 的隐藏 lock 里 dev 标记数为 0），
# 但只是构建期工具；运行期 `npx prisma migrate deploy` 与 dist 均不依赖它（已实测）
RUN rm -rf node_modules/typescript

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

# 复制构建产物（node_modules 来自 prod-deps 阶段，只有生产依赖且已生成 Prisma Client）
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
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
