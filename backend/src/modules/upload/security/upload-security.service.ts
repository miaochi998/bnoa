/**
 * 上传安全服务
 * 实现安全相关功能：
 * - F034: 磁盘空间检查
 * - F035: 超级上限保护
 * - F036: 双开关控制
 * - F037: 安全日志记录
 * - F038: 文件隔离
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * 磁盘空间信息
 */
export interface DiskSpaceInfo {
  /** 总空间（字节） */
  total: number;
  /** 已用空间（字节） */
  used: number;
  /** 可用空间（字节） */
  available: number;
  /** 使用百分比 */
  usagePercent: number;
  /** 是否空间不足 */
  isLow: boolean;
  /** 是否达到危险阈值 */
  isCritical: boolean;
}

/**
 * 上传限制配置
 */
export interface UploadLimits {
  /** 是否启用上传功能（全局开关） */
  uploadEnabled: boolean;
  /** 是否启用安全检查（安全开关） */
  securityEnabled: boolean;
  /** 单文件最大大小（字节） */
  maxFileSize: number;
  /** 单次上传最大文件数 */
  maxFilesPerUpload: number;
  /** 用户每日上传限制（字节） */
  dailyUploadLimit: number;
  /** 用户总存储限制（字节） */
  userStorageLimit: number;
  /** 系统总存储限制（字节） */
  systemStorageLimit: number;
  /** 磁盘空间警告阈值（百分比） */
  diskWarningThreshold: number;
  /** 磁盘空间危险阈值（百分比） */
  diskCriticalThreshold: number;
}

/**
 * 安全日志类型
 */
export type SecurityLogType = 
  | 'UPLOAD_BLOCKED'
  | 'VIRUS_DETECTED'
  | 'FILE_QUARANTINED'
  | 'DISK_SPACE_LOW'
  | 'LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATION'
  | 'FILE_ISOLATED'
  | 'FILE_RELEASED';

/**
 * 安全日志条目
 */
export interface SecurityLogEntry {
  type: SecurityLogType;
  userId?: string;
  fileId?: string;
  fileName?: string;
  details: string;
  metadata?: Record<string, any>;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  timestamp: Date;
}

/**
 * 文件隔离信息
 */
export interface QuarantineInfo {
  fileId: string;
  originalPath: string;
  quarantinePath: string;
  reason: string;
  quarantinedAt: Date;
  quarantinedBy: string;
}

@Injectable()
export class UploadSecurityService {
  private readonly logger = new Logger(UploadSecurityService.name);
  private readonly uploadPath: string;
  private readonly quarantinePath: string;

  // 性能优化：缓存安全配置（60秒TTL）
  private securityConfigCache: any = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 60秒

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH', './uploads');
    this.quarantinePath = this.configService.get<string>(
      'QUARANTINE_PATH',
      './uploads/quarantine',
    );
    
