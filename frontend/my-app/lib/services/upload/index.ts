/**
 * 上传服务统一导出
 * @module lib/services/upload
 */

// MD5服务
export { MD5Service, md5Service } from './MD5Service';
export type { MD5Config, MD5Result } from './MD5Service';

// 秒传检查服务
export { SecureCheckService, secureCheckService } from './SecureCheckService';
export type { 
  SecureCheckRequest, 
  SecureCheckResponse, 
  MediaType 
} from './SecureCheckService';

// 会话管理服务
export { SessionService, sessionService } from './SessionService';
export type { 
  StorageMode, 
  SessionInitRequest, 
  SessionInitResponse, 
  SessionInfo 
} from './SessionService';

// 分片上传服务
export { ChunkUploadService, chunkUploadService } from './ChunkUploadService';
export type { 
  ChunkUploadConfig, 
  ChunkProgress, 
  ChunkUploadResult 
} from './ChunkUploadService';

// S3上传服务
export { S3UploadService, s3UploadService } from './S3UploadService';
export type { 
  S3UploadConfig, 
  S3Progress, 
  S3UploadResult 
} from './S3UploadService';

// 图片压缩服务
export { CompressService, compressService } from './CompressService';
export type { 
  CompressConfig, 
  CompressResult 
} from './CompressService';

// 上传编排器
export { UploadOrchestrator, uploadOrchestrator } from './UploadOrchestrator';
export type { 
  UploadConfig, 
  UploadProgress, 
  UploadResult 
} from './UploadOrchestrator';

// 缓存服务（崩溃恢复）
export { UploadCacheService, cacheService } from './CacheService';
export type {
  CachedUploadSession,
  RecoverableUpload,
  CacheServiceConfig,
} from './CacheService';

// 哈希计算服务（SHA256等）
export { HashService, hashService } from './HashService';
export type {
  HashAlgorithm,
  HashConfig,
  HashResult,
} from './HashService';
