import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { FolderShareType, SharePermission } from '@prisma/client';
import {
  CreateFolderDto,
  UpdateFolderDto,
  MoveFolderDto,
} from './dto/create-folder.dto';
import { RealFolderService } from './real-folder.service';
import { FolderPermissionService } from './folder-permission.service';

/**
 * 文件夹信息
 */
export interface FolderInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
  realFolderId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 文件夹树节点
 */
export interface FolderTreeNode extends FolderInfo {
  children: FolderTreeNode[];
  shareType?: FolderShareType;
  permissions?: SharePermission[];
  isOwner?: boolean;
  creator?: { id: string; username: string; name: string };
}

/**
 * Prisma 文件夹类型
 */
interface PrismaFolder {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
  realFolderId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  shareType?: FolderShareType;
}

/**
 * 文件夹服务
 * 提供文件夹管理相关功能
 */
@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realFolderService: RealFolderService,
    private readonly folderPermissionService: FolderPermissionService,
  ) {}

  /**
   * 创建文件夹
   * @param dto 创建信息
   * @param userId 用户ID
   * @returns 创建的文件夹
   */
  async create(dto: CreateFolderDto, userId: string): Promise<FolderInfo> {
    // 验证父文件夹
    if (dto.parentId) {
      const parentFolder = await this.prisma.folder.findFirst({
        where: {
          id: dto.parentId,
          deletedAt: null,
        },
      });

      if (!parentFolder) {
        throw new NotFoundException('父文件夹不存在');
      }

      // 若父文件夹不是自己创建的，检查共享权限
      if (parentFolder.createdBy !== userId) {
        const rootFolderId =
          await this.findSharedRootFolderId(dto.parentId);
        await this.folderPermissionService.requirePermission(
          userId,
          rootFolderId,
          SharePermission.UPLOAD,
        );
      }

      // 子文件夹继承父文件夹的 realFolderId
      if (!dto.realFolderId && parentFolder.realFolderId) {
        dto.realFolderId = parentFolder.realFolderId;
      }
    }

    // 检查同名文件夹（共享文件夹内不同用户也不能同名）
    const existingFolder = await this.prisma.folder.findFirst({
      where: {
        name: dto.name,
        parentId: dto.parentId || null,
        deletedAt: null,
      },
    });

    if (existingFolder) {
      throw new ConflictException('该目录下已存在同名文件夹');
    }

    // 如果未指定 realFolderId，自动查找用户的 user/{username} 真实文件夹
    let realFolderId = dto.realFolderId;
    if (!realFolderId) {
      // 查找父文件夹的 realFolderId 继承
      if (dto.parentId) {
        const parentFolder = await this.prisma.folder.findFirst({
          where: { id: dto.parentId, deletedAt: null },
        });
        if (parentFolder?.realFolderId) {
          realFolderId = parentFolder.realFolderId;
        }
      }

      // 如果仍然没有，查找用户的 user/{username} 真实文件夹
      if (!realFolderId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (user) {
          const userRealFolder = await this.realFolderService.findByPath(
            `user/${user.username}`,
          );
          if (userRealFolder) {
            realFolderId = userRealFolder.id;
          }
        }
      }
    }

    const folder = await this.prisma.folder.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        parentId: dto.parentId,
        realFolderId: realFolderId,
        createdBy: userId,
      },
    });

    return {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      icon: folder.icon,
      parentId: folder.parentId,
      realFolderId: folder.realFolderId,
      createdBy: folder.createdBy,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  /**
   * 获取文件夹列表
   * @param parentId 父文件夹ID
   * @param userId 用户ID
   * @returns 文件夹列表
   */
  async findAll(
    parentId: string | undefined,
    userId: string,
  ): Promise<FolderInfo[]> {
    const folders = await this.prisma.folder.findMany({
      where: {
        parentId: parentId || null,
        createdBy: userId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      icon: folder.icon,
      parentId: folder.parentId,
      realFolderId: folder.realFolderId,
      createdBy: folder.createdBy,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }));
  }

  /**
   * 获取文件夹详情
   * @param id 文件夹ID
   * @param userId 用户ID
   * @returns 文件夹详情
   */
  async findById(id: string, userId: string): Promise<FolderInfo> {
    // 首先查找文件夹，不限制创建者
    const folder = await this.prisma.folder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: { folderShares: {
          where: {
            OR: [
              { sharedWithUserId: userId },
              {
                sharedWithRole: {
                  userRoles: {
                    some: { userId },
                  },
                },
              },
            ],
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    // 检查是否是所有者或有共享权限
    const isOwner = folder.createdBy === userId;
    const hasSharedAccess = folder.folderShares.length > 0;

    if (!isOwner && !hasSharedAccess) {
      throw new NotFoundException('文件夹不存在');
    }

    return {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      icon: folder.icon,
      parentId: folder.parentId,
      realFolderId: folder.realFolderId,
      createdBy: folder.createdBy,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  /**
   * 更新文件夹
   * @param id 文件夹ID
   * @param dto 更新信息
   * @param userId 用户ID
   * @returns 更新后的文件夹
   */
  async update(
    id: string,
    dto: UpdateFolderDto,
    userId: string,
  ): Promise<FolderInfo> {
    // 使用通用权限检查
    await this.checkSubFolderPermission(id, userId);
    const folder = await this.prisma.folder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    // 如果更新名称，检查同名
    if (dto.name && dto.name !== folder.name) {
      const existingFolder = await this.prisma.folder.findFirst({
        where: {
          name: dto.name,
          parentId: folder.parentId,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existingFolder) {
        throw new ConflictException('该目录下已存在同名文件夹');
      }
    }

    const updatedFolder = await this.prisma.folder.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        realFolderId: dto.realFolderId,
      },
    });

    return {
      id: updatedFolder.id,
      name: updatedFolder.name,
      description: updatedFolder.description,
      icon: updatedFolder.icon,
      parentId: updatedFolder.parentId,
      realFolderId: updatedFolder.realFolderId,
      createdBy: updatedFolder.createdBy,
      createdAt: updatedFolder.createdAt,
      updatedAt: updatedFolder.updatedAt,
    };
  }

  /**
   * 移动文件夹
   * @param id 文件夹ID
   * @param dto 移动信息
   * @param userId 用户ID
   * @returns 更新后的文件夹
   */
  async move(
    id: string,
    dto: MoveFolderDto,
    userId: string,
  ): Promise<FolderInfo> {
    await this.checkSubFolderPermission(id, userId);
    const folder = await this.prisma.folder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    // 验证目标父文件夹
    if (dto.parentId) {
      const parentFolder = await this.prisma.folder.findFirst({
        where: {
          id: dto.parentId,
          deletedAt: null,
        },
      });

      if (!parentFolder) {
        throw new NotFoundException('目标父文件夹不存在');
      }

      // 检查是否移动到自己或子文件夹
      if (await this.isDescendant(dto.parentId, id)) {
        throw new BadRequestException('不能将文件夹移动到自己或子文件夹中');
      }

      // 检查同名
      const existingFolder = await this.prisma.folder.findFirst({
        where: {
          name: folder.name,
          parentId: dto.parentId,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existingFolder) {
        throw new ConflictException('目标目录下已存在同名文件夹');
      }
    }

    const updatedFolder = await this.prisma.folder.update({
      where: { id },
      data: {
        parentId: dto.parentId || null,
      },
    });

    return {
      id: updatedFolder.id,
      name: updatedFolder.name,
      description: updatedFolder.description,
      icon: updatedFolder.icon,
      parentId: updatedFolder.parentId,
      realFolderId: updatedFolder.realFolderId,
      createdBy: updatedFolder.createdBy,
      createdAt: updatedFolder.createdAt,
      updatedAt: updatedFolder.updatedAt,
    };
  }

  /**
   * 删除文件夹
   * @param id 文件夹ID
   * @param deleteFiles 是否删除文件夹内的文件
   * @param userId 用户ID
   */
  async delete(
    id: string,
    deleteFiles: boolean,
    userId: string,
  ): Promise<void> {
    await this.checkSubFolderPermission(id, userId);
    const folder = await this.prisma.folder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    // 检查是否有子文件夹（不按创建者过滤）
    const hasSubFolders = await this.prisma.folder.count({
      where: {
        parentId: id,
        deletedAt: null,
      },
    });

    if (hasSubFolders > 0) {
      throw new BadRequestException('文件夹不为空，请先删除子文件夹');
    }

    // 检查是否有文件（不按上传者过滤）
    const hasFiles = await this.prisma.file.count({
      where: {
        folderId: id,
        deletedAt: null,
      },
    });

    if (hasFiles > 0) {
      if (deleteFiles) {
        // 软删除文件夹内的文件
        await this.prisma.file.updateMany({
          where: {
            folderId: id,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      } else {
        // 将文件移动到父级文件夹（或根目录）
        await this.prisma.file.updateMany({
          where: {
            folderId: id,
            deletedAt: null,
          },
          data: {
            folderId: folder.parentId,
          },
        });
      }
    }

    // 清理关联的共享记录
    await this.prisma.folderShare.deleteMany({
      where: { folderId: id },
    });

    // 重置共享类型
    if (folder.shareType !== 'NONE') {
      await this.prisma.folder.update({
        where: { id },
        data: { shareType: 'NONE' },
      });
    }

    // 软删除文件夹
    await this.prisma.folder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    this.logger.log(`文件夹已删除: ${id}`);
  }

  /**
   * 清空文件夹（删除文件夹中的所有文件，移到回收站）
   * @param id 文件夹ID
   * @param userId 用户ID
   * @returns 操作结果
   */
  async clearFolder(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; deletedCount: number }> {
    await this.checkSubFolderPermission(id, userId);
    const folder = await this.prisma.folder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    // 检查是否有子文件夹（不按创建者过滤）
    const childFolders = await this.prisma.folder.findMany({
      where: {
        parentId: id,
        deletedAt: null,
      },
    });

    if (childFolders.length > 0) {
      throw new BadRequestException('该文件夹包含子文件夹，无法清空。请先删除或移动子文件夹。');
    }

    // 软删除文件夹中的所有文件（不按上传者过滤）
    const result = await this.prisma.file.updateMany({
      where: {
        folderId: id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    this.logger.log(`文件夹已清空: ${id}, 删除文件数: ${result.count}`);

    return {
      success: true,
      deletedCount: result.count,
    };
  }

  /**
   * 获取文件夹树
   * @param userId 用户ID
   * @returns 文件夹树
   */
  async getTree(userId: string): Promise<FolderTreeNode[]> {
    const folders = await this.prisma.folder.findMany({
      where: {
        createdBy: userId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    return this.buildTree(folders);
  }

  /**
   * 构建文件夹树
   * @param folders 文件夹列表
   * @param parentId 父文件夹ID
   * @returns 文件夹树节点
   */
  private buildTree(
    folders: PrismaFolder[],
    parentId: string | null = null,
  ): FolderTreeNode[] {
    return folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        icon: folder.icon,
        parentId: folder.parentId,
        realFolderId: folder.realFolderId,
        createdBy: folder.createdBy,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        shareType: folder.shareType,
        children: this.buildTree(folders, folder.id),
      }));
  }

  /**
   * 向上递归找到根共享文件夹
   */
  async findSharedRootFolderId(folderId: string): Promise<string> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        parentId: true,
        shareType: true,
        isSystemShared: true,
      },
    });
    if (!folder) return folderId;

    if (folder.shareType !== 'NONE' || folder.isSystemShared) {
      return folder.id;
    }
    if (folder.parentId) {
      return this.findSharedRootFolderId(folder.parentId);
    }
    return folder.id;
  }

  /**
   * 通用权限检查：子文件夹创建者 或 根共享文件夹所有者 或 超级管理员
   */
  async checkSubFolderPermission(
    folderId: string,
    userId: string,
  ): Promise<void> {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('文件夹不存在');

    // 创建者可操作
    if (folder.createdBy === userId) return;

    // 非创建者，检查是否是根共享文件夹的所有者
    const rootFolderId = await this.findSharedRootFolderId(folderId);
    const rootFolder = await this.prisma.folder.findUnique({
      where: { id: rootFolderId },
    });
    if (rootFolder?.createdBy === userId) return;

    // 检查是否是超级管理员（系统共享文件夹场景）
    const isSuperAdmin =
      await this.folderPermissionService.checkIsSuperAdmin(userId);
    if (rootFolder?.isSystemShared && isSuperAdmin) return;

    throw new ForbiddenException('无权操作此文件夹');
  }

  /**
   * 获取共享文件夹的子文件夹树
   */
  async getSharedFolderChildren(
    rootFolderId: string,
  ): Promise<FolderTreeNode[]> {
    const children = await this.prisma.folder.findMany({
      where: {
        parentId: rootFolderId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    const result: FolderTreeNode[] = [];
    for (const child of children) {
      const grandChildren = await this.getSharedFolderChildren(child.id);
      result.push({
        id: child.id,
        name: child.name,
        description: child.description,
        icon: child.icon,
        parentId: child.parentId,
        realFolderId: child.realFolderId,
        createdBy: child.createdBy,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt,
        children: grandChildren,
      });
    }
    return result;
  }

  /**
   * 确保用户拥有 user/{username} 真实文件夹和根目录
   */
  private async ensureUserRealFolder(
    username: string,
    displayName: string,
  ): Promise<void> {
    const pathName = `user/${username}`;
    let realFolder: any = null;

    try {
      realFolder = await this.realFolderService.findByPath(pathName);
    } catch {
      // ignore
    }

    if (!realFolder) {
      realFolder = await this.realFolderService.create({
        pathName,
        displayName: `${displayName}的文件夹`,
        description: `用户 ${username} 的个人存储空间`,
      });
      this.logger.log(`为用户创建真实文件夹: ${pathName}`);
    }

    // 确保用户有 Folder 根目录
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user) return;

    const existingFolder = await this.prisma.folder.findFirst({
      where: {
        createdBy: user.id,
        parentId: null,
        isSystemShared: false,
        deletedAt: null,
      },
    });

    if (!existingFolder) {
      await this.prisma.folder.create({
        data: {
          name: '我的文件',
          realFolderId: realFolder.id,
          createdBy: user.id,
        },
      });
      this.logger.log(`为用户创建 Folder 根目录: ${username}`);
    }
  }

  /**
   * 检查是否是后代文件夹
   */
  private async isDescendant(
    descendantId: string,
    ancestorId: string,
  ): Promise<boolean> {
    if (descendantId === ancestorId) {
      return true;
    }

    const folder = await this.prisma.folder.findFirst({
      where: {
        id: descendantId,
        deletedAt: null,
      },
    });

    if (!folder || !folder.parentId) {
      return false;
    }

    return this.isDescendant(folder.parentId, ancestorId);
  }

  /**
   * 获取用户的所有文件夹（个人 + 共享给我的 + 系统共享）
   * @param userId 用户ID
   * @returns 分类的文件夹列表
   */
  async getMyFolders(userId: string): Promise<{
    personal: FolderTreeNode[];
    sharedWithMe: FolderTreeNode[];
    systemShared: FolderTreeNode[];
  }> {
    // 1. 获取用户的角色信息
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { id: true, code: true } } },
    });
    const roleIds = userRoles.map((r) => r.roleId);
    const isSuperAdmin = userRoles.some(
      (r) => r.role.code === 'super_admin',
    );

    // 2. 获取个人文件夹（用户自己创建的非系统共享文件夹）
    let personalFolders = await this.prisma.folder.findMany({
      where: {
        createdBy: userId,
        isSystemShared: false,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    // ℹ️ 如果用户没有个人文件夹，自动创建（兼容 seed 预创建的用户如 admin）
    if (personalFolders.length === 0) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { username: true, name: true },
        });
        if (user) {
          await this.ensureUserRealFolder(user.username, user.name);
          // 重新查询
          personalFolders = await this.prisma.folder.findMany({
            where: {
              createdBy: userId,
              isSystemShared: false,
              deletedAt: null,
            },
            orderBy: { name: 'asc' },
          });
          this.logger.log(`自动为用户创建个人文件夹: ${user.username}`);
        }
      } catch (error) {
        this.logger.warn(`自动创建个人文件夹失败: ${(error as Error).message}`);
      }
    }

    // 3. 获取共享给用户的文件夹（用户共享）
    const userSharedFolders = await this.prisma.folder.findMany({
      where: {
        shareType: FolderShareType.USER,
        deletedAt: null,
        folderShares: {
          some: {
            OR: [
              { sharedWithUserId: userId },
              ...(roleIds.length > 0 ? [{ sharedWithRoleId: { in: roleIds } }] : []),
            ],
          },
        },
        // 排除自己创建的
        NOT: { createdBy: userId },
      },
      include: { folderShares: {
          where: {
            OR: [
              { sharedWithUserId: userId },
              ...(roleIds.length > 0 ? [{ sharedWithRoleId: { in: roleIds } }] : []),
            ],
          },
        },
        user: {
          select: { id: true, username: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 4. 获取系统共享文件夹
    // 超级管理员可以看到所有系统共享文件夹
    const systemSharedFolders = await this.prisma.folder.findMany({
      where: {
        isSystemShared: true,
        deletedAt: null,
        ...(isSuperAdmin
          ? {}
          : {
              shares: {
                some: {
                  ...(roleIds.length > 0
                    ? { sharedWithRoleId: { in: roleIds } }
                    : {}),
                },
              },
            }),
      },
      include: { folderShares: true,
      },
      orderBy: { name: 'asc' },
    });

    // 构建个人文件夹树
    const personalTree = this.buildTree(personalFolders).map((node) => ({
      ...node,
      shareType: node.shareType || FolderShareType.NONE,
      permissions: [
        SharePermission.VIEW,
        SharePermission.DOWNLOAD,
        SharePermission.UPLOAD,
        SharePermission.EDIT,
        SharePermission.DELETE,
      ],
      isOwner: true,
    }));

    // 构建用户共享文件夹列表（树形结构）
    const sharedWithMeList: FolderTreeNode[] = [];
    for (const folder of userSharedFolders) {
      const children = await this.getSharedFolderChildren(folder.id);
      const allPermissions = new Set<SharePermission>();
      folder.folderShares.forEach((share) => {
        share.permissions.forEach((p) => allPermissions.add(p));
      });

      sharedWithMeList.push({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        icon: folder.icon,
        parentId: folder.parentId,
        realFolderId: folder.realFolderId,
        createdBy: folder.createdBy,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        children,
        shareType: FolderShareType.USER,
        permissions: Array.from(allPermissions),
        isOwner: false,
        creator: folder.user,
      });
    }

    // 构建系统共享文件夹列表（树形结构）
    const systemSharedList: FolderTreeNode[] = [];
    for (const folder of systemSharedFolders) {
      const children = await this.getSharedFolderChildren(folder.id);
      const allPermissions = new Set<SharePermission>();
      if (isSuperAdmin) {
        Object.values(SharePermission).forEach((p) =>
          allPermissions.add(p),
        );
      } else {
        folder.folderShares.forEach((share) => {
          share.permissions.forEach((p) => allPermissions.add(p));
        });
      }

      systemSharedList.push({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        icon: folder.icon,
        parentId: folder.parentId,
        realFolderId: folder.realFolderId,
        createdBy: folder.createdBy,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        children,
        shareType: FolderShareType.SYSTEM,
        permissions: Array.from(allPermissions),
        isOwner: isSuperAdmin,
      });
    }

    return {
      personal: personalTree,
      sharedWithMe: sharedWithMeList,
      systemShared: systemSharedList,
    };
  }
}
