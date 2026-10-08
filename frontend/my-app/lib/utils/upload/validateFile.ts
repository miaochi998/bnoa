/**
 * 文件验证工具
 * @module lib/utils/upload/validateFile
 */

/**
 * 文件验证结果
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: FileValidationErrorCode;
}

/**
 * 文件验证错误码
 */
export type FileValidationErrorCode = 
  | 'FILE_TOO_LARGE'
  | 'FILE_TOO_SMALL'
  | 'INVALID_TYPE'
  | 'DANGEROUS_EXTENSION'
  | 'EMPTY_FILE'
  | 'INVALID_NAME'
  | 'TOO_MANY_FILES'
  | 'TOTAL_SIZE_EXCEEDED';

/**
 * 文件验证配置
 */
export interface FileValidationConfig {
  /** 最大文件大小（字节） */
  maxSize?: number;
  /** 最小文件大小（字节） */
  minSize?: number;
  /** 允许的MIME类型列表 */
  allowedTypes?: string[];
  /** 允许的扩展名列表（不含点号） */
  allowedExtensions?: string[];
  /** 是否检查危险扩展名 */
  checkDangerousExtensions?: boolean;
}

/**
 * 批量文件验证配置（F030: 文件数量限制）
 */
export interface BatchValidationConfig extends FileValidationConfig {
  /** 最大文件数量 */
  maxFiles?: number;
  /** 最大总大小（字节） */
  maxTotalSize?: number;
  /** 当前已有文件数量（用于增量添加时的验证） */
  currentFileCount?: number;
  /** 当前已有文件总大小（用于增量添加时的验证） */
  currentTotalSize?: number;
}

/**
 * 批量验证结果
 */
export interface BatchValidationResult {
  /** 是否全部有效 */
  valid: boolean;
  /** 有效的文件列表 */
  validFiles: File[];
  /** 无效的文件及原因 */
  invalidFiles: Array<{ file: File; error: string; errorCode: FileValidationErrorCode }>;
  /** 批量级别的错误（如超出数量限制） */
  batchError?: string;
  /** 批量级别的错误码 */
  batchErrorCode?: FileValidationErrorCode;
  /** 统计信息 */
  stats: {
    totalFiles: number;
    validCount: number;
    invalidCount: number;
    totalSize: number;
    validSize: number;
  };
}

/**
 * 危险文件扩展名黑名单
 * 这些扩展名的文件可能包含恶意代码
 */
export const DANGEROUS_EXTENSIONS: string[] = [
  // 可执行文件
  'exe', 'bat', 'cmd', 'com', 'pif',
  // Shell脚本
  'sh', 'bash', 'zsh', 'fish',
  // 服务端脚本
  'php', 'jsp', 'asp', 'aspx',
  // 动态库
  'dll', 'so', 'dylib',
  // 其他危险格式
  'scr', 'vbs', 'ps1', 'jar',
  'msi', 'app', 'deb', 'rpm',
  // Windows快捷方式
  'lnk', 'url',
  // 宏文件
  'docm', 'xlsm', 'pptm',
];

/**
 * 默认最大文件大小：20GB
 */
export const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024 * 1024;

/**
 * 默认最小文件大小：1字节
 */
export const DEFAULT_MIN_FILE_SIZE = 1;

/**
 * 验证单个文件
 * @param file - 文件对象
 * @param config - 验证配置
 * @returns 验证结果
 */
