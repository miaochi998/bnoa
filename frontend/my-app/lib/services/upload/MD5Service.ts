/**
 * MD5Service - MD5哈希计算服务
 * @module lib/services/upload/MD5Service
 * 
 * 功能：
 * - 分块增量计算MD5（2MB/块）
 * - 支持进度回调
 * - 支持Blob/File对象
 * 
 * 使用场景：
 * - 秒传检查前计算文件MD5
 * - 分片上传时计算分片MD5
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SparkMD5 = require('spark-md5');

/**
 * MD5计算配置
 */
export interface MD5Config {
  /** 分块大小（字节），默认2MB */
  chunkSize?: number;
  /** 进度回调 */
  onProgress?: (percentage: number) => void;
}

/**
 * MD5计算结果
 */
export interface MD5Result {
  /** MD5哈希值（32位小写） */
  md5: string;
  /** 文件大小（字节） */
  size: number;
  /** 计算耗时（毫秒） */
  duration: number;
}

/**
 * MD5Service类 - MD5哈希计算服务
 */
export class MD5Service {
  /** 默认分块大小：2MB */
  private readonly defaultChunkSize = 2 * 1024 * 1024;

  /**
   * 计算文件MD5哈希
   * @param file - File或Blob对象
   * @param config - 配置选项
   * @returns MD5计算结果
   */
  async calculateFileMD5(
    file: File | Blob,
    config?: MD5Config
  ): Promise<MD5Result> {
    const startTime = Date.now();
    const chunkSize = config?.chunkSize ?? this.defaultChunkSize;
    const onProgress = config?.onProgress;
    
    const fileSize = file.size;
    const chunks = Math.ceil(fileSize / chunkSize);
    const spark = new SparkMD5.ArrayBuffer();
    
    let currentChunk = 0;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      const loadNext = () => {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const blob = file.slice(start, end);
        reader.readAsArrayBuffer(blob);
      };

      reader.onload = (e) => {
        if (!e.target?.result) {
          reject(new Error('读取文件块失败'));
          return;
        }

        spark.append(e.target.result as ArrayBuffer);
        currentChunk++;

        // 报告进度
        if (onProgress) {
          const percentage = Math.round((currentChunk / chunks) * 100);
          onProgress(percentage);
        }

        if (currentChunk < chunks) {
          loadNext();
        } else {
          // 计算完成
          const md5 = spark.end();
          const duration = Date.now() - startTime;
          resolve({
            md5,
            size: fileSize,
            duration,
          });
        }
      };

      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };

      // 开始读取第一块
      loadNext();
    });
  }

  /**
   * 计算Blob的MD5（用于分片校验）
   * @param blob - Blob对象
   * @returns 32位MD5字符串
   */
  async calculateBlobMD5(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (!e.target?.result) {
          reject(new Error('读取Blob失败'));
          return;
        }
        
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(e.target.result as ArrayBuffer);
        resolve(spark.end());
      };
      
      reader.onerror = () => {
        reject(new Error('读取Blob失败'));
      };
      
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * 计算字符串的MD5
   * @param str - 字符串
   * @returns 32位MD5字符串
   */
  calculateStringMD5(str: string): string {
    return SparkMD5.hash(str);
  }

  /**
   * 计算ArrayBuffer的MD5
   * @param buffer - ArrayBuffer
   * @returns 32位MD5字符串
   */
  calculateBufferMD5(buffer: ArrayBuffer): string {
    const spark = new SparkMD5.ArrayBuffer();
    spark.append(buffer);
    return spark.end();
  }
}

// 单例导出
export const md5Service = new MD5Service();
