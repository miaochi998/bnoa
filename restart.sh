#!/bin/bash
# ============================================
# BNOA 项目服务重启脚本
# ============================================
# 用途：智能重启项目服务（数据库不重复重启）
#
# 使用方法：
#   ./restart.sh           # 智能重启（数据库运行中则不重启）
#   ./restart.sh full      # 完整重启（强制重启所有服务）
#   ./restart.sh quick     # 快速重启（仅重启后端和前端）
#   ./restart.sh backend   # 仅重启后端
#   ./restart.sh frontend  # 仅重启前端
#   ./restart.sh stop      # 仅停止服务
#   ./restart.sh status    # 查看服务状态
#   ./restart.sh logs      # 查看日志
#   ./restart.sh clean     # 仅清理（停止+清理）
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="bnoa"
BACKEND_PORT=6520
FRONTEND_PORT=6521
DATABASE_PORT=5437
REDIS_PORT=6382

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "yes"
    else
        echo "no"
    fi
}

# 检查 Docker 容器是否运行
is_container_running() {
    local container=$1
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        echo "yes"
    else
        echo "no"
    fi
}

# 检查数据库是否健康
is_database_healthy() {
    if docker exec bnoa-postgres pg_isready -U postgres > /dev/null 2>&1 && \
       docker exec bnoa-redis redis-cli ping > /dev/null 2>&1; then
        echo "yes"
    else
        echo "no"
    fi
}

# 杀死占用端口的进程
kill_port_process() {
    local port=$1
    local name=$2
    local pids=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -n "$pids" ]; then
        print_warning "发现 $name 端口 $port 被占用，正在终止进程..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        print_success "$name 端口 $port 已释放"
    fi
}

# 清理前端进程
cleanup_frontend() {
    print_step "清理前端进程..."

    # 杀死前端端口进程
    kill_port_process $FRONTEND_PORT "前端服务"

    # 杀死 Next.js 进程
    local next_pids=$(pgrep -f "next dev|next start|next-server" 2>/dev/null || true)
    if [ -n "$next_pids" ]; then
        print_info "终止 Next.js 进程..."
        echo "$next_pids" | xargs kill -9 2>/dev/null || true
    fi

    # 杀死 node 进程（前端）
    local node_pids=$(pgrep -f "node.*frontend" 2>/dev/null || true)
    if [ -n "$node_pids" ]; then
        print_info "终止前端 Node 进程..."
        echo "$node_pids" | xargs kill -9 2>/dev/null || true
    fi

    sleep 1
    print_success "前端进程清理完成"
}

# 清理后端进程（保留数据库）
cleanup_backend_only() {
    print_step "【1/4】清理后端进程..."

    # 杀死后端端口进程
    kill_port_process $BACKEND_PORT "后端服务"

    # 杀死 Node.js 进程（NestJS 后端）
    local node_pids=$(pgrep -f "nest start|node dist/src/main" 2>/dev/null || true)
    if [ -n "$node_pids" ]; then
        print_info "终止 NestJS 进程..."
        echo "$node_pids" | xargs kill -9 2>/dev/null || true
    fi

    # 杀死 Prisma 进程
    local prisma_pids=$(pgrep -f "prisma" 2>/dev/null || true)
    if [ -n "$prisma_pids" ]; then
        print_info "终止 Prisma 进程..."
        echo "$prisma_pids" | xargs kill -9 2>/dev/null || true
    fi

    sleep 2
    print_success "后端进程清理完成"
}

