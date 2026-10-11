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
  ForbiddenException,
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
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';

/**
 * 文件字段映射：用于「信息权限」的读取脱敏与写入过滤
 * 覆盖文件中心列表/详情，可按角色隐藏：上传者、所属文件夹、存储路径、
 * 访问地址、校验值、安全扫描、分享码等。
 * ⚠️ 隐藏 url 会影响前端缩略图/预览的展示（由配置者自行权衡）。
 */
const FILE_FIELD_MAP: FieldKeyMapping[] = [
  // 基本信息
  { field: 'name', key: 'name' },
  { field: 'originalName', key: 'originalName' },
  { field: 'extension', key: 'extension' },
  { field: 'size', key: 'size' },
  { field: 'category', key: 'category' },
  { field: 'createdAt', key: 'createdAt' },
  // 归属信息
  { field: 'uploadedBy', key: 'uploadedBy' },
  { field: 'uploadedBy', key: 'user' },
  { field: 'folderId', key: 'folderId' },
  { field: 'folderId', key: 'folder' },
  // 列表接口把文件夹名拍平成 folderName（响应里没有嵌套 folder 对象），需单独映射
  { field: 'folder.name', key: 'folderName' },
  // 存储与安全（默认敏感）
  { field: 'url', key: 'url' },
  { field: 'path', key: 'path' },
  { field: 'md5', key: 'md5' },
  { field: 'virusScanResult', key: 'virusScanResult' },
  { field: 'shareCode', key: 'shareCode' },
];

/** 需要递归处理的数组字段名 */
const FILE_NESTED_ARRAYS = ['items', 'list', 'data', 'files'];
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
// 注意：必须挂 PermissionGuard，否则 @Permissions 装饰器不会生效（此前只挂了 JwtAuthGuard）
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'file',
      user.roles ?? [],
    );
  }

  /** 递归脱敏（文件对象 / 列表 / 分页对象都兼容） */
  private stripFileDeep(node: any, state: any): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      FILE_FIELD_MAP,
      state,
    );
  }

  /**
   * 获取文件列表
   */
  @Get()
  @Permissions('file:list')
  @ApiOperation({ summary: '获取文件列表' })
  async findAll(
    @Query() filter: FileFilterDto,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.fileService.findAll(
      filter, user.userId ?? user.sub,
    );
    const state = await this.resolveFields(user);
    return this.stripFileDeep(result, state);
  }

  /**
   * 获取文件详情
   */
  @Get(':id')
  @Permissions('file:list')
  @ApiOperation({ summary: '获取文件详情' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    const file = await this.fileService.findById(
      id, user.userId ?? user.sub,
    );
    const state = await this.resolveFields(user);
    return this.stripFileDeep(file, state);
  }

  /**
   * 下载单个文件
   */
  @Get(':id/download')
  @Permissions('file:download')
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
  @Permissions('file:rename')
  @ApiOperation({ summary: '重命名文件' })
  async rename(
    @Param('id') id: string,
    @Body() dto: RenameFileDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto as any,
      FILE_FIELD_MAP,
      state,
    );
    if (!safe.name) {
      throw new ForbiddenException('没有「文件名」的编辑权限');
    }
    return this.fileService.rename(
      id, safe as RenameFileDto, user.userId ?? user.sub,
    );
  }

  /**
   * 移动文件
   */
  @Put(':id/move')
  @Permissions('file:move')
  @ApiOperation({ summary: '移动文件' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveFileDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto as any,
      FILE_FIELD_MAP,
      state,
    );
    if (Object.keys(safe).length === 0) {
      throw new ForbiddenException('没有文件字段的编辑权限');
    }
    return this.fileService.move(
      id, safe as MoveFileDto, user.userId ?? user.sub,
    );
  }

  /**
   * 批量移动文件
   */
  @Post('batch-move')
  @Permissions('file:move')
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
  @Permissions('file:copy')
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
  @Permissions('file:copy')
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
  @Permissions('file:delete')
  @ApiOperation({ summary: '删除文件（移到回收站）' })
  async delete(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    await this.fileService.delete(id, userId);
    return { success: true, message: '文件已删除' };
  }

  /**
   * 批量删除文件
   */
  @Post('batch-delete')
  @Permissions('file:delete')
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
  @Permissions('file:trash')
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
  @Permissions('file:restore')
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
  @Permissions('file:permanent-delete')
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
  @Permissions('file:permanent-delete')
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
  @Permissions('file:permanent-delete')
  @ApiOperation({ summary: '清空回收站' })
  async clearRecycleBin(@CurrentUser('userId') userId: string) {
    return this.fileService.clearRecycleBin(userId);
  }

  /**
   * 获取文件统计信息
   */
  @Get('stats/overview')
  @Permissions('file:list')
  @ApiOperation({ summary: '获取文件统计信息' })
  async getStats(
    @CurrentUser() user: UserPayload,
    @Query('storageMode') storageMode?: string,
  ) {
    const stats: any = await this.fileService.getStats(
      user.userId ?? user.sub,
      storageMode,
    );
    const state = await this.resolveFields(user);
    // 汇总值同受字段权限控制：隐藏了「文件大小」就不应再多给一个 totalSize 让人反推
    if (stats && typeof stats === 'object' && !state.canView.has('size')) {
      delete stats.totalSize;
      if (stats.byType && typeof stats.byType === 'object') {
        for (const value of Object.values(stats.byType)) {
          if (value && typeof value === 'object') {
            delete (value as any).size;
          }
        }
      }
      if (Array.isArray(stats.byExtension)) {
        stats.byExtension = stats.byExtension.map((item: any) => {
          if (item && typeof item === 'object') {
            const copy = { ...item };
            delete copy.size;
            return copy;
          }
          return item;
        });
      }
    }
    return stats;
  }

  /**
   * 获取回收站保留天数配置
   */
  @Get('recycle-bin/retention-days')
  @Permissions('file:trash')
  @ApiOperation({ summary: '获取回收站保留天数配置' })
  async getRetentionDays() {
    return this.fileService.getRecycleBinRetentionDays();
  }

  /**
   * 更新回收站保留天数配置
   */
  @Put('recycle-bin/retention-days')
  @Permissions('file-storage:update')
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
  @Permissions('file:download')
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
  @Permissions('file:rename')
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
  @Permissions('file:preview')
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
  @Permissions('file:preview')
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
