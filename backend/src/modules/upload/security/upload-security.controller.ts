/**
 * 上传安全控制器
 * 提供安全相关API端点
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UploadSecurityService, DiskSpaceInfo, UploadLimits } from './upload-security.service';
import { VirusScanService, ScanResult } from './virus-scan.service';

/**
 * 隔离文件请求DTO
 */
class QuarantineFileDto {
  fileId: string;
  reason: string;
}

/**
 * 扫描文件请求DTO
 */
class ScanFileDto {
  filePath: string;
}

@Controller('api/v1/upload-security')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UploadSecurityController {
  constructor(
    private readonly securityService: UploadSecurityService,
    private readonly virusScanService: VirusScanService,
  ) {}

  /**
   * 获取磁盘空间信息
   */
  @Get('disk-space')
  @Permissions('security:config')
  async getDiskSpace(): Promise<DiskSpaceInfo> {
    return this.securityService.getDiskSpace();
  }

  /**
   * 获取上传限制配置
   */
  @Get('limits')
  async getUploadLimits(): Promise<UploadLimits> {
    return this.securityService.getUploadLimits();
  }

  /**
   * 检查上传是否启用
   */
  @Get('status')
  async getUploadStatus(): Promise<{ enabled: boolean; reason?: string }> {
    return this.securityService.checkUploadEnabled();
  }

  /**
   * 执行安全检查
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async performSecurityCheck(
    @CurrentUser() user: { id: string },
    @Body() body: { fileSize: number },
  ): Promise<{ passed: boolean; reason?: string }> {
    return this.securityService.performSecurityCheck(user.id, body.fileSize);
  }

  /**
   * 隔离文件
   */
  @Post('quarantine')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  async quarantineFile(
    @CurrentUser() user: { id: string },
    @Body() dto: QuarantineFileDto,
  ) {
    return this.securityService.quarantineFile(dto.fileId, dto.reason, user.id);
  }

  /**
   * 释放隔离文件
   */
  @Post('release/:fileId')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  async releaseFromQuarantine(
    @CurrentUser() user: { id: string },
    @Param('fileId') fileId: string,
  ) {
    await this.securityService.releaseFromQuarantine(fileId, user.id);
    return { success: true, message: '文件已从隔离区释放' };
  }

  /**
   * 获取病毒扫描服务状态
   */
  @Get('virus-scan/status')
  @Permissions('security:config')
  async getVirusScanStatus() {
    return this.virusScanService.getStatus();
  }

  /**
   * 扫描指定文件
   */
  @Post('virus-scan/scan')
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  async scanFile(@Body() dto: ScanFileDto): Promise<ScanResult> {
    return this.virusScanService.scanFile(dto.filePath);
  }
}
