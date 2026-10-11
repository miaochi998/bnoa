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
  ForbiddenException,
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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SuperAdminOnly } from '../../common/decorators/super-admin-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';

/**
 * 文件夹字段映射：用于「信息权限」的读取脱敏与写入过滤
 * 与文件同属「文件管理」模块（module = file），单独一组字段。
 */
const FOLDER_FIELD_MAP: FieldKeyMapping[] = [
  // 基本信息
  { field: 'folder.name', key: 'name' },
  { field: 'folder.description', key: 'description' },
  { field: 'folder.createdAt', key: 'createdAt' },
  { field: 'folder.isSystem', key: 'isSystem' },
  // 层级与归属
  { field: 'folder.parentId', key: 'parentId' },
  { field: 'folder.parentId', key: 'parent' },
  { field: 'folder.createdBy', key: 'createdBy' },
  // 文件夹详情会带出 creator 对象（{id, username, name}），需要单独映射，
  // 原来的 key:'user' 在本模块响应里并不存在（空转）
  { field: 'folder.createdBy', key: 'creator' },
  // 共享与权限
  { field: 'folder.access', key: 'access' },
  { field: 'folder.shareType', key: 'shareType' },
  { field: 'folder.isSystemShared', key: 'isSystemShared' },
];
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
 *
 * 2026-10-12 补锁：此前类级只挂 JwtAuthGuard、全部路由无 @Permissions，
 * 导致 folder:manage 配置形同虚设（任意登录用户可创建/改名/移动/删除文件夹）。
 * 现读接口用 file:list、写接口用 folder:manage —— 两者都已授予
 * operator / user / super_admin，不会把现有用户锁在门外。
 * service 层原有的「归属/共享」校验继续保留（双层防护）。
 */
@ApiTags('文件夹管理')
@Controller('folders')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class FolderController {
  constructor(
    private readonly folderService: FolderService,
    private readonly folderShareService: FolderShareService,
    private readonly folderPermissionService: FolderPermissionService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块（文件中心）的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'file',
      user.roles ?? [],
    );
  }

  /** 递归脱敏（文件夹对象 / 数组 / 树 都兼容） */
  private stripFolderDeep(node: any, state: any): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      FOLDER_FIELD_MAP,
      state,
    );
  }

  // ==================== 具体路由（必须在 :id 之前）====================

  /**
   * 创建文件夹
   */
  @Post()
  @Permissions('folder:manage')
  @ApiOperation({ summary: '创建文件夹' })
  async create(
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto as any,
      FOLDER_FIELD_MAP,
      state,
    );
    if (!safe.name) {
      throw new ForbiddenException('没有「文件夹名称」的编辑权限');
    }
    return this.folderService.create(
      safe as CreateFolderDto, user.userId ?? user.sub,
    );
  }

  /**
   * 获取文件夹列表
   */
  @Get()
  @Permissions('file:list')
  @ApiOperation({ summary: '获取文件夹列表' })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  async findAll(
    @Query('parentId') parentId: string,
    @CurrentUser() user: UserPayload,
  ) {
    const list = await this.folderService.findAll(
      parentId, user.userId ?? user.sub,
    );
    const state = await this.resolveFields(user);
    return this.stripFolderDeep(list, state);
  }

  /**
   * 获取文件夹树
   */
  @Get('tree/all')
  @Permissions('file:list')
  @ApiOperation({ summary: '获取文件夹树' })
  async getTree(@CurrentUser() user: UserPayload) {
    const tree = await this.folderService.getTree(user.userId ?? user.sub);
    const state = await this.resolveFields(user);
    return this.stripFolderDeep(tree, state);
  }

  /**
   * 获取我的文件夹（包含个人和共享给我的文件夹）
   */
  @Get('my')
  @Permissions('file:list')
  @ApiOperation({ summary: '获取我的文件夹列表' })
  async getMyFolders(@CurrentUser() user: UserPayload) {
    const list = await this.folderService.getMyFolders(
      user.userId ?? user.sub,
    );
    const state = await this.resolveFields(user);
    return this.stripFolderDeep(list, state);
  }

  /**
   * 获取共享给我的文件夹
   */
  @Get('shared-with-me')
  @Permissions('file:list')
  @ApiOperation({ summary: '获取共享给我的文件夹' })
  async getSharedWithMe(@CurrentUser() user: UserPayload) {
    const data = await this.folderShareService.getSharedWithMe(
      user.userId ?? user.sub,
    );
    const state = await this.resolveFields(user);
    // 返回的是文件夹对象（name / description / shareType / createdAt 等），需同样脱敏
    return this.stripFolderDeep(data, state);
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
  @Permissions('file:list')
  @ApiOperation({ summary: '获取文件夹详情' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    const folder = await this.folderService.findById(
      id, user.userId ?? user.sub,
    );
    const state = await this.resolveFields(user);
    return this.stripFolderDeep(folder, state);
  }

  /**
   * 更新文件夹
   */
  @Put(':id')
  @Permissions('folder:manage')
  @ApiOperation({ summary: '更新文件夹' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto as any,
      FOLDER_FIELD_MAP,
      state,
    );
    if (Object.keys(safe).length === 0) {
      throw new ForbiddenException('没有文件夹字段的编辑权限');
    }
    return this.folderService.update(
      id, safe as UpdateFolderDto, user.userId ?? user.sub,
    );
  }

  /**
   * 移动文件夹
   */
  @Put(':id/move')
  @Permissions('folder:manage')
  @ApiOperation({ summary: '移动文件夹' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveFolderDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto as any,
      FOLDER_FIELD_MAP,
      state,
    );
    return this.folderService.move(
      id, safe as MoveFolderDto, user.userId ?? user.sub,
    );
  }

  /**
   * 清空文件夹（删除文件夹中的所有文件）
   */
  @Post(':id/clear')
  @Permissions('folder:manage')
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
  @Permissions('folder:manage')
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
  @Permissions('folder:manage')
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
  @Permissions('file:list')
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
  @Permissions('file:list')
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
  @Permissions('folder:manage')
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
  @Permissions('folder:manage')
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
