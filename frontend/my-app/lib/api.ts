import { getApiBaseUrl } from '@/lib/config';
import { ApiResponse, LoginRequest, LoginResponse, RefreshTokenRequest, User as AuthUser, ChangePasswordRequest as AuthChangePasswordRequest } from '@/types/auth';
import { User, UserListResponse, UserFilter, PageInput, CreateUserRequest, UpdateUserRequest, ChangePasswordRequest } from '@/types/user';
import { Role, RoleListResponse, RoleListApiResponse, CreateRoleRequest, UpdateRoleRequest } from '@/types/role';
import { Permission, PermissionListResponse, PermissionFilter, CreatePermissionRequest, UpdatePermissionRequest, PermissionTreeNode } from '@/types/permission';
import { 
  FileItem, Folder, FolderTreeNode, FileListResponse, FileFilter, FileStats, ShareLink, CreateShareRequest, RealFolder,
  MyFoldersResponse, SharedFolderInfo, FolderShareRecord, ShareFolderRequest, UpdateSharePermissionRequest, 
  CreateSystemSharedFolderRequest, FolderPermissionsResponse, FolderTreeNodeWithShare
} from '@/types/file';
import { AuditLog, AuditLogListResponse, AuditLogFilter, AuditStatistics } from '@/types/audit';
import { SystemConfig, ConfigListResponse, ConfigFilter, CreateConfigRequest, UpdateConfigRequest } from '@/types/config';

export interface DashboardStats {
  totalUsers: number;
  totalRoles: number;
  totalFiles: number;
  todayLogins: number;
}

export interface MyStats {
  myFiles: number;
  usedSpace: number;
  sharedToMe: number;
  recentUploads: number;
}

export interface RecentFile {
  id: string;
  originalName: string;
  size: number;
  category: string;
  mimeType: string;
  createdAt: string;
}

const API_BASE_URL = getApiBaseUrl();

/**
 * 构建用户头像代理 URL
 */
export function getAvatarUrl(
    userId: string,
    hasAvatar?: boolean | string | null,
): string | undefined {
    if (!hasAvatar) return undefined;
    return `${API_BASE_URL}/auth/avatar/${userId}`;
}

/**
 * 获取默认头像代理 URL
 */
export function getDefaultAvatarUrl(): string {
    return `${API_BASE_URL}/auth/default-avatar`;
}

/**
 * 构建文件预览代理 URL（公共访问，无需认证）
 * 由前端用 API_BASE_URL 拼出，避免依赖后端 SERVER_BASE_URL（生产可能被配成 localhost 导致图片无法加载）。
 */
export function getFilePreviewUrl(fileId: string): string {
    return `${API_BASE_URL}/public/files/${fileId}/preview`;
}

/**
 * 构建文件缩略图代理 URL（公共访问，无需认证）
 */
export function getFileThumbnailUrl(fileId: string): string {
    return `${API_BASE_URL}/public/files/${fileId}/thumbnail`;
}

/**
 * 归一化文件对象：把后端返回的 url/thumbnailUrl 替换为前端构建的代理 URL。
 * 这样文件列表/预览/详情面板等所有使用 FileItem 的地方统一拿到浏览器可访问的地址。
 */
