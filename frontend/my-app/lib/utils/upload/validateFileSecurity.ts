/**
 * 文件安全验证工具（参照7DL项目实现）
 * 在上传前进行前端预验证，提供友好的错误提示
 * @module lib/utils/upload/validateFileSecurity
 */

import { apiClient } from '@/lib/api';

/**
 * 危险文件扩展名黑名单（与后端保持一致）
 */
export const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif',
  'sh', 'bash', 'zsh', 'fish',
  'php', 'jsp', 'asp', 'aspx',
  'dll', 'so', 'dylib',
  'scr', 'vbs', 'ps1', 'jar',
  'msi', 'app', 'deb', 'rpm',
  'lnk', 'url',
  'docm', 'xlsm', 'pptm',
];

/**
 * 安全配置缓存
 */
let securityConfigCache: SecurityConfig | null = null;
let formatConfigCache: FormatConfig[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 60秒缓存

/**
 * 安全配置接口
 */
export interface SecurityConfig {
  enableFormatLimit: boolean;
  enableBlacklist: boolean;
  globalMaxFiles: number;
  dangerousExtensions: string[];
  enableVirusScan: boolean;
  scanTimeoutSeconds: number;
  autoQuarantine: boolean;
  minFreeSpaceBytes: number;
  enableSpaceCheck: boolean;
}

/**
 * 格式配置接口
 */
export interface FormatConfig {
  id: string;
  fileExtension: string;
  displayName: string;
  mimeTypes: string[];
  maxSize: number;
  minSize: number;
  category: string;
  isEnabled: boolean;
}

/**
 * 文件验证结果接口
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  formatConfig?: FormatConfig;
}

/**
 * 获取安全配置（带缓存）
 */
export async function getSecurityConfig(): Promise<SecurityConfig> {
  const now = Date.now();
  if (securityConfigCache && now < cacheExpiry) {
    return securityConfigCache;
  }

  try {
    const config = await apiClient.getUploadSecurityConfig();
    securityConfigCache = config;
    cacheExpiry = now + CACHE_TTL;
    return config;
  } catch (error) {
    console.error('获取安全配置失败:', error);
    // 返回默认配置
    return {
      enableFormatLimit: true,
      enableBlacklist: true,
      globalMaxFiles: 100,
      dangerousExtensions: DANGEROUS_EXTENSIONS,
      enableVirusScan: true,
      scanTimeoutSeconds: 300,
      autoQuarantine: true,
      minFreeSpaceBytes: 1073741824,
      enableSpaceCheck: true,
    };
  }
}

/**
 * 获取格式配置列表（带缓存）
 */
export async function getFormatConfigs(): Promise<FormatConfig[]> {
  const now = Date.now();
  if (formatConfigCache && now < cacheExpiry) {
    return formatConfigCache;
  }

  try {
    const response = await apiClient.getFileFormats();
    formatConfigCache = response.items.filter(f => f.isEnabled);
    cacheExpiry = now + CACHE_TTL;
    return formatConfigCache;
  } catch (error) {
    console.error('获取格式配置失败:', error);
    return [];
  }
}

/**
 * 清除配置缓存
 */
export function clearConfigCache(): void {
  securityConfigCache = null;
  formatConfigCache = null;
  cacheExpiry = 0;
}

/**
 * 格式化文件大小
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 验证单个文件的安全性
 * @param file 要验证的文件
 * @returns 验证结果
 */
export async function validateFileSecurity(file: File): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 获取配置
  const [securityConfig, formatConfigs] = await Promise.all([
    getSecurityConfig(),
    getFormatConfigs(),
  ]);

  // 1. 获取文件扩展名
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // 2. 检查危险扩展名（仅当启用黑名单时）
  const dangerousExts = securityConfig.dangerousExtensions || DANGEROUS_EXTENSIONS;
  if (securityConfig.enableBlacklist && dangerousExts.includes(extension)) {
    errors.push(`不允许上传 ${extension.toUpperCase()} 格式的文件（安全限制）`);
    return { isValid: false, errors, warnings };
  }

  // 3. 检查格式白名单（仅当白名单开启时）
  let formatConfig: FormatConfig | undefined;
  if (securityConfig.enableFormatLimit) {
    formatConfig = formatConfigs.find(f => f.fileExtension.toLowerCase() === extension);
    if (!formatConfig) {
      errors.push(`不支持的文件格式: ${extension.toUpperCase()}`);
      return { isValid: false, errors, warnings, formatConfig };
    }
  }

  // 4. 检查文件大小
  // 4.1 硬编码极限：20GB（始终检查，无论任何开关状态）
  const ABSOLUTE_MAX_SIZE = 21474836480; // 20GB
  if (file.size > ABSOLUTE_MAX_SIZE) {
    errors.push(`文件超过系统极限大小 (${formatBytes(ABSOLUTE_MAX_SIZE)})`);
    return { isValid: false, errors, warnings, formatConfig };
  }

  // 4.2 检查格式特定的大小限制（仅当白名单开启时才检查）
  // 🔑 规则：关闭白名单后，除了危险格式黑名单外，只有20GB极限限制，没有格式特定的大小限制
  if (securityConfig.enableFormatLimit && formatConfig && file.size > formatConfig.maxSize) {
    errors.push(`${extension.toUpperCase()} 文件不能超过 ${formatBytes(formatConfig.maxSize)}`);
    return { isValid: false, errors, warnings, formatConfig };
  }

  // 5. 检查文件名是否包含特殊字符
  const dangerousChars = /[<>:"|?*\\]/;
  if (dangerousChars.test(fileName)) {
    warnings.push('文件名包含特殊字符，可能导致上传失败');
  }

  // 6. 检查MIME类型与扩展名是否匹配
  if (formatConfig && file.type && formatConfig.mimeTypes.length > 0) {
    const isTypeMatch = formatConfig.mimeTypes.some(mime => {
      if (mime.endsWith('/*')) {
        return file.type.startsWith(mime.replace('/*', ''));
      }
      return file.type === mime;
    });
    if (!isTypeMatch) {
      warnings.push(`文件类型不匹配：扩展名为 .${extension}，但MIME类型为 ${file.type}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    formatConfig,
  };
}

/**
 * 批量验证文件
 * @param files 要验证的文件列表
 * @returns 验证结果
 */
export async function validateFilesBatch(files: File[]): Promise<{
  valid: File[];
  invalid: Array<{ file: File; result: FileValidationResult }>;
  allResults: Map<string, FileValidationResult>;
}> {
  const valid: File[] = [];
  const invalid: Array<{ file: File; result: FileValidationResult }> = [];
  const allResults = new Map<string, FileValidationResult>();

  for (const file of files) {
    const result = await validateFileSecurity(file);
    allResults.set(file.name, result);
    
    if (result.isValid) {
      valid.push(file);
    } else {
      invalid.push({ file, result });
    }
  }

  return { valid, invalid, allResults };
}

/**
 * 检查扩展名是否危险
 * @param fileName 文件名
 * @returns 是否为危险扩展名
 */
export function isDangerousExtension(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return DANGEROUS_EXTENSIONS.includes(extension);
}
