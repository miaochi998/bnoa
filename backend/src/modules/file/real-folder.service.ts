import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import {
  CreateRealFolderDto,
  UpdateRealFolderDto,
  RealFolderResponse,
} from './dto/folder.dto';

@Injectable()
export class RealFolderService {
  private readonly logger = new Logger(RealFolderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly localStorageService: LocalStorageService,
  ) {}

  /**
   * 创建真实文件夹
   * 同时在RUSTFS和本地存储中创建物理目录
   */
  async create(dto: CreateRealFolderDto): Promise<RealFolderResponse> {
    // 检查路径是否已存在
    const existing = await this.prisma.realFolder.findUnique({
      where: { pathName: dto.pathName },
    });

    if (existing) {
      throw new ConflictException(`路径 ${dto.pathName} 已存在`);
    }

    // 在RUSTFS中创建目录
    try {
      await this.storageService.createFolder(dto.pathName);
      this.logger.log(`RUSTFS目录创建成功: ${dto.pathName}`);
    } catch (error) {
      const errMsg = (error as any)?.response?.message || (error as Error).message || '未知错误';
      this.logger.error(`RUSTFS目录创建失败: ${dto.pathName}`, error);
      throw new BadRequestException(`RUSTFS目录创建失败: ${errMsg}`);
    }

    // 在本地存储中创建目录
    try {
      await this.localStorageService.createFolder(dto.pathName);
      this.logger.log(`本地目录创建成功: ${dto.pathName}`);
    } catch (error) {
      this.logger.error(`本地目录创建失败: ${dto.pathName}`, error);
      // 本地目录创建失败不阻止流程，只记录警告
      this.logger.warn(`本地目录创建失败，但继续创建数据库记录: ${dto.pathName}`);
    }

    // 创建数据库记录
    const folder = await this.prisma.realFolder.create({
      data: {
        pathName: dto.pathName,
        displayName: dto.displayName,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        _count: {
          select: { folders: true },
        },
      },
    });

    this.logger.log(`创建真实文件夹完成: ${folder.pathName}`);

    return this.toResponse(folder);
  }

  /**
   * 获取所有真实文件夹
   */
  async findAll(): Promise<RealFolderResponse[]> {
    const folders = await this.prisma.realFolder.findMany({
      orderBy: [{ sortOrder: 'asc' }, { pathName: 'asc' }],
      include: {
        _count: {
          select: {
            folders: { where: { deletedAt: null } },
          },
        },
      },
    });

    // 实时计算每个真实文件夹的文件数和总大小
    const responses: RealFolderResponse[] = [];
    for (const folder of folders) {
      const stats = await this.prisma.file.aggregate({
        where: { folder: {
            realFolderId: folder.id,
            deletedAt: null,
          },
          deletedAt: null,
        },
        _count: true,
        _sum: { size: true },
      });

      responses.push({
        ...this.toResponse(folder),
        fileCount: stats._count,
        totalSize: (stats._sum.size ?? BigInt(0)).toString(),
      });
    }

    return responses;
  }

  /**
   * 根据ID获取真实文件夹
   */
  async findById(id: string): Promise<RealFolderResponse> {
    const folder = await this.prisma.realFolder.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            folders: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException(`真实文件夹不存在: ${id}`);
    }

    const stats = await this.prisma.file.aggregate({
      where: { folder: { realFolderId: id, deletedAt: null },
        deletedAt: null,
      },
      _count: true,
      _sum: { size: true },
    });

    return {
      ...this.toResponse(folder),
      fileCount: stats._count,
      totalSize: (stats._sum.size ?? BigInt(0)).toString(),
    };
  }

  /**
   * 根据路径获取真实文件夹
   */
  async findByPath(pathName: string): Promise<RealFolderResponse | null> {
    const folder = await this.prisma.realFolder.findUnique({
      where: { pathName },
      include: {
        _count: {
          select: {
            folders: { where: { deletedAt: null } },
          },
        },
      },
    });

    return folder ? this.toResponse(folder) : null;
  }

  /**
   * 更新真实文件夹
   */
  async update(id: string, dto: UpdateRealFolderDto): Promise<RealFolderResponse> {
    const folder = await this.prisma.realFolder.findUnique({
      where: { id },
    });

    if (!folder) {
      throw new NotFoundException(`真实文件夹不存在: ${id}`);
    }

    const updated = await this.prisma.realFolder.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        description: dto.description,
        sortOrder: dto.sortOrder,
      },
      include: {
        _count: {
          select: { folders: true },
        },
      },
    });

    this.logger.log(`更新真实文件夹: ${updated.pathName}`);

    return this.toResponse(updated);
  }

  /**
   * 删除真实文件夹
   */
  async delete(id: string): Promise<void> {
    const folder = await this.prisma.realFolder.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            folders: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException(`真实文件夹不存在: ${id}`);
    }

    if (folder.isSystem) {
      throw new BadRequestException('系统目录不允许删除');
    }

    if (folder._count.folders > 0) {
      throw new BadRequestException(
        `该目录被 ${folder._count.folders} 个活跃文件夹引用，无法删除`,
      );
    }

    // 清除已软删除文件夹的关联（避免外键约束问题）
    await this.prisma.folder.updateMany({
      where: { realFolderId: id, deletedAt: { not: null } },
      data: { realFolderId: null },
    });

    await this.prisma.realFolder.delete({
      where: { id },
    });

    this.logger.log(`删除真实文件夹: ${folder.pathName}`);
  }

  /**
   * 更新文件夹统计信息
   */
  async updateStats(id: string): Promise<void> {
    const stats = await this.prisma.file.aggregate({
      where: { folder: { realFolderId: id },
        deletedAt: null,
      },
      _count: true,
      _sum: { size: true },
    });

    await this.prisma.realFolder.update({
      where: { id },
      data: {
        fileCount: stats._count,
        totalSize: BigInt(stats._sum.size ?? 0),
      },
    });
  }

  /**
   * 初始化系统默认文件夹
   */
  async initSystemFolders(): Promise<void> {
    const systemFolders = [
      { pathName: 'system/avatars', displayName: '用户头像', isSystem: true },
      { pathName: 'system/attachments', displayName: '系统附件', isSystem: true },
      { pathName: 'uploads/images', displayName: '图片上传', isSystem: false },
      { pathName: 'uploads/documents', displayName: '文档上传', isSystem: false },
      { pathName: 'uploads/videos', displayName: '视频上传', isSystem: false },
    ];

    for (const folder of systemFolders) {
      const existing = await this.prisma.realFolder.findUnique({
        where: { pathName: folder.pathName },
      });

      if (!existing) {
        await this.prisma.realFolder.create({
          data: {
            pathName: folder.pathName,
            displayName: folder.displayName,
            isSystem: folder.isSystem,
          },
        });
        this.logger.log(`初始化系统文件夹: ${folder.pathName}`);
      }
    }
  }

  /**
   * 转换为响应格式
   */
  private toResponse(folder: any): RealFolderResponse {
    return {
      id: folder.id,
      pathName: folder.pathName,
      displayName: folder.displayName,
      description: folder.description,
      sortOrder: folder.sortOrder,
      isSystem: folder.isSystem,
      fileCount: folder.fileCount,
      totalSize: folder.totalSize.toString(),
      folderCount: folder._count?.folders ?? 0,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }
}