# 清理所有相关进程（包括数据库和前端）
cleanup_all_processes() {
    print_step "【1/6】清理运行中的进程..."

    # 停止 Docker 容器
    print_info "停止 Docker 容器..."
    docker-compose down 2>/dev/null || true
    docker stop bnoa-postgres bnoa-redis 2>/dev/null || true
    docker rm bnoa-postgres bnoa-redis 2>/dev/null || true

    # 杀死占用端口的进程
    kill_port_process $BACKEND_PORT "后端服务"
    kill_port_process $FRONTEND_PORT "前端服务"
    kill_port_process $DATABASE_PORT "数据库"
    kill_port_process $REDIS_PORT "Redis"

    # 杀死 Node.js 进程（NestJS 后端）
    local node_pids=$(pgrep -f "nest start|node dist/src/main" 2>/dev/null || true)
    if [ -n "$node_pids" ]; then
        print_info "终止 NestJS 进程..."
        echo "$node_pids" | xargs kill -9 2>/dev/null || true
    fi

    # 杀死 Next.js 进程
    local next_pids=$(pgrep -f "next dev|next start|next-server" 2>/dev/null || true)
    if [ -n "$next_pids" ]; then
        print_info "终止 Next.js 进程..."
        echo "$next_pids" | xargs kill -9 2>/dev/null || true
    fi

    # 杀死 Prisma 进程
    local prisma_pids=$(pgrep -f "prisma" 2>/dev/null || true)
    if [ -n "$prisma_pids" ]; then
        print_info "终止 Prisma 进程..."
        echo "$prisma_pids" | xargs kill -9 2>/dev/null || true
    fi

    sleep 2
    print_success "进程清理完成"
}

# 启动数据库服务（如果未运行）
start_database_if_needed() {
    local step_num=$1
    
    # 检查数据库是否已在运行且健康
    if [ "$(is_container_running "bnoa-postgres")" = "yes" ] && \
       [ "$(is_container_running "bnoa-redis")" = "yes" ] && \
       [ "$(is_database_healthy)" = "yes" ]; then
        print_info "检测到 PostgreSQL 和 Redis 已在运行且健康，跳过重启"
        return 0
    fi
    
    print_step "【${step_num}】启动数据库服务..."

    # 检查 Docker 是否运行
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker 未运行，请先启动 Docker"
        exit 1
    fi

    # 启动 PostgreSQL 和 Redis
    print_info "启动 PostgreSQL (端口: $DATABASE_PORT)..."
    print_info "启动 Redis (端口: $REDIS_PORT)..."
    docker-compose up -d postgres redis

    # 等待数据库就绪
    print_info "等待数据库就绪..."
    local retries=0
    local max_retries=30
    while [ $retries -lt $max_retries ]; do
        if docker exec bnoa-postgres pg_isready -U postgres > /dev/null 2>&1; then
            print_success "PostgreSQL 已就绪"
            break
        fi
        retries=$((retries + 1))
        echo -n "."
        sleep 1
    done

    if [ $retries -eq $max_retries ]; then
        print_error "数据库启动超时"
        exit 1
    fi

    # 等待 Redis 就绪
    retries=0
    while [ $retries -lt $max_retries ]; do
        if docker exec bnoa-redis redis-cli ping > /dev/null 2>&1; then
            print_success "Redis 已就绪"
            break
        fi
        retries=$((retries + 1))
        echo -n "."
        sleep 1
    done

    if [ $retries -eq $max_retries ]; then
        print_error "Redis 启动超时"
        exit 1
    fi

    print_success "数据库服务启动完成"
    return 0
}

# 执行数据库迁移
run_migrations() {
    local step_num=$1
    print_step "【${step_num}】执行数据库迁移..."

    cd backend

    # 检查是否需要安装依赖
    if [ ! -d "node_modules" ]; then
        print_info "安装后端依赖..."
        npm install
    fi

    # 执行迁移
    print_info "执行 Prisma 迁移..."
    npx prisma migrate deploy

    # 生成 Prisma Client
    print_info "生成 Prisma Client..."
    npx prisma generate

    cd ..
    print_success "数据库迁移完成"
}

