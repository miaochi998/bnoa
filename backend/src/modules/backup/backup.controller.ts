import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { BackupConfigService } from './backup-config.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { CreateBackupDto, BackupConfigDto, BackupQueryDto, RestoreBackupDto, RestoreQueryDto } from './dto/backup.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SuperAdminOnly } from '../../common/decorators/super-admin-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';

/** 备份字段映射：用于「信息权限」读取脱敏（备份记录不可编辑） */
const BACKUP_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'backupType', key: 'backupType' },
  { field: 'triggerType', key: 'triggerType' },
  { field: 'status', key: 'status' },
  { field: 'storageType', key: 'storageType' },
  { field: 'storagePath', key: 'storagePath' },
  { field: 'fileSize', key: 'fileSize' },
  { field: 'checksum', key: 'checksum' },
  { field: 'startedAt', key: 'startedAt' },
  { field: 'completedAt', key: 'completedAt' },
  { field: 'errorMessage', key: 'errorMessage' },
  { field: 'operatorId', key: 'operatorId' },
];

@ApiTags('备份管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly configService: BackupConfigService,
    private readonly schedulerService: BackupSchedulerService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'backup',
      user.roles ?? [],
    );
  }

  /** 递归脱敏 */
  private stripBackupDeep(node: any, state: any): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      BACKUP_FIELD_MAP,
      state,
    );
  }

  @Get('config')
  @Permissions('backup:view')
  @ApiOperation({ summary: '获取备份配置' })
  async getConfig(@CurrentUser() user: UserPayload) {
    const config = await this.configService.getConfig();
    const state = await this.resolveFields(user);
    // 备份配置里含存储路径等字段，同样按字段权限处理
    return this.stripBackupDeep(config, state);
  }

  @Put('config')
  @Permissions('backup:config')
  @ApiOperation({ summary: '更新备份配置' })
  async updateConfig(@Body() dto: BackupConfigDto) {
    const config = await this.configService.saveConfig(dto);
    await this.schedulerService.syncCronFromConfig();
    return config;
  }

  @Post('create')
  @Permissions('backup:create')
  @ApiOperation({ summary: '手动创建备份' })
  async createBackup(@Body() dto: CreateBackupDto, @Request() req: any) {
    return this.backupService.createBackup(
      dto,
      req.user?.id,
      req.ip,
    );
  }

  @Get('logs')
  @Permissions('backup:info')
  @ApiOperation({ summary: '获取备份记录列表' })
  async getLogs(
    @Query() query: BackupQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.backupService.getBackupLogs(
      query.page || 1,
      query.pageSize || 10,
      query.status,
      query.triggerType,
    );
    const state = await this.resolveFields(user);
    return this.stripBackupDeep(result, state);
  }

  @Get('stats')
  @Permissions('backup:info')
  @ApiOperation({ summary: '获取备份统计' })
  async getStats(@CurrentUser() user: UserPayload) {
    const stats = await this.backupService.getStats();
    const state = await this.resolveFields(user);
    return this.stripBackupDeep(stats, state);
  }

  @Get(':id/download')
  @Permissions('backup:download')
  @ApiOperation({ summary: '下载备份文件' })
  async downloadBackup(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.backupService.getBackupDownload(id);
    const disposition = `attachment; filename="${encodeURIComponent(filename)}"`;
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  }

  @Delete(':id')
  @Permissions('backup:delete')
  @ApiOperation({ summary: '删除备份记录' })
  async deleteBackup(@Param('id') id: string) {
    await this.backupService.deleteBackup(id);
    return { message: '删除成功' };
  }

  @Post(':id/restore')
  @Permissions('backup:restore')
  @SuperAdminOnly()
  @ApiOperation({ summary: '恢复备份' })
  async restoreBackup(@Param('id') id: string, @Body() dto: RestoreBackupDto, @Request() req: any) {
    return this.backupService.restoreBackup(
      id,
      dto,
      req.user?.id,
      req.ip,
    );
  }

  @Get('restore/logs')
  @Permissions('backup:info')
  @ApiOperation({ summary: '获取恢复记录列表' })
  async getRestoreLogs(
    @Query() query: RestoreQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const logs = await this.backupService.getRestoreLogs(
      query.page || 1,
      query.pageSize || 10,
      query.backupId,
    );
    const state = await this.resolveFields(user);
    return this.stripBackupDeep(logs, state);
  }
}
