/**
 * 文件大小格式化工具
 * @module lib/utils/upload/formatFileSize
 */

/**
 * 格式化文件大小为人类可读格式
 * @param bytes - 文件大小（字节）
 * @param decimals - 小数位数，默认2
 * @returns 格式化后的字符串，如 "1.5 MB"
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536, 1) // "1.5 KB"
 * formatFileSize(0) // "0 B"
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);
  
  return parseFloat((bytes / Math.pow(k, index)).toFixed(decimals)) + ' ' + sizes[index];
}

/**
 * 格式化上传速度为人类可读格式
 * @param bytesPerSecond - 每秒字节数
 * @returns 格式化后的字符串，如 "1.5 MB/s"
 * @example
 * formatSpeed(1024) // "1 KB/s"
 * formatSpeed(0) // "0 B/s"
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0 || bytesPerSecond < 0) return '0 B/s';
  
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);
  
  return parseFloat((bytesPerSecond / Math.pow(k, index)).toFixed(2)) + ' ' + sizes[index];
}

/**
 * 格式化剩余时间为人类可读格式
 * @param seconds - 剩余秒数
 * @returns 格式化后的字符串，如 "5分钟"
 * @example
 * formatRemainingTime(30) // "30秒"
 * formatRemainingTime(120) // "2分钟"
 * formatRemainingTime(3700) // "1小时"
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '--';
  
  if (seconds < 60) {
    return `${Math.round(seconds)}秒`;
  }
  
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes}分钟`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  
  if (minutes === 0) {
    return `${hours}小时`;
  }
  
  return `${hours}小时${minutes}分钟`;
}

/**
 * 解析文件大小字符串为字节数
 * @param sizeStr - 文件大小字符串，如 "1.5 MB"
 * @returns 字节数
 * @example
 * parseFileSize("1 KB") // 1024
 * parseFileSize("1.5 MB") // 1572864
 */
export function parseFileSize(sizeStr: string): number {
  const units: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'PB': 1024 * 1024 * 1024 * 1024 * 1024,
  };
  
  const match = sizeStr.trim().toUpperCase().match(/^([\d.]+)\s*([A-Z]+)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return Math.round(value * (units[unit] || 1));
}
