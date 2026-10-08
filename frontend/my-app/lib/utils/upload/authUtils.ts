/**
 * 上传认证工具
 * @module lib/utils/upload/authUtils
 */

/**
 * 从localStorage获取访问令牌
 * @returns 访问令牌或null
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
}

/**
 * 从localStorage获取刷新令牌
 * @returns 刷新令牌或null
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem('refreshToken');
  } catch {
    return null;
  }
}

/**
 * 获取认证请求头
 * @returns 包含Authorization头的对象
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  
  if (!token) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * 获取完整的上传请求头
 * @returns 包含认证和其他必要头的对象
 */
export function getUploadHeaders(): Record<string, string> {
  return {
    ...getAuthHeaders(),
  };
}

/**
 * 检查用户是否已登录
 * @returns 是否已登录
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * 检查令牌是否过期
 * @param token - JWT令牌
 * @returns 是否过期
 */
export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    
    if (!exp) return false;
    
    // 提前5分钟认为过期
    const now = Math.floor(Date.now() / 1000);
    return exp < now + 300;
  } catch {
    return true;
  }
}

/**
 * 检查访问令牌是否过期
 * @returns 是否过期
 */
export function isAccessTokenExpired(): boolean {
  const token = getAccessToken();
  return !token || isTokenExpired(token);
}

/**
 * 获取当前用户ID
 * @returns 用户ID或null
 */
export function getCurrentUserId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || payload.userId || null;
  } catch {
    return null;
  }
}

/**
 * 获取当前用户名
 * @returns 用户名或null
 */
export function getCurrentUsername(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.username || null;
  } catch {
    return null;
  }
}

/**
 * 创建带认证的fetch请求
 * @param url - 请求URL
 * @param options - fetch选项
 * @returns fetch响应
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  
  const authHeaders = getAuthHeaders();
  Object.entries(authHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * 创建带认证的XMLHttpRequest
 * @param xhr - XMLHttpRequest实例
 */
export function setAuthXHR(xhr: XMLHttpRequest): void {
  const token = getAccessToken();
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  }
}

/**
 * 生成唯一的上传ID
 * @returns 唯一ID字符串
 */
export function generateUploadId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `upload_${timestamp}_${random}`;
}

/**
 * 生成唯一的文件ID
 * @returns 唯一ID字符串
 */
export function generateFileId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `file_${timestamp}_${random}`;
}
