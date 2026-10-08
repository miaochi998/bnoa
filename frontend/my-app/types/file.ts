export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  path: string;
  url?: string;
  thumbnailUrl?: string;
  folderId?: string;
  folderName?: string;
  md5?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RealFolder {
  id: string;
  pathName: string;
  displayName: string;
  description?: string;
  sortOrder: number;
  isSystem: boolean;
  fileCount: number;
  totalSize: number;
  folderCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  parentId?: string;
  realFolderId?: string;
  realFolder?: RealFolder;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
  fileCount?: number;
}

export interface FolderTreeNode extends Folder {
  children?: FolderTreeNode[];
  level?: number;
  expanded?: boolean;
}

export interface FileListResponse {
  items: FileItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export type FolderScope = 'personal' | 'sharedWithMe' | 'systemShared';

// 文件夹分类虚拟ID
export const FOLDER_SCOPE_IDS = {
  PERSONAL: '__scope_personal__',
  SHARED_WITH_ME: '__scope_shared_with_me__',
  SYSTEM_SHARED: '__scope_system_shared__',
} as const;

export interface FileFilter {
  keyword?: string;
  folderId?: string;
  folderScope?: FolderScope;
  mimeType?: string;
  extension?: string;
  storageMode?: 'rustfs' | 'local';
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  imageCount: number;
  documentCount: number;
  videoCount: number;
  otherCount: number;
}

export interface UploadSession {
  sessionId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface ShareLink {
  id: string;
  fileId: string;
  code: string;
  access: 'VIEW' | 'DOWNLOAD';
  password?: string;
  expireAt?: string;
  createdAt: string;
}

export interface CreateShareRequest {
  fileId: string;
  access: 'VIEW' | 'DOWNLOAD';
  password?: string;
  expireDays?: number;
}

// ==================== 文件夹共享相关类型 ====================

/**
 * 文件夹共享类型
 */
export type FolderShareType = 'NONE' | 'SYSTEM' | 'USER';

/**
 * 共享权限（从低到高）
 * VIEW < DOWNLOAD < UPLOAD < EDIT < DELETE
 */
export type SharePermission = 'VIEW' | 'DOWNLOAD' | 'UPLOAD' | 'EDIT' | 'DELETE';

/**
 * 带共享信息的文件夹
 */
export interface FolderWithShare extends Folder {
  shareType?: FolderShareType;
  permissions?: SharePermission[];
  isOwner?: boolean;
}

/**
 * 带共享信息的文件夹树节点
 */
export interface FolderTreeNodeWithShare extends FolderWithShare {
  children?: FolderTreeNodeWithShare[];
  level?: number;
  expanded?: boolean;
  creator?: {
    id: string;
    username: string;
    name: string;
  };
}

/**
 * 我的文件夹列表响应
 */
export interface MyFoldersResponse {
  personal: FolderTreeNodeWithShare[];
  sharedWithMe: FolderTreeNodeWithShare[];
  systemShared: FolderTreeNodeWithShare[];
}

/**
 * 共享给我的文件夹信息
 */
export interface SharedFolderInfo {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  fileCount: number;
  shareType: 'SYSTEM' | 'USER';
  sharedBy: {
    id: string;
    username: string;
    name: string;
  };
  permissions: SharePermission[];
  createdAt: string;
}

/**
 * 共享记录
 */
export interface FolderShareRecord {
  id: string;
  sharedWithUser?: {
    id: string;
    username: string;
    name: string;
  };
  sharedWithRole?: {
    id: string;
    name: string;
    code: string;
  };
  permissions: SharePermission[];
  createdAt: string;
}

/**
 * 共享文件夹请求
 */
export interface ShareFolderRequest {
  userIds?: string[];
  roleIds?: string[];
  permissions: SharePermission[];
}

/**
 * 更新共享权限请求
 */
export interface UpdateSharePermissionRequest {
  permissions: SharePermission[];
}

/**
 * 创建系统共享文件夹请求
 */
export interface CreateSystemSharedFolderRequest {
  name: string;
  description?: string;
  icon?: string;
  realFolderId: string;
  roleIds: string[];
  permissions: SharePermission[];
}

/**
 * 文件夹权限响应
 */
export interface FolderPermissionsResponse {
  permissions: SharePermission[];
  isOwner: boolean;
}