export function validateFile(
  file: File,
  config: FileValidationConfig = {}
): FileValidationResult {
  const {
    maxSize = DEFAULT_MAX_FILE_SIZE,
    minSize = DEFAULT_MIN_FILE_SIZE,
    allowedTypes,
    allowedExtensions,
    checkDangerousExtensions = true,
  } = config;

  // 检查文件是否存在
  if (!file) {
    return {
      valid: false,
      error: '文件不存在',
      errorCode: 'EMPTY_FILE',
    };
  }

  // 检查文件名
  if (!file.name || file.name.trim() === '') {
    return {
      valid: false,
      error: '文件名无效',
      errorCode: 'INVALID_NAME',
    };
  }

  // 检查文件大小
  if (file.size === 0) {
    return {
      valid: false,
      error: '文件为空',
      errorCode: 'EMPTY_FILE',
    };
  }

  if (file.size < minSize) {
    return {
      valid: false,
      error: `文件大小不能小于 ${formatBytes(minSize)}`,
      errorCode: 'FILE_TOO_SMALL',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `文件大小不能超过 ${formatBytes(maxSize)}`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  // 获取文件扩展名
  const extension = getExtension(file.name);

  // 检查危险扩展名
  if (checkDangerousExtensions && isDangerousExtension(extension)) {
    return {
      valid: false,
      error: `不允许上传 .${extension} 格式的文件`,
      errorCode: 'DANGEROUS_EXTENSION',
    };
  }

  // 检查允许的扩展名
  if (allowedExtensions && allowedExtensions.length > 0) {
    const normalizedAllowed = allowedExtensions.map(ext => ext.toLowerCase().replace(/^\./, ''));
    if (!normalizedAllowed.includes(extension)) {
      return {
        valid: false,
        error: `只允许上传 ${normalizedAllowed.join(', ')} 格式的文件`,
        errorCode: 'INVALID_TYPE',
      };
    }
  }

  // 检查MIME类型
  if (allowedTypes && allowedTypes.length > 0) {
    const isTypeAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -1);
        return file.type.startsWith(prefix);
      }
      return file.type === type;
    });

    if (!isTypeAllowed) {
      return {
        valid: false,
        error: '不支持的文件类型',
        errorCode: 'INVALID_TYPE',
      };
    }
  }

  return { valid: true };
}

/**
 * 批量验证文件
 * @param files - 文件列表
 * @param config - 验证配置
 * @returns 验证结果映射（文件名 -> 结果）
 */
export function validateFiles(
  files: File[],
  config: FileValidationConfig = {}
): Map<string, FileValidationResult> {
  const results = new Map<string, FileValidationResult>();
  
  for (const file of files) {
    results.set(file.name, validateFile(file, config));
  }
  
  return results;
}

/**
 * 过滤有效文件
 * @param files - 文件列表
 * @param config - 验证配置
 * @returns 有效文件列表
 */
export function filterValidFiles(
  files: File[],
  config: FileValidationConfig = {}
): File[] {
  return files.filter(file => validateFile(file, config).valid);
}

/**
 * 批量验证文件（支持文件数量限制 F030）
 * @param files - 要添加的文件列表
 * @param config - 批量验证配置
 * @returns 批量验证结果
 */
export function validateFilesBatch(
  files: File[],
  config: BatchValidationConfig = {}
): BatchValidationResult {
  const {
    maxFiles,
    maxTotalSize,
    currentFileCount = 0,
    currentTotalSize = 0,
    ...fileConfig
  } = config;

  const result: BatchValidationResult = {
    valid: true,
    validFiles: [],
    invalidFiles: [],
    stats: {
      totalFiles: files.length,
      validCount: 0,
      invalidCount: 0,
      totalSize: 0,
      validSize: 0,
    },
  };

  // 计算总大小
  const newTotalSize = files.reduce((sum, f) => sum + f.size, 0);
  result.stats.totalSize = newTotalSize;

  // 检查文件数量限制
  if (maxFiles !== undefined) {
    const totalCount = currentFileCount + files.length;
    if (totalCount > maxFiles) {
      result.valid = false;
      result.batchError = `文件数量超出限制，最多允许 ${maxFiles} 个文件，当前已有 ${currentFileCount} 个，本次选择 ${files.length} 个`;
      result.batchErrorCode = 'TOO_MANY_FILES';
      
      // 只保留可以添加的文件数量
      const allowedCount = Math.max(0, maxFiles - currentFileCount);
      if (allowedCount === 0) {
        return result;
      }
      // 截取允许数量的文件继续验证
      files = files.slice(0, allowedCount);
    }
  }

  // 检查总大小限制
  if (maxTotalSize !== undefined) {
    const totalSize = currentTotalSize + newTotalSize;
    if (totalSize > maxTotalSize) {
      result.valid = false;
      result.batchError = `文件总大小超出限制，最大允许 ${formatBytes(maxTotalSize)}，当前已有 ${formatBytes(currentTotalSize)}，本次选择 ${formatBytes(newTotalSize)}`;
      result.batchErrorCode = 'TOTAL_SIZE_EXCEEDED';
    }
  }

  // 逐个验证文件
  let validSize = 0;
  for (const file of files) {
    const validation = validateFile(file, fileConfig);
    
    if (validation.valid) {
      // 检查添加此文件后是否超出总大小限制
      if (maxTotalSize !== undefined) {
        const newTotal = currentTotalSize + validSize + file.size;
        if (newTotal > maxTotalSize) {
          result.invalidFiles.push({
            file,
            error: `添加此文件后总大小将超出限制`,
            errorCode: 'TOTAL_SIZE_EXCEEDED',
          });
          result.stats.invalidCount++;
          continue;
        }
      }
      
      result.validFiles.push(file);
      result.stats.validCount++;
      validSize += file.size;
    } else {
      result.invalidFiles.push({
        file,
        error: validation.error || '验证失败',
        errorCode: validation.errorCode || 'INVALID_TYPE',
      });
      result.stats.invalidCount++;
    }
  }

  result.stats.validSize = validSize;
  
  // 如果有无效文件，整体结果为无效（但仍返回有效文件列表）
  if (result.invalidFiles.length > 0) {
    result.valid = false;
  }

  return result;
}

