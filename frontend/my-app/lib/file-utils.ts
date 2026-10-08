import SparkMD5 from 'spark-md5';

/**
 * 计算文件MD5（使用SparkMD5，支持大文件分片计算）
 */
export async function calculateFileMd5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 2 * 1024 * 1024; // 2MB per chunk
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      try {
        const result = e.target?.result as ArrayBuffer;
        if (!result) {
          reject(new Error('读取文件数据失败'));
          return;
        }

        spark.append(result);
        currentChunk++;

        if (currentChunk < chunks) {
          loadNext();
        } else {
          resolve(spark.end());
        }
      } catch (error) {
        reject(new Error(`MD5计算失败: ${error}`));
      }
    };

    fileReader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    const loadNext = () => {
      try {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        fileReader.readAsArrayBuffer(file.slice(start, end));
      } catch (error) {
        reject(new Error(`文件分片读取失败: ${error}`));
      }
    };

    loadNext();
  });
}

/**
 * 计算分片MD5（使用SparkMD5）
 */
export async function calculateChunkMd5(chunk: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(buffer);
        resolve(spark.end());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('读取分片失败'));
    reader.readAsArrayBuffer(chunk);
  });
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化上传速度
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化剩余时间
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
  return `${Math.round(seconds / 3600)}小时`;
}

/**
 * 获取文件类型图标
 */
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return '📦';
  return '📁';
}

/**
 * 默认分片大小 10MB（参照7DL优化配置，减少请求数，提升性能）
 */
export const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;

/**
 * 小文件阈值 10MB（小于此大小不分片）
 */
export const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024;
