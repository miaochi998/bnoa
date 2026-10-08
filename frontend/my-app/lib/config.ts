/**
 * 运行时配置
 * 
 * 根据浏览器当前访问地址动态计算 API URL，
 * 同时支持 IP 访问（内网）和域名访问（外网）。
 */

/** 后端服务端口（与 docker-compose.prod.yml 中 BACKEND_PORT 一致） */
const BACKEND_PORT = 6520;

/**
 * 获取 API 基础 URL
 * 
 * - IP / localhost 访问 → http://{hostname}:{BACKEND_PORT}/api/v1
 * - 域名访问 → 使用构建时 NEXT_PUBLIC_API_URL（如 https://api.example.com/api/v1）
 * - SSR 环境 → 使用 NEXT_PUBLIC_API_URL 或 localhost 回退
 */
export function getApiBaseUrl(): string {
  // SSR / Node.js 环境
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || `http://localhost:${BACKEND_PORT}/api/v1`;
  }

  const { hostname, protocol } = window.location;

  // IP 地址访问（内网 IP 形式，如 192.168.x.x:6521）
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return `${protocol}//${hostname}:${BACKEND_PORT}/api/v1`;
  }

  // localhost / 127.0.0.1 访问（开发环境）
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:${BACKEND_PORT}/api/v1`;
  }

  // 域名访问 → 优先使用构建时环境变量
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 域名访问但没有构建时环境变量 → 回退到同域名 + 后端端口
  return `${protocol}//${hostname}:${BACKEND_PORT}/api/v1`;
}

/** 缓存的 API URL（避免每次调用都重新计算） */
let _cachedApiBaseUrl: string | null = null;

/**
 * 获取 API 基础 URL（带缓存）
 * 适用于模块顶层初始化
 */
export function getApiUrl(): string {
  if (_cachedApiBaseUrl === null) {
    _cachedApiBaseUrl = getApiBaseUrl();
  }
  return _cachedApiBaseUrl;
}