/**
 * 检查是否可以添加更多文件
 * @param currentCount - 当前文件数量
 * @param maxFiles - 最大文件数量
 * @returns 是否可以添加
 */
export function canAddMoreFiles(currentCount: number, maxFiles?: number): boolean {
  if (maxFiles === undefined) return true;
  return currentCount < maxFiles;
}

/**
 * 获取剩余可添加文件数量
 * @param currentCount - 当前文件数量
 * @param maxFiles - 最大文件数量
 * @returns 剩余可添加数量，undefined表示无限制
 */
export function getRemainingFileCount(currentCount: number, maxFiles?: number): number | undefined {
  if (maxFiles === undefined) return undefined;
  return Math.max(0, maxFiles - currentCount);
}

/**
 * 检查扩展名是否危险
 * @param extension - 文件扩展名（不含点号）
 * @returns 是否危险
 */
export function isDangerousExtension(extension: string): boolean {
  if (!extension) return false;
  return DANGEROUS_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * 检查文件是否为图片
 * @param file - 文件对象
 * @returns 是否为图片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 检查文件是否为视频
 * @param file - 文件对象
 * @returns 是否为视频
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * 检查文件是否为音频
 * @param file - 文件对象
 * @returns 是否为音频
 */
export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/');
}

/**
 * 检查文件是否为媒体文件
 * @param file - 文件对象
 * @returns 是否为媒体文件
 */
export function isMediaFile(file: File): boolean {
  return isImageFile(file) || isVideoFile(file) || isAudioFile(file);
}

/**
 * 获取文件扩展名（内部函数）
 */
function getExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return '';
  }
  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * 格式化字节数（内部函数）
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 常用文件类型配置
 */
export const FILE_TYPE_CONFIGS = {
  /** 图片文件 */
  images: {
    allowedTypes: ['image/*'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif', 'avif'],
  },
  /** 视频文件 */
  videos: {
    allowedTypes: ['video/*'],
    allowedExtensions: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', '3gp', 'ogv'],
  },
  /** 音频文件 */
  audios: {
    allowedTypes: ['audio/*'],
    allowedExtensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'weba'],
  },
  /** 文档文件 */
  documents: {
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
  },
  /** 压缩包 */
  archives: {
    allowedTypes: [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar',
    ],
    allowedExtensions: ['zip', 'rar', '7z', 'gz', 'tar'],
  },
  /** 所有媒体文件 */
  media: {
    allowedTypes: ['image/*', 'video/*', 'audio/*'],
    allowedExtensions: [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp',
      'mp4', 'webm', 'mov', 'avi', 'mkv',
      'mp3', 'wav', 'ogg', 'aac', 'flac',
    ],
  },
} as const;
