import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FolderService } from './folder.service';
import { FolderShareService } from './folder-share.service';
import { FolderPermissionService } from './folder-permission.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SuperAdminOnly } from '../../common/decorators/super-admin-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateFolderDto,
  UpdateFolderDto,
  MoveFolderDto,
} from './dto/create-folder.dto';
import {
  ShareFolderDto,
  UpdateSharePermissionDto,
  CreateSystemSharedFolderDto,
} from './dto/folder-share.dto';

/**
 * 文件夹管理控制器
 * 提供文件夹管理的 REST API
 * 
 * 注意：路由顺序很重要！具体路由必须在通配符路由 (:id) 之前
 */
@ApiTags('文件夹管理')
@Controller('folders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FolderController {
  constructor(
    private readonly folderService: FolderService,
    private readonly folderShareService: FolderShareService,
    private readonly folderPermissionService: FolderPermissionService,
  ) {}

  // ==================== 具体路由（必须在 :id 之前）====================

  /**
   * 创建文件夹
   */
  @Post()
  @ApiOperation({ summary: '创建文件夹' })
  async create(
    @Body() dto: CreateFolderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderService.create(dto, userId);
  }

  /**
   * 获取文件夹列表
   */
  @Get()
  @ApiOperation({ summary: '获取文件夹列表' })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  async findAll(
    @Query('parentId') parentId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderService.findAll(parentId, userId);
  }

  /**
   * 获取文件夹树
   */
  @Get('tree/all')
  @ApiOperation({ summary: '获取文件夹树' })
  async getTree(@CurrentUser('userId') userId: string) {
    return this.folderService.getTree(userId);
  }

  /**
   * 获取我的文件夹（包含个人和共享给我的文件夹）
   */
  @Get('my')
  @ApiOperation({ summary: '获取我的文件夹列表' })
  async getMyFolders(@CurrentUser('userId') userId: string) {
    return this.folderService.getMyFolders(userId);
  }

  /**
   * 获取共享给我的文件夹
   */
  @Get('shared-with-me')
  @ApiOperation({ summary: '获取共享给我的文件夹' })
  async getSharedWithMe(@CurrentUser('userId') userId: string) {
    return this.folderShareService.getSharedWithMe(userId);
  }

  /**
   * 获取所有系统共享文件夹（管理员专用）
   */
  @Get('system-shared')
  @ApiOperation({ summary: '获取所有系统共享文件夹' })
  @UseGuards(PermissionGuard)
  @SuperAdminOnly()
  async getSystemSharedFolders() {
    return this.folderShareService.getSystemSharedFolders();
  }

  /**
   * 创建系统共享文件夹（管理员专用）
   */
  @Post('system-shared')
  @ApiOperation({ summary: '创建系统共享文件夹' })
  @UseGuards(PermissionGuard)
  @SuperAdminOnly()
  async createSystemSharedFolder(
    @Body() dto: CreateSystemSharedFolderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderShareService.createSystemSharedFolder(dto, userId);
  }

  // ==================== 通配符路由 (:id) ====================

  /**
   * 获取文件夹详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取文件夹详情' })
  async findById(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderService.findById(id, userId);
  }

  /**
   * 更新文件夹
   */
  @Put(':id')
  @ApiOperation({ summary: '更新文件夹' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderService.update(id, dto, userId);
  }

  /**
   * 移动文件夹
   */
  @Put(':id/move')
  @ApiOperation({ summary: '移动文件夹' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveFolderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderService.move(id, dto, userId);
  }

  /**
   * 清空文件夹（删除文件夹中的所有文件）
   */
  @Post(':id/clear')
  @ApiOperation({ summary: '清空文件夹' })
  async clear(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderService.clearFolder(id, userId);
  }

  /**
   * 删除文件夹
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除文件夹' })
  @ApiQuery({ name: 'deleteFiles', required: false, type: Boolean })
  async delete(
    @Param('id') id: string,
    @Query('deleteFiles', new DefaultValuePipe(false), ParseBoolPipe)
    deleteFiles: boolean,
    @CurrentUser('userId') userId: string,
  ) {
    await this.folderService.delete(id, deleteFiles, userId);
    return { success: true, message: '文件夹已删除' };
  }

  /**
   * 共享文件夹
   */
  @Post(':id/share')
  @ApiOperation({ summary: '共享文件夹给用户或角色' })
  async shareFolder(
    @Param('id') folderId: string,
    @Body() dto: ShareFolderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderShareService.share(folderId, dto, userId);
  }

  /**
   * 获取文件夹的共享记录
   */
  @Get(':id/shares')
  @ApiOperation({ summary: '获取文件夹的共享记录' })
  async getFolderShares(
    @Param('id') folderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderShareService.getShares(folderId, userId);
  }

  /**
   * 获取当前用户对某文件夹的权限
   */
  @Get(':id/permissions')
  @ApiOperation({ summary: '获取当前用户对文件夹的权限' })
  async getMyPermissions(
    @Param('id') folderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const permissions = await this.folderPermissionService.getUserPermissions(
      userId,
      folderId,
    );
    const isOwner = await this.folderPermissionService.isOwner(userId, folderId);
    return { permissions, isOwner };
  }

  /**
   * 更新共享权限
   */
  @Patch(':folderId/shares/:shareId')
  @ApiOperation({ summary: '更新共享权限' })
  async updateShare(
    @Param('folderId') folderId: string,
    @Param('shareId') shareId: string,
    @Body() dto: UpdateSharePermissionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.folderShareService.updateShare(folderId, shareId, dto, userId);
  }

  /**
   * 取消共享
   */
  @Delete(':folderId/shares/:shareId')
  @ApiOperation({ summary: '取消共享' })
  async removeShare(
    @Param('folderId') folderId: string,
    @Param('shareId') shareId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.folderShareService.removeShare(folderId, shareId, userId);
    return { success: true, message: '已取消共享' };
  }
}
