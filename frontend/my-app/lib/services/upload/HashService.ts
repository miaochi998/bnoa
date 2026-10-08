/**
 * HashService - 文件哈希计算服务
 * 支持MD5和SHA256哈希计算
 * 
 * 功能点：
 * - F001: MD5哈希计算（已有MD5Service实现）
 * - F039: SHA256哈希计算（本服务实现）
 * 
 * 使用Web Crypto API实现SHA256计算，性能优于纯JS实现
 */

/**
 * 哈希算法类型
 */
export type HashAlgorithm = 'MD5' | 'SHA-256' | 'SHA-1' | 'SHA-384' | 'SHA-512';

/**
 * 哈希计算配置
 */
export interface HashConfig {
  /** 哈希算法，默认SHA-256 */
  algorithm?: HashAlgorithm;
  /** 分块大小（字节），默认2MB */
  chunkSize?: number;
  /** 进度回调 */
  onProgress?: (progress: number) => void;
  /** 取消信号 */
  signal?: AbortSignal;
}

/**
 * 哈希计算结果
 */
export interface HashResult {
  /** 哈希值（十六进制字符串） */
  hash: string;
  /** 使用的算法 */
  algorithm: HashAlgorithm;
  /** 文件大小 */
  fileSize: number;
  /** 计算耗时（毫秒） */
  duration: number;
}

/**
 * 将ArrayBuffer转换为十六进制字符串
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 哈希计算服务类
 */
export class HashService {
  private defaultChunkSize: number;

  constructor(defaultChunkSize: number = 2 * 1024 * 1024) {
    this.defaultChunkSize = defaultChunkSize;
  }

  /**
   * 计算文件的SHA256哈希
   */
  async calculateSHA256(
    file: File | Blob,
    config: Omit<HashConfig, 'algorithm'> = {}
  ): Promise<HashResult> {
    return this.calculateHash(file, { ...config, algorithm: 'SHA-256' });
  }

  /**
   * 计算文件的SHA1哈希
   */
  async calculateSHA1(
    file: File | Blob,
    config: Omit<HashConfig, 'algorithm'> = {}
  ): Promise<HashResult> {
    return this.calculateHash(file, { ...config, algorithm: 'SHA-1' });
  }

  /**
   * 计算文件哈希（通用方法）
   * 使用Web Crypto API，支持SHA-1, SHA-256, SHA-384, SHA-512
   * 注意：MD5不被Web Crypto API支持，请使用MD5Service
   */
  async calculateHash(
    file: File | Blob,
    config: HashConfig = {}
  ): Promise<HashResult> {
    const {
      algorithm = 'SHA-256',
      chunkSize = this.defaultChunkSize,
      onProgress,
      signal,
    } = config;

    // MD5需要使用专门的MD5Service
    if (algorithm === 'MD5') {
      throw new Error('MD5算法请使用MD5Service');
    }

    const startTime = performance.now();
    const fileSize = file.size;

    // 检查Web Crypto API是否可用
    if (!crypto?.subtle) {
      throw new Error('Web Crypto API不可用');
    }

    // 对于小文件，直接计算
    if (fileSize <= chunkSize) {
      const buffer = await file.arrayBuffer();
      
      if (signal?.aborted) {
        throw new Error('计算已取消');
      }

      const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
      const hash = arrayBufferToHex(hashBuffer);

      onProgress?.(100);

      return {
        hash,
        algorithm,
        fileSize,
        duration: performance.now() - startTime,
      };
    }

    // 对于大文件，分块读取并增量计算
    // 注意：Web Crypto API不支持增量计算，需要读取整个文件
    // 但我们可以分块读取以显示进度
    const chunks: ArrayBuffer[] = [];
    let offset = 0;
    let totalRead = 0;

    while (offset < fileSize) {
      if (signal?.aborted) {
        throw new Error('计算已取消');
      }

      const end = Math.min(offset + chunkSize, fileSize);
      const chunk = file.slice(offset, end);
      const buffer = await chunk.arrayBuffer();
      
      chunks.push(buffer);
      totalRead += buffer.byteLength;
      offset = end;

      const progress = Math.round((totalRead / fileSize) * 90); // 90%用于读取
      onProgress?.(progress);
    }

    // 合并所有块
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let position = 0;
    
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), position);
      position += chunk.byteLength;
    }

    if (signal?.aborted) {
      throw new Error('计算已取消');
    }

    // 计算哈希
    const hashBuffer = await crypto.subtle.digest(algorithm, combined.buffer);
    const hash = arrayBufferToHex(hashBuffer);

    onProgress?.(100);

    return {
      hash,
      algorithm,
      fileSize,
      duration: performance.now() - startTime,
    };
  }

  /**
   * 同时计算多种哈希
   */
  async calculateMultipleHashes(
    file: File | Blob,
    algorithms: HashAlgorithm[],
    config: Omit<HashConfig, 'algorithm'> = {}
  ): Promise<Map<HashAlgorithm, string>> {
    const { onProgress, signal } = config;
    const results = new Map<HashAlgorithm, string>();
    const total = algorithms.length;
    let completed = 0;

    for (const algorithm of algorithms) {
      if (signal?.aborted) {
        throw new Error('计算已取消');
      }

      try {
        const result = await this.calculateHash(file, {
          ...config,
          algorithm,
          onProgress: (p) => {
            const overallProgress = Math.round(((completed + p / 100) / total) * 100);
            onProgress?.(overallProgress);
          },
        });
        results.set(algorithm, result.hash);
      } catch (error) {
        if (algorithm === 'MD5') {
          console.warn('MD5需要使用MD5Service单独计算');
        } else {
          throw error;
        }
      }
      
      completed++;
    }

    return results;
  }

  /**
   * 计算字符串的哈希
   */
  async hashString(
    str: string,
    algorithm: HashAlgorithm = 'SHA-256'
  ): Promise<string> {
    if (algorithm === 'MD5') {
      throw new Error('MD5算法请使用MD5Service');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest(algorithm, data);
    return arrayBufferToHex(hashBuffer);
  }

  /**
   * 计算ArrayBuffer的哈希
   */
  async hashArrayBuffer(
    buffer: ArrayBuffer,
    algorithm: HashAlgorithm = 'SHA-256'
  ): Promise<string> {
    if (algorithm === 'MD5') {
      throw new Error('MD5算法请使用MD5Service');
    }

    const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
    return arrayBufferToHex(hashBuffer);
  }

  /**
   * 验证文件哈希
   */
  async verifyHash(
    file: File | Blob,
    expectedHash: string,
    algorithm: HashAlgorithm = 'SHA-256'
  ): Promise<boolean> {
    const result = await this.calculateHash(file, { algorithm });
    return result.hash.toLowerCase() === expectedHash.toLowerCase();
  }
}

// 创建单例实例
export const hashService = new HashService();

export default hashService;
