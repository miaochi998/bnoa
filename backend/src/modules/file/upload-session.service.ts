import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FileCategory } from '@prisma/client';
import {
  InitUploadDto,
  InitUploadResponse,
  GeneratePresignedUrlsDto,
  PresignedUrlsResponse,
  CompleteUploadDto,
  CompleteUploadResponse,
  UploadSessionResponse,
  CheckFileExistsDto,
  FileExistsResponse,
} from './dto/upload.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadSessionService {
  private readonly logger = new Logger(UploadSessionService.name);
  private readonly defaultChunkSize: number;
  private readonly sessionExpireMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    this.defaultChunkSize = this.configService.get<number>(
      'UPLOAD_CHUNK_SIZE',
      10 * 1024 * 1024, // 10MB
    );
    this.sessionExpireMinutes = this.configService.get<number>(
      'UPLOAD_SESSION_EXPIRE_MINUTES',
      1440, // 24小时
    );
  }

  /**
   * 检查文件是否存在（秒传检查）
   * 秒传命中后创建新 File 记录，复用物理文件
   */
  async checkFileExists(
    dto: CheckFileExistsDto,
    userId: string,
    folderId?: string,
  ): Promise<FileExistsResponse> {
    // 查找相同MD5的文件
    const existingFile = await this.prisma.file.findFirst({
      where: { md5: dto.md5, deletedAt: null },
    });

    if (existingFile) {
      // 秒传：创建新 File 记录，复用物理文件
      const newFile = await this.prisma.file.create({
        data: {
          name: existingFile.name,
          originalName: existingFile.originalName,
          mimeType: existingFile.mimeType,
          extension: existingFile.extension,
          size: existingFile.size,
          md5: existingFile.md5,
          sha256: existingFile.sha256,
          storageType: existingFile.storageType,
          bucket: existingFile.bucket,
          path: existingFile.path,
          url: existingFile.url,
          thumbnailUrl: existingFile.thumbnailUrl,
          category: existingFile.category,
          width: existingFile.width,
          height: existingFile.height,
          duration: existingFile.duration,
          folderId: folderId || null,
          uploadedBy: userId,
        },
      });

      return {
        exists: true,
        fileId: newFile.id,
        url: newFile.url,
        message: '文件已存在，秒传成功',
      };
    }

    return {
      exists: false,
      message: '文件不存在，需要上传',
    };
  }

  /**
   * 初始化上传
   */
  async initUpload(
    dto: InitUploadDto,
    userId: string,
  ): Promise<InitUploadResponse> {
    // 合并 folderId（向后兼容 virtualFolderId）
    const effectiveFolderId = dto.folderId || dto.virtualFolderId;

    // 检查秒传（传入 folderId）
    const existsCheck = await this.checkFileExists(
      { md5: dto.fileMd5 },
      userId,
      effectiveFolderId,
    );
    if (existsCheck.exists) {
      return {
        sessionId: '',
        partSize: 0,
        partCount: 0,
        expiresAt: new Date(),
        isInstant: true,
        existingFileId: existsCheck.fileId,
        existingFileUrl: existsCheck.url,
      };
    }

    // 检查是否存在未完成的上传会话
    const existingSession = await this.prisma.uploadSession.findFirst({
      where: {
        fileMd5: dto.fileMd5,
        uploadedBy: userId,
        status: { in: ['PENDING', 'UPLOADING'] },
        expiresAt: { gt: new Date() },
      },
    });

    if (existingSession) {
      // 返回现有会话（断点续传）
      return {
        sessionId: existingSession.id,
        uploadId: existingSession.fileKey || undefined,
        bucket: existingSession.bucket,
        key: existingSession.fileKey || undefined,
        partSize: existingSession.chunkSize,
        partCount: existingSession.chunkCount,
        expiresAt: existingSession.expiresAt,
      };
    }

    // 计算分片信息
    const chunkSize = dto.chunkSize || this.calculateOptimalChunkSize(dto.fileSize);
    const chunkCount = Math.ceil(dto.fileSize / chunkSize);

    // 生成文件路径（异步，使用真实文件夹路径前缀）
    const fileKey = await this.generateObjectKey(
      dto.fileName,
      effectiveFolderId,
    );

    // 初始化S3分片上传
    const multipartInit = await this.storageService.createMultipartUpload(
      fileKey,
      dto.mimeType,
    );

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.sessionExpireMinutes);

    // 创建上传会话
    const session = await this.prisma.uploadSession.create({
      data: {
        fileName: dto.fileName,
        fileSize: BigInt(dto.fileSize),
        fileMd5: dto.fileMd5,
        mimeType: dto.mimeType,
        extension: dto.fileExtension,
        chunkSize,
        chunkCount,
        storageType: 'RUSTFS',
        bucket: multipartInit.bucket,
        fileKey: multipartInit.key,
        status: 'PENDING',
        uploadedBy: userId,
        expiresAt,
        folderId: effectiveFolderId,
        chunks: JSON.stringify({ uploadId: multipartInit.uploadId, parts: [] }),
      },
    });

    // 记录日志
    await this.logUploadAction(session.id, null, 'init', 'success', userId, {
      fileName: dto.fileName,
      fileSize: dto.fileSize,
    });

    this.logger.log(`初始化上传会话: ${session.id}, 文件: ${dto.fileName}`);

    return {
      sessionId: session.id,
      uploadId: multipartInit.uploadId,
      bucket: multipartInit.bucket,
      key: multipartInit.key,
      partSize: chunkSize,
      partCount: chunkCount,
      expiresAt,
    };
  }

  /**
   * 生成预签名URL
   */
  async generatePresignedUrls(
    dto: GeneratePresignedUrlsDto,
    userId: string,
  ): Promise<PresignedUrlsResponse> {
    const session = await this.getSession(dto.sessionId, userId);

    if (session.status !== 'PENDING' && session.status !== 'UPLOADING') {
      throw new BadRequestException('上传会话状态无效');
    }

    const chunks = JSON.parse(session.chunks as string || '{}');
    const uploadId = chunks.uploadId;

    if (!uploadId || !session.fileKey) {
      throw new BadRequestException('上传会话数据无效');
    }

    // 更新状态为上传中
    if (session.status === 'PENDING') {
      await this.prisma.uploadSession.update({
        where: { id: dto.sessionId },
        data: { status: 'UPLOADING' },
      });
    }

    // 生成预签名URL
    const presignedUrls = await Promise.all(
      dto.partNumbers.map(async (partNumber) => {
        const url = await this.storageService.generatePresignedUploadUrl(
          session.fileKey!,
          uploadId,
          partNumber,
          3600, // 1小时过期
        );

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        // 构建代理URL
        const proxyUrl = `/api/v1/s3-proxy/upload/${dto.sessionId}/${partNumber}`;

        return {
          partNumber,
          url, // 默认使用直连URL
          directUrl: url,
          proxyUrl,
          expiresAt,
        };
      }),
    );

    return {
      sessionId: dto.sessionId,
      uploadId,
      presignedUrls,
      smartMode: true,
    };
  }

  /**
   * 完成上传
   */
  async completeUpload(
    dto: CompleteUploadDto,
    userId: string,
  ): Promise<CompleteUploadResponse> {
    const session = await this.getSession(dto.sessionId, userId);

    if (session.status !== 'UPLOADING') {
      throw new BadRequestException('上传会话状态无效');
    }

    const chunks = JSON.parse(session.chunks as string || '{}');
    const uploadId = chunks.uploadId;

    if (!uploadId || !session.fileKey) {
      throw new BadRequestException('上传会话数据无效');
    }

    // 完成S3分片上传
    const completeResult = await this.storageService.completeMultipartUpload(
      session.fileKey,
      uploadId,
      dto.parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
    );

    // 创建 File 记录
    const fileUrl = this.buildFileUrl(session.fileKey);

    const file = await this.prisma.file.create({
      data: {
        name: session.fileName,
        originalName: session.fileName,
        mimeType: session.mimeType,
        extension: session.extension,
        size: session.fileSize,
        md5: session.fileMd5,
        storageType: 'RUSTFS',
        bucket: session.bucket,
        path: session.fileKey,
        url: fileUrl,
        category: this.getCategoryByExtension(session.extension),
        folderId: session.folderId,
        uploadedBy: userId,
      },
    });

    // 更新会话状态
    await this.prisma.uploadSession.update({
      where: { id: dto.sessionId },
      data: {
        status: 'COMPLETED',
        uploadedChunks: session.chunkCount,
      },
    });

    // 记录日志
    await this.logUploadAction(dto.sessionId, file.id, 'complete', 'success', userId);

    this.logger.log(`上传完成: ${session.fileName}, 文件ID: ${file.id}`);

    return {
      fileId: file.id,
      url: fileUrl,
      message: '上传成功',
    };
  }

  /**
   * 取消上传
   */
  async abortUpload(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId, userId);

    if (session.status === 'COMPLETED') {
      throw new BadRequestException('上传已完成，无法取消');
    }

    const chunks = JSON.parse(session.chunks as string || '{}');
    const uploadId = chunks.uploadId;

    // 取消S3分片上传
    if (uploadId && session.fileKey) {
      try {
        await this.storageService.abortMultipartUpload(session.fileKey, uploadId);
      } catch (error) {
        this.logger.warn(`取消S3分片上传失败: ${sessionId}`);
      }
    }

    // 更新会话状态
    await this.prisma.uploadSession.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED' },
    });

    // 记录日志
    await this.logUploadAction(sessionId, null, 'abort', 'success', userId);

    this.logger.log(`取消上传: ${sessionId}`);
  }

  /**
   * 获取上传会话状态
   */
  async getSessionStatus(
    sessionId: string,
    userId: string,
  ): Promise<UploadSessionResponse> {
    const session = await this.getSession(sessionId, userId);

    const chunks = JSON.parse(session.chunks as string || '{}');
    const uploadedParts = (chunks.parts || []).length;
    const progress = Math.round((uploadedParts / session.chunkCount) * 100);

    return {
      sessionId: session.id,
      status: session.status,
      fileName: session.fileName,
      fileSize: session.fileSize.toString(),
      partCount: session.chunkCount,
      uploadedParts,
      progress,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  /**
   * 获取会话
   */
  private async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.uploadSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`上传会话不存在: ${sessionId}`);
    }

    if (session.uploadedBy !== userId) {
      throw new BadRequestException('无权访问此上传会话');
    }

    if (session.expiresAt < new Date() && session.status !== 'COMPLETED') {
      throw new BadRequestException('上传会话已过期');
    }

    return session;
  }

  /**
   * 计算最优分片大小
   */
  private calculateOptimalChunkSize(fileSize: number): number {
    // 小于10MB: 不分片
    if (fileSize < 10 * 1024 * 1024) {
      return fileSize;
    }
    // 10MB-100MB: 5MB分片
    if (fileSize < 100 * 1024 * 1024) {
      return 5 * 1024 * 1024;
    }
    // 100MB-500MB: 10MB分片
    if (fileSize < 500 * 1024 * 1024) {
      return 10 * 1024 * 1024;
    }
    // 500MB-1GB: 20MB分片
    if (fileSize < 1024 * 1024 * 1024) {
      return 20 * 1024 * 1024;
    }
    // 大于1GB: 50MB分片
    return 50 * 1024 * 1024;
  }

  /**
   * 生成对象键（使用真实文件夹路径作为前缀）
   */
  private async generateObjectKey(
    fileName: string,
    folderId?: string,
  ): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const uuid = uuidv4();
    const ext = fileName.split('.').pop() || '';
    const safeName = `${uuid}.${ext}`;

    // 获取真实文件夹路径前缀
    let prefix = 'uploads';
    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
        include: { realFolder: { select: { pathName: true } } },
      });
      if (folder?.realFolder?.pathName) {
        prefix = folder.realFolder.pathName;
      }
    }

    return `${prefix}/${year}/${month}/${day}/${safeName}`;
  }

  /**
   * 构建文件URL
   */
  private buildFileUrl(key: string): string {
    const config = this.storageService.getConfig();
    const protocol = config.useSSL ? 'https' : 'http';
    return `${protocol}://${config.endpoint}:${config.port}/${config.bucketName}/${key}`;
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 根据文件扩展名获取分类
   */
  private getCategoryByExtension(extension: string): FileCategory {
    const ext = extension.toLowerCase();

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    const documentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
    const codeExts = ['js', 'ts', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'html', 'css', 'json'];

    if (imageExts.includes(ext)) return FileCategory.IMAGE;
    if (videoExts.includes(ext)) return FileCategory.VIDEO;
    if (audioExts.includes(ext)) return FileCategory.AUDIO;
    if (documentExts.includes(ext)) return FileCategory.DOCUMENT;
    if (archiveExts.includes(ext)) return FileCategory.ARCHIVE;
    if (codeExts.includes(ext)) return FileCategory.CODE;

    return FileCategory.OTHER;
  }

  /**
   * 记录上传日志
   */
  private async logUploadAction(
    sessionId: string | null,
    fileId: string | null,
    action: string,
    status: string,
    userId: string,
    metadata?: any,
  ): Promise<void> {
    try {
      await this.prisma.uploadLog.create({
        data: {
          sessionId,
          fileId,
          action,
          status,
          userId,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });
    } catch (error) {
      this.logger.warn(`记录上传日志失败: ${action}`);
    }
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.uploadSession.updateMany({
      where: {
        status: { in: ['PENDING', 'UPLOADING'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`清理过期上传会话: ${result.count} 个`);
    }

    return result.count;
  }
}
