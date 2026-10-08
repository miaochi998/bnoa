import * as path from 'path';

export class FileUtil {
  /**
   * 从文件名提取扩展名
   */
  static getExtension(filename: string): string {
    return path.extname(filename).toLowerCase().replace('.', '');
  }

  /**
   * 从 MIME 类型推断文件分类
   */
  static getCategoryFromMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text')
    ) {
      return 'DOCUMENT';
    }
    if (mimeType.includes('zip') || mimeType.includes('compressed')) {
      return 'ARCHIVE';
    }
    if (
      mimeType.includes('javascript') ||
      mimeType.includes('typescript') ||
      mimeType.includes('json')
    ) {
      return 'CODE';
    }
    return 'OTHER';
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 生成存储路径
   */
  static generateStoragePath(
    userId: string,
    category: string,
    filename: string,
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = this.getExtension(filename);

    return `${category.toLowerCase()}/${year}/${month}/${day}/${userId}/${timestamp}-${random}.${ext}`;
  }

  /**
   * 检查文件类型是否允许
   */
  static isAllowedType(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        const prefix = type.replace('/*', '');
        return mimeType.startsWith(prefix);
      }
      return type === mimeType;
    });
  }

  /**
   * 计算 MD5（用于秒传）
   * 注意：实际 MD5 计算应在客户端完成
   */
  static async calculateMD5(buffer: Buffer): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('md5').update(buffer).digest('hex');
  }
}
