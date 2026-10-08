import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommandOutput,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  ListBucketsCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IStorageService,
  IMultipartUploadService,
  StorageConfig,
  StorageMetadata,
  UploadResult,
  MultipartUploadInit,
  MultipartUploadComplete,
  UploadPart,
} from './interfaces/storage.interface';
import { ConfigService as SystemConfigService } from '../config/config.service';

/**
 * 存储服务
 * 基于 AWS S3 SDK 实现，支持 RustFS/S3 兼容的对象存储
 * 支持从数据库配置或环境变量读取RUSTFS设置
 */
@Injectable()
export class StorageService implements IStorageService, IMultipartUploadService, OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private config: StorageConfig;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SystemConfigService))
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * 模块初始化时创建 S3 客户端
   */
  async onModuleInit() {
    await this.initializeConfig();
    this.initializeS3Client();
  }

  /**
   * 从数据库配置获取值，如果为空则回退到环境变量
   */
  private async getConfigValue(dbKey: string, envKey: string, defaultValue: string): Promise<string> {
    try {
      const dbConfig = await this.systemConfigService.getConfigByKey(dbKey);
      if (dbConfig && dbConfig.value && dbConfig.value.trim() !== '') {
        return dbConfig.value;
      }
    } catch (error) {
      // 数据库配置不可用，使用环境变量
    }
    return this.configService.get<string>(envKey, defaultValue);
  }

  /**
   * 初始化存储配置
   * 优先从数据库配置读取，如果为空则回退到环境变量
   */
  private async initializeConfig(): Promise<void> {
    // 从数据库配置或环境变量读取RUSTFS设置
    const endpoint = await this.getConfigValue('storage.s3Endpoint', 'RUSTFS_ENDPOINT', 'localhost');
    const accessKey = await this.getConfigValue('storage.s3AccessKey', 'RUSTFS_ACCESS_KEY', '');
    const secretKey = await this.getConfigValue('storage.s3SecretKey', 'RUSTFS_SECRET_KEY', '');
    const bucketName = await this.getConfigValue('storage.s3Bucket', 'RUSTFS_BUCKET_NAME', 'bnoa-files');
    const region = await this.getConfigValue('storage.s3Region', 'RUSTFS_REGION', 'us-east-1');

    // 解析端点地址，提取主机和端口
    let host = endpoint;
    let port = this.configService.get<number>('RUSTFS_PORT', 16662);
    let useSSL = false;

    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      const url = new URL(endpoint);
      host = url.hostname;
      port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
      useSSL = url.protocol === 'https:';
    }

    this.config = {
      endpoint: host,
      port,
      useSSL,
      accessKey,
      secretKey,
      bucketName,
      region,
    };

    this.logger.log(
      `存储服务配置: endpoint=${this.config.endpoint}:${this.config.port}`,
    );
    this.logger.log(`存储服务配置: bucket=${this.config.bucketName}`);
    this.logger.log(`存储服务配置来源: ${endpoint.includes('://') ? '数据库配置' : '环境变量'}`);
  }

  /**
   * 初始化 S3 客户端
   */
  private initializeS3Client(): void {
    const protocol = this.config.useSSL ? 'https' : 'http';
    const endpoint = `${protocol}://${this.config.endpoint}:${this.config.port}`;

    this.s3Client = new S3Client({
      endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey,
      },
      forcePathStyle: true, // RustFS 需要路径样式
    });

    this.logger.log('S3 客户端初始化完成');
  }

  /**
   * 上传文件
   * @param buffer 文件内容
   * @param key 文件路径/键名
   * @param mimeType MIME类型
   * @returns 文件访问URL
   */
  async upload(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    try {
      this.logger.debug(`开始上传文件: ${key}, 大小: ${buffer.length} bytes`);

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      const result = await this.s3Client.send(command);

      this.logger.log(`文件上传成功: ${key}, ETag: ${result.ETag}`);

      // 构建文件URL
      const url = this.buildFileUrl(key);
      return url;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`文件上传失败: ${key}`, err.stack);
      throw new InternalServerErrorException(`文件上传失败: ${err.message}`);
    }
  }

  /**
   * 上传文件并返回详细信息
   * @param buffer 文件内容
   * @param key 文件路径/键名
   * @param mimeType MIME类型
   * @returns 上传结果
   */
  async uploadWithResult(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<UploadResult> {
    const url = await this.upload(buffer, key, mimeType);

    return {
      url,
      key,
      size: buffer.length,
      contentType: mimeType,
    };
  }

  /**
   * 下载文件
   * @param key 文件路径/键名
   * @returns 文件内容
   */
  async download(key: string): Promise<Buffer> {
    try {
      this.logger.debug(`开始下载文件: ${key}`);

      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response: GetObjectCommandOutput =
        await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('文件内容为空');
      }

      // 将 ReadableStream 转换为 Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      this.logger.log(`文件下载成功: ${key}, 大小: ${buffer.length} bytes`);
      return buffer;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`文件下载失败: ${key}`, err.stack);
      throw new InternalServerErrorException(`文件下载失败: ${err.message}`);
    }
  }

  /**
   * 删除文件
   * @param key 文件路径/键名
   */
  async delete(key: string): Promise<void> {
    try {
      this.logger.debug(`开始删除文件: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      this.logger.log(`文件删除成功: ${key}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`文件删除失败: ${key}`, err.stack);
      throw new InternalServerErrorException(`文件删除失败: ${err.message}`);
    }
  }

  /**
   * 获取预签名URL
   * @param key 文件路径/键名
   * @param expiresIn 过期时间（秒）
   * @returns 预签名URL
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      this.logger.debug(`生成预签名URL: ${key}, 过期时间: ${expiresIn}s`);

      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.debug(`预签名URL生成成功: ${key}`);
      return url;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`预签名URL生成失败: ${key}`, err.stack);
      throw new InternalServerErrorException(
        `预签名URL生成失败: ${err.message}`,
      );
    }
  }

  /**
   * 检查文件是否存在
   * @param key 文件路径/键名
   * @returns 是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
        stack?: string;
        message?: string;
      };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      this.logger.error(`检查文件存在性失败: ${key}`, err.stack);
      throw new InternalServerErrorException(
        `检查文件存在性失败: ${err.message}`,
      );
    }
  }

  /**
   * 获取文件元数据
   * @param key 文件路径/键名
   * @returns 文件元数据
   */
  async getMetadata(key: string): Promise<StorageMetadata> {
    try {
      this.logger.debug(`获取文件元数据: ${key}`);

      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);

      return {
        size: result.ContentLength || 0,
        lastModified: result.LastModified || new Date(),
        contentType: result.ContentType || 'application/octet-stream',
        etag: result.ETag,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`获取文件元数据失败: ${key}`, err.stack);
      throw new InternalServerErrorException(
        `获取文件元数据失败: ${err.message}`,
      );
    }
  }

  /**
   * 构建文件URL
   * @param key 文件路径/键名
   * @returns 文件URL
   */
  private buildFileUrl(key: string): string {
    const protocol = this.config.useSSL ? 'https' : 'http';
    return `${protocol}://${this.config.endpoint}:${this.config.port}/${this.config.bucketName}/${key}`;
  }

  /**
   * 获取存储配置
   * @returns 存储配置
   */
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  /**
   * 获取存储桶名称
   * @returns 存储桶名称
   */
  getBucketName(): string {
    return this.config.bucketName;
  }

  // ============================================
  // 分片上传相关方法
  // ============================================

  /**
   * 初始化分片上传
   * @param key 文件路径/键名
   * @param mimeType MIME类型
   * @returns 分片上传初始化结果
   */
  async createMultipartUpload(
    key: string,
    mimeType: string,
  ): Promise<MultipartUploadInit> {
    try {
      this.logger.debug(`初始化分片上传: ${key}`);

      const command = new CreateMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: mimeType,
      });

      const result = await this.s3Client.send(command);

      if (!result.UploadId) {
        throw new Error('分片上传初始化失败：未返回UploadId');
      }

      this.logger.log(`分片上传初始化成功: ${key}, uploadId: ${result.UploadId}`);

      return {
        uploadId: result.UploadId,
        key,
        bucket: this.config.bucketName,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`分片上传初始化失败: ${key}`, err.stack);
      throw new InternalServerErrorException(
        `分片上传初始化失败: ${err.message}`,
      );
    }
  }

  /**
   * 生成分片上传预签名URL
   * @param key 文件路径/键名
   * @param uploadId 上传ID
   * @param partNumber 分片编号
   * @param expiresIn 过期时间（秒）
   * @returns 预签名URL
   */
  async generatePresignedUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      this.logger.debug(
        `生成分片上传预签名URL: ${key}, part: ${partNumber}`,
      );

      const command = new UploadPartCommand({
        Bucket: this.config.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.debug(`分片上传预签名URL生成成功: part ${partNumber}`);
      return url;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `分片上传预签名URL生成失败: ${key}, part: ${partNumber}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `分片上传预签名URL生成失败: ${err.message}`,
      );
    }
  }

  /**
   * 完成分片上传
   * @param key 文件路径/键名
   * @param uploadId 上传ID
   * @param parts 已上传的分片列表
   * @returns 完成结果
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadPart[],
  ): Promise<MultipartUploadComplete> {
    try {
      this.logger.debug(`完成分片上传: ${key}, parts: ${parts.length}`);

      // 按分片编号排序
      const sortedParts = [...parts].sort(
        (a, b) => a.partNumber - b.partNumber,
      );

      const command = new CompleteMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      });

      const result = await this.s3Client.send(command);

      this.logger.log(`分片上传完成: ${key}, ETag: ${result.ETag}`);

      return {
        key,
        etag: result.ETag || '',
        location: result.Location || this.buildFileUrl(key),
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`分片上传完成失败: ${key}`, err.stack);
      throw new InternalServerErrorException(
        `分片上传完成失败: ${err.message}`,
      );
    }
  }

  /**
   * 取消分片上传
   * @param key 文件路径/键名
   * @param uploadId 上传ID
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      this.logger.debug(`取消分片上传: ${key}, uploadId: ${uploadId}`);

      const command = new AbortMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: key,
        UploadId: uploadId,
      });

      await this.s3Client.send(command);

      this.logger.log(`分片上传已取消: ${key}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`取消分片上传失败: ${key}`, err.stack);
      throw new InternalServerErrorException(
        `取消分片上传失败: ${err.message}`,
      );
    }
  }

  /**
   * 列出已上传的分片
   * @param key 文件路径/键名
   * @param uploadId 上传ID
   * @returns 已上传的分片列表
   */
  async listParts(key: string, uploadId: string): Promise<UploadPart[]> {
    try {
      this.logger.debug(`列出已上传分片: ${key}, uploadId: ${uploadId}`);

      const parts: UploadPart[] = [];
      let partNumberMarker: string | undefined;

      do {
        const command = new ListPartsCommand({
          Bucket: this.config.bucketName,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: partNumberMarker,
        });

        const result = await this.s3Client.send(command);

        if (result.Parts) {
          for (const part of result.Parts) {
            if (part.PartNumber && part.ETag) {
              parts.push({
                partNumber: part.PartNumber,
                etag: part.ETag,
              });
            }
          }
        }

        partNumberMarker = result.NextPartNumberMarker;
      } while (partNumberMarker);

      this.logger.debug(`已上传分片数量: ${parts.length}`);
      return parts;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`列出已上传分片失败: ${key}`, err.stack);
      throw new InternalServerErrorException(
        `列出已上传分片失败: ${err.message}`,
      );
    }
  }

  /**
   * 获取S3客户端（供其他服务使用）
   */
  getS3Client(): S3Client {
    return this.s3Client;
  }

  /**
   * 重新初始化存储配置和S3客户端
   * 在数据库配置更新后调用
   */
  async reinitialize(): Promise<void> {
    this.logger.log('重新初始化存储服务...');
    await this.initializeConfig();
    this.initializeS3Client();
    this.logger.log('存储服务重新初始化完成');
  }

  /**
   * 测试RUSTFS连接
   * 尝试列出存储桶或检查指定桶是否存在
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const command = new HeadBucketCommand({
        Bucket: this.config.bucketName,
      });
      await this.s3Client.send(command);
      return { success: true, message: `连接成功，存储桶 ${this.config.bucketName} 可访问` };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error('RUSTFS连接测试失败', err.stack);
      return { success: false, message: `连接失败: ${err.message}` };
    }
  }

  /**
   * 在RUSTFS中创建目录（通过创建一个空的占位文件）
   * S3/RUSTFS 不支持真正的目录，通过创建 .folder 占位文件模拟
   * @param folderPath 目录路径（如 resources/covers）
   */
  async createFolder(folderPath: string): Promise<void> {
    try {
      // 确保路径以 / 结尾
      const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      const key = `${normalizedPath}.folder`;

      this.logger.debug(`在RUSTFS中创建目录: ${folderPath}`);

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: Buffer.from(''),
        ContentType: 'application/x-directory',
      });

      await this.s3Client.send(command);

      this.logger.log(`RUSTFS目录创建成功: ${folderPath}`);
    } catch (error: unknown) {
      const err = error as any;
      const errMsg = err.message || err.Code || err.name || '未知错误';
      this.logger.error(`RUSTFS目录创建失败: ${folderPath}, 错误: ${errMsg}`, err.stack);
      throw new InternalServerErrorException(`RUSTFS目录创建失败: ${errMsg}`);
    }
  }

  /**
   * 检查RUSTFS中目录是否存在
   * @param folderPath 目录路径
   */
  async folderExists(folderPath: string): Promise<boolean> {
    try {
      const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      const key = `${normalizedPath}.folder`;
      return await this.exists(key);
    } catch {
      return false;
    }
  }
}
