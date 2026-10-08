import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { BackupConfigService } from './backup-config.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { StorageService } from '../storage/storage.service';
import { CreateBackupDto, RestoreBackupDto } from './dto/backup.dto';
import { Prisma, BackupLog } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export interface BackupStats {
  totalCount: number;
  successCount: number;
  failedCount: number;
  totalSize: number;
  nextScheduledTime?: string;
}

export interface BackupDownloadResult {
  buffer: Buffer;
  filename: string;
  checksum?: string; // 用于恢复时验证文件完整性
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: BackupConfigService,
    private readonly localStorage: LocalStorageService,
    private readonly storageService: StorageService,
  ) {}

  async createBackup(dto: CreateBackupDto, operatorId?: string, operatorIp?: string): Promise<any> {
    const config = await this.configService.getConfig();

    const backupType = dto.backupType || 'FULL';
    const storageType = dto.storageType || config.storageType;
    const triggerType = dto.triggerType || 'MANUAL';

    const contentTypes: string[] = [];
    if (triggerType === 'SCHEDULED') {
      if (config.includeDatabase) contentTypes.push('database');
      if (config.includeFiles) contentTypes.push('files');
    } else {
      if (backupType === 'FULL' || backupType === 'DATABASE') contentTypes.push('database');
      if (backupType === 'FULL' || backupType === 'FILES') contentTypes.push('files');
    }
    if (contentTypes.length === 0) {
      throw new Error('备份内容为空，请至少勾选一项（定时备份以备份设置中的「备份内容」为准）');
    }

    const backupLog = await this.prisma.backupLog.create({
      data: {
        backupType,
        triggerType,
        status: 'running',
        storageType,
        contentTypes,
        operatorId,
        operatorIp,
      },
    });

    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempDir = path.join(require('os').tmpdir(), 'backups', backupLog.id);

    try {
      await fs.promises.mkdir(tempDir, { recursive: true });

      const backupFiles: string[] = [];
      let totalSize = 0;
      let databaseChecksum: string | undefined;

      for (const contentType of contentTypes) {
        if (contentType === 'database') {
          const dbResult = await this.backupDatabase(tempDir);
          backupFiles.push(dbResult.filePath);
          totalSize += dbResult.size;
          databaseChecksum = dbResult.checksum; // 保存数据库备份的 checksum
        } else if (contentType === 'files') {
          const filesFile = await this.backupFiles(tempDir);
          if (filesFile) {
            backupFiles.push(filesFile);
            const stats = await fs.promises.stat(filesFile);
            totalSize += stats.size;
          }
        }
      }

      // 如果没有任何备份文件，说明备份失败
      if (backupFiles.length === 0) {
        throw new Error('所有备份内容均失败，没有生成任何备份文件');
      }

      const isSingleDb = contentTypes.length === 1 && contentTypes[0] === 'database';
      const ext = isSingleDb ? '.sql' : '.tar.gz';
      const filename = `backup-${timestamp}-${backupLog.id.slice(0, 8)}${ext}`;

      let storagePath: string;
      let finalSize = totalSize;
      let finalChecksum: string | undefined;

      if (storageType === 'LOCAL') {
        const uploadRoot = this.localStorage.getUploadRoot();
        const localPath = (config.localPath || 'backups').replace(/^\/+|\/+$/g, '');
        const backupRoot = path.join(uploadRoot, localPath);
        await fs.promises.mkdir(backupRoot, { recursive: true });
        const finalPath = path.join(backupRoot, filename);

        if (isSingleDb) {
          // 单数据库备份直接复制 SQL 文件
          const dbFile = path.join(tempDir, 'database.sql');
          await fs.promises.copyFile(dbFile, finalPath);
          // 如果是最终保存的文件，需要重新计算 checksum
          const savedFileBuffer = await fs.promises.readFile(finalPath);
          finalChecksum = crypto.createHash('sha256').update(savedFileBuffer).digest('hex');
        } else {
          await execAsync(`tar -czf "${finalPath}" -C "${tempDir}" .`);
          const stat = await fs.promises.stat(finalPath);
          finalSize = stat.size;
          // 计算 tar.gz 文件的 checksum
          const tarBuffer = await fs.promises.readFile(finalPath);
          finalChecksum = crypto.createHash('sha256').update(tarBuffer).digest('hex');
        }
        storagePath = path.join(localPath, filename).split(path.sep).join('/');
      } else {
        const prefix = (config.rustfsPrefix || 'backups/').replace(/\/+$/, '') + '/';
        const key = prefix + filename;
        let buffer: Buffer;
        if (isSingleDb) {
          buffer = await fs.promises.readFile(path.join(tempDir, 'database.sql'));
        } else {
          const archivePath = path.join(tempDir, 'archive.tar.gz');
          await execAsync(`tar -czf "${archivePath}" -C "${tempDir}" .`);
          buffer = await fs.promises.readFile(archivePath);
          finalSize = buffer.length;
        }
        // 计算上传文件的 checksum
        finalChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
        await this.storageService.upload(buffer, key, 'application/octet-stream');
        storagePath = key;
      }

      await this.cleanupTempFiles(tempDir);

      // 如果是单数据库备份，优先使用数据库备份的 checksum；否则使用最终文件的 checksum
      const checksumToSave = isSingleDb ? (databaseChecksum || finalChecksum) : finalChecksum;

      await this.prisma.backupLog.update({
        where: { id: backupLog.id },
        data: {
          status: 'success',
          storagePath,
          fileSize: finalSize,
          checksum: checksumToSave,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      return {
        id: backupLog.id,
        status: 'success',
        message: '备份完成',
        fileSize: finalSize,
        storagePath,
      };
    } catch (error) {
      await this.cleanupTempFiles(tempDir);
      await this.prisma.backupLog.update({
        where: { id: backupLog.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });
      throw error;
    }
  }

  private async backupDatabase(backupDir: string): Promise<{ filePath: string; checksum: string; size: number }> {
    const outputFile = path.join(backupDir, 'database.sql');
    const databaseUrl = process.env.DATABASE_URL;

    // 排除运行时日志表，这些表不应该包含在备份中
    // 注意：backup_logs 需要保留（备份记录是元数据，应该保留）
    const excludeTables = '--exclude-table-data=restore_logs --exclude-table-data=audit_logs --exclude-table-data=security_logs --exclude-table-data=ai_usage_logs --exclude-table-data=email_logs';

    const tryDirectPgDump = async (): Promise<boolean> => {
      if (!databaseUrl) return false;
      try {
        const url = new URL(databaseUrl);
        const dbName = (url.pathname || '/').slice(1) || 'bnoa';
        const dbUser = url.username || 'postgres';
        const dbHost = url.hostname;
        const dbPort = url.port || '5432';
        const pass = url.password ? decodeURIComponent(url.password) : '';
        const env = pass ? { ...process.env, PGPASSWORD: pass } : process.env;
        // 使用 --lock-wait-timeout 防止备份期间数据不一致
        const cmd = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean -F p -f "${outputFile}" ${excludeTables} --lock-wait-timeout=60`;
        await execAsync(cmd, { env });
        return true;
      } catch {
        return false;
      }
    };

    const tryDockerPgDump = async (): Promise<void> => {
      try {
        // 使用 --lock-wait-timeout 防止备份期间数据不一致
        const dockerCmd = `docker exec bnoa-postgres pg_dump -U postgres -d bnoa --clean -F p ${excludeTables} --lock-wait-timeout=60 > "${outputFile}"`;
        await execAsync(dockerCmd);
      } catch {
        const prodDockerCmd = `docker exec bnoa-prod-postgres pg_dump -U postgres -d bnoa --clean -F p ${excludeTables} --lock-wait-timeout=60 > "${outputFile}"`;
        await execAsync(prodDockerCmd);
      }
    };

    const ok = await tryDirectPgDump();
    if (!ok) {
      await tryDockerPgDump();
    }

    if (!fs.existsSync(outputFile)) {
      throw new Error('数据库备份失败：未生成备份文件');
    }

    // ========== 验证备份文件完整性 ==========
    const stats = await fs.promises.stat(outputFile);
    if (stats.size === 0) {
      throw new Error('数据库备份失败：备份文件大小为 0');
    }

    // 计算 SHA256 checksum
    const fileBuffer = await fs.promises.readFile(outputFile);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    this.logger.log(`数据库备份完成: 文件大小=${stats.size} bytes, checksum=${checksum}`);

    return { filePath: outputFile, checksum, size: stats.size };
  }

  private async backupFiles(backupDir: string): Promise<string | null> {
    const uploadRoot = this.localStorage.getUploadRoot();
    const outputFile = path.join(backupDir, 'uploads.tar.gz');
    const parent = path.dirname(uploadRoot);
    const base = path.basename(uploadRoot);

    if (!fs.existsSync(uploadRoot)) {
      this.logger.warn('上传根目录不存在，跳过文件备份');
      return null;
    }

    try {
      await execAsync(`tar -czf "${outputFile}" -C "${parent}" "${base}"`);
      return outputFile;
    } catch (error) {
      this.logger.warn(`文件备份失败: ${error.message}, 跳过文件备份`);
      return null;
    }
  }

  async getBackupLogs(page: number = 1, pageSize: number = 10, status?: string, triggerType?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (triggerType) where.triggerType = triggerType;

    const [items, total] = await Promise.all([
      this.prisma.backupLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          operator: {
            select: { id: true, username: true, name: true },
          },
        },
      }),
      this.prisma.backupLog.count({ where }),
    ]);

    const itemsWithBigIntFixed = items.map(item => ({
      ...item,
      fileSize: item.fileSize ? Number(item.fileSize) : null,
    }));

    return {
      items: itemsWithBigIntFixed,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStats(): Promise<BackupStats> {
    const [total, success, failed, backups] = await Promise.all([
      this.prisma.backupLog.count(),
      this.prisma.backupLog.count({ where: { status: 'success' } }),
      this.prisma.backupLog.count({ where: { status: 'failed' } }),
      this.prisma.backupLog.findMany({
        where: { status: 'success' },
        select: { fileSize: true },
      }),
    ]);

    const totalSize = backups.reduce((sum: number, b: any) => sum + Number(b.fileSize || 0), 0);

    const config = await this.configService.getConfig();
    let nextScheduledTime: string | undefined;
    if (config.enabled) {
      nextScheduledTime = this.calculateNextScheduledTime(config.scheduleCron);
    }

    return {
      totalCount: total,
      successCount: success,
      failedCount: failed,
      totalSize,
      nextScheduledTime,
    };
  }

  private calculateNextScheduledTime(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    const now = new Date();
    const next = new Date(now);
    if (parts.length >= 2) {
      const hour = parseInt(parts[1], 10);
      const minute = parseInt(parts[0], 10);
      if (!isNaN(hour) && !isNaN(minute)) {
        next.setHours(hour, minute, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
      }
    }
    return next.toISOString();
  }

  async getBackupDownload(id: string): Promise<BackupDownloadResult> {
    const backup = await this.prisma.backupLog.findUnique({ where: { id } });
    if (!backup) {
      throw new NotFoundException('备份记录不存在');
    }
    if (backup.status !== 'success' || !backup.storagePath) {
      throw new NotFoundException('该备份不可下载');
    }

    const filename = path.basename(backup.storagePath);

    let buffer: Buffer;
    if (backup.storageType === 'LOCAL') {
      const uploadRoot = this.localStorage.getUploadRoot();
      const absolutePath = path.join(uploadRoot, backup.storagePath);
      if (!fs.existsSync(absolutePath)) {
        throw new NotFoundException('备份文件不存在');
      }
      buffer = await fs.promises.readFile(absolutePath);
    } else {
      buffer = await this.storageService.download(backup.storagePath);
    }

    // 计算当前文件的 checksum 用于验证
    const currentChecksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return { buffer, filename, checksum: currentChecksum };
  }

  async deleteBackup(id: string): Promise<void> {
    const backup = await this.prisma.backupLog.findUnique({ where: { id } });
    if (!backup) {
      throw new NotFoundException('备份记录不存在');
    }

    if (backup.storagePath && backup.status === 'success') {
      try {
        if (backup.storageType === 'LOCAL') {
          const uploadRoot = this.localStorage.getUploadRoot();
          const absolutePath = path.join(uploadRoot, backup.storagePath);
          if (fs.existsSync(absolutePath)) {
            await fs.promises.unlink(absolutePath);
          }
        } else {
          await this.storageService.delete(backup.storagePath);
        }
      } catch (error) {
        this.logger.warn(`删除备份文件失败: ${error.message}`);
      }
    }

    await this.prisma.backupLog.delete({ where: { id } });
  }

  async cleanupExpiredBackups(): Promise<number> {
    const config = await this.configService.getConfig();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.retentionDays);

    const expired = await this.prisma.backupLog.findMany({
      where: { status: 'success', completedAt: { lt: cutoff } },
      select: { id: true, storagePath: true, storageType: true },
    });

    for (const b of expired) {
      await this.deleteBackup(b.id);
    }
    return expired.length;
  }

  private async cleanupTempFiles(dir: string): Promise<void> {
    try {
      if (fs.existsSync(dir)) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.warn(`清理临时文件失败: ${error.message}`);
    }
  }

  async restoreBackup(backupId: string, dto: RestoreBackupDto, operatorId?: string, operatorIp?: string): Promise<any> {
    const backup = await this.prisma.backupLog.findUnique({ where: { id: backupId } });
    if (!backup) {
      throw new NotFoundException('备份记录不存在');
    }
    if (backup.status !== 'success') {
      throw new BadRequestException('备份状态不可用，无法恢复');
    }

    const contentTypes = dto.contentTypesStr
      ? dto.contentTypesStr.split(',').map(t => t.trim().toLowerCase())
      : dto.contentTypes
        ? [dto.contentTypes.toLowerCase()]
        : backup.contentTypes || ['database'];
    const startTime = Date.now();
    const tempDir = path.join(require('os').tmpdir(), 'restore', backupId);

    const restoreLog = await this.prisma.restoreLog.create({
      data: {
        backupId,
        restoreType: dto.restoreType || 'FULL',
        status: 'running',
        contentTypes,
        operatorId,
        operatorIp,
      },
    });

    const stepsLog: any[] = [];
    let autoBackupId: string | undefined;
    let autoBackupInfo: { id: string; backupType: string; triggerType: string; storageType: string; storagePath: string; fileSize: number; contentTypes: string[] } | undefined;
    let restoreLogsBackupFile: string | undefined;

    // 保存恢复日志ID，用于数据库恢复后更新状态
    const restoreLogId = restoreLog.id;
    const restoreLogBackupId = backupId;
    const restoreLogRestoreType = dto.restoreType || 'FULL';
    const restoreLogContentTypes = JSON.stringify(contentTypes);
    const restoreLogOperatorId = operatorId || '';
    const restoreLogOperatorIp = operatorIp || '';
    const restoreLogStartTime = startTime.toString();

    try {
      // ========== 关键步骤：在恢复数据库前，先备份 restore_logs 表 ==========
      stepsLog.push({ step: 'backup_restore_logs', message: '备份恢复日志表', time: new Date().toISOString() });
      const tempDir = path.join(require('os').tmpdir(), 'restore', backupId);
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      // 导出 restore_logs 表数据（排除当前恢复记录，避免冲突）
      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl) {
        const url = new URL(databaseUrl);
        const dbName = (url.pathname || '/').slice(1) || 'bnoa';
        const dbUser = url.username || 'postgres';
        const dbHost = url.hostname;
        const dbPort = url.port || '5432';
        const pass = url.password ? decodeURIComponent(url.password) : '';
        
        // 使用 COPY 导出 restore_logs 表数据
        restoreLogsBackupFile = path.join(tempDir, 'restore_logs_backup.sql');
        const exportSuccess = await this.exportTableToFile('restore_logs', restoreLogsBackupFile);
        if (exportSuccess && fs.existsSync(restoreLogsBackupFile)) {
          stepsLog.push({ step: 'backup_restore_logs_done', message: `恢复日志已备份，共 ${fs.statSync(restoreLogsBackupFile).size} 字节`, time: new Date().toISOString() });
        } else {
          this.logger.warn(`备份恢复日志表失败（继续恢复）`);
          restoreLogsBackupFile = undefined;
        }
      }

      stepsLog.push({ step: 'start', message: '开始恢复流程', time: new Date().toISOString() });

      if (dto.createAutoBackup !== false) {
        stepsLog.push({ step: 'auto_backup', message: '创建恢复前自动备份', time: new Date().toISOString() });
        try {
          // 自动备份也只备份数据库，与恢复内容保持一致
          const autoBackupResult = await this.createBackup(
            { backupType: 'DATABASE', triggerType: 'AUTO_BEFORE_RESTORE' },
            operatorId,
            operatorIp,
          );
          autoBackupId = autoBackupResult.id;
          // 保存自动备份信息，用于数据库恢复后重建记录
          autoBackupInfo = {
            id: autoBackupResult.id,
            backupType: 'DATABASE',
            triggerType: 'AUTO_BEFORE_RESTORE',
            storageType: backup.storageType,
            storagePath: autoBackupResult.storagePath,
            fileSize: autoBackupResult.fileSize,
            contentTypes: ['database'],
          };
          // 使用原始 SQL 更新 autoBackupId（避免后续数据库恢复时失败）
          if (autoBackupId) {
            try {
              await this.updateRestoreLogFieldWithSql(restoreLogId, 'auto_backup_id', autoBackupId);
            } catch (e) {
              this.logger.warn(`更新 autoBackupId 失败: ${e.message}`);
            }
          }
          stepsLog.push({
            step: 'auto_backup_done',
            message: `自动备份完成，ID: ${autoBackupId}`,
            time: new Date().toISOString(),
          });
        } catch (autoError) {
          this.logger.warn(`恢复前自动备份失败: ${autoError.message}`);
          stepsLog.push({
            step: 'auto_backup_failed',
            message: `自动备份失败: ${autoError.message}（继续恢复）`,
            time: new Date().toISOString(),
          });
        }
      }

      stepsLog.push({ step: 'download', message: '下载备份文件', time: new Date().toISOString() });
      const { buffer, filename, checksum: downloadedChecksum } = await this.getBackupDownload(backupId);
      const downloadedFile = path.join(tempDir, filename);
      await fs.promises.writeFile(downloadedFile, buffer);

      // ========== 验证下载文件的 checksum ==========
      if (backup.checksum && downloadedChecksum) {
        if (backup.checksum !== downloadedChecksum) {
          throw new Error(`备份文件校验失败: 记录的 checksum=${backup.checksum}, 当前 checksum=${downloadedChecksum}, 文件可能已损坏或被篡改`);
        }
        stepsLog.push({ step: 'download_checksum_verified', message: `备份文件 checksum 验证通过`, time: new Date().toISOString() });
      }

      stepsLog.push({ step: 'download_done', message: `备份文件已下载: ${filename}`, time: new Date().toISOString() });

      const isSingleDb = contentTypes.length === 1 && contentTypes[0] === 'database';
      const isTarGz = filename.endsWith('.tar.gz');

      if (contentTypes.includes('database')) {
        stepsLog.push({ step: 'restore_database', message: '开始恢复数据库', time: new Date().toISOString() });

        let sqlFile = downloadedFile;
        if (isTarGz) {
          sqlFile = path.join(tempDir, 'database.sql');
          await execAsync(`tar -xzf "${downloadedFile}" -C "${tempDir}" database.sql`);
        }

        if (!fs.existsSync(sqlFile)) {
          throw new Error('备份包中未找到数据库文件');
        }

        await this.restoreDatabase(sqlFile);

        // ========== 验证恢复后的数据库完整性 ==========
        const restoreValidation = await this.validateDatabaseRestore(sqlFile);
        if (!restoreValidation.isValid) {
          throw new Error(`数据库恢复后验证失败: ${restoreValidation.message}`);
        }
        stepsLog.push({
          step: 'restore_database_validated',
          message: `数据库恢复验证通过: ${restoreValidation.tableCount} 个表, ${restoreValidation.totalRows} 行数据`,
          time: new Date().toISOString(),
        });
        stepsLog.push({ step: 'restore_database_done', message: '数据库恢复完成', time: new Date().toISOString() });

      // ========== 注意：不再恢复 restore_logs 表 ==========
      // 因为当前恢复操作本身就会在 restore_logs 表中创建新的记录
      // 恢复历史记录可能导致 ID 冲突或其他问题
      stepsLog.push({ step: 'restore_restore_logs_skipped', message: '跳过恢复日志表（避免ID冲突）', time: new Date().toISOString() });
      }

      if (contentTypes.includes('files')) {
        stepsLog.push({ step: 'restore_files', message: '开始恢复上传文件', time: new Date().toISOString() });

        if (!isTarGz) {
          throw new Error('文件备份需要 tar.gz 格式');
        }

        const uploadsDir = this.localStorage.getUploadRoot();
        await execAsync(`tar -xzf "${downloadedFile}" -C "${uploadsDir}"`);
        stepsLog.push({ step: 'restore_files_done', message: '上传文件恢复完成', time: new Date().toISOString() });
      }

      stepsLog.push({ step: 'complete', message: '恢复流程完成', time: new Date().toISOString() });

      // 先重建备份记录（restore_logs 有外键引用 backup_logs，必须先写入被引用表）
      await this.updateBackupLogStatusWithSql(backup);

      // 恢复后重建自动备份记录（如果存在，restore_logs.auto_backup_id 引用此记录）
      if (autoBackupInfo) {
        await this.recreateAutoBackupLogWithSql(autoBackupInfo);
      }

      // 最后插入恢复日志记录（此时外键引用的 backup_logs 记录已存在）
      await this.insertRestoreLogSql(
        backupId,
        autoBackupId,
        'success',
        Date.now() - startTime,
        stepsLog,
      );

      await this.cleanupTempFiles(tempDir);

      return {
        id: restoreLog.id,
        status: 'success',
        message: '恢复完成',
        autoBackupId,
        stepsLog,
      };
    } catch (error) {
      stepsLog.push({ step: 'error', message: `恢复失败: ${error.message}`, time: new Date().toISOString() });

      // 先重建备份记录（restore_logs 有外键引用 backup_logs）
      await this.updateBackupLogStatusWithSql(backup);

      // 恢复后重建自动备份记录（如果存在）
      if (autoBackupInfo) {
        await this.recreateAutoBackupLogWithSql(autoBackupInfo);
      }

      // 最后插入恢复日志记录（此时外键引用的 backup_logs 记录已存在）
      await this.insertRestoreLogSql(
        backupId,
        autoBackupId,
        'failed',
        Date.now() - startTime,
        stepsLog,
        error.message,
      );

      await this.cleanupTempFiles(tempDir);
      throw error;
    }
  }

  private async restoreDatabase(sqlFile: string): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL 环境变量未配置');
    }

    const url = new URL(databaseUrl);
    const dbName = (url.pathname || '/').slice(1) || 'bnoa';
    const dbUser = url.username || 'postgres';
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const pass = url.password ? decodeURIComponent(url.password) : '';

    const tryDirectPsql = async (): Promise<boolean> => {
      try {
        // 通过 stdin 传递 SQL 内容，避免文件路径问题
        const cmd = `cat "${sqlFile}" | PGPASSWORD="${pass}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName}`;
        await execAsync(cmd);
        return true;
      } catch {
        return false;
      }
    };

    const tryDockerPsql = async (): Promise<void> => {
      // 通过 stdin 传递 SQL 内容，容器内可以访问 stdin
      try {
        const dockerCmd = `cat "${sqlFile}" | docker exec -i bnoa-postgres psql -U ${dbUser} -d ${dbName}`;
        await execAsync(dockerCmd);
      } catch {
        try {
          const prodDockerCmd = `cat "${sqlFile}" | docker exec -i bnoa-prod-postgres psql -U ${dbUser} -d ${dbName}`;
          await execAsync(prodDockerCmd);
        } catch {
          throw new Error('所有数据库恢复方式均失败');
        }
      }
    };

    const ok = await tryDirectPsql();
    if (!ok) {
      await tryDockerPsql();
    }
  }

  /**
   * 验证数据库恢复后的数据完整性
   * 检查关键表的记录数，确保数据已正确恢复
   */
  private async validateDatabaseRestore(sqlFile: string): Promise<{ isValid: boolean; message: string; tableCount: number; totalRows: number }> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return { isValid: false, message: 'DATABASE_URL 未配置', tableCount: 0, totalRows: 0 };
    }

    const url = new URL(databaseUrl);
    const dbName = (url.pathname || '/').slice(1) || 'bnoa';
    const dbUser = url.username || 'postgres';
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const pass = url.password ? decodeURIComponent(url.password) : '';

    // 执行 psql 查询的辅助函数，依次尝试直连、docker exec bnoa-postgres、docker exec bnoa-prod-postgres
    const runPsqlQuery = async (query: string): Promise<string> => {
      // 方式1: 直接 psql 连接
      try {
        const cmd = `PGPASSWORD="${pass}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t -c "${query}"`;
        const result = await execAsync(cmd);
        return result.stdout || '';
      } catch { /* fallthrough */ }
      // 方式2: docker exec bnoa-postgres
      try {
        const cmd = `docker exec bnoa-postgres psql -U ${dbUser} -d ${dbName} -t -c "${query}"`;
        const result = await execAsync(cmd);
        return result.stdout || '';
      } catch { /* fallthrough */ }
      // 方式3: docker exec bnoa-prod-postgres
      try {
        const cmd = `docker exec bnoa-prod-postgres psql -U ${dbUser} -d ${dbName} -t -c "${query}"`;
        const result = await execAsync(cmd);
        return result.stdout || '';
      } catch (error) {
        throw error;
      }
    };

    // 直接从数据库查询所有用户表，而不是从 SQL 文件解析
    const getUserTables = async (): Promise<string[]> => {
      const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
      try {
        const stdout = await runPsqlQuery(query);
        const tables = stdout
          .split('\n')
          .map(t => t.trim())
          .filter(t => t.length > 0 && !t.startsWith('_prisma') && t !== 'restore_logs' && t !== 'audit_logs');
        return tables;
      } catch (error) {
        this.logger.warn(`查询用户表失败: ${error.message}`);
        return [];
      }
    };

    const tableNames = await getUserTables();

    if (tableNames.length === 0) {
      return { isValid: false, message: '无法从数据库查询表名', tableCount: 0, totalRows: 0 };
    }

    // 查询每个关键表的记录数
    const executeQuery = async (query: string): Promise<number> => {
      try {
        const stdout = await runPsqlQuery(query);
        const count = parseInt(stdout.trim(), 10);
        return isNaN(count) ? 0 : count;
      } catch {
        return 0;
      }
    };

    let totalRows = 0;
    const tableDetails: string[] = [];

    for (const tableName of tableNames) {
      const count = await executeQuery(`SELECT COUNT(*) FROM "${tableName}"`);
      totalRows += count;
      if (count > 0) {
        tableDetails.push(`${tableName}: ${count}`);
      }
    }

    this.logger.log(`数据库恢复验证: ${tableNames.length} 个表, ${totalRows} 行数据, 详情: ${tableDetails.join(', ')}`);

    // 如果没有任何数据，认为验证失败
    if (totalRows === 0) {
      return { isValid: false, message: '恢复后数据库没有任何数据', tableCount: tableNames.length, totalRows: 0 };
    }

    return {
      isValid: true,
      message: `验证通过: ${tableNames.length} 个表, ${totalRows} 行数据`,
      tableCount: tableNames.length,
      totalRows,
    };
  }

  private async exportTableToFile(tableName: string, outputFile: string): Promise<boolean> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return false;

    const url = new URL(databaseUrl);
    const dbName = (url.pathname || '/').slice(1) || 'bnoa';
    const dbUser = url.username || 'postgres';
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const pass = url.password ? decodeURIComponent(url.password) : '';

    // 尝试直接使用 psql
    try {
      const cmd = `PGPASSWORD="${pass}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "COPY ${tableName} TO STDOUT" > "${outputFile}"`;
      await execAsync(cmd);
      return fs.existsSync(outputFile);
    } catch {
      // 尝试 Docker 开发环境
      try {
        const dockerCmd = `docker exec bnoa-postgres psql -U ${dbUser} -d ${dbName} -c "COPY ${tableName} TO STDOUT" > "${outputFile}"`;
        await execAsync(dockerCmd);
        return fs.existsSync(outputFile);
      } catch {
        // 尝试 Docker 生产环境
        try {
          const prodDockerCmd = `docker exec bnoa-prod-postgres psql -U ${dbUser} -d ${dbName} -c "COPY ${tableName} TO STDOUT" > "${outputFile}"`;
          await execAsync(prodDockerCmd);
          return fs.existsSync(outputFile);
        } catch {
          return false;
        }
      }
    }
  }

  private async importTableFromFile(tableName: string, inputFile: string): Promise<boolean> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return false;

    const url = new URL(databaseUrl);
    const dbName = (url.pathname || '/').slice(1) || 'bnoa';
    const dbUser = url.username || 'postgres';
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const pass = url.password ? decodeURIComponent(url.password) : '';

    // 尝试直接使用 psql
    try {
      const cmd = `PGPASSWORD="${pass}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE; COPY ${tableName} FROM STDIN" < "${inputFile}"`;
      await execAsync(cmd);
      return true;
    } catch {
      // 尝试 Docker 开发环境
      try {
        const dockerCmd = `docker exec bnoa-postgres psql -U ${dbUser} -d ${dbName} -c "TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE; COPY ${tableName} FROM STDIN" < "${inputFile}"`;
        await execAsync(dockerCmd);
        return true;
      } catch {
        // 尝试 Docker 生产环境
        try {
          const prodDockerCmd = `docker exec bnoa-prod-postgres psql -U ${dbUser} -d ${dbName} -c "TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE; COPY ${tableName} FROM STDIN" < "${inputFile}"`;
          await execAsync(prodDockerCmd);
          return true;
        } catch {
          return false;
        }
      }
    }
  }

  async getRestoreLogs(page: number = 1, pageSize: number = 10, backupId?: string) {
    const where: any = {};
    if (backupId) where.backupId = backupId;

    const [items, total] = await Promise.all([
      this.prisma.restoreLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          backup: {
            select: { id: true, backupType: true, createdAt: true },
          },
          operator: {
            select: { id: true, username: true, name: true },
          },
          autoBackup: {
            select: { id: true, createdAt: true },
          },
        },
      }),
      this.prisma.restoreLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 通用辅助方法：通过临时文件执行 SQL，避免 shell 引号转义问题
   * 依次尝试：psql 直连 → docker exec bnoa-postgres → docker exec bnoa-prod-postgres
   */
  private async executeSqlViaFile(sql: string): Promise<boolean> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      this.logger.error('DATABASE_URL 环境变量未配置');
      return false;
    }

    const url = new URL(databaseUrl);
    const dbName = (url.pathname || '/').slice(1) || 'bnoa';
    const dbUser = url.username || 'postgres';
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const pass = url.password ? decodeURIComponent(url.password) : '';

    const tmpFile = path.join('/tmp', `bnoa_sql_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`);
    try {
      fs.writeFileSync(tmpFile, sql, 'utf-8');

      const checkPsqlResult = (result: { stdout: string; stderr: string }, label: string): boolean => {
        const output = (result.stdout || '') + (result.stderr || '');
        if (output.includes('ERROR:')) {
          this.logger.error(`executeSqlViaFile: ${label} SQL执行报错: ${output.substring(0, 500)}`);
          return false;
        }
        this.logger.log(`executeSqlViaFile: ${label} 成功`);
        return true;
      };

      // 方式1: psql 直连
      try {
        const result = await execAsync(`PGPASSWORD="${pass}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${tmpFile}"`);
        if (checkPsqlResult(result, '方式1(psql直连)')) return true;
      } catch (e1) {
        this.logger.warn(`executeSqlViaFile: 方式1失败: ${e1.message?.substring(0, 200)}`);
      }
      // 方式2: docker exec bnoa-postgres（需要先 docker cp 到容器内）
      try {
        const containerTmp = `/tmp/${path.basename(tmpFile)}`;
        await execAsync(`docker cp "${tmpFile}" bnoa-postgres:${containerTmp}`);
        const result = await execAsync(`docker exec bnoa-postgres psql -U ${dbUser} -d ${dbName} -f "${containerTmp}"`);
        await execAsync(`docker exec bnoa-postgres rm -f "${containerTmp}"`).catch(() => {});
        if (checkPsqlResult(result, '方式2(docker exec bnoa-postgres)')) return true;
      } catch (e2) {
        this.logger.warn(`executeSqlViaFile: 方式2失败: ${e2.message?.substring(0, 200)}`);
      }
      // 方式3: docker exec bnoa-prod-postgres
      try {
        const containerTmp = `/tmp/${path.basename(tmpFile)}`;
        await execAsync(`docker cp "${tmpFile}" bnoa-prod-postgres:${containerTmp}`);
        const result = await execAsync(`docker exec bnoa-prod-postgres psql -U ${dbUser} -d ${dbName} -f "${containerTmp}"`);
        await execAsync(`docker exec bnoa-prod-postgres rm -f "${containerTmp}"`).catch(() => {});
        if (checkPsqlResult(result, '方式3(docker exec bnoa-prod-postgres)')) return true;
      } catch (e3) {
        this.logger.error(`executeSqlViaFile: 所有方式均失败, 方式3: ${e3.message?.substring(0, 200)}`);
      }
      return false;
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  /**
   * 使用原始 SQL 更新恢复日志状态
   * 用于数据库恢复后，因为 restore_logs 表可能被清空，Prisma 无法工作
   */
  private async updateRestoreLogStatusWithSql(
    id: string,
    backupId: string,
    status: 'running' | 'success' | 'failed',
    durationMs: number,
    stepsLog: any[],
    errorMessage?: string,
  ): Promise<void> {
    const stepsLogJson = JSON.stringify(stepsLog).replace(/'/g, "''");
    const errorMsg = errorMessage ? `'${errorMessage.replace(/'/g, "''")}'` : 'NULL';
    const completedAt = status !== 'running' ? `, completed_at = NOW()` : '';

    const updateSql = `UPDATE restore_logs SET status = '${status}', duration_ms = ${durationMs}, steps_log = '${stepsLogJson}', error_message = ${errorMsg}, updated_at = NOW()${completedAt} WHERE id = '${id}';`;
    const backupIdForInsert = backupId || '00000000-0000-0000-0000-000000000000';
    const insertSql = `INSERT INTO restore_logs (id, backup_id, status, restore_type, content_types, started_at, completed_at, duration_ms, steps_log, error_message, created_at, updated_at) SELECT '${id}', '${backupIdForInsert}', '${status}', 'DATABASE', ARRAY['database'], NOW() - INTERVAL '${durationMs} milliseconds', NOW(), ${durationMs}, '${stepsLogJson}', ${errorMsg}, NOW() - INTERVAL '${durationMs} milliseconds', NOW() WHERE NOT EXISTS (SELECT 1 FROM restore_logs WHERE id = '${id}');`;

    await this.executeSqlViaFile(updateSql + '\n' + insertSql);
  }

  /**
   * 使用原始 SQL 更新恢复日志的单个字段
   */
  private async updateRestoreLogFieldWithSql(
    id: string,
    field: string,
    value: string,
  ): Promise<void> {
    const sql = `UPDATE restore_logs SET ${field} = '${value}', updated_at = NOW() WHERE id = '${id}';`;
    await this.executeSqlViaFile(sql);
  }

  /**
   * 使用原始 SQL 更新备份记录
   */
  private async updateBackupLogStatusWithSql(backup: BackupLog): Promise<void> {
    const storagePath = backup.storagePath ? `'${backup.storagePath.replace(/'/g, "''")}'` : 'NULL';
    const fileSize = backup.fileSize ?? 'NULL';
    const contentTypes = `ARRAY['${(backup.contentTypes || []).join("','")}']::text[]`;

    // 先 UPDATE，再 INSERT（如果不存在）
    const updateSql = `UPDATE backup_logs SET status = 'success', storage_path = ${storagePath}, file_size = ${fileSize}, content_types = ${contentTypes}, completed_at = NOW(), updated_at = NOW() WHERE id = '${backup.id}';`;
    const insertSql = `INSERT INTO backup_logs (id, backup_type, trigger_type, status, storage_type, content_types, storage_path, file_size, created_at, updated_at) SELECT '${backup.id}', '${backup.backupType}', '${backup.triggerType}', 'success', '${backup.storageType}', ${contentTypes}, ${storagePath}, ${fileSize}, NOW(), NOW() WHERE NOT EXISTS (SELECT 1 FROM backup_logs WHERE id = '${backup.id}');`;

    await this.executeSqlViaFile(updateSql + '\n' + insertSql);
  }

  /**
   * 使用原始 SQL 重新创建恢复日志（用于恢复后 restore_logs 被清除的情况）
   */
  private async recreateRestoreLogWithSql(
    restoreLogId: string,
    backupId: string,
    autoBackupId: string | undefined,
    status: 'success' | 'failed',
    durationMs: number,
    stepsLog: any[],
    errorMessage?: string,
  ): Promise<void> {
    const stepsLogJson = JSON.stringify(stepsLog).replace(/'/g, "''");
    const errorMsg = errorMessage ? `'${errorMessage.replace(/'/g, "''")}'` : 'NULL';
    const autoBackupIdVal = autoBackupId ? `'${autoBackupId}'` : 'NULL';

    const sql = `INSERT INTO restore_logs (id, backup_id, restore_type, status, content_types, auto_backup_id, started_at, completed_at, duration_ms, steps_log, error_message, created_at, updated_at) VALUES ('${restoreLogId}', '${backupId}', 'DATABASE', '${status}', ARRAY['database'], ${autoBackupIdVal}, NOW() - INTERVAL '${durationMs} milliseconds', NOW(), ${durationMs}, '${stepsLogJson}', ${errorMsg}, NOW() - INTERVAL '${durationMs} milliseconds', NOW());`;

    await this.executeSqlViaFile(sql);
  }

  /**
   * 重新创建自动备份记录（用于恢复后 backup_logs 被清除的情况）
   */
  private async recreateAutoBackupLogWithSql(
    autoBackupInfo: { id: string; backupType: string; triggerType: string; storageType: string; storagePath: string; fileSize: number; contentTypes: string[] },
  ): Promise<void> {
    const storagePath = autoBackupInfo.storagePath ? `'${autoBackupInfo.storagePath.replace(/'/g, "''")}'` : 'NULL';
    const fileSize = autoBackupInfo.fileSize ?? 'NULL';
    const contentTypes = `ARRAY['${autoBackupInfo.contentTypes.join("','")}']::text[]`;

    const sql = `INSERT INTO backup_logs (id, backup_type, trigger_type, status, storage_type, content_types, storage_path, file_size, created_at, updated_at) VALUES ('${autoBackupInfo.id}', '${autoBackupInfo.backupType}', '${autoBackupInfo.triggerType}', 'success', '${autoBackupInfo.storageType}', ${contentTypes}, ${storagePath}, ${fileSize}, NOW(), NOW());`;

    await this.executeSqlViaFile(sql);
  }

  /**
   * 直接插入新的恢复日志记录（用于恢复后创建恢复记录）
   * 简洁实现：不判断记录是否存在，直接插入新记录
   */
  private async insertRestoreLogSql(
    backupId: string,
    autoBackupId: string | undefined,
    status: 'success' | 'failed',
    durationMs: number,
    stepsLog: any[],
    errorMessage?: string,
  ): Promise<void> {
    const newRestoreLogId = crypto.randomUUID();
    const stepsLogJson = JSON.stringify(stepsLog).replace(/'/g, "''");
    const errorMsg = errorMessage ? `'${errorMessage.replace(/'/g, "''")}'` : 'NULL';
    const autoBackupIdVal = autoBackupId ? `'${autoBackupId}'` : 'NULL';

    const sql = `INSERT INTO restore_logs (id, backup_id, restore_type, status, content_types, auto_backup_id, started_at, completed_at, duration_ms, steps_log, error_message, created_at, updated_at) VALUES ('${newRestoreLogId}', '${backupId}', 'DATABASE', '${status}', ARRAY['database'], ${autoBackupIdVal}, NOW() - INTERVAL '${durationMs} milliseconds', NOW(), ${durationMs}, '${stepsLogJson}', ${errorMsg}, NOW() - INTERVAL '${durationMs} milliseconds', NOW());`;

    await this.executeSqlViaFile(sql);
  }
}
