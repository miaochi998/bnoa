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
  ParseIntPipe,
  DefaultValuePipe,
  Res,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileFilterDto } from './dto/file-filter.dto';
import {
  RenameFileDto,
  MoveFileDto,
  BatchMoveFilesDto,
  BatchDeleteFilesDto,
} from './dto/rename-file.dto';

/**
 * 文件管理控制器
 * 提供文件管理的 REST API
 */
@ApiTags('文件管理')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * 获取文件列表
   */
  @Get()
  @ApiOperation({ summary: '获取文件列表' })
  async findAll(
    @Query() filter: FileFilterDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.findAll(filter, userId);
  }

  /**
   * 获取文件详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取文件详情' })
  async findById(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.findById(id, userId);
  }

  /**
   * 下载单个文件
   */
  @Get(':id/download')
  @ApiOperation({ summary: '下载单个文件' })
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, mimeType } = await this.fileService.downloadFile(id, userId);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length.toString(),
    });
    
    return new StreamableFile(buffer);
  }

  /**
   * 重命名文件
   */
  @Put(':id/rename')
  @ApiOperation({ summary: '重命名文件' })
  async rename(
    @Param('id') id: string,
    @Body() dto: RenameFileDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.rename(id, dto, userId);
  }

  /**
   * 移动文件
   */
  @Put(':id/move')
  @ApiOperation({ summary: '移动文件' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveFileDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.move(id, dto, userId);
  }

  /**
   * 批量移动文件
   */
  @Post('batch-move')
  @ApiOperation({ summary: '批量移动文件' })
  async batchMove(
    @Body() dto: BatchMoveFilesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.batchMove(dto, userId);
  }

  /**
   * 复制文件
   */
  @Post(':id/copy')
  @ApiOperation({ summary: '复制文件' })
  async copy(
    @Param('id') id: string,
    @Body() dto: { folderId?: string },
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.copy(id, dto.folderId, userId);
  }

  /**
   * 批量复制文件
   */
  @Post('batch-copy')
  @ApiOperation({ summary: '批量复制文件' })
  async batchCopy(
    @Body() dto: { fileIds: string[]; folderId?: string },
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.batchCopy(dto.fileIds, dto.folderId, userId);
  }

  /**
   * 删除文件（移到回收站）
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除文件（移到回收站）' })
  async delete(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    await this.fileService.delete(id, userId);
    return { success: true, message: '文件已删除' };
  }

  /**
   * 批量删除文件
   */
  @Post('batch-delete')
  @ApiOperation({ summary: '批量删除文件' })
  async batchDelete(
    @Body() dto: BatchDeleteFilesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.batchDelete(dto, userId);
  }

  /**
   * 获取回收站文件列表
   */
  @Get('recycle-bin/list')
  @ApiOperation({ summary: '获取回收站文件列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findDeleted(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.findDeleted(page, pageSize, userId);
  }

  /**
   * 恢复已删除文件
   */
  @Post(':id/restore')
  @ApiOperation({ summary: '恢复已删除文件' })
  async restore(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.fileService.restore(id, userId);
    return { success: true, message: '文件已恢复' };
  }

  /**
   * 永久删除文件
   */
  @Delete(':id/permanent')
  @ApiOperation({ summary: '永久删除文件' })
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.fileService.permanentDelete(id, userId);
    return { success: true, message: '文件已永久删除' };
  }

  /**
   * 批量永久删除文件
   */
  @Post('recycle-bin/batch-permanent')
  @ApiOperation({ summary: '批量永久删除文件' })
  async batchPermanentDelete(
    @Body() dto: { fileIds: string[] },
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.batchPermanentDelete(dto.fileIds, userId);
  }

  /**
   * 清空回收站
   */
  @Post('recycle-bin/clear')
  @ApiOperation({ summary: '清空回收站' })
  async clearRecycleBin(@CurrentUser('userId') userId: string) {
    return this.fileService.clearRecycleBin(userId);
  }

  /**
   * 获取文件统计信息
   */
  @Get('stats/overview')
  @ApiOperation({ summary: '获取文件统计信息' })
  async getStats(
    @CurrentUser('userId') userId: string,
    @Query('storageMode') storageMode?: string,
  ) {
    return this.fileService.getStats(userId, storageMode);
  }

  /**
   * 获取回收站保留天数配置
   */
  @Get('recycle-bin/retention-days')
  @ApiOperation({ summary: '获取回收站保留天数配置' })
  async getRetentionDays() {
    return this.fileService.getRecycleBinRetentionDays();
  }

  /**
   * 更新回收站保留天数配置
   */
  @Put('recycle-bin/retention-days')
  @ApiOperation({ summary: '更新回收站保留天数配置' })
  async updateRetentionDays(
    @Body() dto: { days: number },
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.updateRecycleBinRetentionDays(dto.days, userId);
  }

  /**
   * 打包下载多个文件
   */
  @Post('package-download')
  @ApiOperation({ summary: '打包下载多个文件' })
  async packageDownload(
    @Body() dto: { fileIds: string[] },
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, filename } = await this.fileService.packageDownload(dto.fileIds, userId);
    
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    
    return new StreamableFile(stream);
  }

  /**
   * 上传视频缩略图
   */
  @Post(':id/thumbnail')
  @ApiOperation({ summary: '上传视频缩略图' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('thumbnail'))
  async uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return this.fileService.uploadThumbnail(id, file, userId);
  }

  /**
   * 预览文件（代理访问存储服务）
   */
  @Get(':id/preview')
  @ApiOperation({ summary: '预览文件' })
  async previewFile(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, mimeType } = await this.fileService.downloadFile(id, userId);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000',
    });
    
    return new StreamableFile(buffer);
  }

  /**
   * 预览缩略图（代理访问存储服务）
   */
  @Get(':id/thumbnail-preview')
  @ApiOperation({ summary: '预览缩略图' })
  async previewThumbnail(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.fileService.downloadThumbnail(id, userId);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000',
    });
    
    return new StreamableFile(buffer);
  }
}
