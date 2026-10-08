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

@ApiTags('备份管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly configService: BackupConfigService,
    private readonly schedulerService: BackupSchedulerService,
  ) {}

  @Get('config')
  @Permissions('backup:config')
  @ApiOperation({ summary: '获取备份配置' })
  async getConfig() {
    return this.configService.getConfig();
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
  async getLogs(@Query() query: BackupQueryDto) {
    return this.backupService.getBackupLogs(
      query.page || 1,
      query.pageSize || 10,
      query.status,
      query.triggerType,
    );
  }

  @Get('stats')
  @Permissions('backup:info')
  @ApiOperation({ summary: '获取备份统计' })
  async getStats() {
    return this.backupService.getStats();
  }

  @Get(':id/download')
  @Permissions('backup:info')
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
  async getRestoreLogs(@Query() query: RestoreQueryDto) {
    return this.backupService.getRestoreLogs(
      query.page || 1,
      query.pageSize || 10,
      query.backupId,
    );
  }
}