function normalizeFile<T extends { id: string; url?: string; thumbnailUrl?: string }>(file: T): T {
    if (!file) return file;
    return {
        ...file,
        url: file.url ? getFilePreviewUrl(file.id) : file.url,
        thumbnailUrl: file.thumbnailUrl ? getFileThumbnailUrl(file.id) : file.thumbnailUrl,
    };
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;

  constructor() {
    // 从 localStorage 恢复 token
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshTokenValue = localStorage.getItem('refreshToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 每次请求时从localStorage获取最新的token
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken && storedToken !== this.accessToken) {
        this.accessToken = storedToken;
      }
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // 保留状态码与响应体：调用方需要区分「业务错误」（如 409 升级冲突、400 预检未通过）
      // 与「网络中断」（升级重启后端时的必然现象）。此前只抛 message，
      // 导致升级请求被拒时前端误判为"服务重启中"而空等到超时。
      const error: any = new Error(data.message || '请求失败');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // ========== 通用便捷方法 ==========

  async get<T = any>(endpoint: string, options?: { params?: Record<string, any> }): Promise<T> {
    let url = endpoint;
    if (options?.params) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null) q.append(k, String(v));
      }
      const qs = q.toString();
      if (qs) url += `?${qs}`;
    }
    const res = await this.request<T>(url);
    return (res as any).data !== undefined ? (res as any).data : res as any;
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return res as any;
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
    return res as any;
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    return res as any;
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const res = await this.request<T>(endpoint, { method: 'DELETE' });
    return res as any;
  }

  /**
   * GET 请求并返回 Blob（用于下载文件），不解析 JSON
   */
  async getBlob(endpoint: string): Promise<{ blob: Blob; headers: Headers }> {
    const url = `${API_BASE_URL}${endpoint}`;
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken && storedToken !== this.accessToken) this.accessToken = storedToken;
    }
    const headers: Record<string, string> = { ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}) };
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      const text = await response.text();
      let message = '下载失败';
      try {
        const j = JSON.parse(text);
        if (j.message) message = j.message;
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    return { blob, headers: response.headers };
  }

  // 认证相关接口
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data.accessToken) {
      this.accessToken = response.data.accessToken;
      this.refreshTokenValue = response.data.refreshToken;
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.clearTokens();
    }
  }

  async refreshAccessToken(): Promise<LoginResponse> {
    if (!this.refreshTokenValue) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshTokenValue } as RefreshTokenRequest),
    });

    if (response.data.accessToken) {
      this.accessToken = response.data.accessToken;
      this.refreshTokenValue = response.data.refreshToken;
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }

    return response.data;
  }

  async getCurrentUser(): Promise<AuthUser> {
    const response = await this.request<AuthUser>('/auth/me');
    return response.data;
  }

  async changePassword(data: AuthChangePasswordRequest): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProfile(data: {
    name?: string;
    email?: string;
    phone?: string;
    description?: string;
  }): Promise<AuthUser> {
    const response = await this.request<AuthUser>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 上传用户头像
   */
  async uploadAvatar(file: File): Promise<{ avatar: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.accessToken || localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/auth/avatar`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '上传头像失败');
    }
    return data.data;
  }

  /**
   * 删除用户头像
   */
  async deleteAvatar(): Promise<void> {
    await this.request('/auth/avatar', {
      method: 'DELETE',
    });
  }

  /**
   * 上传默认头像（管理员）
   */
  async uploadDefaultAvatar(
    file: File,
  ): Promise<{ defaultAvatar: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.accessToken || localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/auth/default-avatar`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '上传默认头像失败');
    }
    return data.data;
  }

  // Token 管理
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshTokenValue = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // 仪表盘统计接口
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.request<DashboardStats>('/dashboard/stats');
    return response.data;
  }

  async getMyStats(): Promise<MyStats> {
    const response = await this.request<MyStats>('/dashboard/my-stats');
    return response.data;
  }

  async getRecentFiles(): Promise<RecentFile[]> {
    const response = await this.request<RecentFile[]>(
        '/dashboard/recent-files',
    );
    return response.data;
  }

  // ==================== 用户管理接口 ====================

  /**
   * 获取用户列表
   */
  async getUsers(filter: UserFilter, pageInput: PageInput): Promise<UserListResponse> {
    const params = new URLSearchParams();
    params.append('page', pageInput.page.toString());
    params.append('pageSize', pageInput.pageSize.toString());
    if (filter.keyword) params.append('keyword', filter.keyword);
    if (filter.status) params.append('status', filter.status);
    if (filter.roleId) params.append('roleId', filter.roleId);
    if (filter.sortBy) params.append('sortBy', filter.sortBy);
    if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);

    const response = await this.request<UserListResponse>(`/users?${params.toString()}`);
    return response.data;
  }

  /**
   * 批量禁用用户
   */
  async batchSuspendUsers(ids: string[]): Promise<void> {
    await this.request('/users/batch/suspend', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * 启用/禁用用户
   */
  async toggleUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<User> {
    const response = await this.request<User>(`/users/${id}/toggle-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    return response.data;
  }

  /**
   * 获取用户详情
   */
  async getUser(id: string): Promise<User> {
    const response = await this.request<User>(`/users/${id}`);
    return response.data;
  }

  /**
   * 创建用户
   */
  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新用户
   */
  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const response = await this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    await this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 批量删除用户
   */
  async batchDeleteUsers(ids: string[]): Promise<void> {
    await this.request('/users/batch/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * 重置用户密码
   */
  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    await this.request(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  // ==================== 角色管理接口 ====================

  /**
   * 获取角色列表
   */
  async getRoles(page: number = 1, pageSize: number = 100): Promise<RoleListResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    // 后端返回格式: { success, message, data: Role[], meta: { total, page, pageSize, totalPages } }
    const response = await this.request<Role[]>(`/roles?${params.toString()}`) as any;
    
    return {
      nodes: response.data || [],
      totalCount: response.meta?.total || 0,
      page: response.meta?.page || 1,
      pageSize: response.meta?.pageSize || 10,
      totalPages: response.meta?.totalPages || 0,
    };
  }

  /**
   * 获取所有角色（不分页）
   */
  async getAllRoles(): Promise<Role[]> {
    // 后端限制pageSize最大100
    const response = await this.getRoles(1, 100);
    return response.nodes;
  }

  /**
   * 获取角色详情
   */
  async getRole(id: string): Promise<Role> {
    const response = await this.request<Role>(`/roles/${id}`);
    return response.data;
  }

  /**
   * 创建角色
   */
  async createRole(data: CreateRoleRequest): Promise<Role> {
    const response = await this.request<Role>('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新角色
   */
  async updateRole(id: string, data: UpdateRoleRequest): Promise<Role> {
    const response = await this.request<Role>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除角色
   */
  async deleteRole(id: string): Promise<void> {
    await this.request(`/roles/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 分配角色权限
   */
  async assignRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.request(`/roles/${roleId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permissionIds }),
    });
  }

  /**
   * 获取角色的权限
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const response = await this.request<Permission[]>(`/roles/${roleId}/permissions`);
    return response.data;
  }

  // ==================== 权限管理接口 ====================

  /**
   * 获取权限列表
   */
  async getPermissions(filter: PermissionFilter, pageInput: PageInput): Promise<PermissionListResponse> {
    const params = new URLSearchParams();
    if (filter.keyword) params.append('keyword', filter.keyword);
    if (filter.type) params.append('type', filter.type);

    // 后端使用 TransformInterceptor，返回 { success, message, data }
    // 注意：权限API不分页，返回的是数组
    const url = `${API_BASE_URL}/permissions?${params.toString()}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (!response.ok) {
      // 保留状态码与响应体：调用方需要区分「业务错误」（如 409 升级冲突、400 预检未通过）
      // 与「网络中断」（升级重启后端时的必然现象）。此前只抛 message，
      // 导致升级请求被拒时前端误判为"服务重启中"而空等到超时。
      const error: any = new Error(data.message || '请求失败');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    // data 就是 { success, message, data }，其中 data 是数组
    if (!data || !Array.isArray(data.data)) {
      console.error('Invalid response structure:', data);
      return {
        nodes: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
    }
    
    const permissions = data.data;
    const total = permissions.length;
    
    // 前端分页处理
    const start = (pageInput.page - 1) * pageInput.pageSize;
    const end = start + pageInput.pageSize;
    const paginatedPermissions = permissions.slice(start, end);
    
    return {
      nodes: paginatedPermissions,
      totalCount: total,
      page: pageInput.page,
      pageSize: pageInput.pageSize,
      totalPages: Math.ceil(total / pageInput.pageSize),
    };
  }

  /**
   * 获取权限树
   */
  async getPermissionTree(): Promise<PermissionTreeNode[]> {
    // 后端使用 TransformInterceptor，返回 { success, message, data }
    const url = `${API_BASE_URL}/permissions/tree/all`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (!response.ok) {
      // 保留状态码与响应体：调用方需要区分「业务错误」（如 409 升级冲突、400 预检未通过）
      // 与「网络中断」（升级重启后端时的必然现象）。此前只抛 message，
      // 导致升级请求被拒时前端误判为"服务重启中"而空等到超时。
      const error: any = new Error(data.message || '请求失败');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    // data 就是 { success, message, data }，其中 data 是数组
    if (!data || !Array.isArray(data.data)) {
      console.error('Invalid response structure:', data);
      return [];
    }
    
    return data.data;
  }

  /**
   * 获取权限详情
   */
  async getPermission(id: string): Promise<Permission> {
    const response = await this.request<Permission>(`/permissions/${id}`);
    return response.data;
  }

  /**
   * 创建权限
   */
  async createPermission(data: CreatePermissionRequest): Promise<Permission> {
    const response = await this.request<Permission>('/permissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新权限
   */
  async updatePermission(id: string, data: UpdatePermissionRequest): Promise<Permission> {
    const response = await this.request<Permission>(`/permissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除权限
   */
  async deletePermission(id: string): Promise<void> {
    await this.request(`/permissions/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 同步权限定义到数据库（仅超级管理员）
   * 用于生产环境升级后补齐缺失的权限
   */
  async syncPermissions(): Promise<{ added: number; updated: number; total: number }> {
    const response = await this.request<{ data: { added: number; updated: number; total: number } }>('/permissions/sync', {
      method: 'POST',
    });
    const body = response as unknown as { data: { added: number; updated: number; total: number } };
    return body.data;
  }

  // ==================== 文件管理接口 ====================

  /**
   * 获取文件列表
   */
  async getFiles(filter: FileFilter, pageInput: PageInput): Promise<FileListResponse> {
    const params = new URLSearchParams();
    params.append('page', pageInput.page.toString());
    params.append('pageSize', pageInput.pageSize.toString());
    if (filter.keyword) params.append('keyword', filter.keyword);
    if (filter.folderId) params.append('folderId', filter.folderId);
    if (filter.folderScope) params.append('folderScope', filter.folderScope);
    if (filter.mimeType) params.append('mimeType', filter.mimeType);
    if (filter.storageMode) params.append('storageMode', filter.storageMode);

    const response = await this.request<FileListResponse>(`/files?${params.toString()}`);
    return {
      ...response.data,
      items: (response.data.items || []).map((file) => normalizeFile(file)),
    };
  }

  /**
   * 获取文件详情
   */
  async getFile(id: string): Promise<FileItem> {
    const response = await this.request<FileItem>(`/files/${id}`);
    return normalizeFile(response.data);
  }

  /**
   * 重命名文件
   */
  async renameFile(id: string, name: string): Promise<FileItem> {
    const response = await this.request<FileItem>(`/files/${id}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    return normalizeFile(response.data);
  }

  /**
   * 移动文件
   */
  async moveFile(id: string, folderId: string): Promise<FileItem> {
    const response = await this.request<FileItem>(`/files/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folderId }),
    });
    return normalizeFile(response.data);
  }

  /**
   * 批量移动文件
   */
  async batchMoveFiles(fileIds: string[], folderId: string): Promise<void> {
    await this.request('/files/batch-move', {
      method: 'POST',
      body: JSON.stringify({ fileIds, folderId }),
    });
  }

  /**
   * 复制文件
   */
  async copyFile(id: string, folderId?: string): Promise<FileItem> {
    const response = await this.request<FileItem>(`/files/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify({ folderId }),
    });
    return normalizeFile(response.data);
  }

  /**
   * 批量复制文件
   */
  async batchCopyFiles(fileIds: string[], folderId?: string): Promise<void> {
    await this.request('/files/batch-copy', {
      method: 'POST',
      body: JSON.stringify({ fileIds, folderId }),
    });
  }

  /**
   * 清空文件夹（删除文件夹中的所有文件）
   */
  async clearFolder(folderId: string): Promise<void> {
    await this.request(`/folders/${folderId}/clear`, {
      method: 'POST',
    });
  }

  /**
   * 删除文件（移到回收站）
   */
  async deleteFile(id: string): Promise<void> {
    await this.request(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 批量删除文件
   */
  async batchDeleteFiles(fileIds: string[]): Promise<void> {
    await this.request('/files/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  /**
   * 获取回收站文件列表
   */
  async getDeletedFiles(page: number = 1, pageSize: number = 20): Promise<FileListResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    const response = await this.request<FileListResponse>(`/files/recycle-bin/list?${params.toString()}`);
    return response.data;
  }

  /**
   * 恢复已删除文件
   */
  async restoreFile(id: string): Promise<void> {
    await this.request(`/files/${id}/restore`, {
      method: 'POST',
    });
  }

  /**
   * 永久删除文件
   */
  async permanentDeleteFile(id: string): Promise<void> {
    await this.request(`/files/${id}/permanent`, {
      method: 'DELETE',
    });
  }

  /**
   * 批量永久删除文件
   */
  async batchPermanentDeleteFiles(fileIds: string[]): Promise<void> {
    await this.request('/files/recycle-bin/batch-permanent', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  /**
   * 清空回收站
   */
  async clearRecycleBin(): Promise<void> {
    await this.request('/files/recycle-bin/clear', {
      method: 'POST',
    });
  }

  /**
   * 获取回收站保留天数配置
   */
  async getRecycleBinRetentionDays(): Promise<{ days: number }> {
    const response = await this.request<{ days: number }>('/files/recycle-bin/retention-days');
    return response.data;
  }

  /**
   * 更新回收站保留天数配置
   */
  async updateRecycleBinRetentionDays(days: number): Promise<{ days: number }> {
    const response = await this.request<{ days: number }>('/files/recycle-bin/retention-days', {
      method: 'PUT',
      body: JSON.stringify({ days }),
    });
    return response.data;
  }

  /**
   * 获取文件统计
   */
  async getFileStats(storageMode?: 'rustfs' | 'local'): Promise<FileStats> {
    const params = storageMode ? `?storageMode=${storageMode}` : '';
    const response = await this.request<FileStats>(`/files/stats/overview${params}`);
    return response.data;
  }

  // ==================== 文件夹管理接口 ====================

  /**
   * 获取文件夹列表
   */
  async getFolders(parentId?: string): Promise<Folder[]> {
    const params = new URLSearchParams();
    if (parentId) params.append('parentId', parentId);

    const response = await this.request<Folder[]>(`/folders?${params.toString()}`);
    return response.data;
  }

  /**
   * 获取文件夹树
   */
  async getFolderTree(): Promise<FolderTreeNode[]> {
    const response = await this.request<FolderTreeNode[]>('/folders/tree/all');
    return response.data;
  }

  /**
   * 获取文件夹详情
   */
  async getFolder(id: string): Promise<Folder> {
    const response = await this.request<Folder>(`/folders/${id}`);
    return response.data;
  }

  /**
   * 创建文件夹
   */
  async createFolder(data: { name: string; parentId?: string; realFolderId?: string; icon?: string; description?: string }): Promise<Folder> {
    const response = await this.request<Folder>('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新文件夹
   */
  async updateFolder(id: string, data: { name?: string; realFolderId?: string; icon?: string; description?: string }): Promise<Folder> {
    const response = await this.request<Folder>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取真实文件夹列表
   */
  async getRealFolders(): Promise<RealFolder[]> {
    const response = await this.request<RealFolder[]>('/folders/real');
    return response.data;
  }

  /**
   * 创建真实文件夹
   */
  async createRealFolder(data: { pathName: string; displayName: string; description?: string; sortOrder?: number }): Promise<RealFolder> {
    const response = await this.request<RealFolder>('/folders/real', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新真实文件夹
   */
  async updateRealFolder(id: string, data: { displayName?: string; description?: string; sortOrder?: number }): Promise<RealFolder> {
    const response = await this.request<RealFolder>(`/folders/real/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除真实文件夹
   */
  async deleteRealFolder(id: string): Promise<void> {
    await this.request(`/folders/real/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 移动文件夹
   */
  async moveFolder(id: string, parentId?: string): Promise<Folder> {
    const response = await this.request<Folder>(`/folders/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ parentId }),
    });
    return response.data;
  }

  /**
   * 删除文件夹
   */
  async deleteFolder(id: string, deleteFiles: boolean = false): Promise<void> {
    await this.request(`/folders/${id}?deleteFiles=${deleteFiles}`, {
      method: 'DELETE',
    });
  }

  // ==================== 文件夹共享接口 ====================

  /**
   * 获取我的文件夹（个人 + 共享给我的 + 系统共享）
   */
  async getMyFolders(): Promise<MyFoldersResponse> {
    const response = await this.request<MyFoldersResponse>('/folders/my');
    return response.data;
  }

  /**
   * 获取共享给我的文件夹
   */
  async getSharedWithMeFolders(): Promise<{ items: SharedFolderInfo[] }> {
    const response = await this.request<{ items: SharedFolderInfo[] }>('/folders/shared-with-me');
    return response.data;
  }

  /**
   * 共享文件夹给用户或角色
   */
  async shareFolder(folderId: string, data: ShareFolderRequest): Promise<{ success: boolean; createdCount: number }> {
    const response = await this.request<{ success: boolean; createdCount: number }>(`/folders/${folderId}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取文件夹的共享记录
   */
  async getFolderShares(folderId: string): Promise<{ items: FolderShareRecord[] }> {
    const response = await this.request<{ items: FolderShareRecord[] }>(`/folders/${folderId}/shares`);
    return response.data;
  }

  /**
   * 更新共享权限
   */
  async updateFolderShare(folderId: string, shareId: string, data: UpdateSharePermissionRequest): Promise<FolderShareRecord> {
    const response = await this.request<FolderShareRecord>(`/folders/${folderId}/shares/${shareId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 取消共享
   */
  async removeFolderShare(folderId: string, shareId: string): Promise<void> {
    await this.request(`/folders/${folderId}/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 获取当前用户对文件夹的权限
   */
  async getFolderPermissions(folderId: string): Promise<FolderPermissionsResponse> {
    const response = await this.request<FolderPermissionsResponse>(`/folders/${folderId}/permissions`);
    return response.data;
  }

  /**
   * 创建系统共享文件夹（管理员专用）
   */
  async createSystemSharedFolder(data: CreateSystemSharedFolderRequest): Promise<Folder> {
    const response = await this.request<Folder>('/folders/system-shared', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取所有系统共享文件夹（管理员专用）
   */
  async getSystemSharedFolders(): Promise<{ items: any[] }> {
    const response = await this.request<{ items: any[] }>('/folders/system-shared');
    return response.data;
  }

  // ==================== 上传接口 ====================

  /**
   * 单文件上传（小文件，不分片）
   */
  async uploadFile(
    file: File, 
    folderId?: string, 
    storageMode?: 'rustfs' | 'local', 
    onProgress?: (progress: number) => void,
    compress: boolean = true,
    generateThumbnail: boolean = true,
    realFolderId?: string,
    source?: 'upload' | 'editor',
  ): Promise<FileItem> {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    if (folderId) params.append('folderId', folderId);
    if (realFolderId) params.append('realFolderId', realFolderId);
    if (storageMode) params.append('storageMode', storageMode);
    params.append('compress', String(compress));
    params.append('generateThumbnail', String(generateThumbnail));
    if (source) params.append('source', source);
    const queryString = params.toString();
    const url = `${API_BASE_URL}/upload/file${queryString ? `?${queryString}` : ''}`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.data);
        } else {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || '上传失败'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'));
      });

      xhr.open('POST', url);
      if (this.accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      }
      xhr.send(formData);
    });
  }

  /**
   * 检查文件是否存在（秒传检查）
   */
  async checkFileExists(fileMd5: string, fileSize: number, fileName: string): Promise<{
    exists: boolean;
    canReuse: boolean;
    fileId?: string;
    fileUrl?: string;
  }> {
    const response = await this.request<{
      exists: boolean;
      canReuse: boolean;
      fileId?: string;
      fileUrl?: string;
    }>('/upload/check-exists', {
      method: 'POST',
      body: JSON.stringify({ fileMd5, fileSize, fileName }),
    });
    return response.data;
  }

  /**
   * 初始化分片上传会话
   */
  async initUpload(data: {
    fileName: string;
    fileSize: number;
    fileMd5: string;
    mimeType: string;
    folderId?: string;
    storageMode?: 'rustfs' | 'local';
  }): Promise<{
    sessionId: string;
    chunkSize: number;
    chunkCount: number;
    exists: boolean;
    uploadedChunks: number[];
    fileId?: string;
    fileUrl?: string;
  }> {
    const response = await this.request<{
      sessionId: string;
      chunkSize: number;
      chunkCount: number;
      exists: boolean;
      uploadedChunks: number[];
      fileId?: string;
      fileUrl?: string;
    }>('/upload/init', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 上传分片
   * @param sessionId 上传会话ID
   * @param chunkIndex 分片索引
   * @param chunk 分片数据
   * @param chunkMd5 分片MD5
   * @param onProgress 进度回调
   * @param abortSignal 中止信号，用于暂停/取消上传
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunk: Blob,
    chunkMd5: string,
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<{ uploadedChunks: number; progress: number }> {
    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('chunkMd5', chunkMd5);

    const url = `${API_BASE_URL}/upload/chunk/${sessionId}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 监听abort信号
      if (abortSignal) {
        if (abortSignal.aborted) {
          reject(new Error('AbortError'));
          return;
        }
        abortSignal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('AbortError'));
        });
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.data);
        } else {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || '分片上传失败'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('AbortError'));
      });

      xhr.open('POST', url);
      if (this.accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      }
      xhr.send(formData);
    });
  }

  /**
   * 完成分片上传（合并）
   * @param sessionId 上传会话ID
   * @param compress 是否压缩图片（默认true）
   * @param generateThumbnail 是否生成缩略图（默认true）
   */
  async completeUpload(
    sessionId: string,
    compress: boolean = true,
    generateThumbnail: boolean = true
  ): Promise<{ fileId: string; fileUrl: string; size: number; mimeType: string }> {
    const response = await this.request<{ fileId: string; fileUrl: string; size: number; mimeType: string }>(
      `/upload/complete`,
      { 
        method: 'POST',
        body: JSON.stringify({ sessionId, compress, generateThumbnail })
      }
    );
    return response.data;
  }

  /**
   * 取消上传
   */
  async cancelUpload(sessionId: string): Promise<void> {
    await this.request(`/upload/${sessionId}`, { method: 'DELETE' });
  }

  /**
   * 上传视频缩略图
   */
  async uploadVideoThumbnail(fileId: string, thumbnailFile: File): Promise<void> {
    const formData = new FormData();
    formData.append('thumbnail', thumbnailFile);

    const url = `${API_BASE_URL}/files/${fileId}/thumbnail`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || '缩略图上传失败'));
          } catch {
            reject(new Error('缩略图上传失败'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'));
      });

      xhr.open('POST', url);
      if (this.accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      }
      xhr.send(formData);
    });
  }

  // ==================== 分享接口 ====================

  /**
   * 创建分享链接
   */
  async createShare(data: CreateShareRequest): Promise<ShareLink> {
    const response = await this.request<ShareLink>('/shares', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取文件的分享链接
   */
  async getFileShares(fileId: string): Promise<ShareLink[]> {
    const response = await this.request<ShareLink[]>(`/shares/file/${fileId}`);
    return response.data;
  }

  /**
   * 删除分享链接
   */
  async deleteShare(id: string): Promise<void> {
    await this.request(`/shares/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== 审计日志接口 ====================

  /**
   * 获取审计日志列表
   */
  async getAuditLogs(filter: AuditLogFilter, pageInput: PageInput): Promise<AuditLogListResponse> {
    const params = new URLSearchParams();
    params.append('page', pageInput.page.toString());
    params.append('pageSize', pageInput.pageSize.toString());
    if (filter.module) params.append('module', filter.module);
    if (filter.action) params.append('action', filter.action);
    if (filter.status) params.append('status', filter.status);
    if (filter.userId) params.append('userId', filter.userId);
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);

    const response = await this.request<{ items: AuditLog[]; meta: AuditLogListResponse['meta'] }>(`/audit?${params.toString()}`);
    const data = response.data as any;
    return {
      items: Array.isArray(data) ? data : (data.items || []),
      meta: data.meta || (response as any).meta || { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    };
  }

  /**
   * 获取审计统计
   */
  async getAuditStatistics(): Promise<AuditStatistics> {
    const response = await this.request<AuditStatistics>('/audit/statistics');
    return response.data;
  }

  // ==================== 系统配置接口 ====================

  /**
   * 获取配置列表
   */
  async getConfigs(filter: ConfigFilter, pageInput: PageInput): Promise<ConfigListResponse> {
    const params = new URLSearchParams();
    params.append('page', pageInput.page.toString());
    params.append('pageSize', pageInput.pageSize.toString());
    if (filter.category) params.append('category', filter.category);
    if (filter.keyword) params.append('keyword', filter.keyword);

    const response = await this.request<{ items: SystemConfig[]; meta: ConfigListResponse['meta'] }>(`/config?${params.toString()}`);
    const data = response.data as any;
    return {
      items: Array.isArray(data) ? data : (data.items || []),
      meta: data.meta || (response as any).meta || { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    };
  }

  /**
   * 获取配置详情
   */
  async getConfig(id: string): Promise<SystemConfig> {
    const response = await this.request<SystemConfig>(`/config/${id}`);
    return response.data;
  }

  /**
   * 创建配置
   */
  async createConfig(data: CreateConfigRequest): Promise<SystemConfig> {
    const response = await this.request<SystemConfig>('/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新配置
   */
  async updateConfig(id: string, data: UpdateConfigRequest): Promise<SystemConfig> {
    const response = await this.request<SystemConfig>(`/config/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除配置
   */
  async deleteConfig(id: string): Promise<void> {
    await this.request(`/config/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 获取配置分组
   */
  async getConfigCategories(): Promise<string[]> {
    const response = await this.request<string[]>('/config/categories/list');
    return response.data;
  }

  // ==================== RUSTFS 存储配置 ====================

  /**
   * 获取RUSTFS存储配置
   */
  async getRustFSConfig(): Promise<{
    endpoint: string;
    bucketName: string;
    accessKey: string;
    secretKey: string;
    region: string;
  }> {
    const response = await this.request<any>('/config/storage/rustfs');
    return response.data || response;
  }

  /**
   * 保存RUSTFS存储配置
   */
  async saveRustFSConfig(data: {
    endpoint: string;
    bucketName: string;
    accessKey: string;
    secretKey: string;
    region?: string;
  }): Promise<void> {
    await this.request('/config/storage/rustfs', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 测试RUSTFS连接
   */
  async testRustFSConnection(): Promise<{ success: boolean; message: string }> {
    const response = await this.request<any>('/config/storage/rustfs/test', {
      method: 'POST',
    });
    return response.data || response;
  }

  /**
   * 获取缩略图配置
   */
  async getThumbnailSettings(): Promise<{ width: number; height: number; quality: number }> {
    const response = await this.request<{ width: number; height: number; quality: number }>('/config/thumbnail/settings');
    return response.data;
  }

  /**
   * 保存缩略图配置
   */
  async saveThumbnailSettings(data: { width: number; height: number; quality: number }): Promise<void> {
    await this.request('/config/thumbnail/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取上传配置（并行上传数量等）
   */
  async getUploadSettings(): Promise<{ maxConcurrentUploads: number }> {
    const response = await this.request<{ maxConcurrentUploads: number }>('/config/upload/settings');
    return response.data;
  }

  /**
   * 保存上传配置
   */
  async saveUploadSettings(data: { maxConcurrentUploads: number }): Promise<void> {
    await this.request('/config/upload/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取图片压缩配置
   */
  async getCompressionSettings(): Promise<{
    quality: number;
    maxWidth: number;
    maxHeight: number;
    threshold: number;
  }> {
    const response = await this.request<{
      quality: number;
      maxWidth: number;
      maxHeight: number;
      threshold: number;
    }>('/config/compression/settings');
    return response.data;
  }

  /**
   * 保存图片压缩配置
   */
  async saveCompressionSettings(data: {
    quality: number;
    maxWidth: number;
    maxHeight: number;
    threshold: number;
  }): Promise<void> {
    await this.request('/config/compression/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // 编辑器配置API
  // ============================================

  /**
   * 获取编辑器图片配置
   */
  async getEditorImageSettings(): Promise<{
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    thumbnailWidth: number;
    thumbnailHeight: number;
  }> {
    const response = await this.request<{
      maxWidth: number;
      maxHeight: number;
      maxSize: number;
      formats: string[];
      thumbnailWidth: number;
      thumbnailHeight: number;
    }>('/config/editor/image-settings');
    return response.data;
  }

  /**
   * 保存编辑器图片配置
   */
  async saveEditorImageSettings(data: {
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    thumbnailWidth: number;
    thumbnailHeight: number;
  }): Promise<void> {
    await this.request('/config/editor/image-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取编辑器视频配置
   */
  async getEditorVideoSettings(): Promise<{
    maxSize: number;
    formats: string[];
  }> {
    const response = await this.request<{
      maxSize: number;
      formats: string[];
    }>('/config/editor/video-settings');
    return response.data;
  }

  /**
   * 保存编辑器视频配置
   */
  async saveEditorVideoSettings(data: {
    maxSize: number;
    formats: string[];
  }): Promise<void> {
    await this.request('/config/editor/video-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取编辑器文件夹配置
   */
  async getEditorFolderSettings(): Promise<{
    imageFolderId: string;
    videoFolderId: string;
  }> {
    const response = await this.request<{
      imageFolderId: string;
      videoFolderId: string;
    }>('/config/editor/folder-settings');
    return response.data;
  }

  /**
   * 保存编辑器文件夹配置
   */
  async saveEditorFolderSettings(data: {
    imageFolderId: string;
    videoFolderId: string;
  }): Promise<void> {
    await this.request('/config/editor/folder-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ==================== 记事本编辑器配置 ====================

  async getNotebookImageSettings(): Promise<{
    maxWidth: number; maxHeight: number; maxSize: number;
    formats: string[]; thumbnailWidth: number; thumbnailHeight: number;
  }> {
    const r = await this.request<{
      maxWidth: number; maxHeight: number; maxSize: number;
      formats: string[]; thumbnailWidth: number; thumbnailHeight: number;
    }>('/config/notebook/image-settings');
    return r.data;
  }

  async saveNotebookImageSettings(data: {
    maxWidth: number; maxHeight: number; maxSize: number;
    formats: string[]; thumbnailWidth: number; thumbnailHeight: number;
  }): Promise<void> {
    await this.request('/config/notebook/image-settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getNotebookVideoSettings(): Promise<{ maxSize: number; formats: string[] }> {
    const r = await this.request<{ maxSize: number; formats: string[] }>('/config/notebook/video-settings');
    return r.data;
  }

  async saveNotebookVideoSettings(data: { maxSize: number; formats: string[] }): Promise<void> {
    await this.request('/config/notebook/video-settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getNotebookFolderSettings(): Promise<{ imageFolderId: string; videoFolderId: string }> {
    const r = await this.request<{ imageFolderId: string; videoFolderId: string }>('/config/notebook/folder-settings');
    return r.data;
  }

  async saveNotebookFolderSettings(data: { imageFolderId: string; videoFolderId: string }): Promise<void> {
    await this.request('/config/notebook/folder-settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  // ============================================
  // 安全中心API
  // ============================================

  /**
   * 获取安全中心统计数据
   */
  async getSecurityStats(): Promise<{
    totalFiles: number;
    pendingScan: number;
    clean: number;
    threatDetected: number;
    verifiedSafe: number;
    quarantined: number;
    scanFailed: number;
    scannerAvailable: boolean;
  }> {
    const response = await this.request<any>('/upload/security/stats');
    return response.data;
  }

  /**
   * 获取待审核文件列表
   */
  async getScanFiles(params: {
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: any[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
    statistics: any;
  }> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    
    const response = await this.request<any>(`/upload/security/scan-files?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * 确认文件安全
   */
  async verifyFileSafe(fileId: string, note: string): Promise<any> {
    const response = await this.request<any>(`/upload/security/verify/${fileId}`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    return response.data;
  }

  /**
   * 隔离危险文件
   */
  async quarantineFile(fileId: string, reason: string, deleteFromStorage?: boolean): Promise<any> {
    const response = await this.request<any>(`/upload/security/quarantine/${fileId}`, {
      method: 'POST',
      body: JSON.stringify({ reason, deleteFromStorage }),
    });
    return response.data;
  }

  /**
   * 重新扫描文件
   */
  async rescanFile(fileId: string): Promise<any> {
    const response = await this.request<any>(`/upload/security/rescan/${fileId}`, {
      method: 'POST',
    });
    return response.data;
  }

  /**
   * 批量确认文件安全
   */
  async batchVerifyFiles(fileIds: string[], note: string): Promise<{ successCount: number; failedCount: number; failedIds: string[] }> {
    const response = await this.request<any>('/upload/security/batch-verify', {
      method: 'POST',
      body: JSON.stringify({ fileIds, note }),
    });
    return response.data;
  }

  /**
   * 批量隔离文件
   */
  async batchQuarantineFiles(fileIds: string[], reason: string, deleteFromStorage?: boolean): Promise<{ successCount: number; failedCount: number; failedIds: string[] }> {
    const response = await this.request<any>('/upload/security/batch-quarantine', {
      method: 'POST',
      body: JSON.stringify({ fileIds, reason, deleteFromStorage }),
    });
    return response.data;
  }

  /**
   * 获取安全事件列表
   */
  async getSecurityEvents(params: {
    eventType?: string;
    severity?: string;
    status?: string;
    ipAddress?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: any[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
    statistics: { totalCount: number; newCount: number; investigatingCount: number; resolvedCount: number };
  }> {
    const queryParams = new URLSearchParams();
    if (params.eventType) queryParams.append('eventType', params.eventType);
    if (params.severity) queryParams.append('severity', params.severity);
    if (params.status) queryParams.append('status', params.status);
    if (params.ipAddress) queryParams.append('ipAddress', params.ipAddress);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    
    const response = await this.request<any>(`/upload/security/events?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * 确认安全事件
   */
  async acknowledgeEvent(eventId: string, data: { status?: string; actionTaken?: string; notes?: string }): Promise<any> {
    const response = await this.request<any>(`/upload/security/events/${eventId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 批量确认安全事件
   */
  async batchAcknowledgeEvents(eventIds: string[], notes?: string): Promise<{ success: boolean; successCount: number; failedCount: number }> {
    const response = await this.request<any>('/upload/security/events/batch-acknowledge', {
      method: 'POST',
      body: JSON.stringify({ eventIds, notes }),
    });
    return response.data;
  }

  /**
   * 批量删除安全事件
   */
  async batchDeleteEvents(
    eventIds: string[],
  ): Promise<{ success: boolean; deletedCount: number }> {
    const response = await this.request<any>(
      '/upload/security/events/batch-delete',
      {
        method: 'POST',
        body: JSON.stringify({ eventIds }),
      },
    );
    return response.data;
  }

  /**
   * 批量删除审计日志
   */
  async batchDeleteAuditLogs(
    logIds: string[],
  ): Promise<{ deletedCount: number }> {
    const response = await this.request<any>('/audit/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ logIds }),
    });
    return response.data;
  }

  /**
   * 获取上传安全配置
   */
  async getUploadSecurityConfig(): Promise<{
    enableFormatLimit: boolean;
    enableBlacklist: boolean;
    globalMaxFiles: number;
    dangerousExtensions: string[];
    enableVirusScan: boolean;
    scanTimeoutSeconds: number;
    autoQuarantine: boolean;
    minFreeSpaceBytes: number;
    enableSpaceCheck: boolean;
    updatedAt: string;
  }> {
    const response = await this.request<any>('/upload/security/config');
    return response.data;
  }

  /**
   * 更新上传安全配置
   */
  async updateUploadSecurityConfig(data: {
    enableFormatLimit?: boolean;
    enableBlacklist?: boolean;
    enableVirusScan?: boolean;
    autoQuarantine?: boolean;
    enableSpaceCheck?: boolean;
    scanTimeoutSeconds?: number;
  }): Promise<any> {
    const response = await this.request<any>('/upload/security/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取文件格式配置列表
   */
  async getFileFormats(): Promise<{
    items: Array<{
      id: string;
      fileExtension: string;
      displayName: string;
      mimeTypes: string[];
      maxSize: number;
      minSize: number;
      category: string;
      isEnabled: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>;
    total: number;
  }> {
    const response = await this.request<any>('/upload/security/formats');
    return response.data;
  }

  /**
   * 创建文件格式配置
   */
  async createFileFormat(data: {
    fileExtension: string;
    displayName: string;
    mimeTypes: string[];
    maxSize: number;
    minSize?: number;
    category?: string;
    isEnabled?: boolean;
  }): Promise<any> {
    const response = await this.request<any>('/upload/security/formats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新文件格式配置
   */
  async updateFileFormat(formatId: string, data: {
    displayName?: string;
    mimeTypes?: string[];
    maxSize?: number;
    minSize?: number;
    isEnabled?: boolean;
  }): Promise<any> {
    const response = await this.request<any>(`/upload/security/formats/${formatId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除文件格式配置
   */
  async deleteFileFormat(formatId: string): Promise<{ success: boolean }> {
    const response = await this.request<any>(`/upload/security/formats/${formatId}`, {
      method: 'DELETE',
    });
    return response.data;
  }

  /**
   * 切换文件格式启用状态
   */
  async toggleFileFormat(formatId: string): Promise<{ id: string; isEnabled: boolean }> {
    const response = await this.request<any>(`/upload/security/formats/${formatId}/toggle`, {
      method: 'POST',
    });
    return response.data;
  }

  /**
   * 初始化常用文件格式
   */
  async initCommonFormats(): Promise<{ success: boolean; createdCount: number; skippedCount: number }> {
    const response = await this.request<any>('/upload/security/formats/init-common', {
      method: 'POST',
    });
    return response.data;
  }

  /**
   * 添加黑名单扩展名
   */
  async addBlacklistExtension(extension: string): Promise<{ success: boolean; dangerousExtensions: string[] }> {
    const response = await this.request<any>('/upload/security/blacklist', {
      method: 'POST',
      body: JSON.stringify({ extension }),
    });
    return response.data;
  }

  /**
   * 删除黑名单扩展名
   */
  async removeBlacklistExtension(ext: string): Promise<{ success: boolean; dangerousExtensions: string[] }> {
    const response = await this.request<any>(`/upload/security/blacklist/${ext}`, {
      method: 'DELETE',
    });
    return response.data;
  }

  /**
   * 初始化常用危险格式黑名单
   */
  async initBlacklistFormats(): Promise<{ success: boolean; dangerousExtensions: string[] }> {
    const response = await this.request<any>('/upload/security/blacklist/init', {
      method: 'POST',
    });
    return response.data;
  }

  /**
   * 获取病毒扫描器状态
   */
  async getScannerStatus(): Promise<{ available: boolean; version?: string; lastCheck?: string }> {
    const response = await this.request<any>('/upload/security/scanner/status');
    return response.data;
  }

  // ==================== AI 助手接口 ====================

  /**
   * AI内容生成（面板用）
   */
  async generateAIContent(data: {
    modelName: string;
    messages: Array<{ role: string; content: string }>;
    options?: { temperature?: number; maxTokens?: number; topP?: number };
  }): Promise<any> {
    const response = await this.request<any>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取已启用模型列表（面板模型选择器用）
   */
  async getEnabledAIModels(): Promise<any[]> {
    const response = await this.request<any[]>('/ai/models/enabled');
    return response.data;
  }

  // ==================== AI 模型管理接口（系统设置用） ====================

  /**
   * 获取所有模型列表（含已禁用）
   */
  async getAIModels(): Promise<any[]> {
    const response = await this.request<any[]>('/ai/models');
    return response.data;
  }

  /**
   * 创建AI模型
   */
  async createAIModel(data: any): Promise<any> {
    const response = await this.request<any>('/ai/models', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新AI模型
   */
  async updateAIModel(id: string, data: any): Promise<any> {
    const response = await this.request<any>(`/ai/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除AI模型
   */
  async deleteAIModel(id: string): Promise<void> {
    await this.request(`/ai/models/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 启用/禁用AI模型
   */
  async toggleAIModel(id: string, isEnabled: boolean): Promise<any> {
    const response = await this.request<any>(`/ai/models/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled }),
    });
    return response.data;
  }

  // ==================== 数据字典接口 ====================

  /**
   * 获取字典类型列表
   */
  async getDictTypes(): Promise<any[]> {
    const response = await this.request<any[]>('/dictionaries');
    return response.data;
  }

  /**
   * 获取指定类型的字典条目
   */
  async getDictItems(typeCode: string): Promise<any[]> {
    const response = await this.request<any[]>(
        `/dictionaries/items?typeCode=${typeCode}`,
    );
    return response.data;
  }

  /**
   * 创建字典条目
   */
  async createDictItem(data: any): Promise<any> {
    const response = await this.request<any>('/dictionaries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新字典条目
   */
  async updateDictItem(id: string, data: any): Promise<any> {
    const response = await this.request<any>(`/dictionaries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除字典条目
   */
  async deleteDictItem(id: string): Promise<void> {
    await this.request(`/dictionaries/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 启用/禁用字典条目
   */
  async toggleDictItem(id: string): Promise<any> {
    const response = await this.request<any>(
        `/dictionaries/${id}/toggle`,
        { method: 'PATCH' },
    );
    return response.data;
  }

  // ==================== 导入导出 API ====================

  async getExportModules(): Promise<any[]> {
    const response = await this.request<any[]>(
        '/export-import/modules',
    );
    return response.data;
  }

  async createExport(data: {
    module: string;
    format: string;
    params?: Record<string, any>;
  }): Promise<any> {
    const response = await this.request<any>(
        '/export-import/export',
        {
            method: 'POST',
            body: JSON.stringify(data),
        },
    );
    return response;
  }

  async getExportTasks(query?: {
    module?: string;
    type?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (query?.module) params.set('module', query.module);
    if (query?.type) params.set('type', query.type);
    if (query?.status) params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    const response = await this.request<any>(
        `/export-import/tasks${qs ? '?' + qs : ''}`,
    );
    return response;
  }

  async getExportTask(id: string): Promise<any> {
    const response = await this.request<any>(
        `/export-import/tasks/${id}`,
    );
    return response.data;
  }

  async deleteExportTask(id: string): Promise<void> {
    await this.request(`/export-import/tasks/${id}`, {
        method: 'DELETE',
    });
  }

  getExportDownloadUrl(taskId: string): string {
    const token =
        this.accessToken ||
        (typeof window !== 'undefined'
            ? localStorage.getItem('accessToken')
            : null);
    return `${API_BASE_URL}/export-import/download/${taskId}?token=${token}`;
  }

  async importPreview(
    moduleName: string,
    file: File,
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const token =
        this.accessToken ||
        localStorage.getItem('accessToken');
    const response = await fetch(
        `${API_BASE_URL}/export-import/import/preview?module=${moduleName}`,
        {
            method: 'POST',
            headers: {
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
            },
            body: formData,
        },
    );
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || '导入预览失败');
    }
    return data.data;
  }

  async importConfirm(
    moduleName: string,
    file: File,
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const token =
        this.accessToken ||
        localStorage.getItem('accessToken');
    const response = await fetch(
        `${API_BASE_URL}/export-import/import/confirm?module=${moduleName}`,
        {
            method: 'POST',
            headers: {
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
            },
            body: formData,
        },
    );
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || '导入失败');
    }
    return data;
  }

  // ==================== 平台管理接口 ====================

  /**
   * 获取平台列表
   */
  async getPlatforms(params?: { keyword?: string }): Promise<{ list: any[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
    const query = params?.keyword ? `?keyword=${encodeURIComponent(params.keyword)}` : '';
    const response = await this.request<any>(`/business/platforms${query}`);
    return response.data;
  }

  /**
   * 获取启用的平台列表
   */
  async getActivePlatforms(): Promise<any[]> {
    const response = await this.request<any[]>(`/business/platforms/active`);
    return response.data;
  }

  /**
   * 获取平台详情
   */
  async getPlatform(id: string): Promise<any> {
    const response = await this.request<any>(`/business/platforms/${id}`);
    return response.data;
  }

  /**
   * 创建平台
   */
  async createPlatform(data: { name: string; code: string; type?: string; logo?: string; website?: string; remark?: string }): Promise<any> {
    const response = await this.request<any>(`/business/platforms`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新平台
   */
  async updatePlatform(id: string, data: { name?: string; code?: string; type?: string; logo?: string; website?: string; status?: string; remark?: string }): Promise<any> {
    const response = await this.request<any>(`/business/platforms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除平台
   */
  async deletePlatform(id: string): Promise<void> {
    await this.request(`/business/platforms/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== 店铺管理接口 ====================

  /**
   * 获取店铺列表
   */
  async getShops(params?: { keyword?: string; platformId?: string; managerId?: string; status?: string; pageSize?: number }): Promise<{ list: any[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
    const queryParams = new URLSearchParams();
    if (params?.keyword) queryParams.append('keyword', params.keyword);
    if (params?.platformId) queryParams.append('platformId', params.platformId);
    if (params?.managerId) queryParams.append('managerId', params.managerId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await this.request<any>(`/business/shops${query}`);
    return response.data;
  }

  /**
   * 获取经营中的店铺列表
   */
  async getActiveShops(): Promise<any[]> {
    const response = await this.request<any[]>(`/business/shops/active`);
    return response.data;
  }

  /**
   * 获取店铺详情
   */
  async getShop(id: string): Promise<any> {
    const response = await this.request<any>(`/business/shops/${id}`);
    return response.data;
  }

  /**
   * 创建店铺
   */
  async createShop(data: { name: string; platformId: string; managerId: string; status?: string; remark?: string }): Promise<any> {
    const response = await this.request<any>(`/business/shops`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新店铺
   */
  async updateShop(id: string, data: { name?: string; platformId?: string; managerId?: string; status?: string; remark?: string }): Promise<any> {
    const response = await this.request<any>(`/business/shops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除店铺
   */
  async deleteShop(id: string): Promise<void> {
    await this.request(`/business/shops/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== 店铺别名 API ====================

  /**
   * 获取店铺别名列表
   */
  async getShopAliases(shopId: string): Promise<any[]> {
    const response = await this.request<any[]>(`/business/shops/${shopId}/aliases`);
    return response.data;
  }

  /**
   * 添加店铺别名
   */
  async addShopAlias(shopId: string, alias: string): Promise<any> {
    const response = await this.request<any>(`/business/shops/${shopId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias }),
    });
    return response.data;
  }

  /**
   * 删除店铺别名
   */
  async removeShopAlias(shopId: string, aliasId: string): Promise<void> {
    await this.request(`/business/shops/${shopId}/aliases/${aliasId}`, {
      method: 'DELETE',
    });
  }

  // ==================== 快递管理 API ====================

  /**
   * 获取快递公司列表
   */
  async getExpressCompanies(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.keyword) queryParams.append('keyword', params.keyword);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    
    const response = await this.request<any>(`/business/express/companies?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * 获取快递公司下拉列表
   */
  async getExpressCompaniesForSelect(): Promise<any[]> {
    const response = await this.request<any>(`/business/express/companies/select`);
    return response.data;
  }

  /**
   * 获取快递公司详情
   */
  async getExpressCompany(id: string): Promise<any> {
    const response = await this.request<any>(`/business/express/companies/${id}`);
    return response.data;
  }

  /**
   * 创建快递公司
   */
  async createExpressCompany(data: { name: string; code: string; contactName?: string; contactPhone?: string; status?: string; remark?: string }): Promise<any> {
    const response = await this.request<any>(`/business/express/companies`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新快递公司
   */
  async updateExpressCompany(id: string, data: { name?: string; code?: string; contactName?: string; contactPhone?: string; status?: string; remark?: string }): Promise<any> {
    const response = await this.request<any>(`/business/express/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除快递公司
   */
  async deleteExpressCompany(id: string): Promise<void> {
    await this.request(`/business/express/companies/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 获取快递价格列表
   */
  async getExpressPrices(companyId: string): Promise<any[]> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/prices`);
    return response.data;
  }

  /**
   * 创建快递价格
   */
  async createExpressPrice(data: { companyId: string; firstWeight: number; firstWeightPrice: number; additionalWeight: number; additionalWeightPrice: number; volumeRatio?: number }): Promise<any> {
    const response = await this.request<any>(`/business/express/prices`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新快递价格
   */
  async updateExpressPrice(id: string, data: { firstWeight?: number; firstWeightPrice?: number; additionalWeight?: number; additionalWeightPrice?: number; volumeRatio?: number; isActive?: boolean }): Promise<any> {
    const response = await this.request<any>(`/business/express/prices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除快递价格
   */
  async deleteExpressPrice(id: string): Promise<void> {
    await this.request(`/business/express/prices/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 计算快递费用（旧版）
   */
  async calculateExpressFee(companyId: string, data: { weight: number; length: number; width: number; height: number }): Promise<any> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/calculate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // ==================== 快递价格模块新API ====================

  /**
   * 获取区域配置
   */
  async getExpressZones(companyId: string): Promise<any[]> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/zones`);
    return response.data;
  }

  /**
   * 更新区域省份配置
   */
  async updateExpressZone(id: string, data: { provinces: string[] }): Promise<any> {
    const response = await this.request<any>(`/business/express/zones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 批量更新区域配置
   */
  async batchUpdateExpressZones(companyId: string, data: { zones: { id: string; provinces: string[] }[] }): Promise<any> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/zones/batch`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取重量段配置
   */
  async getExpressWeightRanges(companyId: string): Promise<any[]> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/weight-ranges`);
    return response.data;
  }

  /**
   * 更新重量段配置
   */
  async updateExpressWeightRange(id: string, data: { label?: string; minWeight?: number; maxWeight?: number }): Promise<any> {
    const response = await this.request<any>(`/business/express/weight-ranges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取价格矩阵
   */
  async getExpressPriceMatrix(companyId: string): Promise<{ zones: any[]; weightRanges: any[]; matrix: Record<string, Record<string, number>> }> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/prices/matrix`);
    return response.data;
  }

  /**
   * 批量更新价格
   */
  async batchUpdateExpressPrices(companyId: string, data: { prices: { zoneId: string; weightRangeId: string; price: number }[] }): Promise<any> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/prices/batch`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 复制价格配置
   */
  async copyExpressPrices(companyId: string, data: { sourceCompanyId: string }): Promise<any> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/prices/copy`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 获取附加费列表
   */
  async getExpressSurcharges(companyId: string): Promise<any[]> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/surcharges`);
    return response.data;
  }

  /**
   * 创建附加费
   */
  async createExpressSurcharge(companyId: string, data: { name: string; provinces: string[]; weightFrom?: number; weightTo?: number; amount: number }): Promise<any> {
    const response = await this.request<any>(`/business/express/companies/${companyId}/surcharges`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新附加费
   */
  async updateExpressSurcharge(id: string, data: { name?: string; provinces?: string[]; weightFrom?: number; weightTo?: number; amount?: number }): Promise<any> {
    const response = await this.request<any>(`/business/express/surcharges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除附加费
   */
  async deleteExpressSurcharge(id: string): Promise<void> {
    await this.request(`/business/express/surcharges/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 计算快递成本（新版）
   */
  async calculateExpressCost(data: { companyId: string; province: string; weight: number }): Promise<any> {
    const response = await this.request<any>(`/business/express/calculate-cost`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // ==================== 产品管理 API ====================

  /**
   * 获取产品列表
   */
  async getProducts(params?: { keyword?: string; status?: string; brand?: string; page?: number; pageSize?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.keyword) queryParams.append('keyword', params.keyword);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.brand) queryParams.append('brand', params.brand);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

    const response = await this.request<any>(`/business/products?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * 获取产品详情
   */
  async getProduct(id: string): Promise<any> {
    const response = await this.request<any>(`/business/products/${id}`);
    return response.data;
  }

  /**
   * 获取下一个产品编码（新增时默认自动填充，可手动修改）
   */
  async getNextProductCode(): Promise<{ code: string }> {
    const response = await this.request<{ code: string }>('/business/products/next-code');
    return response.data;
  }

  /**
   * 创建产品
   */
  async createProduct(data: any): Promise<any> {
    const response = await this.request<any>('/business/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新产品
   */
  async updateProduct(id: string, data: any): Promise<any> {
    const response = await this.request<any>(`/business/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除产品
   */
  async deleteProduct(id: string): Promise<void> {
    await this.request(`/business/products/${id}`, {
      method: 'DELETE',
    });
  }

  async reorderProducts(ids: string[]): Promise<void> {
    await this.request('/business/products/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * 获取品牌列表
   */
  async getBrands(): Promise<string[]> {
    const response = await this.request<any>('/business/products/brands/list');
    return response.data;
  }

  // ==================== SKU管理 API ====================

  async getSkus(params?: {
    keyword?: string;
    linkId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.keyword) q.append('keyword', params.keyword);
    if (params?.linkId) q.append('linkId', params.linkId);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    const r = await this.request<any>(`/business/skus?${q.toString()}`);
    return r.data;
  }

  async getSku(id: string): Promise<any> {
    const r = await this.request<any>(`/business/skus/${id}`);
    return r.data;
  }

  async createSku(data: any): Promise<any> {
    const r = await this.request<any>('/business/skus', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return r.data;
  }

  async updateSku(id: string, data: any): Promise<any> {
    const r = await this.request<any>(`/business/skus/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return r.data;
  }

  async deleteSku(id: string): Promise<void> {
    await this.request(`/business/skus/${id}`, { method: 'DELETE' });
  }

  async reorderSkus(ids: string[]): Promise<void> {
    await this.request('/business/skus/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async recalculateSkuCost(id: string): Promise<any> {
    const r = await this.request<any>(`/business/skus/${id}/recalculate`, {
      method: 'POST',
    });
    return r.data;
  }

  async getSkuLinksForSelect(): Promise<any[]> {
    const r = await this.request<any>('/business/skus/select/links');
    return r.data;
  }

  async getSkuFinishedProductsForSelect(): Promise<any[]> {
    const r = await this.request<any>('/business/skus/select/finished-products');
    return r.data;
  }

  // ==================== 定价计算 API ====================

  async calculatePricingMatrix(data: {
    linkId: string;
    profitRates: number[];
    commissionRate: number;
    taxRate?: number;
  }): Promise<any> {
    const r = await this.request<any>('/business/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return r.data;
  }

  async analyzeCommission(data: {
    linkId: string;
    sellingPrices: { skuId: string; price: number }[];
  }): Promise<any> {
    const r = await this.request<any>('/business/pricing/commission-analysis', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return r.data;
  }

  async savePricingPlan(data: any): Promise<any> {
    const r = await this.request<any>('/business/pricing/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return r.data;
  }

  async getPricingPlans(params?: {
    keyword?: string;
    linkId?: string;
    page?: number;
    pageSize?: number;
    withSummary?: boolean;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.keyword) q.append('keyword', params.keyword);
    if (params?.linkId) q.append('linkId', params.linkId);
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    if (params?.withSummary) q.append('withSummary', 'true');
    const r = await this.request<any>(`/business/pricing/plans?${q.toString()}`);
    return r.data;
  }

  async getPricingPlan(id: string): Promise<any> {
    const r = await this.request<any>(`/business/pricing/plans/${id}`);
    return r.data;
  }

  async updatePricingPlan(id: string, data: any): Promise<any> {
    const r = await this.request<any>(`/business/pricing/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return r.data;
  }

  async deletePricingPlan(id: string): Promise<void> {
    await this.request(`/business/pricing/plans/${id}`, { method: 'DELETE' });
  }

  async getPricingLinksForSelect(): Promise<any[]> {
    const r = await this.request<any>('/business/pricing/select/links');
    return r.data;
  }

  // ==================== 供应商管理 API ====================

  /**
   * 获取供应商列表
   */
  async getSuppliers(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.keyword) queryParams.append('keyword', params.keyword);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

    const response = await this.request<any>(`/business/suppliers?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * 获取供应商详情
   */
  async getSupplier(id: string): Promise<any> {
    const response = await this.request<any>(`/business/suppliers/${id}`);
    return response.data;
  }

  /**
   * 创建供应商
   */
  async createSupplier(data: any): Promise<any> {
    const response = await this.request<any>('/business/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新供应商
   */
  async updateSupplier(id: string, data: any): Promise<any> {
    const response = await this.request<any>(`/business/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除供应商
   */
  async deleteSupplier(id: string): Promise<void> {
    await this.request(`/business/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  async reorderSuppliers(ids: string[]): Promise<void> {
    await this.request('/business/suppliers/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async reorderPlatforms(ids: string[]): Promise<void> {
    await this.request('/business/platforms/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async reorderShops(ids: string[]): Promise<void> {
    await this.request('/business/shops/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async reorderExpressCompanies(ids: string[]): Promise<void> {
    await this.request('/business/express/companies/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async reorderProductLinks(ids: string[]): Promise<void> {
    await this.request('/business/product-links/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * 获取供应商下拉列表
   */
  async getSuppliersForSelect(): Promise<any[]> {
    const response = await this.request<any>('/business/suppliers/select/list');
    return response.data;
  }

  // ==================== 供应商-产品关联 API ====================

  /**
   * 获取供应商-产品关联列表
   */
  async getSupplierProducts(params?: { supplierId?: string; productId?: string; status?: string; page?: number; pageSize?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.productId) queryParams.append('productId', params.productId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

    const response = await this.request<any>(`/business/suppliers/products?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * 创建供应商-产品关联
   */
  async createSupplierProduct(data: any): Promise<any> {
    const response = await this.request<any>('/business/suppliers/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 更新供应商-产品关联
   */
  async updateSupplierProduct(id: string, data: any): Promise<any> {
    const response = await this.request<any>(`/business/suppliers/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 删除供应商-产品关联
   */
  async deleteSupplierProduct(id: string): Promise<void> {
    await this.request(`/business/suppliers/products/${id}`, {
      method: 'DELETE',
    });
  }

  async reorderSupplierProducts(ids: string[]): Promise<void> {
    await this.request('/business/suppliers/products/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * 获取产品的所有供应商
   */
  async getSuppliersByProduct(productId: string): Promise<any[]> {
    const response = await this.request<any>(`/business/suppliers/product/${productId}/suppliers`);
    return response.data;
  }

  /**
   * 获取供应商的所有产品
   */
  async getProductsBySupplier(supplierId: string): Promise<any[]> {
    const response = await this.request<any>(`/business/suppliers/${supplierId}/products`);
    return response.data;
  }

  // ==================== 耗材管理 API ====================

  async getConsumables(params?: {
    keyword?: string;
    category?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.keyword) q.append('keyword', params.keyword);
    if (params?.category) q.append('category', params.category);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    const response = await this.request<any>(
      `/business/consumables?${q.toString()}`,
    );
    return response.data;
  }

  async getConsumable(id: string): Promise<any> {
    const response = await this.request<any>(
      `/business/consumables/${id}`,
    );
    return response.data;
  }

  async createConsumable(data: any): Promise<any> {
    const response = await this.request<any>(
      '/business/consumables',
      { method: 'POST', body: JSON.stringify(data) },
    );
    return response.data;
  }

  async updateConsumable(
    id: string, data: any,
  ): Promise<any> {
    const response = await this.request<any>(
      `/business/consumables/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    return response.data;
  }

  async deleteConsumable(id: string): Promise<void> {
    await this.request(
      `/business/consumables/${id}`,
      { method: 'DELETE' },
    );
  }

  async reorderConsumables(ids: string[]): Promise<void> {
    await this.request(
      '/business/consumables/reorder',
      { method: 'PUT', body: JSON.stringify({ ids }) },
    );
  }

  async getConsumablePrices(id: string): Promise<any[]> {
    const response = await this.request<any>(
      `/business/consumables/${id}/prices`,
    );
    return response.data;
  }

  async createConsumablePrice(
    id: string, data: any,
  ): Promise<any> {
    const response = await this.request<any>(
      `/business/consumables/${id}/prices`,
      { method: 'POST', body: JSON.stringify(data) },
    );
    return response.data;
  }

  async updateConsumablePrice(
    id: string, priceId: string, data: any,
  ): Promise<any> {
    const response = await this.request<any>(
      `/business/consumables/${id}/prices/${priceId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    return response.data;
  }

  async setConsumablePriceCurrent(
    id: string, priceId: string,
  ): Promise<any> {
    const response = await this.request<any>(
      `/business/consumables/${id}/prices/${priceId}/set-current`,
      { method: 'PATCH' },
    );
    return response.data;
  }

  async deleteConsumablePrice(
    id: string, priceId: string,
  ): Promise<void> {
    await this.request(
      `/business/consumables/${id}/prices/${priceId}`,
      { method: 'DELETE' },
    );
  }

  // ==================== 耗材供应商 API ====================

  async getConsumableSuppliers(params?: {
    keyword?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.keyword) q.append('keyword', params.keyword);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    const response = await this.request<any>(
      `/business/consumable-suppliers?${q.toString()}`,
    );
    return response.data;
  }

  async getConsumableSuppliersForSelect(): Promise<any[]> {
    const response = await this.request<any>(
      '/business/consumable-suppliers/select',
    );
    return response.data;
  }

  async createConsumableSupplier(data: any): Promise<any> {
    const response = await this.request<any>(
      '/business/consumable-suppliers',
      { method: 'POST', body: JSON.stringify(data) },
    );
    return response.data;
  }

  async updateConsumableSupplier(
    id: string, data: any,
  ): Promise<any> {
    const response = await this.request<any>(
      `/business/consumable-suppliers/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    return response.data;
  }

  async deleteConsumableSupplier(
    id: string,
  ): Promise<void> {
    await this.request(
      `/business/consumable-suppliers/${id}`,
      { method: 'DELETE' },
    );
  }

  async reorderConsumableSuppliers(ids: string[]): Promise<void> {
    await this.request(
      '/business/consumable-suppliers/reorder',
      { method: 'PUT', body: JSON.stringify({ ids }) },
    );
  }

  // ==================== 简化上传 API ====================

  /**
   * 单文件上传（简化版，返回URL）
   * 用于平台Logo等单图上传场景
   */
  async uploadSingleFile(
    file: File,
    folderId?: string,
    onProgress?: (progress: number) => void,
    realFolderId?: string,
    storageMode?: 'rustfs' | 'local',
  ): Promise<{ fileId: string; url: string; originalName: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    if (folderId) params.append('folderId', folderId);
    if (realFolderId) params.append('realFolderId', realFolderId);
    if (storageMode) params.append('storageMode', storageMode);
    params.append('compress', 'true');
    params.append('generateThumbnail', 'false');

    const queryString = params.toString();
    const url = `${API_BASE_URL}/upload/file${queryString ? `?${queryString}` : ''}`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          const fileData = response.data;
          resolve({
            fileId: fileData.fileId || fileData.id,
            url: fileData.url,
            originalName: fileData.originalName,
          });
        } else {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || '上传失败'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'));
      });

      xhr.open('POST', url);
      if (this.accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      }
      xhr.send(formData);
    });
  }

  /**
   * 获取文件详情（用于获取文件URL）
   */
  async getFileById(fileId: string): Promise<{ id: string; url: string; path: string; originalName: string }> {
    const response = await this.request<any>(`/files/${fileId}`);
    return normalizeFile(response.data);
  }

  // ==================== 平台配置 API ====================

  /**
   * 获取平台Logo配置
   */
  async getPlatformLogoConfig(): Promise<{
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    realFolderId: string | null;
  }> {
    const response = await this.request<any>('/config/platform/logo');
    return response.data;
  }

  /**
   * 保存平台Logo配置
   */
  async savePlatformLogoConfig(data: {
    maxWidth?: number;
    maxHeight?: number;
    maxSize?: number;
    formats?: string[];
    realFolderId?: string | null;
  }): Promise<void> {
    await this.request('/config/platform/logo', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取产品图片配置
   */
  async getProductImageConfig(): Promise<{
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    realFolderId: string | null;
  }> {
    const response = await this.request<any>('/config/product/image');
    return response.data;
  }

  /**
   * 保存产品图片配置
   */
  async saveProductImageConfig(data: {
    maxWidth?: number;
    maxHeight?: number;
    maxSize?: number;
    formats?: string[];
    realFolderId?: string | null;
  }): Promise<void> {
    await this.request('/config/product/image', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ==================== 工费管理 ====================

  async getLaborTypes(params?: Record<string, any>) {
    const query = params
        ? '?' + new URLSearchParams(
            Object.entries(params)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)]),
        ).toString()
        : '';
    const res = await this.request<any>(
        `/business/labor/types${query}`,
    );
    return res.data || res;
  }

  async createLaborType(data: Record<string, any>) {
    const res = await this.request<any>(
        '/business/labor/types',
        {
            method: 'POST',
            body: JSON.stringify(data),
        },
    );
    return res.data || res;
  }

  async updateLaborType(
      id: string, data: Record<string, any>,
  ) {
    const res = await this.request<any>(
        `/business/labor/types/${id}`,
        {
            method: 'PATCH',
            body: JSON.stringify(data),
        },
    );
    return res.data || res;
  }

  async deleteLaborType(id: string) {
    await this.request(`/business/labor/types/${id}`, {
        method: 'DELETE',
    });
  }

  async reorderLaborTypes(ids: string[]): Promise<void> {
    await this.request('/business/labor/types/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async getLaborRates(typeId: string) {
    const res = await this.request<any>(
        `/business/labor/types/${typeId}/rates`,
    );
    return res.data || res;
  }

  async createLaborRate(
      typeId: string, data: Record<string, any>,
  ) {
    const res = await this.request<any>(
        `/business/labor/types/${typeId}/rates`,
        {
            method: 'POST',
            body: JSON.stringify(data),
        },
    );
    return res.data || res;
  }

  async updateLaborRate(
      typeId: string, rateId: string, data: Record<string, any>,
  ) {
    const res = await this.request<any>(
        `/business/labor/types/${typeId}/rates/${rateId}`,
        {
            method: 'PATCH',
            body: JSON.stringify(data),
        },
    );
    return res.data || res;
  }

  async setLaborRateCurrent(
      typeId: string, rateId: string,
  ) {
    const res = await this.request<any>(
        `/business/labor/types/${typeId}/rates/${rateId}/set-current`,
        { method: 'PATCH' },
    );
    return res.data || res;
  }

  async deleteLaborRate(
      typeId: string, rateId: string,
  ) {
    await this.request(
        `/business/labor/types/${typeId}/rates/${rateId}`,
        { method: 'DELETE' },
    );
  }

  // ==================== 成品管理 ====================

  async getFinishedProducts(params?: {
    keyword?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.keyword) q.append('keyword', params.keyword);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    const res = await this.request<any>(
      `/business/finished-products?${q.toString()}`,
    );
    return res.data;
  }

  async getFinishedProduct(id: string): Promise<any> {
    const res = await this.request<any>(
      `/business/finished-products/${id}`,
    );
    return res.data;
  }

  async createFinishedProduct(data: any): Promise<any> {
    const res = await this.request<any>(
      '/business/finished-products',
      { method: 'POST', body: JSON.stringify(data) },
    );
    return res.data;
  }

  async updateFinishedProduct(
    id: string, data: any,
  ): Promise<any> {
    const res = await this.request<any>(
      `/business/finished-products/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    return res.data;
  }

  async deleteFinishedProduct(id: string): Promise<void> {
    await this.request(
      `/business/finished-products/${id}`,
      { method: 'DELETE' },
    );
  }

  async recalculateFinishedProductCost(
    id: string,
  ): Promise<any> {
    const res = await this.request<any>(
      `/business/finished-products/${id}/recalculate`,
      { method: 'POST' },
    );
    return res.data;
  }

  async reorderFinishedProducts(ids: string[]): Promise<void> {
    await this.request(
      '/business/finished-products/reorder',
      { method: 'PUT', body: JSON.stringify({ ids }) },
    );
  }

  // 辅助接口
  async getFPProductsForSelect(): Promise<any[]> {
    const res = await this.request<any>(
      '/business/finished-products/select/products',
    );
    return res.data;
  }

  async getFPSupplierProducts(
    productId: string,
  ): Promise<any[]> {
    const res = await this.request<any>(
      `/business/finished-products/select/supplier-products/${productId}`,
    );
    return res.data;
  }

  async getFPConsumablesForSelect(): Promise<any[]> {
    const res = await this.request<any>(
      '/business/finished-products/select/consumables',
    );
    return res.data;
  }

  async getFPLaborTypesForSelect(): Promise<any[]> {
    const res = await this.request<any>(
      '/business/finished-products/select/labor-types',
    );
    return res.data;
  }

  // ==================== 链接管理 ====================

  async getProductLinks(params?: {
    keyword?: string;
    shopId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.keyword)
      q.append('keyword', params.keyword);
    if (params?.shopId)
      q.append('shopId', params.shopId);
    if (params?.status)
      q.append('status', params.status);
    if (params?.page)
      q.append('page', String(params.page));
    if (params?.pageSize)
      q.append('pageSize', String(params.pageSize));
    const res = await this.request<any>(
      `/business/product-links?${q.toString()}`,
    );
    return res.data;
  }

  async getProductLink(id: string): Promise<any> {
    const res = await this.request<any>(
      `/business/product-links/${id}`,
    );
    return res.data;
  }

  async createProductLink(data: any): Promise<any> {
    const res = await this.request<any>(
      '/business/product-links',
      { method: 'POST', body: JSON.stringify(data) },
    );
    return res.data;
  }

  async updateProductLink(
    id: string, data: any,
  ): Promise<any> {
    const res = await this.request<any>(
      `/business/product-links/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    return res.data;
  }

  async deleteProductLink(
    id: string,
  ): Promise<void> {
    await this.request(
      `/business/product-links/${id}`,
      { method: 'DELETE' },
    );
  }

  async getPLShopsForSelect(): Promise<any[]> {
    const res = await this.request<any>(
      '/business/product-links/select/shops',
    );
    return res.data;
  }

  // ==================== 达人管理 API ====================

  async getTalents(params?: {
    keyword?: string; status?: string;
    level?: string; flagColor?: string;
    managerId?: string; platform?: string;
    page?: number; pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.keyword) q.append('keyword', params.keyword);
    if (params?.status) q.append('status', params.status);
    if (params?.level) q.append('level', params.level);
    if (params?.flagColor) q.append('flagColor', params.flagColor);
    if (params?.managerId) q.append('managerId', params.managerId);
    if (params?.platform) q.append('platform', params.platform);
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    const r = await this.request<any>(`/business/talents?${q.toString()}`);
    return r.data;
  }

  async getTalent(id: string): Promise<any> {
    const r = await this.request<any>(`/business/talents/${id}`);
    return r.data;
  }

  async createTalent(data: any): Promise<any> {
    const r = await this.request<any>('/business/talents', {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data;
  }

  async updateTalent(id: string, data: any): Promise<any> {
    const r = await this.request<any>(`/business/talents/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
    return r.data;
  }

  async deleteTalent(id: string): Promise<void> {
    await this.request(`/business/talents/${id}`, { method: 'DELETE' });
  }

  async getTalentsForSelect(): Promise<any[]> {
    const r = await this.request<any>('/business/talents/select/list');
    return r.data;
  }

  async createTalentPlatform(talentId: string, data: any): Promise<any> {
    const r = await this.request<any>(`/business/talents/${talentId}/platforms`, {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data;
  }

  async updateTalentPlatform(id: string, data: any): Promise<any> {
    const r = await this.request<any>(`/business/talents/platforms/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
    return r.data;
  }

  async deleteTalentPlatform(id: string): Promise<void> {
    await this.request(`/business/talents/platforms/${id}`, { method: 'DELETE' });
  }

  async getTalentContactLogs(talentId: string, params?: {
    page?: number; pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    const r = await this.request<any>(
      `/business/talents/${talentId}/contact-logs?${q.toString()}`,
    );
    return r.data;
  }

  async createTalentContactLog(talentId: string, data: { content: string }): Promise<any> {
    const r = await this.request<any>(`/business/talents/${talentId}/contact-logs`, {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data;
  }

  async transferTalents(data: {
    talentIds: string[]; toUserId: string; remark?: string;
  }): Promise<void> {
    await this.request('/business/talents/transfer', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async setTalentFlag(talentId: string, data: { flagColor: string }): Promise<any> {
    const r = await this.request<any>(`/business/talents/${talentId}/flag`, {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data;
  }

  async removeTalentFlag(talentId: string): Promise<void> {
    await this.request(`/business/talents/${talentId}/flag`, { method: 'DELETE' });
  }

  async getTalentFlagConfigs(): Promise<any[]> {
    const r = await this.request<any>('/business/talents/flag-configs');
    return r.data;
  }

  async saveTalentFlagConfigs(data: {
    configs: { flagColor: string; meaning: string }[];
  }): Promise<any[]> {
    const r = await this.request<any>('/business/talents/flag-configs', {
      method: 'PUT', body: JSON.stringify(data),
    });
    return r.data;
  }

  // ==================== 利润表 ====================

  async getAvailablePeriods(): Promise<{ year: number; months: number[] }[]> {
    const r = await this.request<{ year: number; months: number[] }[]>('/profit-reports/available-periods');
    return r.data;
  }

  async getProfitReports(params?: {
    year?: number; page?: number; pageSize?: number;
  }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.year) q.append('year', String(params.year));
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('pageSize', String(params.pageSize));
    const r = await this.request<any>(`/profit-reports?${q.toString()}`);
    return r.data;
  }

  async getProfitReport(id: string): Promise<any> {
    const r = await this.request<any>(`/profit-reports/${id}`);
    return r.data;
  }

  async createProfitReport(data: {
    year: number; month: number; remark?: string;
  }): Promise<any> {
    const r = await this.request<any>('/profit-reports', {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data;
  }

  async updateProfitReport(id: string, data: {
    remark?: string;
  }): Promise<any> {
    const r = await this.request<any>(`/profit-reports/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
    return r.data;
  }

  async deleteProfitReport(id: string): Promise<void> {
    await this.request(`/profit-reports/${id}`, { method: 'DELETE' });
  }

  async confirmProfitReport(id: string): Promise<any> {
    const r = await this.request<any>(`/profit-reports/${id}/confirm`, {
      method: 'POST',
    });
    return r.data;
  }

  async revokeProfitReport(id: string): Promise<any> {
    const r = await this.request<any>(`/profit-reports/${id}/revoke`, {
      method: 'POST',
    });
    return r.data;
  }

  async saveProfitEntries(id: string, data: {
    entries: any[];
  }): Promise<any> {
    const r = await this.request<any>(`/profit-reports/${id}/entries`, {
      method: 'PUT', body: JSON.stringify(data),
    });
    return r.data;
  }

  async saveProfitShippingCosts(
    reportId: string, entryId: string, data: { items: any[] },
  ): Promise<any> {
    const r = await this.request<any>(
      `/profit-reports/${reportId}/entries/${entryId}/shipping-costs`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    return r.data;
  }

  async saveProfitStoreExpenses(
    reportId: string, entryId: string, data: { items: any[] },
  ): Promise<any> {
    const r = await this.request<any>(
      `/profit-reports/${reportId}/entries/${entryId}/store-expenses`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    return r.data;
  }

  async saveProfitAllocationCategories(
    id: string, data: { categories: any[] },
  ): Promise<any> {
    const r = await this.request<any>(
      `/profit-reports/${id}/allocation-categories`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    return r.data;
  }

  async saveProfitAllocations(
    id: string, data: { items: any[] },
  ): Promise<any> {
    const r = await this.request<any>(
      `/profit-reports/${id}/allocations`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    return r.data;
  }

  async saveProfitCompanyExpenses(
    id: string, data: { items: any[] },
  ): Promise<any> {
    const r = await this.request<any>(
      `/profit-reports/${id}/company-expenses`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    return r.data;
  }

  async saveProfitNonExpenses(
    id: string, data: { items: any[] },
  ): Promise<any> {
    const r = await this.request<any>(
      `/profit-reports/${id}/non-expenses`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    return r.data;
  }

  async profitImportPreview(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const token =
        this.accessToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
    const response = await fetch(
        `${API_BASE_URL}/profit-reports/import/preview`,
        {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        },
    );
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || '预览解析失败');
    }
    return data.data;
  }

  async profitImportConfirm(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const token =
        this.accessToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
    const response = await fetch(
        `${API_BASE_URL}/profit-reports/import/confirm`,
        {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        },
    );
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || '导入失败');
    }
    return data.data;
  }

  async getProfitAnalysis(params: {
    year: number; month?: number; months?: string;
  }): Promise<any> {
    const q = new URLSearchParams();
    q.append('year', String(params.year));
    if (params.month) q.append('month', String(params.month));
    if (params.months) q.append('months', params.months);
    const r = await this.request<any>(
      `/profit-reports/analysis?${q.toString()}`,
    );
    return r.data;
  }

  async getMonthlyTrend(params: {
    year: number; compareYears?: string; shopId?: string;
  }): Promise<any> {
    const q = new URLSearchParams();
    q.append('year', String(params.year));
    if (params.compareYears) q.append('compareYears', params.compareYears);
    if (params.shopId) q.append('shopId', params.shopId);
    const r = await this.request<any>(
      `/profit-reports/analysis/monthly-trend?${q.toString()}`,
    );
    return r.data;
  }

  // ==================== 编号查重 API ====================

  async numberCheckDedup(codes: string[]): Promise<any> {
    const r = await this.request<any>('/number-check/dedup', {
      method: 'POST',
      body: JSON.stringify({ codes }),
    });
    return r.data;
  }

  async numberCheckImportPreview(file: File): Promise<any> {
    const url = `${API_BASE_URL}/number-check/import/preview`;
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '导入预览失败');
    return data.data;
  }

  async numberCheckImportCodes(dto: {
    fileId: string;
    sheet: string;
    columnIndex: number;
    hasHeader: boolean;
  }): Promise<any> {
    const r = await this.request<any>('/number-check/import/codes', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async numberCheckCreateBatch(dto: any): Promise<any> {
    const r = await this.request<any>('/number-check/batches', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async numberCheckListRecords(
    filter: Record<string, any>,
  ): Promise<{ data: any[]; meta: any }> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    }
    const r = (await this.request<any>(
      `/number-check/records?${q.toString()}`,
    )) as any;
    return {
      data: r.data || [],
      meta: r.meta || { total: 0, page: 1, limit: 20, totalPages: 0 },
    };
  }

  async numberCheckGetRecord(id: string): Promise<any> {
    const r = await this.request<any>(`/number-check/records/${id}`);
    return r.data;
  }

  async numberCheckUpdateRecord(
    id: string,
    dto: { remark?: string; isSettled?: boolean; status?: 'ACTIVE' | 'VOID' },
  ): Promise<any> {
    const r = await this.request<any>(`/number-check/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async numberCheckExportDuplicates(
    codes: string[],
  ): Promise<{ blob: Blob; filename: string }> {
    const url = `${API_BASE_URL}/number-check/export-duplicates`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ codes }),
    });
    if (!res.ok) {
      const t = await res.text();
      let m = '导出失败';
      try {
        m = JSON.parse(t).message || m;
      } catch {
        /* ignore */
      }
      throw new Error(m);
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const mm =
      cd.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ??
      cd.match(/filename=["']?([^"'\s;]+)["']?/i);
    return {
      blob,
      filename: mm ? decodeURIComponent(mm[1].trim()) : 'duplicates.xlsx',
    };
  }

  async numberCheckDownloadBatchFile(
    batchNo: string,
  ): Promise<{ blob: Blob; filename: string }> {
    const { blob, headers } = await this.getBlob(
      `/number-check/batches/${batchNo}/file`,
    );
    const cd = headers.get('content-disposition') || '';
    const mm =
      cd.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ??
      cd.match(/filename=["']?([^"'\s;]+)["']?/i);
    return { blob, filename: mm ? decodeURIComponent(mm[1].trim()) : 'file' };
  }

  async numberCheckGetStats(): Promise<any> {
    const r = await this.request<any>('/number-check/stats');
    return r.data;
  }

  async numberCheckGetConfig(): Promise<any> {
    const r = await this.request<any>('/number-check/config');
    return r.data;
  }

  async numberCheckUpdateConfig(dto: {
    maxSize?: number;
    realFolderId?: string;
    storageMode?: 'local' | 'rustfs';
  }): Promise<any> {
    const r = await this.request<any>('/number-check/config', {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async paymentList(filter: Record<string, any>): Promise<{ data: any[]; meta: any }> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    }
    const r = (await this.request<any>(`/business/payments?${q.toString()}`)) as any;
    return {
      data: r.data || [],
      meta: r.meta || { total: 0, page: 1, limit: 20, totalPages: 0 },
    };
  }

  async paymentDetail(id: string): Promise<any> {
    const r = await this.request<any>(`/business/payments/${id}`);
    return r.data;
  }

  async paymentCreate(dto: any): Promise<any> {
    const r = await this.request<any>('/business/payments', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async paymentUpdate(id: string, dto: any): Promise<any> {
    const r = await this.request<any>(`/business/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async paymentDelete(id: string): Promise<void> {
    await this.request<void>(`/business/payments/${id}`, { method: 'DELETE' });
  }

  async paymentSummary(filter: Record<string, any>): Promise<any> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    }
    const r = await this.request<any>(`/business/payments/summary?${q.toString()}`);
    return r.data;
  }

  async paymentExport(filter: Record<string, any>): Promise<{ blob: Blob; filename: string }> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    }
    const { blob, headers } = await this.getBlob(
      `/business/payments/export?${q.toString()}`,
    );
    const cd = headers.get('content-disposition') || '';
    const mm =
      cd.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ??
      cd.match(/filename=["']?([^"'\s;]+)["']?/i);
    return { blob, filename: mm ? decodeURIComponent(mm[1].trim()) : 'payments.xlsx' };
  }

  // ==================== 进货入库记录 ====================

  async purchaseReceiptList(
    filter: Record<string, any>,
  ): Promise<{ data: any[]; meta: any }> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    }
    const r = (await this.request<any>(
      `/business/purchase-receipts?${q.toString()}`,
    )) as any;
    return {
      data: r.data || [],
      meta: r.meta || { total: 0, page: 1, limit: 20, totalPages: 0 },
    };
  }

  async purchaseReceiptDetail(id: string): Promise<any> {
    const r = await this.request<any>(`/business/purchase-receipts/${id}`);
    return r.data;
  }

  async purchaseReceiptCreate(dto: any): Promise<any> {
    const r = await this.request<any>('/business/purchase-receipts', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async purchaseReceiptUpdate(id: string, dto: any): Promise<any> {
    const r = await this.request<any>(`/business/purchase-receipts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    return r.data;
  }

  async purchaseReceiptDelete(id: string): Promise<void> {
    await this.request<void>(`/business/purchase-receipts/${id}`, {
      method: 'DELETE',
    });
  }

  /** 导出入库记录（previewBaseUrl 由调用方传 getApiBaseUrl()，保证照片链接可用） */
  async purchaseReceiptExport(
    filter: Record<string, any>,
  ): Promise<{ blob: Blob; filename: string }> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    }
    const { blob, headers } = await this.getBlob(
      `/business/purchase-receipts/export?${q.toString()}`,
    );
    const cd = headers.get('content-disposition') || '';
    const mm =
      cd.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ??
      cd.match(/filename=["']?([^"'\s;]+)["']?/i);
    return {
      blob,
      filename: mm ? decodeURIComponent(mm[1].trim()) : 'purchase-receipts.xlsx',
    };
  }

  /** 付款记录「关联入库单」候选（已结清的不返回） */
  async purchaseReceiptForPayment(params: {
    supplierType: 'SUPPLIER' | 'CONSUMABLE_SUPPLIER';
    supplierId: string;
    keyword?: string;
    limit?: number;
  }): Promise<any[]> {
    const q = new URLSearchParams();
    q.append('supplierType', params.supplierType);
    q.append('supplierId', params.supplierId);
    if (params.keyword) q.append('keyword', params.keyword);
    if (params.limit) q.append('limit', String(params.limit));
    const r = await this.request<any>(
      `/business/purchase-receipts/for-payment?${q.toString()}`,
    );
    return r.data || [];
  }

  async purchaseReceiptNextBillNo(): Promise<{ billNo: string }> {
    const r = await this.request<any>(
      '/business/purchase-receipts/next-bill-no',
    );
    return r.data || { billNo: '' };
  }

  /**
   * AI 识别发货单票据号（可选增强）
   * available=false 表示未配置可用模型/Key，调用方应静默跳过识别。
   */
  async purchaseReceiptRecognizeBill(fileId: string): Promise<{
    available: boolean;
    billNo: string | null;
    raw?: string;
    reason?: string;
    model?: string;
  }> {
    const r = await this.request<any>(
      '/business/purchase-receipts/recognize-bill',
      { method: 'POST', body: JSON.stringify({ fileId }) },
    );
    return r.data || { available: false, billNo: null };
  }

  async purchaseReceiptCheckBillNo(dto: {
    billNo: string;
    supplierId?: string;
    consumableSupplierId?: string;
    excludeId?: string;
  }): Promise<{ exists: boolean; records: any[] }> {
    const r = await this.request<any>(
      '/business/purchase-receipts/check-bill-no',
      { method: 'POST', body: JSON.stringify(dto) },
    );
    return r.data || { exists: false, records: [] };
  }
}

export const apiClient = new ApiClient();

// ==================== 公开分享 API（无需登录） ====================

const PUBLIC_API_BASE = getApiBaseUrl();

export interface ShareInfoPublic {
    fileName: string;
    fileSize: number;
    mimeType: string;
    hasPassword: boolean;
    access: string;
    expireAt: string | null;
    expired: boolean;
}

export interface AccessShareResult {
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    access: string;
    thumbnailUrl?: string;
}

export async function getShareInfo(
    code: string,
): Promise<ShareInfoPublic> {
    const res = await fetch(
        `${PUBLIC_API_BASE}/shares/${code}/info`,
    );
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json.message || '获取分享信息失败');
    }
    return json.data;
}

export async function accessShare(
    code: string,
    password?: string,
): Promise<AccessShareResult> {
    const res = await fetch(
        `${PUBLIC_API_BASE}/shares/${code}/access`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        },
    );
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json.message || '访问分享失败');
    }
    return json.data;
}

/**
 * 获取分享文件代理 URL（通过后端代理访问文件）
 */
export function getShareFileUrl(code: string): string {
    return `${PUBLIC_API_BASE}/shares/${code}/file`;
}

// ============================================
// 记事本相关
// ============================================

export interface Notebook {
    id: string;
    title: string;
    content: any;
    userId: string;
    user?: {
        id: string;
        name: string;
        username: string;
    };
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}

export interface NotebookListResponse {
    list: Notebook[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

class NotebookAPI {
    async getNotebooks(params?: {
        page?: number;
        pageSize?: number;
        keyword?: string;
        userId?: string;
    }): Promise<NotebookListResponse> {
        return apiClient.get('/notebooks', { params });
    }

    async getNotebook(id: string): Promise<Notebook> {
        return apiClient.get(`/notebooks/${id}`);
    }

    async createNotebook(data: {
        title: string;
        content: any;
    }): Promise<Notebook> {
        const res = await apiClient.post('/notebooks', data);
        return res.data;
    }

    async updateNotebook(
        id: string,
        data: { title?: string; content?: any },
    ): Promise<Notebook> {
        const res = await apiClient.patch(`/notebooks/${id}`, data);
        return res.data;
    }

    async deleteNotebook(id: string): Promise<void> {
        return apiClient.delete(`/notebooks/${id}`);
    }
}

// 导出记事本 API 实例
export const notebookAPI = new NotebookAPI();

// ========== 系统升级 API ==========

class UpgradeAPI {
    async getCurrentVersion(): Promise<any> {
        return apiClient.get('/upgrade/version');
    }

    async checkForUpdate(): Promise<any> {
        return apiClient.get('/upgrade/check');
    }

    async executeUpgrade(targetVersion: string): Promise<any> {
        const res = await apiClient.post('/upgrade/execute', { targetVersion });
        return (res as any).data !== undefined ? (res as any).data : res;
    }

    async getUpgradeProgress(upgradeId?: string): Promise<any> {
        const params: any = {};
        if (upgradeId) params.upgradeId = upgradeId;
        return apiClient.get('/upgrade/progress', { params });
    }

    async getUpgradeLogs(page: number = 1, pageSize: number = 20): Promise<any> {
        return apiClient.get('/upgrade/logs', { params: { page, pageSize } });
    }

    async getConfig(): Promise<any> {
        return apiClient.get('/upgrade/config');
    }

    async saveConfig(config: any): Promise<any> {
        const res = await apiClient.put('/upgrade/config', config);
        return (res as any).data !== undefined ? (res as any).data : res;
    }

    async getConfigStatus(): Promise<any> {
        return apiClient.get('/upgrade/config/status');
    }

    async testPortainerConnection(): Promise<any> {
        const res = await apiClient.post('/upgrade/portainer/test');
        return (res as any).data !== undefined ? (res as any).data : res;
    }

    async getServicesHealth(): Promise<any> {
        return apiClient.get('/upgrade/health/services');
    }
}

// ========== 备份管理 API ==========
class BackupAPI {
    async getConfig(): Promise<any> {
        return apiClient.get('/backup/config');
    }

    async saveConfig(config: any): Promise<any> {
        return apiClient.put('/backup/config', config);
    }

    async createBackup(data: { backupType?: string; storageType?: string }): Promise<any> {
        return apiClient.post('/backup/create', data);
    }

    async getLogs(page: number = 1, pageSize: number = 10, status?: string, triggerType?: string): Promise<any> {
        const params: any = { page, pageSize };
        if (status) params.status = status;
        if (triggerType) params.triggerType = triggerType;
        return apiClient.get('/backup/logs', { params });
    }

    async getStats(): Promise<any> {
        return apiClient.get('/backup/stats');
    }

    async deleteBackup(id: string): Promise<any> {
        return apiClient.delete(`/backup/${id}`);
    }

    async downloadBackup(id: string): Promise<{ blob: Blob; filename: string }> {
        const { blob, headers } = await apiClient.getBlob(`/backup/${id}/download`);
        const cd = headers.get('content-disposition');
        const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ?? cd?.match(/filename=["']?([^"'\s;]+)["']?/i);
        const filename = m ? decodeURIComponent(m[1].trim()) : `backup-${id}.sql`;
        return { blob, filename };
    }

    async restoreBackup(id: string, data: { confirm: boolean; contentTypes?: string; contentTypesStr?: string; createAutoBackup?: boolean; restoreType?: string }): Promise<any> {
        return apiClient.post(`/backup/${id}/restore`, data);
    }

    async getRestoreLogs(page: number = 1, pageSize: number = 10, backupId?: string): Promise<any> {
        const params: any = { page, pageSize };
        if (backupId) params.backupId = backupId;
        return apiClient.get('/backup/restore/logs', { params });
    }
}

export const upgradeAPI = new UpgradeAPI();
export const backupAPI = new BackupAPI();