# 启动后端服务
start_backend() {
    local step_num=$1
    print_step "【${step_num}】启动后端服务..."

    cd backend

    # 检查是否需要安装依赖
    if [ ! -d "node_modules" ]; then
        print_info "安装后端依赖..."
        npm install
    fi

    # 生成 Prisma Client（如果尚未生成）
    if [ ! -d "node_modules/.prisma" ]; then
        print_info "生成 Prisma Client..."
        npx prisma generate
    fi

    # 以独立会话启动 NestJS 服务，避免脚本退出后被连带结束
    print_info "启动 NestJS 服务 (端口: $BACKEND_PORT)..."
    python3 - <<PY
import os
import subprocess
import sys

script_dir = r"$SCRIPT_DIR"
log_path = os.path.join(script_dir, "logs", "backend.log")
pid_path = os.path.join(script_dir, "logs", "backend.pid")
with open(log_path, "ab", buffering=0) as log:
    proc = subprocess.Popen(
        ["bash", "-lc", f"cd '{script_dir}/backend' && npm run start:prod"],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=log,
        start_new_session=True,
        close_fds=True,
    )
with open(pid_path, "w", encoding="utf-8") as f:
    f.write(str(proc.pid))
PY

    # 等待后端就绪
    print_info "等待后端服务就绪..."
    local retries=0
    local max_retries=60
    while [ $retries -lt $max_retries ]; do
        if curl -s http://localhost:$BACKEND_PORT/api/v1/health > /dev/null 2>&1 || \
           curl -s http://localhost:$BACKEND_PORT/api/docs-json > /dev/null 2>&1; then
            print_success "后端服务已就绪"
            break
        fi
            if [ -f "$SCRIPT_DIR/logs/backend.pid" ]; then
            local backend_pid
            backend_pid=$(cat "$SCRIPT_DIR/logs/backend.pid" 2>/dev/null || true)
            if [ -n "$backend_pid" ] && ! kill -0 "$backend_pid" 2>/dev/null; then
                print_error "后端进程已退出，请检查 logs/backend.log"
                tail -n 40 "$SCRIPT_DIR/logs/backend.log" || true
                exit 1
            fi
        fi
        retries=$((retries + 1))
        echo -n "."
        sleep 1
    done

    if [ $retries -eq $max_retries ]; then
        print_warning "后端服务启动可能未完成，请检查日志"
    fi

    cd ..
    print_success "后端服务启动完成"
}

