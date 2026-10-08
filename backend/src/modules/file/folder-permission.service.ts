import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SharePermission } from '@prisma/client';

/**
 * 共享文件夹信息
 */
export interface SharedFolderInfo {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  fileCount: number;
  shareType: 'SYSTEM' | 'USER';
  sharedBy: {
    id: string;
    username: string;
    name: string;
  };
  permissions: SharePermission[];
  createdAt: Date;
}

/**
 * 文件夹权限服务
 * 提供文件夹权限检查相关功能
 */
@Injectable()
export class FolderPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 检查用户是否是超级管理员
   */
  async checkIsSuperAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { code: true } } },
    });
    return userRoles.some((r) => r.role.code === 'super_admin');
  }

  /**
   * 检查用户对文件夹的权限
   * 支持子文件夹向上递归查找共享权限
   * @param userId 用户ID
   * @param folderId 文件夹ID
   * @param requiredPermission 需要的权限
   * @returns 是否有权限
   */
  async checkPermission(
    userId: string,
    folderId: string,
    requiredPermission: SharePermission,
  ): Promise<boolean> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId, deletedAt: null },
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

    // 1. 所有者拥有全部权限
    if (folder.createdBy === userId) {
      return true;
    }

    // 2. 超级管理员对系统共享文件夹拥有全部权限
    if (folder.isSystemShared) {
      const isSuperAdmin = await this.checkIsSuperAdmin(userId);
      if (isSuperAdmin) return true;
    }

    // 3. 检查当前文件夹的直接共享权限
    if (folder.folderShares.length > 0) {
      const allPermissions = new Set<SharePermission>();
      folder.folderShares.forEach((share) => {
        share.permissions.forEach((p) => allPermissions.add(p));
      });
      if (this.hasPermission(allPermissions, requiredPermission)) {
        return true;
      }
    }

    // 4. 子文件夹向上递归查找父文件夹的共享权限
    if (folder.parentId) {
      return this.checkPermission(userId, folder.parentId, requiredPermission);
    }

    return false;
  }

  /**
   * 权限包含关系判断
   * DELETE > EDIT > UPLOAD > DOWNLOAD > VIEW
   */
  private hasPermission(
    permissions: Set<SharePermission>,
    required: SharePermission,
  ): boolean {
    // DELETE 包含所有权限
    if (permissions.has(SharePermission.DELETE)) return true;

    // EDIT 包含 VIEW, DOWNLOAD, UPLOAD
    if (permissions.has(SharePermission.EDIT)) {
      const editIncludes: SharePermission[] = [
        SharePermission.VIEW,
        SharePermission.DOWNLOAD,
        SharePermission.UPLOAD,
        SharePermission.EDIT,
      ];
      if (editIncludes.includes(required)) {
        return true;
      }
    }

    // UPLOAD 包含 VIEW, DOWNLOAD
    if (permissions.has(SharePermission.UPLOAD)) {
      const uploadIncludes: SharePermission[] = [
        SharePermission.VIEW,
        SharePermission.DOWNLOAD,
        SharePermission.UPLOAD,
      ];
      if (uploadIncludes.includes(required)) {
        return true;
      }
    }

    // DOWNLOAD 包含 VIEW
    if (permissions.has(SharePermission.DOWNLOAD)) {
      const downloadIncludes: SharePermission[] = [
        SharePermission.VIEW,
        SharePermission.DOWNLOAD,
      ];
      if (downloadIncludes.includes(required)) {
        return true;
      }
    }

    // VIEW 只有自身
    return permissions.has(required);
  }

  /**
   * 获取用户对文件夹的权限列表
   * @param userId 用户ID
   * @param folderId 文件夹ID
   * @returns 权限列表
   */
  async getUserPermissions(
    userId: string,
    folderId: string,
  ): Promise<SharePermission[]> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId, deletedAt: null },
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

    // 所有者拥有全部权限
    if (folder.createdBy === userId) {
      return Object.values(SharePermission);
    }

    // 合并权限
    const permissions = new Set<SharePermission>();
    folder.folderShares.forEach((share) => {
      share.permissions.forEach((p) => permissions.add(p));
    });

    return Array.from(permissions);
  }

  /**
   * 获取共享给用户的所有文件夹
   * @param userId 用户ID
   * @returns 共享文件夹列表
   */
  async getSharedFolders(userId: string): Promise<SharedFolderInfo[]> {
    // 获取用户的角色ID列表
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const roleIds = userRoles.map((ur) => ur.roleId);

    // 查询所有共享给该用户或其角色的文件夹
    const shares = await this.prisma.folderShare.findMany({
      where: {
        OR: [
          { sharedWithUserId: userId },
          ...(roleIds.length > 0
            ? [{ sharedWithRoleId: { in: roleIds } }]
            : []),
        ],
        folder: {
          deletedAt: null,
        },
      },
      include: { folder: {
          include: { user: {
              select: { id: true, username: true, name: true },
            },
            _count: {
              select: { files: true },
            },
          },
        },
        sharer: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    // 按文件夹分组，合并权限
    const folderMap = new Map<string, SharedFolderInfo>();

    shares.forEach((share) => {
      const existing = folderMap.get(share.folderId);
      if (existing) {
        // 合并权限
        const mergedPermissions = new Set([
          ...existing.permissions,
          ...share.permissions,
        ]);
        existing.permissions = Array.from(mergedPermissions);
      } else {
        folderMap.set(share.folderId, {
          id: share.folder.id,
          name: share.folder.name,
          icon: share.folder.icon,
          description: share.folder.description,
          fileCount: share.folder._count.files,
          shareType: share.folder.isSystemShared ? 'SYSTEM' : 'USER',
          sharedBy: share.sharer,
          permissions: [...share.permissions],
          createdAt: share.folder.createdAt,
        });
      }
    });

    return Array.from(folderMap.values());
  }

  /**
   * 验证用户是否有权限访问文件夹，如果没有则抛出异常
   * @param userId 用户ID
   * @param folderId 文件夹ID
   * @param requiredPermission 需要的权限
   */
  async requirePermission(
    userId: string,
    folderId: string,
    requiredPermission: SharePermission,
  ): Promise<void> {
    const hasPermission = await this.checkPermission(
      userId,
      folderId,
      requiredPermission,
    );
    if (!hasPermission) {
      throw new ForbiddenException('无权访问此文件夹');
    }
  }

  /**
   * 检查用户是否是文件夹的所有者
   * @param userId 用户ID
   * @param folderId 文件夹ID
   * @returns 是否是所有者
   */
  async isOwner(userId: string, folderId: string): Promise<boolean> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId, deletedAt: null },
      select: { createdBy: true },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    return folder.createdBy === userId;
  }

  /**
   * 验证用户是否是文件夹的所有者，如果不是则抛出异常
   * @param userId 用户ID
   * @param folderId 文件夹ID
   */
  async requireOwner(userId: string, folderId: string): Promise<void> {
    const isOwner = await this.isOwner(userId, folderId);
    if (!isOwner) {
      throw new ForbiddenException('只有文件夹所有者才能执行此操作');
    }
  }
}
