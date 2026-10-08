/**
 * 上传相关类型定义
 */

export enum UploadStatus {
  WAITING = 'waiting',
  UPLOADING = 'uploading',
  SUCCESS = 'success',
  ERROR = 'error',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
}

export enum FileCategory {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  ARCHIVE = 'ARCHIVE',
  CODE = 'CODE',
  OTHER = 'OTHER',
}

export enum StorageType {
  RUSTFS = 'RUSTFS',
  LOCAL = 'LOCAL',
  S3 = 'S3',
}

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
  speed?: number;
  remainingTime?: number;
  thumbnail?: string;
  type: string;
  stepHint?: string;
  isInstant?: boolean;
  retryCount?: number;
  sessionId?: string;
  fileId?: string;
  url?: string;
}

export interface FileExistsResponse {
  exists: boolean;
  fileId?: string;
  url?: string;
  message: string;
}

export interface InitUploadResponse {
  sessionId: string;
  uploadId?: string;
  bucket?: string;
  key?: string;
  partSize: number;
  partCount: number;
  expiresAt: string;
  isInstant?: boolean;
  existingFileId?: string;
  existingFileUrl?: string;
}

export interface PresignedUrl {
  partNumber: number;
  url: string;
  directUrl: string;
  proxyUrl: string;
  expiresAt: string;
}

export interface PresignedUrlsResponse {
  sessionId: string;
  uploadId: string;
  presignedUrls: PresignedUrl[];
  smartMode: boolean;
}

export interface CompleteUploadResponse {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  message: string;
}

export interface UploadSessionResponse {
  sessionId: string;
  status: string;
  fileName: string;
  fileSize: string;
  partCount: number;
  uploadedParts: number;
  progress: number;
  expiresAt: string;
  createdAt: string;
}

export interface MediaFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  extension: string;
  fileSize: string;
  fileMd5?: string;
  storageType: StorageType;
  fileUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  category: FileCategory;
  folderId?: string;
  folderName?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMediaFiles {
  data: MediaFile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RealFolder {
  id: string;
  pathName: string;
  displayName: string;
  description?: string;
  sortOrder: number;
  isSystem: boolean;
  uploadLevel: string;
  downloadLevel: string;
  fileCount: number;
  totalSize: string;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated 已废弃，请使用 types/file.ts 中的 Folder 类型 */
export interface VirtualFolder {
  id: string;
  name: string;
  parentId?: string;
  realFolderId: string;
  realFolderPath: string;
  icon?: string;
  sortOrder: number;
  fileCount: number;
  totalSize: string;
  children: VirtualFolder[];
  createdAt: string;
  updatedAt: string;
}