# 启动前端服务
start_frontend() {
    local step_num=$1
    print_step "【${step_num}】启动前端服务..."

    # 检查前端目录是否存在
    if [ ! -d "frontend/my-app" ]; then
        print_error "前端目录不存在: frontend/my-app"
        return 1
    fi

    cd frontend/my-app

    # 检查是否需要安装依赖
    if [ ! -d "node_modules" ]; then
        print_info "安装前端依赖..."
        npm install
    fi

    # 构建并在后台启动 Next.js 服务
    print_info "构建前端生产版本..."
    npm run build

    # standalone 启动需要显式提供静态资源与 public 目录
    print_info "同步前端静态资源..."
    mkdir -p .next/standalone/.next
    rm -rf .next/standalone/.next/static .next/standalone/public
    cp -R .next/static .next/standalone/.next/
    cp -R public .next/standalone/

    print_info "启动 Next.js 服务 (端口: $FRONTEND_PORT)..."
    if [ -f .next/standalone/server.js ]; then
        python3 - <<PY
import os
import subprocess

script_dir = r"$SCRIPT_DIR"
log_path = os.path.join(script_dir, "logs", "frontend.log")
pid_path = os.path.join(script_dir, "logs", "frontend.pid")
env = os.environ.copy()
env["PORT"] = str($FRONTEND_PORT)
env["HOSTNAME"] = "0.0.0.0"
with open(log_path, "ab", buffering=0) as log:
    proc = subprocess.Popen(
        ["bash", "-lc", f"cd '{script_dir}/frontend/my-app' && node .next/standalone/server.js"],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=log,
        start_new_session=True,
        close_fds=True,
        env=env,
    )
with open(pid_path, "w", encoding="utf-8") as f:
    f.write(str(proc.pid))
PY
    else
        python3 - <<PY
import os
import subprocess

script_dir = r"$SCRIPT_DIR"
log_path = os.path.join(script_dir, "logs", "frontend.log")
pid_path = os.path.join(script_dir, "logs", "frontend.pid")
env = os.environ.copy()
env["PORT"] = str($FRONTEND_PORT)
env["HOSTNAME"] = "0.0.0.0"
with open(log_path, "ab", buffering=0) as log:
    proc = subprocess.Popen(
        ["bash", "-lc", f"cd '{script_dir}/frontend/my-app' && npm run start -- -p $FRONTEND_PORT"],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=log,
        start_new_session=True,
        close_fds=True,
        env=env,
    )
with open(pid_path, "w", encoding="utf-8") as f:
    f.write(str(proc.pid))
PY
    fi

    # 等待前端就绪
    print_info "等待前端服务就绪..."
    local retries=0
    local max_retries=60
    while [ $retries -lt $max_retries ]; do
        if curl -sI http://localhost:$FRONTEND_PORT > /dev/null 2>&1 || curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            print_success "前端服务已就绪"
            break
        fi
        if [ -f "$SCRIPT_DIR/logs/frontend.pid" ]; then
            local frontend_pid
            frontend_pid=$(cat "$SCRIPT_DIR/logs/frontend.pid" 2>/dev/null || true)
            if [ -n "$frontend_pid" ] && ! kill -0 "$frontend_pid" 2>/dev/null; then
                print_error "前端进程已退出，请检查 logs/frontend.log"
                tail -n 40 "$SCRIPT_DIR/logs/frontend.log" || true
                exit 1
            fi
        fi
        retries=$((retries + 1))
        echo -n "."
        sleep 1
    done

    if [ $retries -eq $max_retries ]; then
        print_warning "前端服务启动可能未完成，请检查日志"
    fi

    cd ../..
    print_success "前端服务启动完成"
}

