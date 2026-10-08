import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SharePermission, FolderShareType } from '@prisma/client';
import { FolderPermissionService } from './folder-permission.service';
import {
  ShareFolderDto,
  UpdateSharePermissionDto,
  CreateSystemSharedFolderDto,
} from './dto/folder-share.dto';

/**
 * 共享记录信息
 */
export interface FolderShareInfo {
  id: string;
  sharedWithUser?: {
    id: string;
    username: string;
    name: string;
  };
  sharedWithRole?: {
    id: string;
    name: string;
    code: string;
  };
  permissions: SharePermission[];
  createdAt: Date;
}

/**
 * 文件夹共享服务
 * 提供文件夹共享相关功能
 */
@Injectable()
export class FolderShareService {
  private readonly logger = new Logger(FolderShareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: FolderPermissionService,
  ) {}

  /**
   * 共享文件夹给用户或角色
   * @param folderId 文件夹ID
   * @param dto 共享信息
   * @param userId 操作者ID
   */
  async share(
    folderId: string,
    dto: ShareFolderDto,
    userId: string,
  ): Promise<{ success: boolean; createdCount: number }> {
    // 验证是否是文件夹所有者
    await this.permissionService.requireOwner(userId, folderId);

    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId, deletedAt: null },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    let createdCount = 0;

    // 共享给用户
    if (dto.userIds && dto.userIds.length > 0) {
      for (const targetUserId of dto.userIds) {
        // 不能共享给自己
        if (targetUserId === userId) {
          continue;
        }

        // 检查用户是否存在
        const user = await this.prisma.user.findUnique({
          where: { id: targetUserId },
        });
        if (!user) {
          continue;
        }

        // 创建或更新共享记录
        await this.prisma.folderShare.upsert({
          where: {
            folderId_sharedWithUserId: {
              folderId,
              sharedWithUserId: targetUserId,
            },
          },
          create: {
            folderId,
            sharedWithUserId: targetUserId,
            permissions: dto.permissions,
            sharedBy: userId,
          },
          update: {
            permissions: dto.permissions,
          },
        });
        createdCount++;
      }
    }

    // 共享给角色
    if (dto.roleIds && dto.roleIds.length > 0) {
      for (const roleId of dto.roleIds) {
        // 检查角色是否存在
        const role = await this.prisma.role.findUnique({
          where: { id: roleId },
        });
        if (!role) {
          continue;
        }

        // 创建或更新共享记录
        await this.prisma.folderShare.upsert({
          where: {
            folderId_sharedWithRoleId: {
              folderId,
              sharedWithRoleId: roleId,
            },
          },
          create: {
            folderId,
            sharedWithRoleId: roleId,
            permissions: dto.permissions,
            sharedBy: userId,
          },
          update: {
            permissions: dto.permissions,
          },
        });
        createdCount++;
      }
    }

    // 更新文件夹的共享类型
    if (createdCount > 0 && folder.shareType === FolderShareType.NONE) {
      await this.prisma.folder.update({
        where: { id: folderId },
        data: { shareType: FolderShareType.USER },
      });
    }

    this.logger.log(
      `文件夹 ${folderId} 已共享给 ${createdCount} 个用户/角色`,
    );

