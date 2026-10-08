import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import * as https from 'https';
import * as http from 'http';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { ConfigService } from '@nestjs/config';
import { SharePermission } from '@prisma/client';
import { FolderPermissionService } from './folder-permission.service';
import { FolderService } from './folder.service';
import {
  FileFilterDto,
  PaginationMeta,
  FileSortField,
  SortDirection,
  StorageMode,
  FolderScope,
} from './dto/file-filter.dto';
import {
  RenameFileDto,
  MoveFileDto,
  BatchMoveFilesDto,
  BatchDeleteFilesDto,
} from './dto/rename-file.dto';

/**
 * 文件信息
 */
export interface FileInfo {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  md5?: string | null;
  url: string;
  thumbnailUrl: string | null;
  folderId: string | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 文件统计信息
 */
export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byExtension: { extension: string; count: number; size: number }[];
}

/**
 * 文件服务
 * 提供文件管理相关功能
 */
@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly localStorageService: LocalStorageService,
    private readonly configService: ConfigService,
    private readonly folderPermissionService: FolderPermissionService,
    @Inject(forwardRef(() => FolderService))
    private readonly folderService: FolderService,
  ) {}

  /**
   * 获取文件列表
   * @param filter 筛选条件
   * @param userId 用户ID
   * @returns 文件列表和分页信息
   */
  async findAll(
    filter: FileFilterDto,
    userId: string,
  ): Promise<{ items: FileInfo[]; meta: PaginationMeta }> {
    const {
      folderId,
      keyword,
      extension,
      sortBy = FileSortField.CREATED_AT,
      sortOrder = SortDirection.DESC,
      page = 1,
      pageSize = 20,
      storageMode,
      folderScope,
    } = filter;

    // 构建查询条件（排除编辑器附件）
    const where: any = { deletedAt: null, source: 'UPLOAD' };

    if (folderScope) {
      // 按文件夹分类范围筛选
      const folderIds = await this.getFolderIdsByScope(
        folderScope,
        userId,
      );
      if (folderScope === FolderScope.PERSONAL) {
        // 个人文件夹：同时包含 folderId=null 的历史文件
        const orConditions: any[] = [];
        if (folderIds.length > 0) {
          orConditions.push({ folderId: { in: folderIds } });
        }
        orConditions.push({ folderId: null, uploadedBy: userId });
        where.OR = orConditions;
      } else if (folderIds.length > 0) {
        where.folderId = { in: folderIds };
      } else {
        // 该分类下没有文件夹，返回空结果
        where.folderId = '__none__';
      }
    } else if (folderId) {
      // 指定文件夹时，检查 VIEW 权限后查询该文件夹所有文件
      await this.folderPermissionService.requirePermission(
        userId,
        folderId,
        SharePermission.VIEW,
      );
      where.folderId = folderId;
    } else {
      // 未指定文件夹时，只显示自己上传的文件（个人视图）
      where.uploadedBy = userId;
    }

    if (keyword) {
      where.name = { contains: keyword, mode: 'insensitive' };
    }

    if (extension) {
      where.extension = extension.toLowerCase();
    }

    // 存储模式筛选
    if (storageMode) {
      where.storageType = storageMode === StorageMode.RUSTFS ? 'RUSTFS' : 'LOCAL';
    }

    // 构建排序

    const orderBy: any = {};

    orderBy[sortBy] = sortOrder;

    // 查询总数

    const total = await this.prisma.file.count({ where });

    // 查询数据，包含文件夹信息
    const files = await this.prisma.file.findMany({
      where,
      include: { folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    // 生成代理URL的基础路径
    const serverBaseUrl = this.configService.get<string>('SERVER_BASE_URL', 'http://localhost:6520');

    return {
      items: files.map((file) => {
        // 所有文件都使用代理URL，以解决URL编码和跨域问题
        let proxyThumbnailUrl = file.thumbnailUrl;
        let proxyUrl = file.url;
        
        if (file.thumbnailUrl) {
          proxyThumbnailUrl = `${serverBaseUrl}/api/v1/public/files/${file.id}/thumbnail`;
        }
        if (file.url) {
          proxyUrl = `${serverBaseUrl}/api/v1/public/files/${file.id}/preview`;
        }

        return {
          id: file.id,
          name: file.name,
          originalName: file.originalName,
          mimeType: file.mimeType,
          extension: file.extension,
          size: Number(file.size),
          path: file.path,
          md5: file.md5,
          url: proxyUrl,
          thumbnailUrl: proxyThumbnailUrl,
          folderId: file.folderId,
          folderName: file.folder?.name || null,
          uploadedBy: file.uploadedBy,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        };
      }),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * 根据文件夹范围获取所有文件夹ID（包含子文件夹）
   */
  private async getFolderIdsByScope(
    scope: FolderScope,
    userId: string,
  ): Promise<string[]> {
    const myFolders = await this.folderService.getMyFolders(userId);

    let rootFolders: any[] = [];
    switch (scope) {
      case FolderScope.PERSONAL:
        rootFolders = myFolders.personal;
        break;
      case FolderScope.SHARED_WITH_ME:
        rootFolders = myFolders.sharedWithMe;
        break;
      case FolderScope.SYSTEM_SHARED:
        rootFolders = myFolders.systemShared;
        break;
    }

    // 递归收集所有文件夹ID（包含子文件夹）
    const ids: string[] = [];
    const collect = (nodes: any[]) => {
      for (const node of nodes) {
        ids.push(node.id);
        if (node.children?.length) {
          collect(node.children);
        }
      }
    };
    collect(rootFolders);
    return ids;
  }

  /**
   * 获取文件详情
   * @param id 文件ID
   * @param userId 用户ID
   * @returns 文件详情
   */
  async findById(id: string, userId: string): Promise<FileInfo> {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 权限检查：文件上传者 或 对所在文件夹有 VIEW 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.VIEW,
      );
    }

    // 所有文件都使用代理URL，以解决URL编码和跨域问题
    const serverBaseUrl = this.configService.get<string>('SERVER_BASE_URL', 'http://localhost:6520');
    let proxyUrl = file.url;
    let proxyThumbnailUrl = file.thumbnailUrl;
    
    if (file.url) {
      proxyUrl = `${serverBaseUrl}/api/v1/public/files/${file.id}/preview`;
    }
    if (file.thumbnailUrl) {
      proxyThumbnailUrl = `${serverBaseUrl}/api/v1/public/files/${file.id}/thumbnail`;
    }

    return {
      id: file.id,
      name: file.name,
      originalName: file.originalName,
      mimeType: file.mimeType,
      extension: file.extension,
      size: Number(file.size),
      md5: file.md5,
      url: proxyUrl,
      thumbnailUrl: proxyThumbnailUrl,
      folderId: file.folderId,
      uploadedBy: file.uploadedBy,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * 重命名文件
   * @param id 文件ID
   * @param dto 重命名信息
   * @param userId 用户ID
   * @returns 更新后的文件信息
   */
  async rename(
    id: string,
    dto: RenameFileDto,
    userId: string,
  ): Promise<FileInfo> {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 权限检查：上传者 或 对文件夹有 EDIT 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.EDIT,
      );
    }

    // 提取扩展名
    const extension =
      dto.name.split('.').pop()?.toLowerCase() || file.extension;
    const name = dto.name;

    const updatedFile = await this.prisma.file.update({
      where: { id },
      data: {
        name,
        extension,
      },
    });

    return {
      id: updatedFile.id,
      name: updatedFile.name,
      originalName: updatedFile.originalName,
      mimeType: updatedFile.mimeType,
      extension: updatedFile.extension,
      size: Number(updatedFile.size),
      url: updatedFile.url,
      thumbnailUrl: updatedFile.thumbnailUrl,
      folderId: updatedFile.folderId,
      uploadedBy: updatedFile.uploadedBy,
      createdAt: updatedFile.createdAt,
      updatedAt: updatedFile.updatedAt,
    };
  }

  /**
   * 移动文件
   * @param id 文件ID
   * @param dto 移动信息
   * @param userId 用户ID
   * @returns 更新后的文件信息
   */
  async move(id: string, dto: MoveFileDto, userId: string): Promise<FileInfo> {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 检查源文件夹 EDIT 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.EDIT,
      );
    }

    // 检查目标文件夹 UPLOAD 权限
    if (dto.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        dto.folderId,
        SharePermission.UPLOAD,
      );

      // 限制：不允许将共享文件夹的文件移到个人文件夹
      if (file.folderId) {
        const sourceRoot =
          await this.folderService.findSharedRootFolderId(file.folderId);
        const targetRoot =
          await this.folderService.findSharedRootFolderId(dto.folderId);
        const sourceFolder = await this.prisma.folder.findUnique({
          where: { id: sourceRoot },
        });
        const isSourceShared =
          sourceFolder?.shareType !== 'NONE' ||
          sourceFolder?.isSystemShared;

        if (isSourceShared && sourceRoot !== targetRoot) {
          const targetFolder = await this.prisma.folder.findUnique({
            where: { id: dto.folderId },
          });
          if (
            targetFolder?.createdBy === userId &&
            !targetFolder?.isSystemShared
          ) {
            throw new BadRequestException(
              '不允许将共享文件夹中的文件移到个人文件夹',
            );
          }
        }
      }
    }

    const updatedFile = await this.prisma.file.update({
      where: { id },
      data: {
        folderId: dto.folderId || null,
      },
    });

    return {
      id: updatedFile.id,
      name: updatedFile.name,
      originalName: updatedFile.originalName,
      mimeType: updatedFile.mimeType,
      extension: updatedFile.extension,
      size: Number(updatedFile.size),
      url: updatedFile.url,
      thumbnailUrl: updatedFile.thumbnailUrl,
      folderId: updatedFile.folderId,
      uploadedBy: updatedFile.uploadedBy,
      createdAt: updatedFile.createdAt,
      updatedAt: updatedFile.updatedAt,
    };
  }

  /**
   * 批量移动文件
   * @param dto 批量移动信息
   * @param userId 用户ID
   * @returns 操作结果
   */
  async batchMove(
    dto: BatchMoveFilesDto,
    userId: string,
  ): Promise<{ success: boolean; movedCount: number; failedIds: string[] }> {
    const { fileIds, folderId } = dto;
    let movedCount = 0;
    const failedIds: string[] = [];

    // 验证目标文件夹权限
    if (folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        folderId,
        SharePermission.UPLOAD,
      );
    }

    // 批量移动
    for (const fileId of fileIds) {
      try {
        const file = await this.prisma.file.findFirst({
          where: {
            id: fileId,
            deletedAt: null,
          },
        });

        if (!file) {
          failedIds.push(fileId);
          continue;
        }

        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            folderId: folderId || null,
          },
        });

        movedCount++;
      } catch (error) {
        this.logger.error(`移动文件失败: ${fileId}`, error);
        failedIds.push(fileId);
      }
    }

    return {
      success: failedIds.length === 0,
      movedCount,
      failedIds,
    };
  }

  /**
   * 复制文件
   * @param id 文件ID
   * @param folderId 目标文件夹ID
   * @param userId 用户ID
   * @returns 复制后的文件信息
   */
  async copy(id: string, folderId: string | undefined, userId: string): Promise<FileInfo> {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 检查源文件 VIEW 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.VIEW,
      );
    }

    // 验证目标文件夹 UPLOAD 权限
    if (folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        folderId,
        SharePermission.UPLOAD,
      );
    }

    // 创建文件副本（数据库记录，共享同一物理文件）
    // md5 必须复制，否则缩略图代理无法计算正确路径
    const newFile = await this.prisma.file.create({
      data: {
        name: `${file.name.replace(/\.[^/.]+$/, '')}_副本.${file.extension}`,
        originalName: file.originalName,
        mimeType: file.mimeType,
        extension: file.extension,
        size: file.size,
        md5: file.md5,
        path: file.path,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
        storageType: file.storageType,
        bucket: file.bucket,
        folderId: folderId || null,
        uploadedBy: userId,
      },
    });

    return {
      id: newFile.id,
      name: newFile.name,
      originalName: newFile.originalName,
      mimeType: newFile.mimeType,
      extension: newFile.extension,
      size: Number(newFile.size),
      url: newFile.url,
      thumbnailUrl: newFile.thumbnailUrl,
      folderId: newFile.folderId,
      uploadedBy: newFile.uploadedBy,
      createdAt: newFile.createdAt,
      updatedAt: newFile.updatedAt,
    };
  }

  /**
   * 批量复制文件
   * @param fileIds 文件ID列表
   * @param folderId 目标文件夹ID
   * @param userId 用户ID
   * @returns 操作结果
   */
  async batchCopy(
    fileIds: string[],
    folderId: string | undefined,
    userId: string,
  ): Promise<{ success: boolean; copiedCount: number; failedIds: string[] }> {
    let copiedCount = 0;
    const failedIds: string[] = [];

    // 验证目标文件夹 UPLOAD 权限
    if (folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        folderId,
        SharePermission.UPLOAD,
      );
    }

    for (const fileId of fileIds) {
      try {
        await this.copy(fileId, folderId, userId);
        copiedCount++;
      } catch (error) {
        this.logger.error(`复制文件失败: ${fileId}`, error);
        failedIds.push(fileId);
      }
    }

    return {
      success: failedIds.length === 0,
      copiedCount,
      failedIds,
    };
  }

  /**
   * 删除文件（软删除）
   * @param id 文件ID
   * @param userId 用户ID
   */
  async delete(id: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 权限检查：上传者 或 对文件夹有 DELETE 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.DELETE,
      );
    }

    await this.prisma.file.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    this.logger.log(`文件已删除: ${id}`);
  }

  /**
   * 批量删除文件
   * @param dto 批量删除信息
   * @param userId 用户ID
   * @returns 操作结果
   */
  async batchDelete(
    dto: BatchDeleteFilesDto,
    userId: string,
  ): Promise<{ success: boolean; deletedCount: number; failedIds: string[] }> {
    const { fileIds } = dto;
    let deletedCount = 0;
    const failedIds: string[] = [];

    for (const fileId of fileIds) {
      try {
        await this.delete(fileId, userId);
        deletedCount++;
      } catch (error) {
        this.logger.error(`删除文件失败: ${fileId}`, error);
        failedIds.push(fileId);
      }
    }

    return {
      success: failedIds.length === 0,
      deletedCount,
      failedIds,
    };
  }

  /**
   * 获取回收站文件列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param userId 用户ID
   * @returns 已删除文件列表
   */
  async findDeleted(
    page: number = 1,
    pageSize: number = 20,
    userId: string,
  ): Promise<{ items: FileInfo[]; meta: PaginationMeta }> {
    // 按文件夹所有权查询：显示用户自己文件夹中被删除的文件
    const where: any = {
      deletedAt: { not: null as any },
      OR: [
        { uploadedBy: userId },
        { folder: { createdBy: userId } },
      ],
    };

    const total = await this.prisma.file.count({ where });

    const files = await this.prisma.file.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: files.map((file) => ({
        id: file.id,
        name: file.name,
        originalName: file.originalName,
        mimeType: file.mimeType,
        extension: file.extension,
        size: Number(file.size),
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
        folderId: file.folderId,
        uploadedBy: file.uploadedBy,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * 恢复已删除文件
   * @param id 文件ID
   * @param userId 用户ID
   */
  async restore(id: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: { not: null },
        OR: [
          { uploadedBy: userId },
          { folder: { createdBy: userId } },
        ],
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在或不在回收站中');
    }

    await this.prisma.file.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });

    this.logger.log(`文件已恢复: ${id}`);
  }

  /**
   * 永久删除文件
   * @param id 文件ID
   * @param userId 用户ID
   */
  async permanentDelete(id: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: { not: null },
        OR: [
          { uploadedBy: userId },
          { folder: { createdBy: userId } },
        ],
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在或不在回收站中');
    }

    // 从数据库中删除记录（先删记录再决定是否删物理文件）
    await this.prisma.file.delete({
      where: { id },
    });

    // 删除物理文件（检查引用计数）
    await this.deletePhysicalFileIfOrphan(
      file.path,
      file.thumbnailUrl,
      file.storageType,
    );

    this.logger.log(`文件已永久删除: ${id}`);
  }

  /**
   * 删除物理文件（仅当无其他 File 记录引用相同 path 时）
   * 秒传机制下多条 File 记录可能共享同一物理文件，
   * 需确保最后一个引用被删除时才删除物理文件。
   */
  async deletePhysicalFileIfOrphan(
    filePath: string,
    thumbnailUrl: string | null,
    storageType: string,
  ): Promise<void> {
    // 检查是否还有其他记录引用相同物理文件
    const refCount = await this.prisma.file.count({
      where: { path: filePath },
    });

    if (refCount > 0) {
      this.logger.log(
        `物理文件仍有 ${refCount} 条引用，跳过删除: ${filePath}`,
      );
      return;
    }

    // 无其他引用，删除物理文件
    try {
      if (storageType === 'LOCAL') {
        await this.localStorageService.deleteFile(filePath);
        this.logger.log(`原文件已从本地存储删除: ${filePath}`);
      } else {
        await this.storageService.delete(filePath);
        this.logger.log(`原文件已从RUSTFS删除: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`从存储删除文件失败: ${filePath}`, error);
    }

    // 删除缩略图
    if (thumbnailUrl) {
      try {
        const thumbnailPath = this.extractPathFromUrl(thumbnailUrl);
        if (thumbnailPath) {
          if (storageType === 'LOCAL') {
            await this.localStorageService.deleteFile(thumbnailPath);
            this.logger.log(`缩略图已从本地存储删除: ${thumbnailPath}`);
          } else {
            await this.storageService.delete(thumbnailPath);
            this.logger.log(`缩略图已从RUSTFS删除: ${thumbnailPath}`);
          }
        }
      } catch (error) {
        this.logger.warn(`从存储删除缩略图失败: ${thumbnailUrl}`, error);
      }
    }
  }

  /**
   * 从URL中提取存储路径
   * @param url 文件URL
   * @returns 存储路径
   */
  private extractPathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // 移除开头的斜杠和bucket名称
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        // 跳过bucket名称，返回剩余路径
        return pathParts.slice(1).join('/');
      }
      return pathParts.join('/');
    } catch {
      // 如果不是有效URL，尝试直接返回
      return url;
    }
  }

  /**
   * 批量永久删除文件
   * @param fileIds 文件ID列表
   * @param userId 用户ID
   * @returns 操作结果
   */
  async batchPermanentDelete(
    fileIds: string[],
    userId: string,
  ): Promise<{ success: boolean; deletedCount: number; failedIds: string[] }> {
    let deletedCount = 0;
    const failedIds: string[] = [];

    for (const fileId of fileIds) {
      try {
        await this.permanentDelete(fileId, userId);
        deletedCount++;
      } catch (error) {
        this.logger.error(`永久删除文件失败: ${fileId}`, error);
        failedIds.push(fileId);
      }
    }

    return {
      success: failedIds.length === 0,
      deletedCount,
      failedIds,
    };
  }

  /**
   * 清空回收站
   * @param userId 用户ID
   * @returns 操作结果
   */
  async clearRecycleBin(
    userId: string,
  ): Promise<{ success: boolean; deletedCount: number }> {
    // 获取所有已删除的文件（按文件夹所有权）
    const deletedFiles = await this.prisma.file.findMany({
      where: {
        deletedAt: { not: null },
        OR: [
          { uploadedBy: userId },
          { folder: { createdBy: userId } },
        ],
      },
    });

    let deletedCount = 0;

    for (const file of deletedFiles) {
      try {
        // 先删除数据库记录，再决定是否删物理文件
        await this.prisma.file.delete({
          where: { id: file.id },
        });

        // 删除物理文件（检查引用计数）
        await this.deletePhysicalFileIfOrphan(
          file.path,
          file.thumbnailUrl,
          file.storageType,
        );

        deletedCount++;
      } catch (error) {
        this.logger.error(`清空回收站时删除文件失败: ${file.id}`, error);
      }
    }

    this.logger.log(`回收站已清空，删除文件数: ${deletedCount}`);

    return {
      success: true,
      deletedCount,
    };
  }

  /**
   * 获取文件统计信息
   * @param userId 用户ID
   * @param storageMode 存储模式筛选
   * @returns 文件统计信息
   */
  async getStats(userId: string, storageMode?: string): Promise<FileStats> {
    // 构建查询条件
    const where: any = {
      uploadedBy: userId,
      deletedAt: null,
    };

    // 存储模式筛选
    if (storageMode) {
      where.storageType = storageMode === 'rustfs' ? 'RUSTFS' : 'LOCAL';
    }

    // 获取所有文件
    const files = await this.prisma.file.findMany({
      where,
      select: {
        extension: true,
        size: true,
      },
    });

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + Number(file.size), 0);

    // 按扩展名统计
    const extensionMap = new Map<string, { count: number; size: number }>();
    for (const file of files) {
      const ext = file.extension || 'unknown';
      const current = extensionMap.get(ext) || { count: 0, size: 0 };
      current.count++;
      current.size += Number(file.size);
      extensionMap.set(ext, current);
    }

    const byExtension = Array.from(extensionMap.entries()).map(
      ([extension, stats]) => ({
        extension,
        count: stats.count,
        size: stats.size,
      }),
    );

    return {
      totalFiles,
      totalSize,
      byExtension,
    };
  }

  /**
   * 下载单个文件
   * @param id 文件ID
   * @param userId 用户ID
   * @returns 文件内容、文件名和MIME类型
   */
  async downloadFile(
    id: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 权限检查：上传者 或 对文件夹有 DOWNLOAD 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.DOWNLOAD,
      );
    }

    if (!file.path) {
      throw new BadRequestException('文件路径不存在');
    }

    // 根据存储类型选择下载方式
    let buffer: Buffer;
    if (file.storageType === 'LOCAL') {
      buffer = await this.localStorageService.downloadFile(file.path);
    } else {
      buffer = await this.storageService.download(file.path);
    }

    return {
      buffer,
      filename: file.name,
      mimeType: file.mimeType || 'application/octet-stream',
    };
  }

  /**
   * 下载缩略图
   * @param id 文件ID
   * @param userId 用户ID
   * @returns 缩略图内容和MIME类型
   */
  async downloadThumbnail(
    id: string,
    userId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 权限检查：上传者 或 对文件夹有 VIEW 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.VIEW,
      );
    }

    if (!file.thumbnailUrl) {
      throw new NotFoundException('缩略图不存在');
    }

    // 从缩略图URL中提取路径（根目录 = 存储桶根目录）
    // 缩略图路径格式: {basePath}/{md5}_thumb.jpg
    const thumbnailPath = file.path
      ? file.path.replace(/\.[^/.]+$/, '').replace(/[^/]+$/, `${file.md5}_thumb.jpg`)
      : `${file.md5}_thumb.jpg`;

    // 根据存储类型选择下载方式
    let buffer: Buffer;
    if (file.storageType === 'LOCAL') {
      buffer = await this.localStorageService.downloadFile(thumbnailPath);
    } else {
      buffer = await this.storageService.download(thumbnailPath);
    }

    return {
      buffer,
      mimeType: 'image/jpeg',
    };
  }

  /**
   * 打包下载多个文件
   * @param fileIds 文件ID列表
   * @param userId 用户ID
   * @returns 压缩包流和文件名
   */
  async packageDownload(
    fileIds: string[],
    userId: string,
  ): Promise<{ stream: Readable; filename: string }> {
    if (!fileIds || fileIds.length === 0) {
      throw new BadRequestException('请选择要下载的文件');
    }

    // 获取文件信息（不按上传者过滤，由单文件权限检查保障）
    const files = await this.prisma.file.findMany({
      where: {
        id: { in: fileIds },
        deletedAt: null,
      },
    });

    if (files.length === 0) {
      throw new NotFoundException('未找到可下载的文件');
    }

    // 创建压缩包
    const archive = archiver('zip', {
      zlib: { level: 5 },
    });

    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    // 添加文件到压缩包
    for (const file of files) {
      if (file.path) {
        try {
          // 直接从存储服务获取文件内容
          const fileBuffer = await this.storageService.download(file.path);
          archive.append(fileBuffer, { name: file.name });
        } catch (error) {
          this.logger.warn(`无法获取文件 ${file.name}: ${error}`);
        }
      }
    }

    // 完成压缩
    archive.finalize();

    const filename = `files-${Date.now()}.zip`;
    return { stream: passThrough, filename };
  }

  /**
   * 获取回收站保留天数配置
   * @returns 保留天数
   */
  async getRecycleBinRetentionDays(): Promise<{ days: number }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: 'recycle_bin_retention_days',
          isActive: true,
          deletedAt: null,
        },
      });

      if (config && config.value) {
        const days = parseInt(config.value, 10);
        if (!isNaN(days) && days > 0) {
          return { days };
        }
      }
    } catch (error) {
      this.logger.warn('获取回收站保留天数配置失败', error);
    }

    // 默认30天
    return { days: 30 };
  }

  /**
   * 更新回收站保留天数配置
   * @param days 保留天数
   * @param userId 操作人ID
   * @returns 更新后的配置
   */
  async updateRecycleBinRetentionDays(
    days: number,
    userId: string,
  ): Promise<{ days: number }> {
    if (days < 1 || days > 365) {
      throw new BadRequestException('保留天数必须在1-365之间');
    }

    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: 'recycle_bin_retention_days',
        deletedAt: null,
      },
    });

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: {
          value: days.toString(),
          updatedBy: userId,
        },
      });
    } else {
      await this.prisma.config.create({
        data: {
          key: 'recycle_bin_retention_days',
          value: days.toString(),
          type: 'NUMBER',
          description: '回收站文件保留天数',
          category: 'file',
          isSystem: true,
          isActive: true,
          createdBy: userId,
        },
      });
    }

    this.logger.log(`回收站保留天数已更新为: ${days}天`);
    return { days };
  }

  /**
   * 上传视频缩略图
   * @param fileId 文件ID
   * @param thumbnailFile 缩略图文件
   * @param userId 用户ID
   * @returns 更新后的文件信息
   */
  async uploadThumbnail(
    fileId: string,
    thumbnailFile: Express.Multer.File,
    userId: string,
  ): Promise<{ success: boolean; thumbnailUrl: string }> {
    // 查找文件
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // 权限检查：上传者 或 对文件夹有 EDIT 权限
    if (file.uploadedBy !== userId && file.folderId) {
      await this.folderPermissionService.requirePermission(
        userId,
        file.folderId,
        SharePermission.EDIT,
      );
    }

    // 从文件的实际存储路径中提取目录（确保缩略图与视频在同一目录）
    let basePath = '';
    if (file.path) {
      const lastSlashIndex = file.path.lastIndexOf('/');
      if (lastSlashIndex > 0) {
        basePath = file.path.substring(0, lastSlashIndex);
      }
    }

    // 生成缩略图存储路径（与原文件在同一目录）
    const thumbnailKey = basePath
      ? `${basePath}/${file.md5}_thumb.jpg`
      : `${file.md5}_thumb.jpg`;

    // 根据文件的存储类型选择正确的存储服务
    let thumbnailUrl: string;
    const serverBaseUrl = this.configService.get<string>('SERVER_BASE_URL', 'http://localhost:6520');
    
    if (file.storageType === 'LOCAL') {
      // 本地存储
      await this.localStorageService.uploadFile(thumbnailFile.buffer, thumbnailKey);
      thumbnailUrl = `${serverBaseUrl}/uploads/${thumbnailKey}`;
      this.logger.log(`视频缩略图已上传到本地存储: ${thumbnailKey}`);
    } else {
      // RUSTFS存储
      thumbnailUrl = await this.storageService.upload(
        thumbnailFile.buffer,
        thumbnailKey,
        'image/jpeg',
      );
      this.logger.log(`视频缩略图已上传到RUSTFS: ${thumbnailKey}`);
    }

    // 更新文件记录的缩略图URL
    await this.prisma.file.update({
      where: { id: fileId },
      data: { thumbnailUrl },
    });

    this.logger.log(`视频缩略图URL已更新: ${fileId} -> ${thumbnailUrl}`);

    return { success: true, thumbnailUrl };
  }
}