# 验证服务状态
verify_services() {
    local step_num=$1
    local check_frontend=${2:-true}
    
    print_step "【${step_num}】验证服务状态..."

    local all_good=true

    # 检查 PostgreSQL
    if docker exec bnoa-postgres pg_isready -U postgres > /dev/null 2>&1; then
        print_success "✓ PostgreSQL (端口: $DATABASE_PORT)"
    else
        print_error "✗ PostgreSQL (端口: $DATABASE_PORT)"
        all_good=false
    fi

    # 检查 Redis
    if docker exec bnoa-redis redis-cli ping > /dev/null 2>&1; then
        print_success "✓ Redis (端口: $REDIS_PORT)"
    else
        print_error "✗ Redis (端口: $REDIS_PORT)"
        all_good=false
    fi

    # 检查后端
    if curl -s http://localhost:$BACKEND_PORT/api/v1/health > /dev/null 2>&1 || \
       curl -s http://localhost:$BACKEND_PORT/api/docs-json > /dev/null 2>&1; then
        print_success "✓ 后端服务 (端口: $BACKEND_PORT)"
    else
        print_error "✗ 后端服务 (端口: $BACKEND_PORT)"
        all_good=false
    fi

    # 检查前端（如果启用）
    if [ "$check_frontend" = true ]; then
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            print_success "✓ 前端服务 (端口: $FRONTEND_PORT)"
        else
            print_error "✗ 前端服务 (端口: $FRONTEND_PORT)"
            all_good=false
        fi
    fi

    echo ""
    if [ "$all_good" = true ]; then
        print_success "所有服务运行正常！"
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  BNOA 项目服务重启完成${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "访问地址："
        echo "  前端页面:    http://localhost:$FRONTEND_PORT"
        echo "  后端 API:    http://localhost:$BACKEND_PORT"
        echo "  API 文档:    http://localhost:$BACKEND_PORT/api/docs"
        echo "  数据库:      localhost:$DATABASE_PORT"
        echo "  Redis:       localhost:$REDIS_PORT"
        echo ""
        echo "常用命令："
        echo "  查看日志:    ./restart.sh logs"
        echo "  查看状态:    ./restart.sh status"
        echo "  停止服务:    ./restart.sh stop"
        echo ""
    else
        print_error "部分服务启动失败，请检查日志"
        return 1
    fi
}

# 智能重启（默认）
smart_restart() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  BNOA 项目服务智能重启${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    
    # 检查数据库是否已在运行
    local db_already_running=false
    if [ "$(is_container_running "bnoa-postgres")" = "yes" ] && \
       [ "$(is_container_running "bnoa-redis")" = "yes" ] && \
       [ "$(is_database_healthy)" = "yes" ]; then
        db_already_running=true
        print_info "检测到数据库服务已在运行，将跳过数据库重启"
        echo ""
    fi
    
    if [ "$db_already_running" = true ]; then
        # 4步流程：清理后端 → 清理前端 → 启动后端 → 启动前端 → 验证
        cleanup_backend_only
        cleanup_frontend
        start_backend "2"
        start_frontend "3"
        verify_services "4"
    else
        # 6步流程：完整重启
        cleanup_all_processes
        start_database_if_needed "2"
        run_migrations "3"
        start_backend "4"
        start_frontend "5"
        verify_services "6"
    fi
}

# 完整重启（强制重启所有服务）
full_restart() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  BNOA 项目服务完整重启${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    cleanup_all_processes
    start_database_if_needed "2"
    run_migrations "3"
    start_backend "4"
    start_frontend "5"
    verify_services "6"
}

# 快速重启（仅重启后端和前端）
quick_restart() {
    print_info "执行快速重启..."

    # 停止后端和前端
    print_info "停止后端和前端服务..."
    pkill -f "nest start|node dist/src/main" 2>/dev/null || true
    pkill -f "next dev|next start|next-server" 2>/dev/null || true
    sleep 2

    # 启动后端
    start_backend "1"
    
    # 启动前端
    start_frontend "2"

    # 验证
    verify_services "3"
}

# 仅重启后端
backend_restart() {
    print_info "仅重启后端服务..."
    cleanup_backend_only
    start_backend "1"
    verify_services "2" false  # 不检查前端
}

# 仅重启前端
frontend_restart() {
    print_info "仅重启前端服务..."
    cleanup_frontend
    start_frontend "1"
    
    # 只检查前端状态
    print_step "【2】验证前端服务状态..."
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        print_success "✓ 前端服务 (端口: $FRONTEND_PORT)"
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  前端服务重启完成${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "访问地址：http://localhost:$FRONTEND_PORT"
        echo ""
    else
        print_error "✗ 前端服务 (端口: $FRONTEND_PORT)"
        print_error "前端服务启动失败，请检查日志"
        return 1
    fi
}

# 显示服务状态
show_status() {
    print_step "服务状态检查"
    echo ""

    echo "Docker 容器状态："
    docker ps --filter "name=bnoa" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  无运行中的容器"
    echo ""

    echo "端口占用情况："
    echo "  后端服务 ($BACKEND_PORT): $(check_port $BACKEND_PORT)"
    echo "  前端服务 ($FRONTEND_PORT): $(check_port $FRONTEND_PORT)"
    echo "  数据库 ($DATABASE_PORT): $(check_port $DATABASE_PORT)"
    echo "  Redis ($REDIS_PORT): $(check_port $REDIS_PORT)"
    echo ""

    echo "进程状态："
    local nest_pids=$(pgrep -f "nest start|node dist/src/main" 2>/dev/null || echo "无")
    echo "  NestJS 进程: $nest_pids"
    local next_pids=$(pgrep -f "next dev|next start|next-server" 2>/dev/null || echo "无")
    echo "  Next.js 进程: $next_pids"
}

# 查看日志
show_logs() {
    echo "选择要查看的日志："
    echo "  1) 后端日志"
    echo "  2) 前端日志"
    echo "  3) 所有日志"
    read -p "请输入选项 (1-3): " choice
    
    case $choice in
        1)
            if [ -f "logs/backend.log" ]; then
                print_info "显示后端日志 (按 Ctrl+C 退出)..."
                tail -f logs/backend.log
            else
                print_warning "后端日志文件不存在"
            fi
            ;;
        2)
            if [ -f "logs/frontend.log" ]; then
                print_info "显示前端日志 (按 Ctrl+C 退出)..."
                tail -f logs/frontend.log
            else
                print_warning "前端日志文件不存在"
            fi
            ;;
        3)
            if [ -f "logs/backend.log" ] && [ -f "logs/frontend.log" ]; then
                print_info "显示所有日志 (按 Ctrl+C 退出)..."
                tail -f logs/backend.log logs/frontend.log
            else
                print_warning "部分日志文件不存在"
                [ -f "logs/backend.log" ] && tail -f logs/backend.log
                [ -f "logs/frontend.log" ] && tail -f logs/frontend.log
            fi
            ;;
        *)
            print_error "无效选项"
            ;;
    esac
}

