import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  StreamableFile,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { SharePermission } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { FolderPermissionService } from './folder-permission.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import type { UserPayload } from '../../common/decorators/current-user.decorator';

/**
 * 业务引用放行表
 *
 * 文件一旦被业务记录引用，它就是该业务的**共享资源**（产品主图、耗材图等），
 * 不应再受「仅上传者本人可见」限制 —— 否则会出现「管理员上传的产品图，
 * 运营一张都看不到」这类误杀。
 *
 * 判定方式：拥有对应模块**查看权限**的用户即可读。
 * 新增业务图片字段时在下面登记一条即可（permission 取该模块的查看码）。
 */
const BIZ_FILE_REFS: Array<{
  permission: string;
  referenced: (prisma: PrismaService, fileId: string) => Promise<boolean>;
}> = [
  {
    permission: 'product:view',
    referenced: async (prisma, fileId) =>
      (await prisma.product.count({ where: { mainImage: fileId } })) > 0,
  },
  {
    permission: 'consumable:view',
    referenced: async (prisma, fileId) =>
      (await prisma.consumable.count({ where: { image: fileId } })) > 0,
  },
];

/**
 * 公共文件控制器
 *
 * 用途：供 `<img src>` / `<iframe>` 这类**无法携带 Authorization 头**的资源请求使用。
 * 浏览器拉取图片时不会带认证头，因此令牌通过查询参数传递：`?token=<accessToken>`。
 *
 * 安全规则（2026-10-12 收紧；此前为「任意 fileId 可匿名读取」）：
 *   1. 必须携带有效令牌，且账号未被停用 / 未被删除；
 *   2. 上传者本人可读；
 *   3. 文件归属某文件夹时，需对该文件夹具备 VIEW 权限（共享文件夹场景）；
 *   4. 文件被**业务记录**引用时，拥有该业务模块查看权限者（如 `product:view`）可读
 *      —— 业务图片属共享资源，不按上传者归属限制；
 *   5. 其它情况一律 403 —— 不再允许匿名读取任意文件；
 *   6. 已隔离（status = QUARANTINED）的文件任何情况都不返回。
 *
 * 注意：对外分享不依赖本端点（分享走 `GET /shares/:code/file`，含密码与
 * shareAccess 校验）；头像走 `/auth/avatar/:userId`；验证码背景图走
 * `/captcha-settings/backgrounds/:id/image`，均不受本收紧影响。
 */
@ApiTags('公共文件访问')
@Controller('public/files')
export class PublicFileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly localStorageService: LocalStorageService,
    private readonly folderPermissionService: FolderPermissionService,
    private readonly jwtService: JwtService,
  ) {}

  /** 从 `Authorization: Bearer` 或 `?token=` 解析当前用户；无令牌 / 无效 / 账号不可用返回 null */
  private async resolveUserId(req: Request): Promise<string | null> {
    const header = req.headers.authorization;
    let token: string | undefined;
    if (header?.startsWith('Bearer ')) token = header.slice(7);
    if (!token) token = (req.query as Record<string, unknown>)?.token as
      | string
      | undefined;
    if (!token || typeof token !== 'string') return null;

    try {
      const payload = await this.jwtService.verifyAsync<UserPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true, deletedAt: true },
      });
      if (!user || user.deletedAt || user.status === 'SUSPENDED') return null;
      return user.id;
    } catch {
      return null;
    }
  }

  /** 统一的文件可读性校验（fail-closed；super_admin 豁免） */
  private async assertCanRead(
    file: {
      id: string;
      uploadedBy: string | null;
      folderId: string | null;
      status: string | null;
    },
    userId: string | null,
  ): Promise<void> {
    if (file.status === 'QUARANTINED') {
      throw new ForbiddenException('文件已被安全隔离，暂不可访问');
    }
    if (!userId) {
      throw new UnauthorizedException('未提供有效访问令牌');
    }
    if (file.uploadedBy === userId) return;
    // 超管可访问全部文件（与 FileService 的归属校验口径一致）
    if (await this.isSuperAdminUser(userId)) return;
    if (file.folderId) {
      const allowed = await this.folderPermissionService.checkPermission(
        userId,
        file.folderId,
        SharePermission.VIEW,
      );
      if (allowed) return;
    }
    // 业务引用放行：文件被业务记录引用时，随该业务模块的查看权限共享
    if (await this.isBizSharedFile(file.id, userId)) return;
    throw new ForbiddenException('无权访问该文件');
  }

  /**
   * 文件是否作为「业务共享资源」对该用户可读
   *
   * 按 `BIZ_FILE_REFS` 顺序短路：命中任一业务引用、且用户具备该模块查看权限即放行。
   * 权限查询复用 `PermissionGuard` 的同一份缓存，避免与本守卫口径不一致。
   */
  private async isBizSharedFile(
    fileId: string,
    userId: string,
  ): Promise<boolean> {
    for (const ref of BIZ_FILE_REFS) {
      const referenced = await ref.referenced(this.prisma, fileId);
      if (!referenced) continue;
      const allowed = await PermissionGuard.hasAnyPermission(
        this.prisma,
        userId,
        [ref.permission],
      );
      if (allowed) return true;
    }
    return false;
  }

  /** 是否超级管理员（查库口径，与 PermissionGuard 一致） */
  private async isSuperAdminUser(userId: string): Promise<boolean> {
    const rows = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { isActive: true, deletedAt: null, code: 'super_admin' },
      },
      select: { roleId: true },
      take: 1,
    });
    return rows.length > 0;
  }

  /**
   * 预览缩略图（需登录，支持 `?token=`）
   */
  @Get(':id/thumbnail')
  @ApiOperation({ summary: '预览缩略图（需登录，支持 ?token=）' })
  async previewThumbnail(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    await this.assertCanRead(file, await this.resolveUserId(req));

    if (!file.thumbnailUrl) {
      throw new NotFoundException('缩略图不存在');
    }

    // 从文件路径生成缩略图路径（根目录 = 存储桶根目录）
    const thumbnailPath = file.path
      ? file.path.replace(/[^/]+$/, `${file.md5}_thumb.jpg`)
      : `${file.md5}_thumb.jpg`;

    // 根据存储类型选择下载方式
    let buffer: Buffer;
    if (file.storageType === 'LOCAL') {
      buffer = await this.localStorageService.downloadFile(thumbnailPath);
    } else {
      buffer = await this.storageService.download(thumbnailPath);
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(buffer);
  }

  /**
   * 预览文件（需登录，支持 `?token=`）
   */
  @Get(':id/preview')
  @ApiOperation({ summary: '预览文件（需登录，支持 ?token=）' })
  async previewFile(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    await this.assertCanRead(file, await this.resolveUserId(req));

    if (!file.path) {
      throw new NotFoundException('文件路径不存在');
    }

    // 根据存储类型选择下载方式
    let buffer: Buffer;
    if (file.storageType === 'LOCAL') {
      buffer = await this.localStorageService.downloadFile(file.path);
    } else {
      buffer = await this.storageService.download(file.path);
    }

    res.set({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors 'self' http://localhost:6521",
    });

    return new StreamableFile(buffer);
  }
}