    // 确保隔离目录存在
    this.ensureQuarantineDir();
  }

  /**
   * 获取数据库安全配置（带缓存优化）
   */
  async getSecurityConfig(): Promise<{
    enableFormatLimit: boolean;
    enableBlacklist: boolean;
    globalMaxFiles: number;
    dangerousExtensions: string[];
    enableVirusScan: boolean;
    scanTimeoutSeconds: number;
    autoQuarantine: boolean;
    minFreeSpaceBytes: number;
    enableSpaceCheck: boolean;
  }> {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (this.securityConfigCache && now < this.cacheExpiry) {
      return this.securityConfigCache;
    }
    
    // 缓存失效，查询数据库
    const config = await this.prisma.uploadSecurityConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const securityConfig = {
      enableFormatLimit: config?.enableFormatLimit ?? true,
      enableBlacklist: config?.enableBlacklist ?? true,
      globalMaxFiles: config?.globalMaxFiles ?? 100,
      dangerousExtensions: (config?.dangerousExtensions as string[]) ?? ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js'],
      enableVirusScan: config?.enableVirusScan ?? true,
      scanTimeoutSeconds: config?.scanTimeoutSeconds ?? 300,
      autoQuarantine: config?.autoQuarantine ?? true,
      minFreeSpaceBytes: Number(config?.minFreeSpaceBytes ?? 1073741824), // 1GB
      enableSpaceCheck: config?.enableSpaceCheck ?? true,
    };
    
    // 更新缓存
    this.securityConfigCache = securityConfig;
    this.cacheExpiry = now + this.CACHE_TTL;
    
    return securityConfig;
  }

  /**
   * 清除安全配置缓存（配置更新后调用）
   */
  clearConfigCache(): void {
    this.securityConfigCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * 验证文件格式（检查危险格式黑名单和白名单）
   */
  async validateFileFormat(
    fileExtension: string,
    context?: {
      userId?: string;
      fileName?: string;
      fileSize?: number;
      ipAddress?: string;
    },
  ): Promise<{ valid: boolean; reason?: string }> {
    const config = await this.getSecurityConfig();
    const ext = fileExtension.toLowerCase().replace(/^\./, '');
    
    // 1. 检查危险格式黑名单（仅当启用黑名单时）
    if (config.enableBlacklist && config.dangerousExtensions.includes(ext)) {
      await this.logSecurityEvent({
        type: 'UPLOAD_BLOCKED',
        userId: context?.userId,
        fileName: context?.fileName,
        details: `危险格式被阻止: ${ext.toUpperCase()}`,
        metadata: { extension: ext, blacklist: config.dangerousExtensions },
        severity: 'WARNING',
        timestamp: new Date(),
      });
      return { valid: false, reason: `不允许上传 ${ext.toUpperCase()} 格式的文件（安全限制）` };
    }

    // 2. 如果启用了格式限制，检查白名单
    if (config.enableFormatLimit) {
      const formatConfig = await this.prisma.fileFormatConfig.findFirst({
        where: {
          extension: ext,
          isEnabled: true,
        },
      });

      if (!formatConfig) {
        await this.logSecurityEvent({
          type: 'UPLOAD_BLOCKED',
          userId: context?.userId,
          fileName: context?.fileName,
          details: `不支持的文件格式: ${ext.toUpperCase()}`,
          metadata: { extension: ext, enableFormatLimit: true },
          severity: 'INFO',
          timestamp: new Date(),
        });
        return { valid: false, reason: `不支持的文件格式: ${ext.toUpperCase()}` };
      }
    }

    return { valid: true };
  }

  /**
   * 验证文件大小（检查全局上限和格式限制）
   */
  async validateFileSize(
    fileSize: number,
    fileExtension: string,
    context?: {
      userId?: string;
      fileName?: string;
      ipAddress?: string;
    },
  ): Promise<{ valid: boolean; reason?: string }> {
    const config = await this.getSecurityConfig();
    const ext = fileExtension.toLowerCase().replace(/^\./, '');

    // 1. 硬编码极限：20GB（始终检查，无论任何开关状态）
    const ABSOLUTE_MAX_SIZE = 21474836480; // 20GB
    if (fileSize > ABSOLUTE_MAX_SIZE) {
      await this.logSecurityEvent({
        type: 'LIMIT_EXCEEDED',
        userId: context?.userId,
        fileName: context?.fileName,
        details: `文件超过系统极限大小`,
        metadata: { fileSize, absoluteMaxSize: ABSOLUTE_MAX_SIZE },
        severity: 'CRITICAL',
        timestamp: new Date(),
      });
      return { valid: false, reason: `文件超过系统极限大小 (${this.formatBytes(ABSOLUTE_MAX_SIZE)})` };
    }

    // 2. 如果启用了格式白名单，检查格式特定的大小限制
    // 🔑 规则：关闭白名单后，除了危险格式黑名单外，只有20GB极限限制，没有格式特定的大小限制
    if (config.enableFormatLimit) {
      const formatConfig = await this.prisma.fileFormatConfig.findFirst({
        where: {
          extension: ext,
          isEnabled: true,
        },
      });

      if (formatConfig && fileSize > Number(formatConfig.maxSize)) {
        await this.logSecurityEvent({
          type: 'LIMIT_EXCEEDED',
          userId: context?.userId,
          fileName: context?.fileName,
          details: `${ext.toUpperCase()}文件超过格式限制`,
          metadata: { fileSize, formatMaxSize: Number(formatConfig.maxSize) },
          severity: 'INFO',
          timestamp: new Date(),
        });
        return { valid: false, reason: `${ext.toUpperCase()}文件不能超过 ${this.formatBytes(Number(formatConfig.maxSize))}` };
      }
    }

    return { valid: true };
  }

  /**
   * 综合上传验证（格式+大小+空间）
   */
  async validateUpload(
    fileSize: number,
    fileExtension: string,
    userId: string,
    fileName?: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    const context = { userId, fileName, fileSize };

    // 1. 验证文件格式
    const formatResult = await this.validateFileFormat(fileExtension, context);
    if (!formatResult.valid) {
      return formatResult;
    }

    // 2. 验证文件大小
    const sizeResult = await this.validateFileSize(fileSize, fileExtension, context);
    if (!sizeResult.valid) {
      return sizeResult;
    }

    // 3. 检查存储空间
    const config = await this.getSecurityConfig();
    if (config.enableSpaceCheck) {
      const diskOk = await this.checkDiskSpace(fileSize);
      if (!diskOk) {
        return { valid: false, reason: '存储空间不足' };
      }
    }

    return { valid: true };
  }

  /**
   * 确保隔离目录存在
   */
  private ensureQuarantineDir(): void {
    if (!fs.existsSync(this.quarantinePath)) {
      fs.mkdirSync(this.quarantinePath, { recursive: true });
      this.logger.log(`创建隔离目录: ${this.quarantinePath}`);
    }
  }

  /**
   * F034: 获取磁盘空间信息
   */
  async getDiskSpace(): Promise<DiskSpaceInfo> {
    try {
      const uploadDir = path.resolve(this.uploadPath);
      
      // 确保目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 使用df命令获取磁盘空间（macOS/Linux）
      const { stdout } = await execAsync(`df -k "${uploadDir}" | tail -1`);
      const parts = stdout.trim().split(/\s+/);
      
      // df输出格式: Filesystem 1K-blocks Used Available Use% Mounted
      const total = parseInt(parts[1], 10) * 1024;
      const used = parseInt(parts[2], 10) * 1024;
      const available = parseInt(parts[3], 10) * 1024;
      const usagePercent = Math.round((used / total) * 100);

      const limits = await this.getUploadLimits();
      
      return {
        total,
        used,
        available,
        usagePercent,
        isLow: usagePercent >= limits.diskWarningThreshold,
        isCritical: usagePercent >= limits.diskCriticalThreshold,
      };
    } catch (error) {
      this.logger.error(`获取磁盘空间失败: ${error}`);
      // 返回默认值，不阻止上传
      return {
        total: 0,
        used: 0,
        available: Number.MAX_SAFE_INTEGER,
        usagePercent: 0,
        isLow: false,
        isCritical: false,
      };
    }
  }

  /**
   * F034: 检查磁盘空间是否足够
   * @param requiredSize 需要的空间大小（字节）
   */
  async checkDiskSpace(requiredSize: number): Promise<boolean> {
    const diskSpace = await this.getDiskSpace();
    
    if (diskSpace.isCritical) {
      await this.logSecurityEvent({
        type: 'DISK_SPACE_LOW',
        details: `磁盘空间严重不足，使用率: ${diskSpace.usagePercent}%`,
        severity: 'CRITICAL',
        metadata: { diskSpace },
        timestamp: new Date(),
      });
      return false;
    }

    if (diskSpace.available < requiredSize) {
      await this.logSecurityEvent({
        type: 'DISK_SPACE_LOW',
        details: `磁盘空间不足，需要: ${this.formatBytes(requiredSize)}，可用: ${this.formatBytes(diskSpace.available)}`,
        severity: 'WARNING',
        metadata: { requiredSize, available: diskSpace.available },
        timestamp: new Date(),
      });
      return false;
    }

    return true;
  }

  /**
   * F035: 获取上传限制配置
   */
  async getUploadLimits(): Promise<UploadLimits> {
    // 从数据库或配置获取限制
    const config = await this.prisma.systemConfig.findFirst({
      where: { key: 'upload_limits' },
    }).catch(() => null);

    const defaultLimits: UploadLimits = {
      uploadEnabled: this.configService.get<boolean>('UPLOAD_ENABLED', true),
      securityEnabled: this.configService.get<boolean>('UPLOAD_SECURITY_ENABLED', true),
      maxFileSize: this.configService.get<number>('UPLOAD_MAX_FILE_SIZE', 21474836480), // 20GB
      maxFilesPerUpload: this.configService.get<number>('UPLOAD_MAX_FILES_PER_UPLOAD', 100),
      dailyUploadLimit: this.configService.get<number>('UPLOAD_DAILY_LIMIT', 10737418240), // 10GB
      userStorageLimit: this.configService.get<number>('UPLOAD_USER_STORAGE_LIMIT', 107374182400), // 100GB
      systemStorageLimit: this.configService.get<number>('UPLOAD_SYSTEM_STORAGE_LIMIT', 1099511627776), // 1TB
      diskWarningThreshold: this.configService.get<number>('DISK_WARNING_THRESHOLD', 80),
      diskCriticalThreshold: this.configService.get<number>('DISK_CRITICAL_THRESHOLD', 95),
    };

    if (config?.value) {
      try {
        const dbLimits = JSON.parse(config.value as string);
        return { ...defaultLimits, ...dbLimits };
      } catch {
        return defaultLimits;
      }
    }

    return defaultLimits;
  }

  /**
   * F035: 检查用户上传限制
   * @param userId 用户ID
   * @param fileSize 文件大小
   */
  async checkUserLimits(userId: string, fileSize: number): Promise<{ allowed: boolean; reason?: string }> {
    const limits = await this.getUploadLimits();

    // 检查单文件大小限制
    if (fileSize > limits.maxFileSize) {
      return {
        allowed: false,
        reason: `文件大小超过限制，最大允许 ${this.formatBytes(limits.maxFileSize)}`,
      };
    }

    // 检查用户今日上传量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyUpload = await this.prisma.file.aggregate({
      where: {
        uploadedBy: userId,
        createdAt: { gte: today },
        deletedAt: null,
      },
      _sum: { size: true },
    });

    const dailyUsed = Number(dailyUpload._sum.size || 0);
    if (dailyUsed + fileSize > limits.dailyUploadLimit) {
      await this.logSecurityEvent({
        type: 'LIMIT_EXCEEDED',
        userId,
        details: `用户今日上传量超限，已用: ${this.formatBytes(dailyUsed)}，限制: ${this.formatBytes(limits.dailyUploadLimit)}`,
        severity: 'WARNING',
        timestamp: new Date(),
      });
      return {
        allowed: false,
        reason: `今日上传量已达上限 ${this.formatBytes(limits.dailyUploadLimit)}`,
      };
    }

    // 检查用户总存储量
    const totalStorage = await this.prisma.file.aggregate({
      where: {
        uploadedBy: userId,
        deletedAt: null,
      },
      _sum: { size: true },
    });

    const totalUsed = Number(totalStorage._sum.size || 0);
    if (totalUsed + fileSize > limits.userStorageLimit) {
      await this.logSecurityEvent({
        type: 'LIMIT_EXCEEDED',
        userId,
        details: `用户存储空间超限，已用: ${this.formatBytes(totalUsed)}，限制: ${this.formatBytes(limits.userStorageLimit)}`,
        severity: 'WARNING',
        timestamp: new Date(),
      });
      return {
        allowed: false,
        reason: `存储空间已满，已使用 ${this.formatBytes(totalUsed)} / ${this.formatBytes(limits.userStorageLimit)}`,
      };
    }

    return { allowed: true };
  }

  /**
   * F036: 检查双开关状态
   */
  async checkUploadEnabled(): Promise<{ enabled: boolean; reason?: string }> {
    const limits = await this.getUploadLimits();

    // 检查全局上传开关
    if (!limits.uploadEnabled) {
      return {
        enabled: false,
        reason: '系统上传功能已暂停',
      };
    }

    // 检查安全开关
    if (!limits.securityEnabled) {
      this.logger.warn('安全检查已禁用，上传将跳过安全验证');
    }

    return { enabled: true };
  }

  /**
   * F037: 记录安全日志
   * 同时记录到 securityLog 表（用于安全事件页面）和 auditLog 表（用于审计日志）
   */
  async logSecurityEvent(entry: SecurityLogEntry): Promise<void> {
    try {
      // 1. 记录到 securityLog 表（安全事件管理页面使用）
      await this.prisma.securityLog.create({
        data: {
          id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: entry.type,
          severity: entry.severity || 'INFO',
          status: 'NEW',
          userId: entry.userId || null,
          fileId: entry.fileId || null,
          fileName: entry.fileName || null,
          details: entry.details || null,
          metadata: entry.metadata ? entry.metadata : undefined,
          ipAddress: null,
          location: null,
        },
      });

      // 2. 同时记录到 auditLog 表（审计日志页面使用）
      const actionMap: Record<string, string> = {
        'UPLOAD_BLOCKED': 'SECURITY_UPLOAD_BLOCKED',
        'VIRUS_DETECTED': 'SECURITY_VIRUS_DETECTED',
        'FILE_QUARANTINED': 'SECURITY_FILE_QUARANTINED',
        'DISK_SPACE_LOW': 'SECURITY_DISK_SPACE_LOW',
        'LIMIT_EXCEEDED': 'SECURITY_LIMIT_EXCEEDED',
        'SECURITY_VIOLATION': 'SECURITY_SECURITY_VIOLATION',
        'FILE_ISOLATED': 'SECURITY_FILE_ISOLATED',
        'FILE_RELEASED': 'SECURITY_FILE_RELEASED',
      };
      
      const action = actionMap[entry.type] || 'SECURITY_SECURITY_VIOLATION';
      
      await this.prisma.auditLog.create({
        data: {
          action: action as any,
          module: 'UPLOAD_SECURITY',
          resource: 'FILE',
          resourceId: entry.fileId || null,
          description: `[${entry.type}] ${entry.details}`,
          oldValue: null,
          newValue: JSON.stringify({
            type: entry.type,
            fileName: entry.fileName,
            details: entry.details,
            metadata: entry.metadata,
            severity: entry.severity,
          }),
          userId: entry.userId || null,
          ip: '0.0.0.0',
          userAgent: 'System',
          requestUrl: '/api/v1/upload/security',
          requestMethod: 'POST',
          requestParams: null,
          executionTime: 0,
          status: 'SUCCESS',
          errorMessage: null,
        },
      });

      // 根据严重程度记录日志
      const logMessage = `[${entry.type}] ${entry.details}`;
      switch (entry.severity) {
        case 'CRITICAL':
          this.logger.error(logMessage);
          break;
        case 'ERROR':
          this.logger.error(logMessage);
          break;
        case 'WARNING':
          this.logger.warn(logMessage);
          break;
        default:
          this.logger.log(logMessage);
      }
    } catch (error) {
      this.logger.error(`记录安全日志失败: ${error}`);
    }
  }

  /**
   * F038: 隔离文件
   * @param fileId 文件ID
   * @param reason 隔离原因
   * @param operatorId 操作者ID
   */
  async quarantineFile(
    fileId: string,
    reason: string,
    operatorId: string,
  ): Promise<QuarantineInfo> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new BadRequestException('文件不存在');
    }

    // 生成隔离路径
    const quarantineFileName = `${fileId}_${Date.now()}${path.extname(file.name)}`;
    const quarantinePath = path.join(this.quarantinePath, quarantineFileName);

    try {
      // 如果是本地存储，移动文件到隔离区
      if (file.storageType === 'LOCAL' && file.path) {
        const originalPath = path.resolve(file.path);
        if (fs.existsSync(originalPath)) {
          fs.renameSync(originalPath, quarantinePath);
        }
      }

      // 更新文件状态
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'QUARANTINED',
          quarantinedAt: new Date(),
          quarantineReason: reason,
          quarantinePath: quarantinePath,
        } as any, // Prisma字段已在schema中定义
      });

      // 记录安全日志
      await this.logSecurityEvent({
        type: 'FILE_QUARANTINED',
        userId: operatorId,
        fileId,
        fileName: file.name,
        details: `文件已隔离: ${reason}`,
        severity: 'WARNING',
        timestamp: new Date(),
      });

      return {
        fileId,
        originalPath: file.path || '',
        quarantinePath,
        reason,
        quarantinedAt: new Date(),
        quarantinedBy: operatorId,
      };
    } catch (error) {
      this.logger.error(`隔离文件失败: ${error}`);
      throw new BadRequestException('隔离文件失败');
    }
  }

  /**
   * F038: 释放隔离文件
   * @param fileId 文件ID
   * @param operatorId 操作者ID
   */
  async releaseFromQuarantine(fileId: string, operatorId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new BadRequestException('文件不存在');
    }

    const fileData = file as any; // Prisma字段已在schema中定义
    if (fileData.status !== 'QUARANTINED') {
      throw new BadRequestException('文件未被隔离');
    }

    try {
      // 如果是本地存储，恢复文件
      if (file.storageType === 'LOCAL' && fileData.quarantinePath && file.path) {
        if (fs.existsSync(fileData.quarantinePath)) {
          fs.renameSync(fileData.quarantinePath, file.path);
        }
      }

      // 更新文件状态
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'ACTIVE',
          quarantinedAt: null,
          quarantineReason: null,
          quarantinePath: null,
        } as any, // Prisma字段已在schema中定义
      });

      // 记录安全日志
      await this.logSecurityEvent({
        type: 'FILE_RELEASED',
        userId: operatorId,
        fileId,
        fileName: file.name,
        details: '文件已从隔离区释放',
        severity: 'INFO',
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`释放隔离文件失败: ${error}`);
      throw new BadRequestException('释放隔离文件失败');
    }
  }

  /**
   * 综合安全检查
   * @param userId 用户ID
   * @param fileSize 文件大小
   */
  async performSecurityCheck(
    userId: string,
    fileSize: number,
  ): Promise<{ passed: boolean; reason?: string }> {
    // 检查双开关
    const uploadCheck = await this.checkUploadEnabled();
    if (!uploadCheck.enabled) {
      return { passed: false, reason: uploadCheck.reason };
    }

    // 检查磁盘空间
    const diskOk = await this.checkDiskSpace(fileSize);
    if (!diskOk) {
      return { passed: false, reason: '磁盘空间不足' };
    }

    // 检查用户限制
    const limitsCheck = await this.checkUserLimits(userId, fileSize);
    if (!limitsCheck.allowed) {
      return { passed: false, reason: limitsCheck.reason };
    }

    return { passed: true };
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
