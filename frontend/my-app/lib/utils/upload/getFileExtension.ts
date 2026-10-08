/**
 * 文件扩展名工具
 * @module lib/utils/upload/getFileExtension
 */

/**
 * 从文件名获取扩展名（不含点号）
 * @param fileName - 文件名
 * @returns 小写扩展名，如 "jpg"
 * @example
 * getFileExtension("photo.JPG") // "jpg"
 * getFileExtension("document.pdf") // "pdf"
 * getFileExtension("noextension") // ""
 */
export function getFileExtension(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') return '';
  
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return '';
  }
  
  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * 从MIME类型获取扩展名
 * @param mimeType - MIME类型
 * @returns 扩展名，如 "jpg"
 * @example
 * getExtensionFromMimeType("image/jpeg") // "jpg"
 * getExtensionFromMimeType("application/pdf") // "pdf"
 */
export function getExtensionFromMimeType(mimeType: string): string {
  if (!mimeType || typeof mimeType !== 'string') return '';
  
  const mimeToExt: Record<string, string> = {
    // 图片
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
    
    // 视频
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/x-flv': 'flv',
    'video/3gpp': '3gp',
    
    // 音频
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'weba',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/x-m4a': 'm4a',
    'audio/mp4': 'm4a',
    
    // 文档
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/json': 'json',
    'application/xml': 'xml',
    'text/markdown': 'md',
    
    // 压缩包
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/gzip': 'gz',
    'application/x-tar': 'tar',
  };
  
  return mimeToExt[mimeType.toLowerCase()] || '';
}

/**
 * 从扩展名获取MIME类型
 * @param extension - 文件扩展名（可带点号）
 * @returns MIME类型
 * @example
 * getMimeTypeFromExtension("jpg") // "image/jpeg"
 * getMimeTypeFromExtension(".pdf") // "application/pdf"
 */
export function getMimeTypeFromExtension(extension: string): string {
  if (!extension || typeof extension !== 'string') return 'application/octet-stream';
  
  const ext = extension.toLowerCase().replace(/^\./, '');
  
  const extToMime: Record<string, string> = {
    // 图片
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'ico': 'image/x-icon',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'avif': 'image/avif',
    
    // 视频
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogv': 'video/ogg',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'flv': 'video/x-flv',
    '3gp': 'video/3gpp',
    
    // 音频
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'weba': 'audio/webm',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    
    // 文档
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'md': 'text/markdown',
    
    // 压缩包
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'gz': 'application/gzip',
    'tar': 'application/x-tar',
  };
  
  return extToMime[ext] || 'application/octet-stream';
}

/**
 * 获取文件名（不含扩展名）
 * @param fileName - 完整文件名
 * @returns 不含扩展名的文件名
 * @example
 * getFileNameWithoutExtension("photo.jpg") // "photo"
 * getFileNameWithoutExtension("document") // "document"
 */
export function getFileNameWithoutExtension(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') return '';
  
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return fileName;
  }
  
  return fileName.slice(0, lastDotIndex);
}
