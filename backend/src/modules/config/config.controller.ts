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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import { ConfigService } from './config.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateConfigDto,
  UpdateConfigDto,
  QueryConfigDto,
  BatchUpdateConfigDto,
} from './dto/config.dto';

/**
 * 系统配置控制器
 * 提供系统配置的 CRUD 接口
 */
@ApiTags('config')
@Controller('config')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * 创建配置
   */
  @Post()
  @Permissions('config:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建配置', description: '创建新的系统配置' })
  @ApiResponse({ status: 201, description: '配置创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 409, description: '配置键已存在' })
  async createConfig(
    @Body() dto: CreateConfigDto,
    @CurrentUser() user: UserPayload,
  ) {
    const config = await this.configService.createConfig(dto, user.sub);
    return {
      success: true,
      message: '配置创建成功',
      data: config,
    };
  }

  /**
   * 更新配置
   */
  @Put(':id')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新配置', description: '更新系统配置' })
  @ApiResponse({ status: 200, description: '配置更新成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: UserPayload,
  ) {
    const config = await this.configService.updateConfig(id, dto, user.sub);
    return {
      success: true,
      message: '配置更新成功',
      data: config,
    };
  }

  /**
   * 删除配置
   */
  @Delete(':id')
  @Permissions('config:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除配置', description: '删除系统配置' })
  @ApiResponse({ status: 200, description: '配置删除成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  @ApiResponse({ status: 400, description: '系统配置不允许删除' })
  async deleteConfig(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.deleteConfig(id, user.sub);
    return {
      success: true,
      message: '配置删除成功',
    };
  }

  /**
   * 获取配置详情
   */
  @Get(':id')
  @Permissions('config:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取配置详情',
    description: '获取指定配置的详细信息',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async getConfigById(@Param('id') id: string) {
    const config = await this.configService.getConfigById(id);
    return {
      success: true,
      message: '获取配置详情成功',
      data: config,
    };
  }

  /**
   * 查询配置列表
   */
  @Get()
  @Permissions('config:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询配置列表', description: '分页查询配置列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findConfigs(@Query() query: QueryConfigDto) {
    const result = await this.configService.findConfigs(query);
    return {
      success: true,
      message: '查询配置列表成功',
      data: result.items,
      meta: result.meta,
    };
  }

  /**
   * 批量更新配置
   */
  @Post('batch-update')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量更新配置', description: '批量更新多个配置项' })
  @ApiResponse({ status: 200, description: '批量更新成功' })
  async batchUpdateConfigs(
    @Body() dto: BatchUpdateConfigDto,
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.batchUpdateConfigs(dto, user.sub);
    return {
      success: true,
      message: '批量更新配置成功',
    };
  }

  /**
   * 获取配置分组列表
   */
  @Get('categories/list')
  @Permissions('config:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取配置分组', description: '获取所有配置分组' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getCategories() {
    const categories = await this.configService.getCategories();
    return {
      success: true,
      message: '获取配置分组成功',
      data: categories,
    };
  }

  /**
   * 根据分组获取配置
   */
  @Get('category/:category')
  @Permissions('config:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取分组配置',
    description: '根据分组获取配置列表',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getConfigsByCategory(@Param('category') category: string) {
    const configs = await this.configService.getConfigsByCategory(category);
    return {
      success: true,
      message: '获取分组配置成功',
      data: configs,
    };
  }

  /**
   * 刷新配置缓存
   */
  @Post('cache/refresh')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新配置缓存', description: '刷新系统配置缓存' })
  @ApiResponse({ status: 200, description: '刷新成功' })
  async refreshCache() {
    await this.configService.refreshCache();
    return {
      success: true,
      message: '配置缓存刷新成功',
    };
  }

  /**
   * 获取缩略图配置
   */
  @Get('thumbnail/settings')
  @Permissions('config:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取缩略图配置', description: '获取缩略图生成配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getThumbnailSettings() {
    const config = await this.configService.getThumbnailConfig();
    return {
      success: true,
      message: '获取缩略图配置成功',
      data: config,
    };
  }

  /**
   * 保存缩略图配置
   */
  @Put('thumbnail/settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存缩略图配置', description: '保存缩略图生成配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveThumbnailSettings(
    @Body() dto: { width: number; height: number; quality: number },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveThumbnailConfig(dto, user.sub);
    return {
      success: true,
      message: '缩略图配置保存成功',
    };
  }

  /**
   * 获取上传配置（并行上传数量等）
   */
  @Get('upload/settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取上传配置', description: '获取上传相关配置（并行上传数量等）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUploadSettings() {
    const config = await this.configService.getUploadConfig();
    return {
      success: true,
      message: '获取上传配置成功',
      data: config,
    };
  }

  /**
   * 保存上传配置
   */
  @Put('upload/settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存上传配置', description: '保存上传相关配置（并行上传数量等）' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveUploadSettings(
    @Body() dto: { maxConcurrentUploads: number },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveUploadConfig(dto, user.sub);
    return {
      success: true,
      message: '上传配置保存成功',
    };
  }

  /**
   * 获取图片压缩配置
   */
  @Get('compression/settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取图片压缩配置', description: '获取图片压缩参数配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getCompressionSettings() {
    const config = await this.configService.getCompressionConfig();
    return {
      success: true,
      message: '获取图片压缩配置成功',
      data: config,
    };
  }

  /**
   * 保存图片压缩配置
   */
  @Put('compression/settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存图片压缩配置', description: '保存图片压缩参数配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveCompressionSettings(
    @Body() dto: { quality: number; maxWidth: number; maxHeight: number; threshold: number },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveCompressionConfig(dto, user.sub);
    return {
      success: true,
      message: '图片压缩配置保存成功',
    };
  }

  // ==================== 编辑器配置 ====================

  /**
   * 获取编辑器图片配置
   */
  @Get('editor/image-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取编辑器图片配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEditorImageSettings() {
    const config = await this.configService.getEditorImageConfig();
    return {
      success: true,
      message: '获取编辑器图片配置成功',
      data: config,
    };
  }

  /**
   * 保存编辑器图片配置
   */
  @Put('editor/image-settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存编辑器图片配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveEditorImageSettings(
    @Body() dto: {
      maxWidth: number;
      maxHeight: number;
      maxSize: number;
      formats: string[];
      thumbnailWidth: number;
      thumbnailHeight: number;
    },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveEditorImageConfig(dto, user.sub);
    return {
      success: true,
      message: '编辑器图片配置保存成功',
    };
  }

  /**
   * 获取编辑器视频配置
   */
  @Get('editor/video-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取编辑器视频配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEditorVideoSettings() {
    const config = await this.configService.getEditorVideoConfig();
    return {
      success: true,
      message: '获取编辑器视频配置成功',
      data: config,
    };
  }

  /**
   * 保存编辑器视频配置
   */
  @Put('editor/video-settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存编辑器视频配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveEditorVideoSettings(
    @Body() dto: {
      maxSize: number;
      formats: string[];
    },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveEditorVideoConfig(dto, user.sub);
    return {
      success: true,
      message: '编辑器视频配置保存成功',
    };
  }

  /**
   * 获取编辑器文件夹配置
   */
  @Get('editor/folder-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取编辑器文件夹配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEditorFolderSettings() {
    const config = await this.configService.getEditorFolderConfig();
    return {
      success: true,
      message: '获取编辑器文件夹配置成功',
      data: config,
    };
  }

  /**
   * 保存编辑器文件夹配置
   */
  @Put('editor/folder-settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存编辑器文件夹配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveEditorFolderSettings(
    @Body() dto: {
      imageFolderId: string;
      videoFolderId: string;
    },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveEditorFolderConfig(dto, user.sub);
    return {
      success: true,
      message: '编辑器文件夹配置保存成功',
    };
  }

  // ==================== 记事本编辑器配置 ====================

  @Get('notebook/image-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取记事本编辑器图片配置' })
  async getNotebookImageSettings() {
    const config = await this.configService.getNotebookImageConfig();
    return { success: true, message: '获取记事本图片配置成功', data: config };
  }

  @Put('notebook/image-settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存记事本编辑器图片配置' })
  async saveNotebookImageSettings(
    @Body() dto: { maxWidth: number; maxHeight: number; maxSize: number; formats: string[]; thumbnailWidth: number; thumbnailHeight: number },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveNotebookImageConfig(dto, user.sub);
    return { success: true, message: '记事本图片配置保存成功' };
  }

  @Get('notebook/video-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取记事本编辑器视频配置' })
  async getNotebookVideoSettings() {
    const config = await this.configService.getNotebookVideoConfig();
    return { success: true, message: '获取记事本视频配置成功', data: config };
  }

  @Put('notebook/video-settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存记事本编辑器视频配置' })
  async saveNotebookVideoSettings(
    @Body() dto: { maxSize: number; formats: string[] },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveNotebookVideoConfig(dto, user.sub);
    return { success: true, message: '记事本视频配置保存成功' };
  }

  @Get('notebook/folder-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取记事本编辑器文件夹配置' })
  async getNotebookFolderSettings() {
    const config = await this.configService.getNotebookFolderConfig();
    return { success: true, message: '获取记事本文件夹配置成功', data: config };
  }

  @Put('notebook/folder-settings')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存记事本编辑器文件夹配置' })
  async saveNotebookFolderSettings(
    @Body() dto: { imageFolderId: string; videoFolderId: string },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveNotebookFolderConfig(dto, user.sub);
    return { success: true, message: '记事本文件夹配置保存成功' };
  }

  /**
   * 获取产品图片配置
   */
  @Get('product/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取产品图片配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProductImageSettings() {
    const config = await this.configService.getProductImageConfig();
    return {
      success: true,
      message: '获取产品图片配置成功',
      data: config,
    };
  }

  /**
   * 保存产品图片配置
   */
  @Put('product/image')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存产品图片配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveProductImageSettings(
    @Body() dto: {
      maxWidth?: number;
      maxHeight?: number;
      maxSize?: number;
      formats?: string[];
      realFolderId?: string | null;
    },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.saveProductImageConfig(dto, user.sub);
    return {
      success: true,
      message: '产品图片配置保存成功',
    };
  }

  /**
   * 获取平台Logo配置
   */
  @Get('platform/logo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取平台Logo配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPlatformLogoSettings() {
    const config = await this.configService.getPlatformLogoConfig();
    return {
      success: true,
      message: '获取平台Logo配置成功',
      data: config,
    };
  }

  /**
   * 保存平台Logo配置
   */
  @Put('platform/logo')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存平台Logo配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async savePlatformLogoSettings(
    @Body() dto: {
      maxWidth?: number;
      maxHeight?: number;
      maxSize?: number;
      formats?: string[];
      realFolderId?: string | null;
    },
    @CurrentUser() user: UserPayload,
  ) {
    await this.configService.savePlatformLogoConfig(dto, user.sub);
    return {
      success: true,
      message: '平台Logo配置保存成功',
    };
  }

  // ==================== RUSTFS 存储配置 ====================

  /**
   * 获取RUSTFS存储配置
   */
  @Get('storage/rustfs')
  @Permissions('config:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取RUSTFS存储配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRustFSConfig() {
    const config = this.storageService.getConfig();
    return {
      success: true,
      message: '获取RUSTFS配置成功',
      data: {
        endpoint: `${config.useSSL ? 'https' : 'http'}://${config.endpoint}:${config.port}`,
        bucketName: config.bucketName,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
        region: config.region || 'us-east-1',
      },
    };
  }

  /**
   * 保存RUSTFS存储配置
   */
  @Put('storage/rustfs')
  @Permissions('config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存RUSTFS存储配置' })
  @ApiResponse({ status: 200, description: '保存成功' })
  async saveRustFSConfig(
    @Body() dto: {
      endpoint: string;
      bucketName: string;
      accessKey: string;
      secretKey: string;
      region?: string;
    },
    @CurrentUser() user: UserPayload,
  ) {
    // 批量保存到数据库配置
    const configs = [
      { key: 'storage.s3Endpoint', value: dto.endpoint },
      { key: 'storage.s3Bucket', value: dto.bucketName },
      { key: 'storage.s3AccessKey', value: dto.accessKey },
      { key: 'storage.s3SecretKey', value: dto.secretKey },
      { key: 'storage.s3Region', value: dto.region || 'us-east-1' },
    ];

    for (const cfg of configs) {
      await this.configService.setConfigByKey(cfg.key, cfg.value, user.sub);
    }

    // 重新初始化存储服务，使新配置生效
    await this.storageService.reinitialize();

    return {
      success: true,
      message: 'RUSTFS配置保存成功',
    };
  }

  /**
   * 测试RUSTFS连接
   */
  @Post('storage/rustfs/test')
  @Permissions('config:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '测试RUSTFS连接' })
  @ApiResponse({ status: 200, description: '测试完成' })
  async testRustFSConnection() {
    const result = await this.storageService.testConnection();
    return {
      success: result.success,
      message: result.message,
    };
  }
}
