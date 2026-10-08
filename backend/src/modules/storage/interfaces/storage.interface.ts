/**
 * 存储服务接口
 * 定义存储服务的基本操作
 */
export interface IStorageService {
  /**
   * 上传文件
   * @param buffer 文件内容
   * @param key 文件路径/键名
   * @param mimeType MIME类型
   * @returns 文件访问URL
   */
  upload(buffer: Buffer, key: string, mimeType: string): Promise<string>;

  /**
   * 下载文件
   * @param key 文件路径/键名
   * @returns 文件内容
   */
  download(key: string): Promise<Buffer>;

  /**
   * 删除文件
   * @param key 文件路径/键名
   */
  delete(key: string): Promise<void>;

  /**
   * 获取预签名URL
   * @param key 文件路径/键名
   * @param expiresIn 过期时间（秒）
   * @returns 预签名URL
   */
  getPresignedUrl(key: string, expiresIn: number): Promise<string>;

  /**
   * 检查文件是否存在
   * @param key 文件路径/键名
   * @returns 是否存在
   */
  exists(key: string): Promise<boolean>;

  /**
   * 获取文件元数据
   * @param key 文件路径/键名
   * @returns 文件元数据
   */
  getMetadata(key: string): Promise<StorageMetadata>;
}

/**
 * 存储元数据
 */
export interface StorageMetadata {
  size: number;
  lastModified: Date;
  contentType: string;
  etag?: string;
}

/**
 * 存储配置
 */
export interface StorageConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  region?: string;
}

/**
 * 上传结果
 */
export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
  etag?: string;
}

/**
 * 存储类型枚举
 */
export enum StorageType {
  RUSTFS = 'RUSTFS',
  LOCAL = 'LOCAL',
  S3 = 'S3',
}

/**
 * 分片上传初始化结果
 */
export interface MultipartUploadInit {
  uploadId: string;
  key: string;
  bucket: string;
}

/**
 * 分片信息
 */
export interface UploadPart {
  partNumber: number;
  etag: string;
}

/**
 * 预签名URL结果
 */
export interface PresignedUrlResult {
  partNumber: number;
  url: string;
  directUrl: string;
  proxyUrl: string;
  expiresAt: Date;
}

/**
 * 分片上传完成结果
 */
export interface MultipartUploadComplete {
  key: string;
  etag: string;
  location: string;
}

/**
 * 分片上传服务接口
 */
export interface IMultipartUploadService {
  /**
   * 初始化分片上传
   */
  createMultipartUpload(key: string, mimeType: string): Promise<MultipartUploadInit>;

  /**
   * 生成分片上传预签名URL
   */
  generatePresignedUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn?: number,
  ): Promise<string>;

  /**
   * 完成分片上传
   */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadPart[],
  ): Promise<MultipartUploadComplete>;

  /**
   * 取消分片上传
   */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  /**
   * 列出已上传的分片
   */
  listParts(key: string, uploadId: string): Promise<UploadPart[]>;
}