# 停止所有服务
stop_services() {
    print_info "停止所有服务..."

    # 停止后端
    pkill -f "nest start|node dist/src/main" 2>/dev/null || true
    
    # 停止前端
    pkill -f "next dev|next start|next-server" 2>/dev/null || true

    # 停止 Docker 容器
    docker-compose down 2>/dev/null || true
    docker stop bnoa-postgres bnoa-redis 2>/dev/null || true

    print_success "所有服务已停止"
}

# 仅清理（不启动）
clean_only() {
    print_warning "这将停止所有服务并清理进程"
    read -p "确定要继续吗？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_all_processes
        print_success "清理完成"
    else
        print_info "取消清理"
    fi
}

# 显示帮助
show_help() {
    echo "BNOA 项目服务重启脚本"
    echo ""
    echo "用法: ./restart.sh [命令]"
    echo ""
    echo "命令:"
    echo "  (无参数)  智能重启：检测数据库状态，运行中则跳过"
    echo "  full      完整重启：强制重启所有服务（包括数据库）"
    echo "  quick     快速重启：仅重启后端和前端（保留数据库）"
    echo "  backend   仅重启后端"
    echo "  frontend  仅重启前端"
    echo "  stop      停止所有服务"
    echo "  status    查看服务状态"
    echo "  logs      查看日志"
    echo "  clean     仅清理（停止+清理，不启动）"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./restart.sh           # 智能重启（推荐日常使用）"
    echo "  ./restart.sh full      # 完整重启（数据库有问题时用）"
    echo "  ./restart.sh quick     # 快速重启（开发常用）"
    echo "  ./restart.sh backend   # 仅重启后端"
    echo "  ./restart.sh frontend  # 仅重启前端"
    echo "  ./restart.sh status    # 查看状态"
    echo ""
    echo "⚠️  重要提示："
    echo "  所有服务重启必须使用此脚本，禁止手动使用 npm 重启！"
}

# 定位脚本所在目录，避免从任意工作目录执行时出错
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 创建日志目录
mkdir -p logs

# 主逻辑
case "${1:-}" in
    full)
        full_restart
        ;;
    quick)
        quick_restart
        ;;
    backend)
        backend_restart
        ;;
    frontend)
        frontend_restart
        ;;
    stop)
        stop_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    clean)
        clean_only
        ;;
    help)
        show_help
        ;;
    "")
        # 默认：智能重启
        smart_restart
        ;;
    *)
        print_error "未知命令: $1"
        show_help
        exit 1
        ;;
esac
