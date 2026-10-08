/**
 * 上传工具函数统一导出
 * @module lib/utils/upload
 */

// 文件大小格式化
export {
  formatFileSize,
  formatSpeed,
  formatRemainingTime,
  parseFileSize,
} from './formatFileSize';

// 文件扩展名工具
export {
  getFileExtension,
  getExtensionFromMimeType,
  getMimeTypeFromExtension,
  getFileNameWithoutExtension,
} from './getFileExtension';

// 文件图标工具
export {
  getFileCategory,
  getFileIconInfo,
  getFileIcon,
  getFileIconColor,
  getFileTypeEmoji,
  getFileTypeName,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isMediaFile,
  isPreviewable,
  type FileCategory,
  type FileIconInfo,
} from './getFileIcon';

// 文件验证工具
export {
  validateFile,
  validateFiles,
  filterValidFiles,
  validateFilesBatch,
  canAddMoreFiles,
  getRemainingFileCount,
  isDangerousExtension,
  isImageFile as isImageFileFromFile,
  isVideoFile as isVideoFileFromFile,
  isAudioFile as isAudioFileFromFile,
  isMediaFile as isMediaFileFromFile,
  DANGEROUS_EXTENSIONS,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MIN_FILE_SIZE,
  FILE_TYPE_CONFIGS,
  type FileValidationResult,
  type FileValidationErrorCode,
  type FileValidationConfig,
  type BatchValidationConfig,
  type BatchValidationResult,
} from './validateFile';

// 认证工具
export {
  getAccessToken,
  getRefreshToken,
  getAuthHeaders,
  getUploadHeaders,
  isAuthenticated,
  isTokenExpired,
  isAccessTokenExpired,
  getCurrentUserId,
  getCurrentUsername,
  authenticatedFetch,
  setAuthXHR,
  generateUploadId,
  generateFileId,
} from './authUtils';

/**
 * 上传相关常量
 */
export const UPLOAD_CONSTANTS = {
  /** 默认分片大小：5MB */
  DEFAULT_CHUNK_SIZE: 5 * 1024 * 1024,
  /** 小文件阈值：10MB（小于此大小不分片） */
  SMALL_FILE_THRESHOLD: 10 * 1024 * 1024,
  /** 最大并发上传数 */
  MAX_CONCURRENT_UPLOADS: 3,
  /** 最大重试次数 */
  MAX_RETRY_COUNT: 3,
  /** 重试延迟（毫秒） */
  RETRY_DELAY: 1000,
  /** 会话过期时间（小时） */
  SESSION_EXPIRE_HOURS: 24,
} as const;

/**
 * 上传状态枚举
 */
export const UPLOAD_STATUS = {
  WAITING: 'waiting',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled',
} as const;

export type UploadStatus = typeof UPLOAD_STATUS[keyof typeof UPLOAD_STATUS];

/**
 * 上传阶段枚举
 */
export const UPLOAD_STAGE = {
  MD5: 'md5',
  CHECKING: 'checking',
  COMPRESSING: 'compressing',
  UPLOADING: 'uploading',
  MERGING: 'merging',
  COMPLETED: 'completed',
} as const;

export type UploadStage = typeof UPLOAD_STAGE[keyof typeof UPLOAD_STAGE];

/**
 * 上传阶段提示文字
 */
export const UPLOAD_STAGE_HINTS: Record<UploadStage, string> = {
  [UPLOAD_STAGE.MD5]: '计算文件指纹...',
  [UPLOAD_STAGE.CHECKING]: '检查文件...',
  [UPLOAD_STAGE.COMPRESSING]: '压缩图片...',
  [UPLOAD_STAGE.UPLOADING]: '上传中...',
  [UPLOAD_STAGE.MERGING]: '合并文件...',
  [UPLOAD_STAGE.COMPLETED]: '上传完成',
};
