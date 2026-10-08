/**
 * 扫描审核服务（参照7DL项目实现）
 * 提供威胁文件的审核、隔离、恢复等功能
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { VirusScannerService, ScanResult } from './virus-scanner.service';
import { UploadSecurityService } from './upload-security.service';
import { StorageService } from '../../storage/storage.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// 跳过扫描的文件扩展名（图片/视频/音频）
const SKIP_SCAN_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'heic', 'heif',
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp',
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma',
];

// 必须扫描的文件扩展名
const MUST_SCAN_EXTENSIONS = [
  'exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'app', 'bat', 'cmd', 'sh',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  'iso', 'img', 'esd', 'wim',
  'js', 'vbs', 'ps1', 'py',
];

export interface ScanReviewQueryDto {
  status?: string;
  fileExtension?: string;
  page?: number;
  pageSize?: number;
}

export interface VerifyFileDto {
  note: string;
}

export interface QuarantineFileDto {
  reason: string;
  deleteFromStorage?: boolean;
}

@Injectable()
export class ScanReviewService {
  private readonly logger = new Logger(ScanReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly virusScanner: VirusScannerService,
    private readonly securityService: UploadSecurityService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * 判断文件是否需要扫描
   */
  shouldScanFile(fileExtension: string): 'scan' | 'skip' | 'optional' {
    const ext = fileExtension.toLowerCase();
    
    if (SKIP_SCAN_EXTENSIONS.includes(ext)) {
      return 'skip';
    }
    
    if (MUST_SCAN_EXTENSIONS.includes(ext)) {
      return 'scan';
    }
    
    return 'optional';
  }

  /**
   * 扫描上传的文件
   */
  async scanUploadedFile(
    fileId: string,
    filePath: string,
    fileName: string,
    fileExtension: string,
    userId: string,
  ): Promise<{ scanned: boolean; result?: ScanResult }> {
    const scanDecision = this.shouldScanFile(fileExtension);
    
    if (scanDecision === 'skip') {
      this.logger.log(`⏭️ 媒体文件无需扫描: ${fileName}`);
      return { scanned: false };
    }

    this.logger.log(`🔍 开始病毒扫描: ${fileName} (fileId=${fileId})`);

    try {
      const scanResult = await this.virusScanner.scanFile(filePath);
      
      if (scanResult.isClean) {
        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            virusScanResult: 'clean',
            virusScanAt: new Date(),
            status: 'ACTIVE',
          },
        });
        this.logger.log(`✅ 病毒扫描通过: ${fileName} (${scanResult.scanTime}ms)`);
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
          metadata: {
            threats: scanResult.threats,
            scanTime: scanResult.scanTime,
          },
          severity: 'WARNING',
          timestamp: new Date(),
        });
      }

      return { scanned: true, result: scanResult };
    } catch (scanError: any) {
      this.logger.error(`病毒扫描失败: ${fileName}`, scanError);
      
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          virusScanResult: `scan_failed:${scanError.message}`,
          virusScanAt: new Date(),
        },
      });

      return { scanned: true, result: undefined };
    }
  }

  /**
   * 获取待审核文件列表
   */
  async getPendingScanFiles(userId: string, query: ScanReviewQueryDto) {
    await this.checkAdminPermission(userId);

    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);

    const where: any = {
      deletedAt: null,
    };

    // 支持 ALL/all 查询所有文件，否则按特定状态筛选
    const statusLower = query.status?.toLowerCase();
    if (statusLower && statusLower !== 'all') {
      where.status = query.status;
    }

    if (query.fileExtension) {
      where.extension = query.fileExtension.toLowerCase();
    }

    const [items, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        include: { user: {
            select: { id: true, username: true, name: true },
          },
        },
        orderBy: [{ virusScanAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.file.count({ where }),
    ]);

    const statistics = await this.getScanStatistics();

    return {
      items: items.map((item) => this.formatFile(item)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      statistics,
    };
  }

  /**
   * 获取扫描统计数据
   */
  async getScanStatistics() {
    const statuses = [
      'ACTIVE',
      'THREAT_DETECTED',
      'VERIFIED_SAFE',
      'QUARANTINED',
    ];

    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.file.count({
          where: { status, deletedAt: null },
        }),
      ),
    );

    const byStatus: Record<string, number> = {};
    statuses.forEach((status, index) => {
      byStatus[status] = counts[index];
    });

    // 获取最近检测到的威胁
    const recentThreats = await this.prisma.file.findMany({
      where: {
        status: { in: ['THREAT_DETECTED', 'VERIFIED_SAFE', 'QUARANTINED'] },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        virusScanResult: true,
        virusScanAt: true,
      },
      orderBy: { virusScanAt: 'desc' },
      take: 5,
    });

    const scannerStatus = await this.virusScanner.getStatus();

    return {
      total: counts.reduce((a, b) => a + b, 0),
      byStatus,
      recentThreats: recentThreats.map((t) => ({
        id: t.id,
        fileName: t.name,
        threats: this.parseThreats(t.virusScanResult),
        scannedAt: t.virusScanAt,
      })),
      scannerHealth: scannerStatus,
    };
  }

  /**
   * 审核确认文件安全
   */
  async verifyFileSafe(adminId: string, fileId: string, dto: VerifyFileDto) {
    await this.checkAdminPermission(adminId);

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    const allowedStatuses = ['THREAT_DETECTED', 'QUARANTINED'];
    if (!allowedStatuses.includes(file.status || '')) {
      throw new ConflictException('只能审核待审核或已隔离状态的文件');
    }

    const wasQuarantined = file.status === 'QUARANTINED';

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'VERIFIED_SAFE',
        quarantinedAt: null,
        quarantineReason: null,
        virusScanResult: `verified_safe:${dto.note}`,
      },
      include: { user: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    // 记录安全日志
    await this.securityService.logSecurityEvent({
      type: 'FILE_RELEASED',
      userId: adminId,
      fileId,
      fileName: file.name,
      details: `管理员确认文件安全: ${dto.note}`,
      metadata: {
        originalThreats: file.virusScanResult,
        verifyNote: dto.note,
        wasQuarantined,
      },
      severity: 'INFO',
      timestamp: new Date(),
    });

    this.logger.log(`✅ 文件已确认安全: ${file.name} (ID: ${fileId})`);

    return this.formatFile(updated);
  }

  /**
   * 隔离危险文件
   */
  async quarantineFile(adminId: string, fileId: string, dto: QuarantineFileDto) {
    await this.checkAdminPermission(adminId);

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    if (file.status === 'QUARANTINED') {
      throw new ConflictException('文件已被隔离');
    }

    // 物理隔离文件
    let quarantinePath = '';
    try {
      quarantinePath = await this.physicalQuarantine(file, dto.deleteFromStorage || false);
    } catch (error) {
      this.logger.error(`物理隔离失败: ${file.path}`, error);
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'QUARANTINED',
        quarantinedAt: new Date(),
        quarantineReason: dto.reason,
        quarantinePath: quarantinePath || file.path,
      },
      include: { user: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    // 记录安全日志
    await this.securityService.logSecurityEvent({
      type: 'FILE_QUARANTINED',
      userId: adminId,
      fileId,
      fileName: file.name,
      details: `管理员确认文件危险并隔离: ${dto.reason}`,
      metadata: {
        originalPath: file.path,
        quarantinePath,
        threats: file.virusScanResult,
        reason: dto.reason,
      },
      severity: 'CRITICAL',
      timestamp: new Date(),
    });

    this.logger.warn(`🔒 文件已隔离: ${file.name} (ID: ${fileId})`);

    return {
      ...this.formatFile(updated),
      quarantinePath,
    };
  }

  /**
   * 重新扫描文件
   */
  async rescanFile(adminId: string, fileId: string) {
    await this.checkAdminPermission(adminId);

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    if (file.status === 'QUARANTINED') {
      throw new ConflictException('已隔离的文件无法重新扫描');
    }

    // 获取文件路径
    const filePath = path.join(process.cwd(), 'uploads', file.path);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('文件不存在于存储中');
    }

    // 更新状态为扫描中
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        virusScanResult: 'scanning',
      },
    });

    // 执行扫描
    const scanResult = await this.virusScanner.scanFile(filePath);

    // 更新扫描结果
    const newStatus = scanResult.isClean ? 'ACTIVE' : 'THREAT_DETECTED';
    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: newStatus,
        virusScanResult: scanResult.isClean 
          ? 'clean' 
          : `threat_detected:${scanResult.threats.join(',')}`,
        virusScanAt: new Date(),
      },
    });

    this.logger.log(`🔍 重新扫描完成: ${file.name} -> ${newStatus}`);

    return this.formatFile(updated);
  }

  /**
   * 物理隔离文件
   */
  private async physicalQuarantine(file: any, deleteFromStorage: boolean): Promise<string> {
    const storageType = file.storageType || 'LOCAL';
    
    if (storageType === 'RUSTFS' || storageType === 'S3') {
      if (deleteFromStorage) {
        try {
          await this.storageService.delete(file.path);
          this.logger.log(`🗑️ 已从存储删除文件: ${file.path}`);
          return 'DELETED';
        } catch (error: any) {
          this.logger.error(`存储删除文件失败: ${file.path}`, error);
          throw new InternalServerErrorException(`存储删除文件失败: ${error.message}`);
        }
      } else {
        this.logger.log(`📦 存储文件已标记隔离: ${file.path}`);
        return file.path;
      }
    }
    
    // 本地存储处理
    const today = new Date().toISOString().split('T')[0];
    const quarantineDir = path.join(process.cwd(), 'quarantine', today);

    await fs.mkdir(quarantineDir, { recursive: true });

    const safeFileName = `${file.id}_${path.basename(file.name || 'unknown')}`;
    const quarantinePath = path.join(quarantineDir, safeFileName);

    const sourcePath = path.join(process.cwd(), 'uploads', file.path);

    try {
      await fs.access(sourcePath);

      if (deleteFromStorage) {
        await fs.unlink(sourcePath);
        this.logger.log(`🗑️ 已删除本地文件: ${sourcePath}`);
        return 'DELETED';
      } else {
        await fs.rename(sourcePath, quarantinePath);
        return `quarantine/${today}/${safeFileName}`;
      }
    } catch (error) {
      this.logger.error(`隔离文件失败: ${sourcePath}`, error);
      throw new InternalServerErrorException('隔离文件失败');
    }
  }

  /**
   * 批量物理删除已隔离的文件
   */
  async batchPhysicalDelete(adminId: string, fileIds: string[]): Promise<{
    successCount: number;
    failedCount: number;
    failedIds: string[];
    deletedFiles: string[];
  }> {
    await this.checkAdminPermission(adminId);

    let successCount = 0;
    let failedCount = 0;
    const failedIds: string[] = [];
    const deletedFiles: string[] = [];

    for (const fileId of fileIds) {
      try {
        const result = await this.physicalDeleteFile(adminId, fileId);
        if (result.success) {
          successCount++;
          deletedFiles.push(result.fileName);
        } else {
          failedCount++;
          failedIds.push(fileId);
        }
      } catch (error) {
        this.logger.error(`物理删除文件失败: ${fileId}`, error);
        failedCount++;
        failedIds.push(fileId);
      }
    }

    return {
      successCount,
      failedCount,
      failedIds,
      deletedFiles,
    };
  }

  /**
   * 物理删除单个已隔离的文件
   */
  private async physicalDeleteFile(adminId: string, fileId: string): Promise<{
    success: boolean;
    fileName: string;
  }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    if (file.status !== 'QUARANTINED') {
      throw new ConflictException('只能物理删除已隔离的文件');
    }

    const fileName = file.name || 'unknown';
    const storageType = file.storageType || 'LOCAL';

    // 删除物理文件
    if (file.path && file.quarantinePath !== 'DELETED') {
      try {
        if (storageType === 'RUSTFS' || storageType === 'S3') {
          await this.storageService.delete(file.path);
          this.logger.log(`🗑️ 已从存储删除文件: ${file.path}`);
        } else {
          const filePath = path.join(process.cwd(), file.quarantinePath || file.path);
          await fs.access(filePath);
          await fs.unlink(filePath);
          this.logger.log(`🗑️ 已删除本地文件: ${filePath}`);
        }
      } catch (error: any) {
        this.logger.warn(`物理文件不存在或删除失败: ${file.path}`, error.message);
      }
    }

    // 软删除数据库记录
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        deletedAt: new Date(),
      },
    });

    // 记录安全日志
    await this.securityService.logSecurityEvent({
      type: 'FILE_ISOLATED',
      userId: adminId,
      fileId,
      fileName,
      details: `管理员物理删除已隔离文件: ${fileName}`,
      metadata: {
        originalPath: file.path,
        storageType,
      },
      severity: 'CRITICAL',
      timestamp: new Date(),
    });

    this.logger.warn(`🗑️ 文件已物理删除: ${fileName} (ID: ${fileId})`);

    return {
      success: true,
      fileName,
    };
  }

  /**
   * 检查管理员权限
   */
  private async checkAdminPermission(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('用户不存在');
    }

    // 检查角色code（如super_admin, ADMIN）和角色name（如超级管理员）
    const roleCodes = user.userRoles.map((ur: { role: { code: string } }) => ur.role.code.toLowerCase());
    const roleNames = user.userRoles.map((ur: { role: { name: string } }) => ur.role.name.toLowerCase());
    
    const isAdmin = roleCodes.some((code: string) => 
      code.includes('admin') || code.includes('super')
    ) || roleNames.some((name: string) => 
      name.includes('admin') || name.includes('super') || name.includes('管理')
    );

    if (!isAdmin) {
      throw new ForbiddenException('权限不足');
    }
  }

  /**
   * 解析威胁信息
   */
  private parseThreats(virusScanResult: string | null): string[] {
    if (!virusScanResult) return [];
    if (virusScanResult.startsWith('threat_detected:')) {
      return virusScanResult.replace('threat_detected:', '').split(',');
    }
    return [];
  }

  /**
   * 格式化文件输出
   */
  private formatFile(file: any) {
    return {
      id: file.id,
      fileName: file.name,
      originalName: file.originalName,
      fileSize: Number(file.size),
      extension: file.extension,
      mimeType: file.mimeType,
      path: file.path,
      status: file.status,
      virusScanResult: file.virusScanResult,
      virusScanAt: file.virusScanAt,
      quarantinedAt: file.quarantinedAt,
      quarantineReason: file.quarantineReason,
      quarantinePath: file.quarantinePath,
      uploadedBy: file.user
        ? {
            id: file.user.id,
            username: file.user.username,
            name: file.user.name,
          }
        : null,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
