import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

/**
 * 仪表盘服务
 * 提供仪表盘统计数据聚合功能
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取仪表盘统计数据
   * @returns 仪表盘统计数据
   */
  async getDashboardStats() {
    // 获取总用户数
    const totalUsers = await this.prisma.user.count({
      where: {
        deletedAt: null,
      },
    });

    // 获取角色数量
    const totalRoles = await this.prisma.role.count();

    // 获取文件总数
    const totalFiles = await this.prisma.file.count({
      where: {
        deletedAt: null,
      },
    });

    // 获取今日登录数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogins = await this.prisma.auditLog.count({
      where: {
        action: 'LOGIN',
        createdAt: {
          gte: today,
        },
      },
    });

    return {
      totalUsers,
      totalRoles,
      totalFiles,
      todayLogins,
    };
  }

  /**
   * 获取当前用户个人统计
   */
  async getMyStats(userId: string) {
    const [myFiles, usedSpaceResult, sharedToMe, recentUploads] =
        await Promise.all([
          this.prisma.file.count({
            where: { uploadedBy: userId, deletedAt: null },
          }),
          this.prisma.file.aggregate({
            _sum: { size: true },
            where: { uploadedBy: userId, deletedAt: null },
          }),
          this.prisma.folderShare.count({
            where: { sharedWithUserId: userId },
          }),
          this.prisma.file.count({
            where: {
              uploadedBy: userId,
              deletedAt: null,
              createdAt: {
                gte: new Date(
                    Date.now() - 7 * 24 * 60 * 60 * 1000,
                ),
              },
            },
          }),
        ]);

    return {
      myFiles,
      usedSpace: Number(usedSpaceResult._sum.size ?? 0),
      sharedToMe,
      recentUploads,
    };
  }

  /**
   * 获取当前用户最近上传的文件
   */
  async getRecentFiles(userId: string) {
    const files = await this.prisma.file.findMany({
      where: { uploadedBy: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        originalName: true,
        size: true,
        category: true,
        mimeType: true,
        createdAt: true,
      },
    });

    return files.map((f) => ({
      ...f,
      size: Number(f.size),
    }));
  }
}
