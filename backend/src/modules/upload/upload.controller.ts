import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UploadService, UploadConfig } from './upload.service';
import { UploadSecurityService } from './security/upload-security.service';
import { VirusScanService } from './security/virus-scan.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CheckFileExistsDto,
  FileExistsResult,
} from './dto/check-file-exists.dto';
import { InitUploadDto, InitUploadResult } from './dto/init-upload.dto';
import { UploadChunkDto, UploadChunkResult } from './dto/upload-chunk.dto';
import {
  CompleteUploadDto,
  CompleteUploadResult,
} from './dto/complete-upload.dto';
import {
  SingleFileUploadDto,
  SingleFileUploadResult,
} from './dto/single-file-upload.dto';
import { MulterFile } from './interfaces/multer-file.interface';

/**
 * 上传控制器
 * 提供文件上传相关的 REST API
 */
@ApiTags('上传服务')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly securityService: UploadSecurityService,
    private readonly virusScanService: VirusScanService,
  ) {}

  /**
   * 检查文件是否存在（秒传检查）
   */
  @Post('check-exists')
  @ApiOperation({ summary: '检查文件是否存在（秒传检查）' })
  async checkFileExists(
    @Body() dto: CheckFileExistsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<FileExistsResult> {
    return this.uploadService.checkFileExists(dto, userId);
  }

  /**
   * 初始化分片上传会话
   */
  @Post('init')
  @ApiOperation({ summary: '初始化分片上传会话' })
  async initUpload(
    @Body() dto: InitUploadDto,
    @CurrentUser('userId') userId: string,
  ): Promise<InitUploadResult> {
    return this.uploadService.initUpload(dto, userId);
  }

  /**
   * 上传分片
   */
  @Post('chunk/:sessionId')
  @ApiOperation({ summary: '上传分片' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chunkIndex: { type: 'number', description: '分片索引' },
        chunkMd5: { type: 'string', description: '分片MD5' },
        file: { type: 'string', format: 'binary', description: '分片文件' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @Body() dto: UploadChunkDto,
    @UploadedFile() file: MulterFile,
    @CurrentUser('userId') userId: string,
  ): Promise<UploadChunkResult> {
    if (!file) {
      throw new BadRequestException('分片文件不能为空');
    }
    return this.uploadService.uploadChunk(
      sessionId,
      dto.chunkIndex,
      dto.chunkMd5,
      file.buffer,
      userId,
    );
  }

  /**
   * 完成分片上传（合并）- 路径参数方式
   */
  @Post('complete/:sessionId')
  @ApiOperation({ summary: '完成分片上传（合并）- 路径参数方式' })
  async completeUploadByPath(
    @Param('sessionId') sessionId: string,
    @Body() dto: CompleteUploadDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CompleteUploadResult> {
    return this.uploadService.completeUpload({ ...dto, sessionId }, userId);
  }

  /**
   * 完成分片上传（合并）- Body参数方式（兼容前端）
   */
  @Post('complete')
  @ApiOperation({ summary: '完成分片上传（合并）- Body参数方式' })
  async completeUpload(
    @Body() dto: CompleteUploadDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CompleteUploadResult> {
    if (!dto.sessionId) {
      throw new BadRequestException('sessionId不能为空');
    }
    return this.uploadService.completeUpload(dto, userId);
  }

  /**
   * 合并分片（7DL兼容端点）
   */
  @Post('merge')
  @ApiOperation({ summary: '合并分片（7DL兼容端点）' })
  async mergeChunks(
    @Body() dto: CompleteUploadDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CompleteUploadResult> {
    if (!dto.sessionId) {
      throw new BadRequestException('sessionId不能为空');
    }
    return this.uploadService.completeUpload(dto, userId);
  }

  /**
   * 取消上传
   */
  @Delete(':sessionId')
  @ApiOperation({ summary: '取消上传' })
  async cancelUpload(
    @Param('sessionId') sessionId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.uploadService.cancelUpload(sessionId, userId);
    return { success: true, message: '上传已取消' };
  }

  /**
   * 单文件上传（小文件）
   */
  @Post('file')
  @ApiOperation({ summary: '单文件上传（小文件，不分片）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '单文件上传',
    type: SingleFileUploadDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingleFile(
    @UploadedFile() file: MulterFile,
    @Query('folderId') folderId: string,
    @Query('realFolderId') realFolderId: string,
    @Query('storageMode') storageMode: 'rustfs' | 'local',
    @Query('compress') compressStr: string,
    @Query('generateThumbnail') generateThumbnailStr: string,
    @Query('source') source: 'upload' | 'editor',
    @CurrentUser('userId') userId: string,
  ): Promise<SingleFileUploadResult> {
    if (!file) {
      throw new BadRequestException('文件不能为空');
    }
    const compress = compressStr !== 'false';
    const generateThumbnail = generateThumbnailStr !== 'false';
    return this.uploadService.uploadSingleFile(
      file, folderId, storageMode, userId,
      compress, generateThumbnail, realFolderId, source,
    );
  }

  /**
   * 获取上传配置
   */
  @Post('config')
  @ApiOperation({ summary: '获取上传配置' })
  getUploadConfig(): UploadConfig {
    return this.uploadService.getUploadConfig();
  }

  // ============================================
  // 安全相关端点
  // ============================================

  /**
   * 获取磁盘空间信息
   */
  @Get('security/disk-space')
  @UseGuards(PermissionGuard)
  @Permissions('security:config')
  @ApiOperation({ summary: '获取磁盘空间信息' })
  async getDiskSpace() {
    return this.securityService.getDiskSpace();
  }

  /**
   * 获取上传限制配置
   */
  @Get('security/limits')
  @ApiOperation({ summary: '获取上传限制配置' })
  async getUploadLimits() {
    return this.securityService.getUploadLimits();
  }

  /**
   * 检查上传是否启用
   */
  @Get('security/status')
  @ApiOperation({ summary: '检查上传是否启用' })
  async getUploadStatus() {
    return this.securityService.checkUploadEnabled();
  }

  /**
   * 执行安全检查
   */
  @Post('security/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '执行安全检查' })
  async performSecurityCheck(
    @CurrentUser('sub') userId: string,
    @Body() body: { fileSize: number },
  ) {
    return this.securityService.performSecurityCheck(userId, body.fileSize);
  }

  /**
   * 隔离文件
   */
  @Post('security/quarantine')
  @UseGuards(PermissionGuard)
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '隔离文件' })
  async quarantineFile(
    @CurrentUser('sub') userId: string,
    @Body() dto: { fileId: string; reason: string },
  ) {
    return this.securityService.quarantineFile(dto.fileId, dto.reason, userId);
  }

  /**
   * 释放隔离文件
   */
  @Post('security/release/:fileId')
  @UseGuards(PermissionGuard)
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '释放隔离文件' })
  async releaseFromQuarantine(
    @CurrentUser('sub') userId: string,
    @Param('fileId') fileId: string,
  ) {
    await this.securityService.releaseFromQuarantine(fileId, userId);
    return { success: true, message: '文件已从隔离区释放' };
  }

  /**
   * 获取病毒扫描服务状态
   */
  @Get('security/virus-scan/status')
  @UseGuards(PermissionGuard)
  @Permissions('security:config')
  @ApiOperation({ summary: '获取病毒扫描服务状态' })
  async getVirusScanStatus() {
    return this.virusScanService.getStatus();
  }

  /**
   * 扫描指定文件
   */
  @Post('security/virus-scan/scan')
  @UseGuards(PermissionGuard)
  @Permissions('security:verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '扫描指定文件' })
  async scanFile(@Body() dto: { filePath: string }) {
    return this.virusScanService.scanFile(dto.filePath);
  }
}
