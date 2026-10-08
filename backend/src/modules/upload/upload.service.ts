import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { MulterFile } from './interfaces/multer-file.interface';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { ImageService } from '../image/image.service';
import { VirusScannerService } from './security/virus-scanner.service';
import { UploadSecurityService } from './security/upload-security.service';
import { ConfigService as SysConfigService } from '../config/config.service';
import {
  CheckFileExistsDto,
  FileExistsResult,
} from './dto/check-file-exists.dto';
import { InitUploadDto, InitUploadResult } from './dto/init-upload.dto';
import { UploadChunkResult } from './dto/upload-chunk.dto';
import {
  CompleteUploadDto,
  CompleteUploadResult,
} from './dto/complete-upload.dto';
import { SingleFileUploadResult } from './dto/single-file-upload.dto';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * 分片信息接口
 */
interface ChunkInfo {
  index: number;
  md5: string;
  size: number;
  uploadedAt: Date;
}

/**
 * 上传配置
 */
export interface UploadConfig {
  chunkSize: number;
  sessionExpireMinutes: number;
}

/**
 * 上传服务
 * 提供文件上传、分片上传、秒传等功能
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly config: UploadConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly localStorageService: LocalStorageService,
    private readonly imageService: ImageService,
    private readonly virusScanner: VirusScannerService,
    private readonly securityService: UploadSecurityService,
    private readonly sysConfigService: SysConfigService,
  ) {
    this.config = {
      chunkSize: this.configService.get<number>('UPLOAD_CHUNK_SIZE', 10485760), // 10MB（参照7DL优化配置）
      sessionExpireMinutes: this.configService.get<number>(
        'UPLOAD_SESSION_EXPIRE_MINUTES',
        1440,
      ), // 24小时
    };
  }

  /**
   * 检查文件是否存在（秒传检查）
   * @param dto 检查参数
   * @param userId 用户ID
   * @returns 检查结果
   */
  async checkFileExists(
    dto: CheckFileExistsDto,
    userId: string,
  ): Promise<FileExistsResult> {
    try {
      // 查找相同MD5的文件（不限制文件夹，实现跨文件夹秒传）
      const existingFile = await this.prisma.file.findFirst({
        where: {
          md5: dto.md5,
          uploadedBy: userId,
          deletedAt: null,
        },
      });

      if (existingFile) {
        return {
          exists: true,
          fileId: existingFile.id,
          url: existingFile.url,
          message: '文件已存在，可使用秒传',
        };
      }

      // 检查是否有其他用户上传的相同文件（公共文件）
      const publicFile = await this.prisma.file.findFirst({
        where: {
          md5: dto.md5,
          access: 'PUBLIC',
          deletedAt: null,
        },
      });

      if (publicFile) {
        return {
          exists: true,
          fileId: publicFile.id,
          url: publicFile.url,
          message: '公共文件已存在，可使用秒传',
        };
      }

      return {
        exists: false,
        message: '文件不存在，需要上传',
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`检查文件存在性失败: ${err.message}`, err.stack);
      throw new InternalServerErrorException('检查文件存在性失败');
    }
  }

  /**
   * 初始化上传会话
   * @param dto 初始化参数
   * @param userId 用户ID
   * @returns 会话信息
   */
  async initUpload(
    dto: InitUploadDto,
    userId: string,
  ): Promise<InitUploadResult> {
    // 🔑 调试日志：确认前端传递的 folderId
    this.logger.log(`[initUpload] 收到上传请求: fileName=${dto.fileName}, folderId=${dto.folderId || 'undefined'}, storageMode=${dto.storageMode}`);
    
    // 获取文件扩展名（如果未提供，从文件名中提取）
    const extension = dto.extension || dto.fileName.split('.').pop() || '';
    
    // ========== 安全验证（读取数据库配置） ==========
    const securityValidation = await this.securityService.validateUpload(
      dto.fileSize,
      extension,
      userId,
      dto.fileName,
    );
    
    if (!securityValidation.valid) {
      throw new BadRequestException(securityValidation.reason || '文件验证失败');
    }
    // ========== 安全验证结束 ==========

    // 获取MD5值（支持md5和fileMd5两种字段名）
    const fileMd5 = dto.md5 || dto.fileMd5 || '';
    
    // 检查秒传
    this.logger.log(`[秒传检查] MD5: ${fileMd5}, userId: ${userId}`);
    const existsCheck = await this.checkFileExists(
      { md5: fileMd5 },
      userId,
    );
    this.logger.log(`[秒传检查] 结果: exists=${existsCheck.exists}, fileId=${existsCheck.fileId}`);

    // 秒传：文件已存在
    if (existsCheck.exists && existsCheck.fileId) {
      // 🔑 修复：秒传时需要检查是否指定了不同的文件夹
      // 如果用户指定了 folderId，需要创建一个新的文件记录关联到该文件夹
      const existingFile = await this.prisma.file.findUnique({
        where: { id: existsCheck.fileId },
      });

      if (existingFile) {
        // 如果指定了不同的文件夹，创建一个新的文件记录（引用相同的存储对象）
        if (dto.folderId && dto.folderId !== existingFile.folderId) {
          this.logger.log(`[秒传] 创建文件引用到新文件夹: folderId=${dto.folderId}`);
          const newFile = await this.prisma.file.create({
            data: {
              name: existingFile.name,
              originalName: existingFile.originalName,
              size: existingFile.size,
              mimeType: existingFile.mimeType,
              extension: existingFile.extension,
              storageType: existingFile.storageType,
              bucket: existingFile.bucket,
              path: existingFile.path,
              url: existingFile.url,
              md5: existingFile.md5,
              thumbnailUrl: existingFile.thumbnailUrl,
              access: existingFile.access,
              folderId: dto.folderId,
              uploadedBy: userId,
            },
          });
          
          return {
            exists: true,
            fileId: newFile.id,
            fileUrl: newFile.url,
            sessionId: '',
            chunkSize: 0,
            chunkCount: 0,
            uploadedChunks: [],
            status: 'COMPLETED',
          };
        }
        
        // 文件夹相同或未指定文件夹，直接返回已存在的文件
        return {
          exists: true,
          fileId: existsCheck.fileId,
          fileUrl: existsCheck.url,
          sessionId: '',
          chunkSize: 0,
          chunkCount: 0,
          uploadedChunks: [],
          status: 'COMPLETED',
        };
      }
    }

    // 计算分片信息
    const chunkSize = dto.chunkSize || this.config.chunkSize;
    const chunkCount = Math.ceil(dto.fileSize / chunkSize);

    try {
      // 检查是否存在未完成的上传会话（仅当MD5不为空时才查找）
      let existingSession = null;
      if (fileMd5) {
        existingSession = await this.prisma.uploadSession.findFirst({
          where: {
            fileMd5: fileMd5,
            uploadedBy: userId,
            status: { in: ['PENDING', 'UPLOADING'] },
          },
        });
      }

      if (existingSession) {
        // 解析已上传的分片信息
        const uploadedChunks: number[] = [];
        if (existingSession.chunks) {
          const chunks = existingSession.chunks as unknown as ChunkInfo[];
          uploadedChunks.push(...chunks.map((c) => c.index));
        }

        return {
          sessionId: existingSession.id,
          chunkSize: existingSession.chunkSize,
          chunkCount: existingSession.chunkCount,
          uploadedChunks,
          status: existingSession.status,
        };
      }

      // 确定存储类型
      const storageType = dto.storageMode === 'local' ? 'LOCAL' : 'RUSTFS';

      // 创建新的上传会话
      const session = await this.prisma.uploadSession.create({
        data: {
          fileName: dto.fileName,
          fileSize: BigInt(dto.fileSize),
          fileMd5: fileMd5,
          mimeType: dto.mimeType,
          extension: extension,
          chunkSize,
          chunkCount,
          uploadedChunks: 0,
          chunks: [] as any,
          status: 'PENDING',
          storageType: storageType,
          folderId: dto.folderId,
          uploadedBy: userId,
          bucket: this.storageService.getBucketName(),
          expiresAt: new Date(
            Date.now() + this.config.sessionExpireMinutes * 60 * 1000,
          ),
        },
      });

      return {
        sessionId: session.id,
        chunkSize: session.chunkSize,
        chunkCount: session.chunkCount,
        uploadedChunks: [],
        status: session.status,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`初始化上传会话失败: ${err.message}`, err.stack);
      throw new InternalServerErrorException('初始化上传会话失败');
    }
  }

  /**
   * 上传分片
   * @param sessionId 会话ID
   * @param chunkIndex 分片索引
   * @param chunkMd5 分片MD5
   * @param buffer 分片数据
   * @param userId 用户ID
   * @returns 上传结果
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkMd5: string,
    buffer: Buffer,
    userId: string,
  ): Promise<UploadChunkResult> {
    // 查找上传会话
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        uploadedBy: userId,
      },
    });

    if (!session) {
      throw new NotFoundException('上传会话不存在');
    }

    if (session.status === 'COMPLETED') {
      throw new ConflictException('上传会话已完成');
    }

    if (session.status === 'EXPIRED') {
      throw new ConflictException('上传会话已过期');
    }

    // 验证分片索引
    if (chunkIndex < 0 || chunkIndex >= session.chunkCount) {
      throw new BadRequestException('无效的分片索引');
    }

    // 验证分片大小
    const expectedSize =
      chunkIndex === session.chunkCount - 1
        ? Number(session.fileSize) - chunkIndex * session.chunkSize
        : session.chunkSize;

    if (buffer.length !== expectedSize) {
      throw new BadRequestException('分片大小不匹配');
    }

    // 验证分片MD5（如果提供了chunkMd5）
    const actualMd5 = crypto.createHash('md5').update(buffer).digest('hex');
    if (chunkMd5 && chunkMd5 !== actualMd5) {
      this.logger.warn(`分片MD5不匹配: 期望=${chunkMd5}, 实际=${actualMd5}`);
      // 暂时只记录警告，不阻止上传
      // throw new BadRequestException('分片MD5校验失败');
    }

    try {
      // 参照7DL：将分片保存到本地临时目录，而不是RUSTFS
      // 这样可以避免分片永久存储在服务器上，合并后立即清理
      const tempDir = path.join('/tmp', 'uploads', sessionId);
      await fs.mkdir(tempDir, { recursive: true });
      
      const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
      await fs.writeFile(chunkPath, buffer);
      
      this.logger.debug(`分片已保存到临时目录: ${chunkPath}`);

      // 更新会话状态
      const chunks = (session.chunks as unknown as ChunkInfo[]) || [];
      const existingIndex = chunks.findIndex((c) => c.index === chunkIndex);

      if (existingIndex >= 0) {
        chunks[existingIndex] = {
          index: chunkIndex,
          md5: chunkMd5,
          size: buffer.length,
          uploadedAt: new Date(),
        };
      } else {
        chunks.push({
          index: chunkIndex,
          md5: chunkMd5,
          size: buffer.length,
          uploadedAt: new Date(),
        });
      }

      const updatedSession = await this.prisma.uploadSession.update({
        where: { id: sessionId },
        data: {
          chunks: chunks as any,
          uploadedChunks: chunks.length,
          status:
            chunks.length === session.chunkCount ? 'UPLOADING' : 'UPLOADING',
        },
      });

      return {
        chunkIndex,
        success: true,
        uploadedChunks: updatedSession.uploadedChunks,
        totalChunks: session.chunkCount,
        message: '分片上传成功',
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`上传分片失败: ${err.message}`, err.stack);
      throw new InternalServerErrorException('上传分片失败');
    }
  }

  /**
   * 完成上传（合并分片）
   * @param dto 完成参数
   * @param userId 用户ID
   * @returns 文件信息
   */
  async completeUpload(
    dto: CompleteUploadDto,
    userId: string,
  ): Promise<CompleteUploadResult> {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: dto.sessionId,
        uploadedBy: userId,
      },
    });

    if (!session) {
      throw new NotFoundException('上传会话不存在');
    }

    if (session.status === 'COMPLETED') {
      throw new ConflictException('上传会话已完成');
    }

    // 检查是否所有分片都已上传
    if (session.uploadedChunks < session.chunkCount) {
      throw new BadRequestException(
        `分片未上传完成，已上传 ${session.uploadedChunks}/${session.chunkCount}`,
      );
    }

    try {
      // 参照7DL：从本地临时目录读取分片并合并
      const tempDir = path.join('/tmp', 'uploads', session.id);
      const chunks: ChunkInfo[] =
        (session.chunks as unknown as ChunkInfo[]) || [];
      chunks.sort((a, b) => a.index - b.index);

      const buffers: Buffer[] = [];
      for (let i = 0; i < session.chunkCount; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        const chunkBuffer = await fs.readFile(chunkPath);
        buffers.push(chunkBuffer);
      }

      let fileBuffer = Buffer.concat(buffers);
      let uploadMimeType = session.mimeType;
      let uploadExtension = session.extension || '';

      // ========== 图片压缩（参照uploadSingleFile） ==========
      const compress = dto.compress !== false; // 默认为true
      if (compress && this.imageService.isSupportedImageType(session.mimeType)) {
        try {
          const compressionConfig = await this.sysConfigService.getCompressionConfig();
          const thresholdBytes = compressionConfig.threshold * 1024 * 1024;
          if (fileBuffer.length > thresholdBytes) {
            const compressResult = await this.imageService.compressImage(
              fileBuffer,
              {
                quality: compressionConfig.quality,
                maxWidth: compressionConfig.maxWidth,
                maxHeight: compressionConfig.maxHeight,
              },
            );
            fileBuffer = Buffer.from(compressResult.buffer);
            uploadMimeType = `image/${compressResult.format}`;
            uploadExtension = compressResult.format;
            this.logger.log(
              `分片上传图片已压缩: ${session.fileName}, 原始大小: ${buffers.reduce((sum, b) => sum + b.length, 0)}, 压缩后: ${compressResult.size}, 格式: ${compressResult.format}`,
            );
          } else {
            this.logger.log(
              `分片上传图片未压缩（小于阈值）: ${session.fileName}, 大小: ${fileBuffer.length}, 阈值: ${thresholdBytes}`,
            );
          }
        } catch (error: unknown) {
          const err = error as Error;
          this.logger.warn(`分片上传图片压缩失败，使用原始文件: ${err.message}`);
        }
      } else if (!compress && this.imageService.isSupportedImageType(session.mimeType)) {
        this.logger.log(`分片上传图片压缩已关闭: ${session.fileName}`);
      }

      // 验证文件MD5（参照7DL项目：如果前端提供了MD5则验证，否则使用服务器计算值）
      // 注意：压缩后MD5会变化，使用压缩后的buffer计算
      const serverMd5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
      let fileMd5 = serverMd5;
      
      if (session.fileMd5 && session.fileMd5.trim() !== '') {
        if (serverMd5.toLowerCase() !== session.fileMd5.toLowerCase()) {
          this.logger.warn(`文件MD5不匹配: 前端=${session.fileMd5}, 服务器=${serverMd5}`);
          // 参照7DL：只记录警告，使用服务器计算的MD5
        }
        fileMd5 = serverMd5; // 使用服务器计算的MD5
      } else {
        this.logger.log(`前端未提供MD5，使用服务器计算值: ${serverMd5}`);
      }

      // ========== 解析文件夹和存储路径 ==========
      // 未指定 folderId 时，自动关联到用户根个人文件夹
      let effectiveFolderId: string | null = session.folderId;
      if (!effectiveFolderId) {
        effectiveFolderId = (await this.getUserRootPersonalFolderId(userId)) ?? null;
        if (effectiveFolderId) {
          this.logger.log(`[completeUpload] 自动关联到用户根个人文件夹: ${effectiveFolderId}`);
        }
      }

      // 解析存储路径（递归查找 realFolder 映射 + 追加日期）
      const basePath = await this.resolveBasePath(effectiveFolderId, userId);

      // 生成文件存储路径
      const encodedFileName = encodeURIComponent(session.fileName);
      const fileKey = `${basePath}/${fileMd5}_${encodedFileName}`;

      // 根据存储类型选择上传方式
      let fileUrl: string;
      const serverBaseUrl = this.configService.get<string>('SERVER_BASE_URL', 'http://localhost:6520');
      const isLocalStorage = session.storageType === 'LOCAL';

      if (isLocalStorage) {
        // 本地存储
        await this.localStorageService.uploadFile(fileBuffer, fileKey);
        fileUrl = `${serverBaseUrl}/uploads/${fileKey}`;
        this.logger.log(`分片合并文件已上传到本地存储: ${fileKey}`);
      } else {
        // RUSTFS存储（使用压缩后的mimeType）
        fileUrl = await this.storageService.upload(
          fileBuffer,
          fileKey,
          uploadMimeType,
        );
        this.logger.log(`分片合并文件已上传到RUSTFS: ${fileKey}`);
      }

      // ========== 生成图片缩略图（参照uploadSingleFile） ==========
      const generateThumbnail = dto.generateThumbnail !== false; // 默认为true
      let thumbnailUrl: string | null = null;
      if (generateThumbnail && this.imageService.isSupportedImageType(session.mimeType)) {
        try {
          const thumbnailConfig = await this.sysConfigService.getThumbnailConfig();
          const thumbnailResult = await this.imageService.generateThumbnail(
            fileBuffer,
            { quality: thumbnailConfig.quality },
          );
          // 缩略图与原图在同一文件夹（根目录 = 存储桶根目录）
          const thumbnailPath = basePath
            ? `${basePath}/${fileMd5}_thumb.jpg`
            : `${fileMd5}_thumb.jpg`;
          
          if (isLocalStorage) {
            // 本地存储缩略图
            await this.localStorageService.uploadFile(thumbnailResult.buffer, thumbnailPath);
            thumbnailUrl = `${serverBaseUrl}/uploads/${thumbnailPath}`;
          } else {
            // RUSTFS存储缩略图
            thumbnailUrl = await this.storageService.upload(
              thumbnailResult.buffer,
              thumbnailPath,
              'image/jpeg',
            );
          }
          this.logger.log(`缩略图已生成: ${session.fileName} -> ${thumbnailPath}, 配置: quality=${thumbnailConfig.quality}`);
        } catch (thumbError: unknown) {
          const err = thumbError as Error;
          this.logger.warn(`生成缩略图失败: ${err.message}`);
        }
      } else if (!generateThumbnail && this.imageService.isSupportedImageType(session.mimeType)) {
        this.logger.log(`分片上传缩略图生成已关闭: ${session.fileName}`);
      }

      // 创建文件记录（使用压缩后的mimeType、extension和size）
      const fileName = dto.fileName || session.fileName;
      const file = await this.prisma.file.create({
        data: {
          name: fileName,
          originalName: session.fileName,
          mimeType: uploadMimeType,
          extension: uploadExtension,
          size: fileBuffer.length, // 使用压缩后的大小
          md5: fileMd5,
          storageType: session.storageType,
          bucket: this.storageService.getBucketName(),
          path: fileKey,
          url: fileUrl,
          thumbnailUrl,
          access: 'PRIVATE',
          folderId: effectiveFolderId,
          uploadedBy: userId,
          status: 'ACTIVE',
        },
      });

      // ========== 异步病毒扫描（参照7DL项目，不阻塞返回） ==========
      // 将文件buffer复制一份用于异步扫描，避免被垃圾回收
      const scanBuffer = Buffer.from(fileBuffer);
      this.performAsyncVirusScan(
        file.id,
        scanBuffer,
        session.fileName,
        session.extension || '',
        userId,
      ).catch((err) => {
        this.logger.error(`异步病毒扫描失败: ${err.message}`, err.stack);
      });
      // ========== 扫描触发完成（异步执行中） ==========

      // 更新会话状态
      await this.prisma.uploadSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          fileKey,
        },
      });

      // 参照7DL：清理本地临时分片目录
      await fs.rm(tempDir, { recursive: true, force: true });
      this.logger.log(`临时分片目录已清理: ${tempDir}`);

      return {
        fileId: file.id,
        fileName: file.name,
        url: file.url,
        size: Number(file.size),
        mimeType: file.mimeType,
        uploadedAt: file.createdAt,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`完成上传失败: ${err.message}`, err.stack);
      throw new InternalServerErrorException('完成上传失败');
    }
  }

  /**
   * 取消上传
   * @param sessionId 会话ID
   * @param userId 用户ID
   */
  async cancelUpload(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        uploadedBy: userId,
      },
    });

    if (!session) {
      throw new NotFoundException('上传会话不存在');
    }

    if (session.status === 'COMPLETED') {
      throw new ConflictException('上传会话已完成，无法取消');
    }

    try {
      // 参照7DL：清理本地临时分片目录
      const tempDir = path.join('/tmp', 'uploads', sessionId);
      await fs.rm(tempDir, { recursive: true, force: true });
      this.logger.log(`取消上传，临时分片目录已清理: ${tempDir}`);

      // 更新会话状态
      await this.prisma.uploadSession.update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`取消上传失败: ${err.message}`, err.stack);
    }
  }

  /**
   * 生成日期路径后缀
   */
  private getDateSuffix(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  }

  /**
   * 解析文件夹的存储基础路径（递归查找 realFolder 映射）
   * 1. 当前文件夹有 realFolder 映射 → 使用其 pathName
   * 2. 否则递归向上查找父文件夹的映射
   * 3. 都没有 → fallback 到 user/{username}
   * 4. 最终统一追加 /yyyy/mm/dd
   */
  private async resolveBasePath(
    folderId: string | undefined | null,
    userId: string,
    realFolderId?: string,
  ): Promise<string> {
    let prefix = '';

    // 优先使用 realFolderId 直接查找物理文件夹路径
    if (realFolderId) {
      const realFolder = await this.prisma.realFolder.findUnique({
        where: { id: realFolderId },
        select: { pathName: true },
      });
      if (realFolder) {
        prefix = realFolder.pathName;
      }
    }

    if (!prefix && folderId) {
      prefix = await this.findRealFolderPath(folderId);
    }

    // fallback: user/{username}
    if (!prefix) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      prefix = `user/${user?.username || 'unknown'}`;
    }

    return `${prefix}/${this.getDateSuffix()}`;
  }

  /**
   * 递归向上查找文件夹的 realFolder 映射路径
   */
  private async findRealFolderPath(
    folderId: string,
  ): Promise<string> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: { realFolder: { select: { pathName: true } } },
    });
    if (!folder) return '';
    if (folder.realFolder?.pathName) {
      return folder.realFolder.pathName;
    }
    // 递归查找父文件夹
    if (folder.parentId) {
      return this.findRealFolderPath(folder.parentId);
    }
    return '';
  }

  /**
   * 获取用户的根个人文件夹ID
   * 如果用户没有个人文件夹，返回 undefined
   */
  private async getUserRootPersonalFolderId(
    userId: string,
  ): Promise<string | undefined> {
    const rootFolder = await this.prisma.folder.findFirst({
      where: {
        createdBy: userId,
        parentId: null,
        isSystemShared: false,
        deletedAt: null,
      },
    });
    return rootFolder?.id;
  }

  /**
   * 生成默认存储路径（无真实文件夹映射时使用）
   * 格式: user/{username}/yyyy/mm/dd/
   * @deprecated 使用 resolveBasePath 替代
   */
  private async generateDefaultBasePath(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const username = user?.username || 'unknown';
    return `user/${username}/${this.getDateSuffix()}`;
  }

  /**
   * 修复multer文件名编码问题
   * multer在处理multipart/form-data时，文件名可能被错误编码
   * @param filename 原始文件名
   * @returns 正确编码的文件名
   */
  private fixFilenameEncoding(filename: string): string {
    try {
      // 尝试将Latin-1编码的字符串转换为UTF-8
      return Buffer.from(filename, 'latin1').toString('utf8');
    } catch {
      return filename;
    }
  }

  /**
   * 单文件上传（小文件，不分片）
   * @param file 文件
   * @param folderId 文件夹ID
   * @param storageMode 存储模式
   * @param userId 用户ID
   * @returns 上传结果
   */
  async uploadSingleFile(
    file: MulterFile,
    folderId: string | undefined,
    storageMode: 'rustfs' | 'local' | undefined,
    userId: string,
    compress: boolean = true,
    generateThumbnail: boolean = true,
    realFolderId?: string,
    source?: 'upload' | 'editor',
  ): Promise<SingleFileUploadResult> {
    const serverBaseUrl = this.configService.get<string>('SERVER_BASE_URL', 'http://localhost:6520');
    // 修复文件名编码问题
    const originalName = this.fixFilenameEncoding(file.originalname);
    const extension = path.extname(originalName).slice(1) || 'unknown';

    // ========== 安全验证（读取数据库配置） ==========
    const securityValidation = await this.securityService.validateUpload(
      file.size,
      extension,
      userId,
      originalName,
    );
    
    if (!securityValidation.valid) {
      throw new BadRequestException(securityValidation.reason || '文件验证失败');
    }
    // ========== 安全验证结束 ==========

    // 计算文件MD5
    const fileMd5 = crypto.createHash('md5').update(file.buffer).digest('hex');

    // 检查秒传
    const existsCheck = await this.checkFileExists(
      { md5: fileMd5, folderId },
      userId,
    );

    if (existsCheck.exists && existsCheck.fileId) {
      // 创建文件引用记录
      const existingFile = await this.prisma.file.findUnique({
        where: { id: existsCheck.fileId },
      });

      if (existingFile) {
        const newFile = await this.prisma.file.create({
          data: {
            name: originalName,
            originalName: originalName,
            mimeType: file.mimetype,
            extension: path.extname(originalName).slice(1) || 'unknown',
            size: file.size,
            md5: fileMd5,
            storageType: existingFile.storageType,
            bucket: existingFile.bucket,
            path: existingFile.path,
            url: existingFile.url,
            access: 'PRIVATE',
            folderId,
            uploadedBy: userId,
            source: source === 'editor' ? 'EDITOR' : 'UPLOAD',
          },
        });

        const proxyUrl = `${serverBaseUrl}/api/v1/public/files/${newFile.id}/preview`;
        return {
          fileId: newFile.id,
          fileName: newFile.name,
          originalName: newFile.originalName,
          url: proxyUrl,
          size: Number(newFile.size),
          mimeType: newFile.mimeType,
          extension: newFile.extension,
          isRapidUpload: true,
          uploadedAt: newFile.createdAt,
        };
      }
    }

    // 正常上传
    let uploadBuffer = file.buffer;
    let uploadMimeType = file.mimetype;
    let uploadExtension = path.extname(originalName).slice(1) || 'unknown';

    // 如果开启压缩且是图片，进行压缩处理（从配置读取压缩参数）
    if (compress && this.imageService.isSupportedImageType(file.mimetype)) {
      try {
        // 从配置服务获取压缩参数
        const compressionConfig = await this.sysConfigService.getCompressionConfig();
        const thresholdBytes = compressionConfig.threshold * 1024 * 1024; // MB转字节
        
        // 只有文件大小超过阈值才压缩
        if (file.size > thresholdBytes) {
          const compressResult = await this.imageService.compressImage(
            file.buffer,
            {
              quality: compressionConfig.quality,
              maxWidth: compressionConfig.maxWidth,
              maxHeight: compressionConfig.maxHeight,
            },
          );
          uploadBuffer = compressResult.buffer;
          uploadMimeType = `image/${compressResult.format}`;
          uploadExtension = compressResult.format;
          this.logger.log(
            `图片已压缩: ${originalName}, 原始大小: ${file.size}, 压缩后: ${compressResult.size}, 配置: quality=${compressionConfig.quality}, maxWidth=${compressionConfig.maxWidth}, maxHeight=${compressionConfig.maxHeight}`,
          );
        } else {
          this.logger.log(
            `图片未压缩（小于阈值）: ${originalName}, 大小: ${file.size}, 阈值: ${thresholdBytes}`,
          );
        }
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.warn(`图片压缩失败，使用原始文件: ${err.message}`);
      }
    } else if (!compress && this.imageService.isSupportedImageType(file.mimetype)) {
      this.logger.log(`图片压缩已关闭: ${originalName}`);
    }

    // 确定存储类型，默认为RUSTFS
    const actualStorageMode = storageMode || 'rustfs';
    const storageTypeValue = actualStorageMode === 'local' ? 'LOCAL' : 'RUSTFS';

    // 未指定 folderId 时，自动关联到用户根个人文件夹
    // 当传入 realFolderId 时，不设置 folderId，仅用于存储路径解析
    let effectiveFolderId = folderId;
    if (!effectiveFolderId && !realFolderId) {
      effectiveFolderId = await this.getUserRootPersonalFolderId(userId);
      if (effectiveFolderId) {
        this.logger.log(`[uploadSingleFile] 自动关联到用户根个人文件夹: ${effectiveFolderId}`);
      }
    }

    // 解析存储路径（优先使用 realFolderId，否则递归查找 realFolder 映射）
    const basePath = await this.resolveBasePath(
      effectiveFolderId, userId, realFolderId,
    );

    // 生成文件存储路径
    const encodedFileName = encodeURIComponent(originalName);
    const fileKey = `${basePath}/${fileMd5}_${encodedFileName}`;

    // 根据存储模式选择上传方式
    let fileUrl: string;
    
    if (actualStorageMode === 'local') {
      // 本地存储
      const localPath = await this.localStorageService.uploadFile(uploadBuffer, fileKey);
      fileUrl = `${serverBaseUrl}/uploads/${fileKey}`;
      this.logger.log(`文件已上传到本地存储: ${localPath}`);
    } else {
      // RUSTFS存储
      fileUrl = await this.storageService.upload(
        uploadBuffer,
        fileKey,
        uploadMimeType,
      );
      this.logger.log(`文件已上传到RUSTFS: ${fileKey}`);
    }

    // 生成缩略图（仅图片，且开关开启时）
    let thumbnailUrl: string | null = null;
    if (generateThumbnail && this.imageService.isSupportedImageType(file.mimetype)) {
      try {
        // 从配置获取缩略图参数（imageService.generateThumbnail内部会读取宽高配置）
        const thumbnailConfig = await this.sysConfigService.getThumbnailConfig();
        const thumbnailResult = await this.imageService.generateThumbnail(
          file.buffer,
          { quality: thumbnailConfig.quality },
        );
        // 缩略图与原图在同一文件夹（根目录 = 存储桶根目录）
        const thumbnailPath = basePath
          ? `${basePath}/${fileMd5}_thumb.jpg`
          : `${fileMd5}_thumb.jpg`;
        
        if (actualStorageMode === 'local') {
          // 本地存储缩略图
          await this.localStorageService.uploadFile(thumbnailResult.buffer, thumbnailPath);
          thumbnailUrl = `${serverBaseUrl}/uploads/${thumbnailPath}`;
        } else {
          // RUSTFS存储缩略图
          thumbnailUrl = await this.storageService.upload(
            thumbnailResult.buffer,
            thumbnailPath,
            'image/jpeg',
          );
        }
        this.logger.log(`缩略图已生成: ${originalName} -> ${thumbnailPath}, 配置: width=${thumbnailConfig.width}, height=${thumbnailConfig.height}, quality=${thumbnailConfig.quality}`);
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.warn(`生成缩略图失败: ${err.message}`);
      }
    } else if (!generateThumbnail && this.imageService.isSupportedImageType(file.mimetype)) {
      this.logger.log(`缩略图生成已关闭: ${originalName}`);
    }

    const newFile = await this.prisma.file.create({
      data: {
        name: originalName,
        originalName: originalName,
        mimeType: uploadMimeType,
        extension: uploadExtension,
        size: uploadBuffer.length,
        md5: fileMd5,
        storageType: storageTypeValue,
        bucket: this.storageService.getBucketName(),
        path: fileKey,
        url: fileUrl,
        thumbnailUrl,
        access: 'PRIVATE',
        folderId: effectiveFolderId,
        uploadedBy: userId,
        source: source === 'editor' ? 'EDITOR' : 'UPLOAD',
      },
    });

    // ========== 异步病毒扫描
    // 将文件buffer复制一份用于异步扫描，避免被垃圾回收
    const scanBuffer = Buffer.from(uploadBuffer);
    this.performAsyncVirusScan(
      newFile.id,
      scanBuffer,
      originalName,
      uploadExtension,
      userId,
    ).catch((err) => {
      this.logger.error(`异步病毒扫描失败: ${err.message}`, err.stack);
    });
    // ========== 扫描触发完成（异步执行中） ==========

    // 返回代理URL，解决RUSTFS跨域/网络不可达问题
    const proxyUrl = `${serverBaseUrl}/api/v1/public/files/${newFile.id}/preview`;
    return {
      fileId: newFile.id,
      fileName: newFile.name,
      originalName: newFile.originalName,
      url: proxyUrl,
      size: Number(newFile.size),
      mimeType: newFile.mimeType,
      extension: newFile.extension,
      isRapidUpload: false,
      uploadedAt: newFile.createdAt,
    };
  }

  /**
   * 获取上传配置
   * @returns 上传配置
   */
  getUploadConfig(): UploadConfig {
    return { ...this.config };
  }

  /**
   * 清理分片
   * @param sessionId 会话ID
   * @param chunks 分片信息
   */
  private async cleanupChunks(
    sessionId: string,
    chunks: ChunkInfo[],
  ): Promise<void> {
    for (const chunk of chunks) {
      try {
        const chunkKey = `chunks/${sessionId}/${chunk.index}`;
        await this.storageService.delete(chunkKey);
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.warn(`清理分片失败: ${err.message}`);
      }
    }
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化后的字符串
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
   * 异步执行病毒扫描（参照7DL项目实现）
   * 不阻塞上传返回，在后台执行扫描
   * @param fileId 文件ID
   * @param fileBuffer 文件内容
   * @param fileName 文件名
   * @param fileExtension 文件扩展名
   * @param userId 用户ID
   */
  private async performAsyncVirusScan(
    fileId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileExtension: string,
    userId: string,
  ): Promise<void> {
    // 智能扫描策略：媒体文件跳过扫描
    const skipScanExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'tif',
      'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v',
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
    ];
    const fileExt = fileExtension.toLowerCase();

    // 检查病毒扫描是否启用
    const securityConfig = await this.securityService.getSecurityConfig();
    if (!securityConfig.enableVirusScan) {
      this.logger.log(`⏭️ 病毒扫描已禁用，跳过扫描: ${fileName}`);
      return;
    }

    if (skipScanExtensions.includes(fileExt)) {
      this.logger.log(`⏭️ 媒体文件无需扫描: ${fileName}`);
      return;
    }

    this.logger.log(`🔍 开始异步病毒扫描: ${fileName} (fileId=${fileId})`);

    // 创建临时文件进行扫描
    const tempDir = `/tmp/scan_${Date.now()}_${fileId}`;
    const tempFilePath = `${tempDir}/${fileName}`;

    try {
      // 创建临时目录
      await fs.mkdir(tempDir, { recursive: true });
      // 写入临时文件
      await fs.writeFile(tempFilePath, fileBuffer);

      // 执行病毒扫描
      const scanResult = await this.virusScanner.scanFile(tempFilePath);

      if (scanResult.isClean) {
        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            virusScanResult: 'clean',
            virusScanAt: new Date(),
            status: 'ACTIVE',
          },
        });
        this.logger.log(`✅ 异步病毒扫描通过: ${fileName} (${scanResult.scanTime}ms)`);
      } else {
        this.logger.warn(`⚠️ 检测到潜在威胁: ${fileName} - ${scanResult.threats.join(', ')}`);

        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            virusScanResult: `threat_detected:${scanResult.threats.join(',')}`,
            virusScanAt: new Date(),
            status: 'THREAT_DETECTED',
          },
        });

        // 记录安全日志
        await this.securityService.logSecurityEvent({
          type: 'VIRUS_DETECTED',
          userId,
          fileId,
          fileName,
          details: `检测到潜在威胁（待审核）: ${scanResult.threats.join(', ')}`,
          metadata: { threats: scanResult.threats, scanTime: scanResult.scanTime },
          severity: 'WARNING',
          timestamp: new Date(),
        });
      }
    } catch (scanError: any) {
      this.logger.error(`异步病毒扫描失败: ${fileName}`, scanError);

      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          virusScanResult: `scan_failed:${scanError.message}`,
          virusScanAt: new Date(),
        },
      });
    } finally {
      // 清理临时文件
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        this.logger.log(`🧹 清理临时扫描文件: ${tempDir}`);
      } catch (cleanError) {
        this.logger.warn(`清理临时文件失败: ${cleanError}`);
      }
    }
  }
}