    return { success: true, createdCount };
  }

  /**
   * 获取共享给当前用户的文件夹列表
   * @param userId 用户ID
   */
  async getSharedWithMe(userId: string) {
    const folders = await this.permissionService.getSharedFolders(userId);
    return { items: folders };
  }

  /**
   * 获取文件夹的共享记录
   * @param folderId 文件夹ID
   * @param userId 操作者ID
   */
  async getShares(
    folderId: string,
    userId: string,
  ): Promise<{ items: FolderShareInfo[] }> {
    // 验证是否是文件夹所有者
    await this.permissionService.requireOwner(userId, folderId);

    const shares = await this.prisma.folderShare.findMany({
      where: { folderId },
      include: { sharedWithUser: {
          select: { id: true, username: true, name: true },
        },
        sharedWithRole: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: FolderShareInfo[] = shares.map((share) => ({
      id: share.id,
      sharedWithUser: share.sharedWithUser || undefined,
      sharedWithRole: share.sharedWithRole || undefined,
      permissions: share.permissions,
      createdAt: share.createdAt,
    }));

    return { items };
  }

  /**
   * 更新共享权限
   * @param folderId 文件夹ID
   * @param shareId 共享记录ID
   * @param dto 更新信息
   * @param userId 操作者ID
   */
  async updateShare(
    folderId: string,
    shareId: string,
    dto: UpdateSharePermissionDto,
    userId: string,
  ): Promise<FolderShareInfo> {
    // 验证是否是文件夹所有者
    await this.permissionService.requireOwner(userId, folderId);

    const share = await this.prisma.folderShare.findFirst({
      where: { id: shareId, folderId },
    });

    if (!share) {
      throw new NotFoundException('共享记录不存在');
    }

    const updated = await this.prisma.folderShare.update({
      where: { id: shareId },
      data: { permissions: dto.permissions },
      include: { sharedWithUser: {
          select: { id: true, username: true, name: true },
        },
        sharedWithRole: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    this.logger.log(`共享记录 ${shareId} 权限已更新`);

    return {
      id: updated.id,
      sharedWithUser: updated.sharedWithUser || undefined,
      sharedWithRole: updated.sharedWithRole || undefined,
      permissions: updated.permissions,
      createdAt: updated.createdAt,
    };
  }

  /**
   * 取消共享
   * @param folderId 文件夹ID
   * @param shareId 共享记录ID
   * @param userId 操作者ID
   */
  async removeShare(
    folderId: string,
    shareId: string,
    userId: string,
  ): Promise<void> {
    // 验证是否是文件夹所有者
    await this.permissionService.requireOwner(userId, folderId);

    const share = await this.prisma.folderShare.findFirst({
      where: { id: shareId, folderId },
    });

    if (!share) {
      throw new NotFoundException('共享记录不存在');
    }

    await this.prisma.folderShare.delete({
      where: { id: shareId },
    });

    // 检查是否还有其他共享记录，如果没有则重置文件夹共享类型
    const remainingShares = await this.prisma.folderShare.count({
      where: { folderId },
    });

    if (remainingShares === 0) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
      });
      // 只有用户共享类型的文件夹才重置
      if (folder && folder.shareType === FolderShareType.USER) {
        await this.prisma.folder.update({
          where: { id: folderId },
          data: { shareType: FolderShareType.NONE },
        });
      }
    }

    this.logger.log(`共享记录 ${shareId} 已删除`);
  }

  /**
   * 创建系统共享文件夹（管理员专用）
   * @param dto 创建信息
   * @param userId 管理员ID
   */
  async createSystemSharedFolder(
    dto: CreateSystemSharedFolderDto,
    userId: string,
  ) {
    // 创建文件夹（关联 realFolderId）
    const folder = await this.prisma.folder.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        realFolderId: dto.realFolderId,
        createdBy: userId,
        shareType: FolderShareType.SYSTEM,
        isSystemShared: true,
      },
    });

    // 为每个角色创建共享记录
    for (const roleId of dto.roleIds) {
      await this.prisma.folderShare.create({
        data: {
          folderId: folder.id,
          sharedWithRoleId: roleId,
          permissions: dto.permissions,
          sharedBy: userId,
        },
      });
    }

    this.logger.log(`系统共享文件夹已创建: ${folder.id}`);

    return folder;
  }

  /**
   * 获取所有系统共享文件夹（管理员专用）
   */
  async getSystemSharedFolders() {
    const folders = await this.prisma.folder.findMany({
      where: {
        isSystemShared: true,
        deletedAt: null,
      },
      include: { folderShares: {
          include: { sharedWithRole: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        _count: {
          select: { files: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        icon: folder.icon,
        fileCount: folder._count.files,
        shares: folder.folderShares
          .filter((s) => s.sharedWithRole)
          .map((s) => ({
            roleId: s.sharedWithRoleId,
            roleName: s.sharedWithRole?.name,
            roleCode: s.sharedWithRole?.code,
            permissions: s.permissions,
          })),
        createdAt: folder.createdAt,
      })),
    };
  }
}
