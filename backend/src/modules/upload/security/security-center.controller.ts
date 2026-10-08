/**
 * 安全中心控制器
 * 提供安全中心UI所需的所有API端点
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ScanReviewService, ScanReviewQueryDto, VerifyFileDto, QuarantineFileDto } from './scan-review.service';
import { VirusScannerService } from './virus-scanner.service';
import { PrismaService } from '../../../config/prisma.service';

/**
 * 批量操作DTO
 */
class BatchVerifyDto {
  fileIds: string[];
  note: string;
}

class BatchQuarantineDto {
  fileIds: string[];
  reason: string;
  deleteFromStorage?: boolean;
}

class BatchDeleteDto {
  fileIds: string[];
}

@ApiTags('安全中心')
@Controller('upload/security')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class SecurityCenterController {
  constructor(
    private readonly scanReviewService: ScanReviewService,
    private readonly virusScannerService: VirusScannerService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================
  // 安全统计API
  // ============================================

  /**
   * 获取安全中心统计数据
   */
  @Get('stats')
  @Permissions('security:events')
  @ApiOperation({ summary: '获取安全中心统计数据' })
  async getSecurityStats() {
    // 获取各状态文件数量
    const [
      totalFiles,
      pendingScan,
      clean,
      threatDetected,
      verifiedSafe,
      quarantined,
      scanFailed,
    ] = await Promise.all([
      this.prisma.file.count({ where: { deletedAt: null } }),
      this.prisma.file.count({ where: { status: 'PENDING', deletedAt: null } }),
      this.prisma.file.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.file.count({ where: { status: 'THREAT_DETECTED', deletedAt: null } }),
      this.prisma.file.count({ where: { status: 'VERIFIED_SAFE', deletedAt: null } }),
      this.prisma.file.count({ where: { status: 'QUARANTINED', deletedAt: null } }),
      this.prisma.file.count({ 
        where: { 
          virusScanResult: { startsWith: 'scan_failed' },
          deletedAt: null,
        } 
      }),
    ]);

    // 获取扫描器状态
    const scannerStatus = await this.virusScannerService.getStatus();

    return {
      totalFiles,
      pendingScan,
      clean,
      threatDetected,
      verifiedSafe,
      quarantined,
      scanFailed,
      scannerAvailable: scannerStatus.available,
    };
  }

  // ============================================
  // 扫描审核API
  // ============================================

  /**
   * 获取待审核文件列表
   */
  @Get('scan-files')
  @Permissions('security:scan-review')
  @ApiOperation({ summary: '获取待审核文件列表' })
  async getScanFiles(
    @CurrentUser('userId') userId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: ScanReviewQueryDto = {
      status: status || 'THREAT_DETECTED',
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.scanReviewService.getPendingScanFiles(userId, query);
  }

  /**
   * 确认文件安全
   */
  @Post('verify/:fileId')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '确认文件安全' })
  async verifyFileSafe(
    @CurrentUser('userId') userId: string,
    @Param('fileId') fileId: string,
    @Body() dto: VerifyFileDto,
  ) {
    return this.scanReviewService.verifyFileSafe(userId, fileId, dto);
  }

  /**
   * 隔离危险文件
   */
  @Post('quarantine/:fileId')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '隔离危险文件' })
  async quarantineFile(
    @CurrentUser('userId') userId: string,
    @Param('fileId') fileId: string,
    @Body() dto: QuarantineFileDto,
  ) {
    return this.scanReviewService.quarantineFile(userId, fileId, dto);
  }

  /**
   * 重新扫描文件
   */
  @Post('rescan/:fileId')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重新扫描文件' })
  async rescanFile(
    @CurrentUser('userId') userId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.scanReviewService.rescanFile(userId, fileId);
  }

  /**
   * 批量确认文件安全
   */
  @Post('batch-verify')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量确认文件安全' })
  async batchVerify(
    @CurrentUser('userId') userId: string,
    @Body() dto: BatchVerifyDto,
  ) {
    const results = {
      successCount: 0,
      failedCount: 0,
      failedIds: [] as string[],
    };

    for (const fileId of dto.fileIds) {
      try {
        await this.scanReviewService.verifyFileSafe(userId, fileId, { note: dto.note });
        results.successCount++;
      } catch (error) {
        results.failedCount++;
        results.failedIds.push(fileId);
      }
    }

    return results;
  }

  /**
   * 批量隔离文件
   */
  @Post('batch-quarantine')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量隔离文件' })
  async batchQuarantine(
    @CurrentUser('userId') userId: string,
    @Body() dto: BatchQuarantineDto,
  ) {
    const results = {
      successCount: 0,
      failedCount: 0,
      failedIds: [] as string[],
    };

    for (const fileId of dto.fileIds) {
      try {
        await this.scanReviewService.quarantineFile(userId, fileId, {
          reason: dto.reason,
          deleteFromStorage: dto.deleteFromStorage,
        });
        results.successCount++;
      } catch (error) {
        results.failedCount++;
        results.failedIds.push(fileId);
      }
    }

    return results;
  }

  /**
   * 批量物理删除已隔离文件
   */
  @Post('batch-delete')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量物理删除已隔离文件' })
  async batchDelete(
    @CurrentUser('userId') userId: string,
    @Body() dto: BatchDeleteDto,
  ) {
    return this.scanReviewService.batchPhysicalDelete(userId, dto.fileIds);
  }

  // ============================================
  // 安全事件API
  // ============================================

  /**
   * 获取安全事件列表
   */
  @Get('events')
  @Permissions('security:events')
  @ApiOperation({ summary: '获取安全事件列表' })
  async getSecurityEvents(
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = Math.min(pageSize ? parseInt(pageSize, 10) : 20, 100);

    const where: any = {};
    
    if (eventType && eventType !== 'all') {
      where.type = eventType;
    }
    if (severity && severity !== 'all') {
      where.severity = severity;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (ipAddress) {
      where.ipAddress = { contains: ipAddress };
    }

    const [events, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
        include: { user: {
            select: { id: true, username: true, name: true },
          },
        },
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    // 获取统计数据
    const [totalCount, newCount, investigatingCount, resolvedCount] = await Promise.all([
      this.prisma.securityLog.count(),
      this.prisma.securityLog.count({ where: { status: 'NEW' } }),
      this.prisma.securityLog.count({ where: { status: 'INVESTIGATING' } }),
      this.prisma.securityLog.count({ where: { status: 'RESOLVED' } }),
    ]);

    return {
      items: events.map(event => ({
        id: event.id,
        eventType: event.type,
        severity: event.severity,
        status: event.status || 'NEW',
        userId: event.userId,
        username: event.user?.username,
        ipAddress: event.ipAddress,
        location: event.location,
        details: event.details,
        actionTaken: event.actionTaken,
        notes: event.notes,
        acknowledgedBy: event.acknowledgedBy,
        acknowledgedAt: event.acknowledgedAt,
        createdAt: event.createdAt,
      })),
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
      statistics: {
        totalCount,
        newCount,
        investigatingCount,
        resolvedCount,
      },
    };
  }

  /**
   * 确认安全事件
   */
  @Post('events/:eventId/acknowledge')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '确认安全事件' })
  async acknowledgeEvent(
    @CurrentUser('userId') userId: string,
    @Param('eventId') eventId: string,
    @Body() dto: { status?: string; actionTaken?: string; notes?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    const updated = await this.prisma.securityLog.update({
      where: { id: eventId },
      data: {
        status: dto.status || 'INVESTIGATING',
        actionTaken: dto.actionTaken,
        notes: dto.notes,
        acknowledgedBy: user?.username || userId,
        acknowledgedAt: new Date(),
      },
    });

    return {
      success: true,
      event: updated,
    };
  }

  /**
   * 批量确认安全事件
   */
  @Post('events/batch-acknowledge')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量确认安全事件' })
  async batchAcknowledgeEvents(
    @CurrentUser('userId') userId: string,
    @Body() dto: { eventIds: string[]; notes?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    let successCount = 0;
    let failedCount = 0;

    for (const eventId of dto.eventIds) {
      try {
        await this.prisma.securityLog.update({
          where: { id: eventId },
          data: {
            status: 'INVESTIGATING',
            notes: dto.notes,
            acknowledgedBy: user?.username || userId,
            acknowledgedAt: new Date(),
          },
        });
        successCount++;
      } catch {
        failedCount++;
      }
    }

    return {
      success: true,
      successCount,
      failedCount,
    };
  }

  /**
   * 批量删除安全事件
   */
  @Post('events/batch-delete')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量删除安全事件' })
  async batchDeleteEvents(
    @Body() dto: { eventIds: string[] },
  ) {
    const result = await this.prisma.securityLog.deleteMany({
      where: { id: { in: dto.eventIds } },
    });
    return { success: true, deletedCount: result.count };
  }

  // ============================================
  // 扫描器状态API
  // ============================================

  /**
   * 获取病毒扫描器状态
   */
  @Get('scanner/status')
  @Permissions('security:config')
  @ApiOperation({ summary: '获取病毒扫描器状态' })
  async getScannerStatus() {
    return this.virusScannerService.getStatus();
  }

  // ============================================
  // 上传安全配置API
  // ============================================

  /**
   * 获取上传安全配置
   */
  @Get('config')
  @Permissions('security:config')
  @ApiOperation({ summary: '获取上传安全配置' })
  async getSecurityConfig() {
    let config = await this.prisma.uploadSecurityConfig.findUnique({
      where: { id: 1 },
    });

    // 如果配置不存在，创建默认配置
    if (!config) {
      config = await this.prisma.uploadSecurityConfig.create({
        data: { id: 1 },
      });
    }

    return {
      enableFormatLimit: config.enableFormatLimit,
      enableBlacklist: config.enableBlacklist,
      globalMaxFiles: config.globalMaxFiles,
      dangerousExtensions: config.dangerousExtensions,
      enableVirusScan: config.enableVirusScan,
      scanTimeoutSeconds: config.scanTimeoutSeconds,
      autoQuarantine: config.autoQuarantine,
      minFreeSpaceBytes: Number(config.minFreeSpaceBytes),
      enableSpaceCheck: config.enableSpaceCheck,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * 更新上传安全配置
   */
  @Put('config')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新上传安全配置' })
  async updateSecurityConfig(
    @CurrentUser('userId') userId: string,
    @Body() dto: {
      enableFormatLimit?: boolean;
      enableBlacklist?: boolean;
      enableVirusScan?: boolean;
      autoQuarantine?: boolean;
      enableSpaceCheck?: boolean;
      scanTimeoutSeconds?: number;
    },
  ) {
    const updateData: any = {
      updatedBy: userId,
    };

    if (dto.enableFormatLimit !== undefined) updateData.enableFormatLimit = dto.enableFormatLimit;
    if (dto.enableBlacklist !== undefined) updateData.enableBlacklist = dto.enableBlacklist;
    if (dto.enableVirusScan !== undefined) updateData.enableVirusScan = dto.enableVirusScan;
    if (dto.autoQuarantine !== undefined) updateData.autoQuarantine = dto.autoQuarantine;
    if (dto.enableSpaceCheck !== undefined) updateData.enableSpaceCheck = dto.enableSpaceCheck;
    if (dto.scanTimeoutSeconds !== undefined) updateData.scanTimeoutSeconds = dto.scanTimeoutSeconds;

    // 确保配置存在
    await this.prisma.uploadSecurityConfig.upsert({
      where: { id: 1 },
      create: { id: 1, ...updateData },
      update: updateData,
    });

    return this.getSecurityConfig();
  }

  // ============================================
  // 文件格式配置API
  // ============================================

  /**
   * 获取文件格式配置列表
   */
  @Get('formats')
  @Permissions('security:config')
  @ApiOperation({ summary: '获取文件格式配置列表' })
  async getFileFormats() {
    const formats = await this.prisma.fileFormatConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return {
      items: formats.map(f => ({
        id: f.id,
        fileExtension: f.extension,
        displayName: f.displayName,
        mimeTypes: f.mimeTypes as string[],
        maxSize: Number(f.maxSize),
        minSize: Number(f.minSize),
        category: f.category,
        isEnabled: f.isEnabled,
        sortOrder: f.sortOrder,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
      total: formats.length,
    };
  }

  /**
   * 创建文件格式配置
   */
  @Post('formats')
  @Permissions('security:config')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建文件格式配置' })
  async createFileFormat(
    @Body() dto: {
      fileExtension: string;
      displayName: string;
      mimeTypes: string[];
      maxSize: number;
      minSize?: number;
      category?: string;
      isEnabled?: boolean;
    },
  ) {
    const format = await this.prisma.fileFormatConfig.create({
      data: {
        extension: dto.fileExtension.toLowerCase().replace(/^\./, ''),
        displayName: dto.displayName,
        mimeTypes: dto.mimeTypes,
        maxSize: BigInt(dto.maxSize),
        minSize: BigInt(dto.minSize || 0),
        category: dto.category as any,
        isEnabled: dto.isEnabled ?? true,
      },
    });

    return {
      id: format.id,
      fileExtension: format.extension,
      displayName: format.displayName,
      mimeTypes: format.mimeTypes,
      maxSize: Number(format.maxSize),
      minSize: Number(format.minSize),
      isEnabled: format.isEnabled,
    };
  }

  /**
   * 更新文件格式配置
   */
  @Put('formats/:formatId')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新文件格式配置' })
  async updateFileFormat(
    @Param('formatId') formatId: string,
    @Body() dto: {
      displayName?: string;
      mimeTypes?: string[];
      maxSize?: number;
      minSize?: number;
      isEnabled?: boolean;
    },
  ) {
    const updateData: any = {};
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.mimeTypes !== undefined) updateData.mimeTypes = dto.mimeTypes;
    if (dto.maxSize !== undefined) updateData.maxSize = BigInt(dto.maxSize);
    if (dto.minSize !== undefined) updateData.minSize = BigInt(dto.minSize);
    if (dto.isEnabled !== undefined) updateData.isEnabled = dto.isEnabled;

    const format = await this.prisma.fileFormatConfig.update({
      where: { id: formatId },
      data: updateData,
    });

    return {
      id: format.id,
      fileExtension: format.extension,
      displayName: format.displayName,
      mimeTypes: format.mimeTypes,
      maxSize: Number(format.maxSize),
      minSize: Number(format.minSize),
      isEnabled: format.isEnabled,
    };
  }

  /**
   * 删除文件格式配置
   */
  @Delete('formats/:formatId')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除文件格式配置' })
  async deleteFileFormat(@Param('formatId') formatId: string) {
    await this.prisma.fileFormatConfig.delete({
      where: { id: formatId },
    });

    return { success: true };
  }

  /**
   * 切换文件格式启用状态
   */
  @Post('formats/:formatId/toggle')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换文件格式启用状态' })
  async toggleFileFormat(@Param('formatId') formatId: string) {
    const format = await this.prisma.fileFormatConfig.findUnique({
      where: { id: formatId },
    });

    if (!format) {
      throw new Error('格式配置不存在');
    }

    const updated = await this.prisma.fileFormatConfig.update({
      where: { id: formatId },
      data: { isEnabled: !format.isEnabled },
    });

    return {
      id: updated.id,
      isEnabled: updated.isEnabled,
    };
  }

  // ============================================
  // 黑名单管理API
  // ============================================

  /**
   * 添加黑名单扩展名
   */
  @Post('blacklist')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '添加黑名单扩展名' })
  async addBlacklistExtension(
    @Body() dto: { extension: string },
  ) {
    const ext = dto.extension.toLowerCase().replace(/^\./, '');
    const config = await this.prisma.uploadSecurityConfig.findUnique({
      where: { id: 1 },
    });

    const currentList = (config?.dangerousExtensions || []) as string[];
    if (currentList.includes(ext)) {
      return { success: true, dangerousExtensions: currentList, message: '扩展名已存在' };
    }

    const updated = await this.prisma.uploadSecurityConfig.update({
      where: { id: 1 },
      data: { dangerousExtensions: [...currentList, ext] },
    });

    return {
      success: true,
      dangerousExtensions: updated.dangerousExtensions,
    };
  }

  /**
   * 删除黑名单扩展名
   */
  @Delete('blacklist/:ext')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除黑名单扩展名' })
  async removeBlacklistExtension(
    @Param('ext') ext: string,
  ) {
    const extension = ext.toLowerCase().replace(/^\./, '');
    const config = await this.prisma.uploadSecurityConfig.findUnique({
      where: { id: 1 },
    });

    const currentList = (config?.dangerousExtensions || []) as string[];
    const newList = currentList.filter(e => e !== extension);

    const updated = await this.prisma.uploadSecurityConfig.update({
      where: { id: 1 },
      data: { dangerousExtensions: newList },
    });

    return {
      success: true,
      dangerousExtensions: updated.dangerousExtensions,
    };
  }

  /**
   * 初始化常用危险格式黑名单
   */
  @Post('blacklist/init')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '初始化常用危险格式黑名单' })
  async initBlacklistFormats() {
    const defaultDangerousExtensions = [
      // 可执行文件
      'exe', 'bat', 'cmd', 'com', 'pif',
      // Shell脚本
      'sh', 'bash', 'zsh', 'fish',
      // 服务端脚本
      'php', 'jsp', 'asp', 'aspx',
      // 动态库
      'dll', 'so', 'dylib',
      // 其他危险格式
      'scr', 'vbs', 'ps1', 'jar',
      'msi', 'app', 'deb', 'rpm',
      // Windows快捷方式
      'lnk', 'url',
      // 宏文件
      'docm', 'xlsm', 'pptm',
    ];

    await this.prisma.uploadSecurityConfig.update({
      where: { id: 1 },
      data: { dangerousExtensions: defaultDangerousExtensions },
    });

    return {
      success: true,
      dangerousExtensions: defaultDangerousExtensions,
      message: `已重置为 ${defaultDangerousExtensions.length} 个常用危险格式`,
    };
  }

  // ============================================
  // 白名单格式初始化API
  // ============================================

  /**
   * 批量创建常用文件格式
   * 注意：此操作会删除所有现有格式配置，然后重新创建标准格式列表
   * 这样可以在编辑或删除失误后恢复到初始状态
   */
  @Post('formats/init-common')
  @Permissions('security:config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '初始化常用文件格式（完全重置）' })
  async initCommonFormats() {
    // 完整的常用格式列表（包含图片、视频、文档、办公、压缩包、镜像等）
    const commonFormats = [
      // ===== 图片格式 =====
      { ext: 'jpg', name: 'JPG 图片', mimes: ['image/jpeg'], maxSize: 10 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'jpeg', name: 'JPEG 图片', mimes: ['image/jpeg'], maxSize: 10 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'png', name: 'PNG 图片', mimes: ['image/png'], maxSize: 10 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'gif', name: 'GIF 图片', mimes: ['image/gif'], maxSize: 5 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'webp', name: 'WebP 图片', mimes: ['image/webp'], maxSize: 10 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'svg', name: 'SVG 矢量图', mimes: ['image/svg+xml'], maxSize: 2 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'ico', name: 'ICO 图标', mimes: ['image/x-icon', 'image/vnd.microsoft.icon'], maxSize: 1 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'bmp', name: 'BMP 位图', mimes: ['image/bmp'], maxSize: 20 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'tiff', name: 'TIFF 图片', mimes: ['image/tiff'], maxSize: 50 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'tif', name: 'TIF 图片', mimes: ['image/tiff'], maxSize: 50 * 1024 * 1024, category: 'IMAGE' },
      
      // ===== 视频格式 =====
      { ext: 'mp4', name: 'MP4 视频', mimes: ['video/mp4'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'webm', name: 'WebM 视频', mimes: ['video/webm'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'mov', name: 'MOV 视频', mimes: ['video/quicktime'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'avi', name: 'AVI 视频', mimes: ['video/x-msvideo'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'mkv', name: 'MKV 视频', mimes: ['video/x-matroska'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'wmv', name: 'WMV 视频', mimes: ['video/x-ms-wmv'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'flv', name: 'FLV 视频', mimes: ['video/x-flv'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      
      // ===== 音频格式 =====
      { ext: 'mp3', name: 'MP3 音频', mimes: ['audio/mpeg'], maxSize: 50 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'wav', name: 'WAV 音频', mimes: ['audio/wav', 'audio/x-wav'], maxSize: 100 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'flac', name: 'FLAC 音频', mimes: ['audio/flac'], maxSize: 100 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'aac', name: 'AAC 音频', mimes: ['audio/aac'], maxSize: 50 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'ogg', name: 'OGG 音频', mimes: ['audio/ogg'], maxSize: 50 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'wma', name: 'WMA 音频', mimes: ['audio/x-ms-wma'], maxSize: 50 * 1024 * 1024, category: 'AUDIO' },
      
      // ===== 文档格式 =====
      { ext: 'pdf', name: 'PDF 文档', mimes: ['application/pdf'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'txt', name: '文本文件', mimes: ['text/plain'], maxSize: 10 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'rtf', name: 'RTF 文档', mimes: ['application/rtf', 'text/rtf'], maxSize: 20 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'md', name: 'Markdown 文档', mimes: ['text/markdown', 'text/x-markdown'], maxSize: 10 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'csv', name: 'CSV 表格', mimes: ['text/csv'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'json', name: 'JSON 文件', mimes: ['application/json'], maxSize: 10 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'xml', name: 'XML 文件', mimes: ['application/xml', 'text/xml'], maxSize: 10 * 1024 * 1024, category: 'DOCUMENT' },
      
      // ===== Office 办公格式 =====
      // Word 文档
      { ext: 'doc', name: 'Word 文档 (旧版)', mimes: ['application/msword'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'docx', name: 'Word 文档', mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      // Excel 表格
      { ext: 'xls', name: 'Excel 表格 (旧版)', mimes: ['application/vnd.ms-excel'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'xlsx', name: 'Excel 表格', mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      // PowerPoint 幻灯片
      { ext: 'ppt', name: 'PowerPoint 幻灯片 (旧版)', mimes: ['application/vnd.ms-powerpoint'], maxSize: 100 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'pptx', name: 'PowerPoint 幻灯片', mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], maxSize: 100 * 1024 * 1024, category: 'DOCUMENT' },
      // WPS 办公格式
      { ext: 'wps', name: 'WPS 文档', mimes: ['application/vnd.ms-works'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'et', name: 'WPS 表格', mimes: ['application/vnd.ms-works'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'dps', name: 'WPS 演示', mimes: ['application/vnd.ms-works'], maxSize: 100 * 1024 * 1024, category: 'DOCUMENT' },
      // OpenDocument 格式
      { ext: 'odt', name: 'OpenDocument 文档', mimes: ['application/vnd.oasis.opendocument.text'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'ods', name: 'OpenDocument 表格', mimes: ['application/vnd.oasis.opendocument.spreadsheet'], maxSize: 50 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'odp', name: 'OpenDocument 演示', mimes: ['application/vnd.oasis.opendocument.presentation'], maxSize: 100 * 1024 * 1024, category: 'DOCUMENT' },
      
      // ===== 压缩包格式 =====
      { ext: 'zip', name: 'ZIP 压缩包', mimes: ['application/zip', 'application/x-zip-compressed'], maxSize: 1024 * 1024 * 1024, category: 'ARCHIVE' },
      { ext: 'rar', name: 'RAR 压缩包', mimes: ['application/x-rar-compressed', 'application/vnd.rar'], maxSize: 1024 * 1024 * 1024, category: 'ARCHIVE' },
      { ext: '7z', name: '7Z 压缩包', mimes: ['application/x-7z-compressed'], maxSize: 1024 * 1024 * 1024, category: 'ARCHIVE' },
      { ext: 'tar', name: 'TAR 归档', mimes: ['application/x-tar'], maxSize: 1024 * 1024 * 1024, category: 'ARCHIVE' },
      { ext: 'gz', name: 'GZ 压缩包', mimes: ['application/gzip'], maxSize: 1024 * 1024 * 1024, category: 'ARCHIVE' },
      { ext: 'bz2', name: 'BZ2 压缩包', mimes: ['application/x-bzip2'], maxSize: 1024 * 1024 * 1024, category: 'ARCHIVE' },
      { ext: 'xz', name: 'XZ 压缩包', mimes: ['application/x-xz'], maxSize: 1024 * 1024 * 1024, category: 'ARCHIVE' },
      
      // ===== 镜像格式 =====
      { ext: 'dmg', name: 'DMG 镜像', mimes: ['application/x-apple-diskimage'], maxSize: 10 * 1024 * 1024 * 1024, category: 'ARCHIVE' },
      { ext: 'iso', name: 'ISO 镜像', mimes: ['application/x-iso9660-image'], maxSize: 10 * 1024 * 1024 * 1024, category: 'ARCHIVE' },
      
      // ===== 电子书格式 =====
      { ext: 'epub', name: 'EPUB 电子书', mimes: ['application/epub+zip'], maxSize: 100 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'mobi', name: 'MOBI 电子书', mimes: ['application/x-mobipocket-ebook'], maxSize: 100 * 1024 * 1024, category: 'DOCUMENT' },
      
      // ===== 字体格式 =====
      { ext: 'ttf', name: 'TTF 字体', mimes: ['font/ttf', 'application/x-font-ttf'], maxSize: 20 * 1024 * 1024, category: 'OTHER' },
      { ext: 'otf', name: 'OTF 字体', mimes: ['font/otf', 'application/x-font-otf'], maxSize: 20 * 1024 * 1024, category: 'OTHER' },
      { ext: 'woff', name: 'WOFF 字体', mimes: ['font/woff'], maxSize: 10 * 1024 * 1024, category: 'OTHER' },
      { ext: 'woff2', name: 'WOFF2 字体', mimes: ['font/woff2'], maxSize: 10 * 1024 * 1024, category: 'OTHER' },
      
      // ===== 设计类格式（美工常用） =====
      // Adobe Photoshop
      { ext: 'psd', name: 'Photoshop 文件', mimes: ['image/vnd.adobe.photoshop', 'application/x-photoshop'], maxSize: 500 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'psb', name: 'Photoshop 大型文件', mimes: ['image/vnd.adobe.photoshop'], maxSize: 2 * 1024 * 1024 * 1024, category: 'IMAGE' },
      // Adobe Illustrator
      { ext: 'ai', name: 'Illustrator 文件', mimes: ['application/postscript', 'application/illustrator'], maxSize: 200 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'eps', name: 'EPS 矢量图', mimes: ['application/postscript', 'image/x-eps'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      // Adobe InDesign
      { ext: 'indd', name: 'InDesign 文件', mimes: ['application/x-indesign'], maxSize: 500 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'indt', name: 'InDesign 模板', mimes: ['application/x-indesign'], maxSize: 500 * 1024 * 1024, category: 'DOCUMENT' },
      // Adobe XD
      { ext: 'xd', name: 'Adobe XD 文件', mimes: ['application/octet-stream'], maxSize: 200 * 1024 * 1024, category: 'IMAGE' },
      // Sketch
      { ext: 'sketch', name: 'Sketch 文件', mimes: ['application/octet-stream'], maxSize: 200 * 1024 * 1024, category: 'IMAGE' },
      // Figma (导出格式)
      { ext: 'fig', name: 'Figma 文件', mimes: ['application/octet-stream'], maxSize: 200 * 1024 * 1024, category: 'IMAGE' },
      // CorelDRAW
      { ext: 'cdr', name: 'CorelDRAW 文件', mimes: ['application/cdr', 'application/x-cdr'], maxSize: 200 * 1024 * 1024, category: 'IMAGE' },
      // AutoCAD
      { ext: 'dwg', name: 'AutoCAD 图纸', mimes: ['application/acad', 'image/vnd.dwg'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'dxf', name: 'AutoCAD 交换格式', mimes: ['application/dxf', 'image/vnd.dxf'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      // 3D 设计格式
      { ext: 'obj', name: 'OBJ 3D模型', mimes: ['model/obj', 'application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'OTHER' },
      { ext: 'fbx', name: 'FBX 3D模型', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'OTHER' },
      { ext: 'stl', name: 'STL 3D打印模型', mimes: ['model/stl', 'application/sla'], maxSize: 200 * 1024 * 1024, category: 'OTHER' },
      { ext: 'blend', name: 'Blender 文件', mimes: ['application/x-blender'], maxSize: 500 * 1024 * 1024, category: 'OTHER' },
      { ext: 'max', name: '3ds Max 文件', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'OTHER' },
      { ext: 'c4d', name: 'Cinema 4D 文件', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'OTHER' },
      // 其他设计格式
      { ext: 'raw', name: 'RAW 原始图像', mimes: ['image/x-raw', 'image/x-dcraw'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'cr2', name: 'Canon RAW', mimes: ['image/x-canon-cr2'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'nef', name: 'Nikon RAW', mimes: ['image/x-nikon-nef'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'arw', name: 'Sony RAW', mimes: ['image/x-sony-arw'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'dng', name: 'DNG 通用RAW', mimes: ['image/x-adobe-dng'], maxSize: 100 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'heic', name: 'HEIC 图片', mimes: ['image/heic', 'image/heif'], maxSize: 50 * 1024 * 1024, category: 'IMAGE' },
      { ext: 'heif', name: 'HEIF 图片', mimes: ['image/heif'], maxSize: 50 * 1024 * 1024, category: 'IMAGE' },
      
      // ===== 视频编辑格式 =====
      // Adobe Premiere Pro
      { ext: 'prproj', name: 'Premiere Pro 项目', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      // Adobe After Effects
      { ext: 'aep', name: 'After Effects 项目', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'aet', name: 'After Effects 模板', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      // Final Cut Pro
      { ext: 'fcpx', name: 'Final Cut Pro 项目', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'fcpxml', name: 'Final Cut Pro XML', mimes: ['application/xml'], maxSize: 50 * 1024 * 1024, category: 'VIDEO' },
      // DaVinci Resolve
      { ext: 'drp', name: 'DaVinci Resolve 项目', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      // Sony Vegas
      { ext: 'veg', name: 'Vegas Pro 项目', mimes: ['application/octet-stream'], maxSize: 200 * 1024 * 1024, category: 'VIDEO' },
      // 视频编辑通用格式
      { ext: 'mxf', name: 'MXF 专业视频', mimes: ['application/mxf'], maxSize: 10 * 1024 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'r3d', name: 'RED RAW 视频', mimes: ['application/octet-stream'], maxSize: 10 * 1024 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'braw', name: 'Blackmagic RAW', mimes: ['application/octet-stream'], maxSize: 10 * 1024 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'prores', name: 'Apple ProRes', mimes: ['video/prores'], maxSize: 10 * 1024 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'm4v', name: 'M4V 视频', mimes: ['video/x-m4v'], maxSize: 500 * 1024 * 1024, category: 'VIDEO' },
      { ext: '3gp', name: '3GP 视频', mimes: ['video/3gpp'], maxSize: 200 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'ts', name: 'TS 视频流', mimes: ['video/mp2t'], maxSize: 2 * 1024 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'm2ts', name: 'M2TS 蓝光视频', mimes: ['video/mp2t'], maxSize: 10 * 1024 * 1024 * 1024, category: 'VIDEO' },
      { ext: 'vob', name: 'VOB DVD视频', mimes: ['video/dvd'], maxSize: 2 * 1024 * 1024 * 1024, category: 'VIDEO' },
      // 字幕格式
      { ext: 'srt', name: 'SRT 字幕', mimes: ['text/plain', 'application/x-subrip'], maxSize: 5 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'ass', name: 'ASS 字幕', mimes: ['text/plain'], maxSize: 5 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'ssa', name: 'SSA 字幕', mimes: ['text/plain'], maxSize: 5 * 1024 * 1024, category: 'DOCUMENT' },
      { ext: 'vtt', name: 'WebVTT 字幕', mimes: ['text/vtt'], maxSize: 5 * 1024 * 1024, category: 'DOCUMENT' },
      
      // ===== 音频编辑格式 =====
      { ext: 'aif', name: 'AIFF 音频', mimes: ['audio/aiff', 'audio/x-aiff'], maxSize: 500 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'aiff', name: 'AIFF 音频', mimes: ['audio/aiff', 'audio/x-aiff'], maxSize: 500 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'm4a', name: 'M4A 音频', mimes: ['audio/mp4', 'audio/x-m4a'], maxSize: 100 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'opus', name: 'Opus 音频', mimes: ['audio/opus'], maxSize: 50 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'mid', name: 'MIDI 音频', mimes: ['audio/midi', 'audio/x-midi'], maxSize: 10 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'midi', name: 'MIDI 音频', mimes: ['audio/midi', 'audio/x-midi'], maxSize: 10 * 1024 * 1024, category: 'AUDIO' },
      // Adobe Audition
      { ext: 'sesx', name: 'Audition 项目', mimes: ['application/octet-stream'], maxSize: 100 * 1024 * 1024, category: 'AUDIO' },
      // Logic Pro
      { ext: 'logic', name: 'Logic Pro 项目', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'AUDIO' },
      { ext: 'logicx', name: 'Logic Pro X 项目', mimes: ['application/octet-stream'], maxSize: 500 * 1024 * 1024, category: 'AUDIO' },
      // FL Studio
      { ext: 'flp', name: 'FL Studio 项目', mimes: ['application/octet-stream'], maxSize: 200 * 1024 * 1024, category: 'AUDIO' },
      // Ableton Live
      { ext: 'als', name: 'Ableton Live 项目', mimes: ['application/octet-stream'], maxSize: 200 * 1024 * 1024, category: 'AUDIO' },
    ];

    // 先删除所有现有格式配置
    await this.prisma.fileFormatConfig.deleteMany({});

    let createdCount = 0;

    // 重新创建所有格式
    for (let i = 0; i < commonFormats.length; i++) {
      const format = commonFormats[i];
      await this.prisma.fileFormatConfig.create({
        data: {
          extension: format.ext,
          displayName: format.name,
          mimeTypes: format.mimes,
          maxSize: BigInt(format.maxSize),
          category: format.category as any,
          sortOrder: i,
          isEnabled: true,
        },
      });
      createdCount++;
    }

    return {
      success: true,
      createdCount,
      skippedCount: 0,
      message: `已重置为 ${createdCount} 个标准格式`,
    };
  }
}
