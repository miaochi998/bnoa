/**
 * 文件图标工具
 * @module lib/utils/upload/getFileIcon
 */

import { 
  FileText, 
  Image, 
  Film, 
  Music, 
  FileArchive, 
  FileCode, 
  File,
  FileSpreadsheet,
  Presentation,
  type LucideIcon 
} from 'lucide-react';

/**
 * 文件类型分类
 */
export type FileCategory = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'document' 
  | 'spreadsheet'
  | 'presentation'
  | 'archive' 
  | 'code' 
  | 'other';

/**
 * 文件图标信息
 */
export interface FileIconInfo {
  icon: LucideIcon;
  color: string;
  category: FileCategory;
}

/**
 * 根据MIME类型获取文件分类
 * @param mimeType - MIME类型
 * @returns 文件分类
 */
export function getFileCategory(mimeType: string): FileCategory {
  if (!mimeType) return 'other';
  
  const type = mimeType.toLowerCase();
  
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  
  if (type.includes('pdf') || 
      type.includes('word') || 
      type.includes('document') ||
      type === 'text/plain' ||
      type === 'text/markdown') {
    return 'document';
  }
  
  if (type.includes('excel') || type.includes('spreadsheet')) {
    return 'spreadsheet';
  }
  
  if (type.includes('powerpoint') || type.includes('presentation')) {
    return 'presentation';
  }
  
  if (type.includes('zip') || 
      type.includes('rar') || 
      type.includes('7z') ||
      type.includes('tar') ||
      type.includes('gzip') ||
      type.includes('compressed')) {
    return 'archive';
  }
  
  if (type.includes('javascript') || 
      type.includes('typescript') ||
      type.includes('json') ||
      type.includes('xml') ||
      type.includes('html') ||
      type.includes('css') ||
      type.includes('python') ||
      type.includes('java') ||
      type.includes('c++') ||
      type.includes('php')) {
    return 'code';
  }
  
  return 'other';
}

/**
 * 根据MIME类型获取文件图标信息
 * @param mimeType - MIME类型
 * @returns 图标信息（包含图标组件、颜色、分类）
 */
export function getFileIconInfo(mimeType: string): FileIconInfo {
  const category = getFileCategory(mimeType);
  
  const iconMap: Record<FileCategory, FileIconInfo> = {
    image: { icon: Image, color: 'text-green-500', category: 'image' },
    video: { icon: Film, color: 'text-purple-500', category: 'video' },
    audio: { icon: Music, color: 'text-pink-500', category: 'audio' },
    document: { icon: FileText, color: 'text-blue-500', category: 'document' },
    spreadsheet: { icon: FileSpreadsheet, color: 'text-emerald-500', category: 'spreadsheet' },
    presentation: { icon: Presentation, color: 'text-orange-500', category: 'presentation' },
    archive: { icon: FileArchive, color: 'text-yellow-500', category: 'archive' },
    code: { icon: FileCode, color: 'text-cyan-500', category: 'code' },
    other: { icon: File, color: 'text-gray-500', category: 'other' },
  };
  
  return iconMap[category];
}

/**
 * 根据MIME类型获取文件图标组件
 * @param mimeType - MIME类型
 * @returns Lucide图标组件
 */
export function getFileIcon(mimeType: string): LucideIcon {
  return getFileIconInfo(mimeType).icon;
}

/**
 * 根据MIME类型获取文件图标颜色类名
 * @param mimeType - MIME类型
 * @returns Tailwind颜色类名
 */
export function getFileIconColor(mimeType: string): string {
  return getFileIconInfo(mimeType).color;
}

/**
 * 根据MIME类型获取文件类型emoji
 * @param mimeType - MIME类型
 * @returns emoji字符
 */
export function getFileTypeEmoji(mimeType: string): string {
  const category = getFileCategory(mimeType);
  
  const emojiMap: Record<FileCategory, string> = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📄',
    spreadsheet: '📊',
    presentation: '📽️',
    archive: '📦',
    code: '💻',
    other: '📁',
  };
  
  return emojiMap[category];
}

/**
 * 根据MIME类型获取文件类型显示名称
 * @param mimeType - MIME类型
 * @returns 类型显示名称
 */
export function getFileTypeName(mimeType: string): string {
  const category = getFileCategory(mimeType);
  
  const nameMap: Record<FileCategory, string> = {
    image: '图片',
    video: '视频',
    audio: '音频',
    document: '文档',
    spreadsheet: '表格',
    presentation: '演示文稿',
    archive: '压缩包',
    code: '代码',
    other: '文件',
  };
  
  return nameMap[category];
}

/**
 * 判断是否为图片文件
 * @param mimeType - MIME类型
 * @returns 是否为图片
 */
export function isImageFile(mimeType: string): boolean {
  return getFileCategory(mimeType) === 'image';
}

/**
 * 判断是否为视频文件
 * @param mimeType - MIME类型
 * @returns 是否为视频
 */
export function isVideoFile(mimeType: string): boolean {
  return getFileCategory(mimeType) === 'video';
}

/**
 * 判断是否为音频文件
 * @param mimeType - MIME类型
 * @returns 是否为音频
 */
export function isAudioFile(mimeType: string): boolean {
  return getFileCategory(mimeType) === 'audio';
}

/**
 * 判断是否为媒体文件（图片、视频、音频）
 * @param mimeType - MIME类型
 * @returns 是否为媒体文件
 */
export function isMediaFile(mimeType: string): boolean {
  const category = getFileCategory(mimeType);
  return category === 'image' || category === 'video' || category === 'audio';
}

/**
 * 判断是否可预览
 * @param mimeType - MIME类型
 * @returns 是否可预览
 */
export function isPreviewable(mimeType: string): boolean {
  const category = getFileCategory(mimeType);
  return category === 'image' || category === 'video' || category === 'audio';
}
