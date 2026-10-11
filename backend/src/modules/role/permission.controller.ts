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
import { SuperAdminOnly } from '../../common/decorators/super-admin-only.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import { RoleService } from './role.service';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from './field-permission.service';

/** 权限点字段映射：用于「信息权限」读取脱敏 */
const PERMISSION_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'name', key: 'name' },
  { field: 'code', key: 'code' },
  { field: 'type', key: 'type' },
  { field: 'description', key: 'description' },
];
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  QueryPermissionDto,
} from './dto/permission.dto';

/**
 * 权限管理控制器
 * 提供权限 CRUD 和权限树接口
 */
@ApiTags('permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PermissionController {
  constructor(
    private readonly roleService: RoleService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'permission',
      user.roles ?? [],
    );
  }

  /** 递归脱敏 */
  private stripPermissionDeep(node: any, state: any): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      PERMISSION_FIELD_MAP,
      state,
    );
  }

  /**
   * 同步权限定义到数据库（仅超级管理员）
   * 用于生产环境升级后补齐缺失的权限，使权限总数与定义一致
   */
  @Post('sync')
  @SuperAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '同步权限', description: '将预定义权限同步到数据库，补齐缺失项' })
  @ApiResponse({ status: 200, description: '同步成功' })
  async syncPermissions() {
    const result = await this.roleService.syncPermissions();
    return {
      success: true,
      message: `权限同步完成，当前共 ${result.total} 条`,
      data: result,
    };
  }

  /**
   * 立即刷新权限缓存（仅超级管理员）
   * 正常情况下「保存角色权限」会自动清缓存，此接口用于兜底排查
   */
  @Post('refresh-cache')
  @SuperAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '立即刷新权限缓存',
    description: '清空服务端权限缓存，使权限变更立即对所有用户生效',
  })
  async refreshPermissionCache() {
    const before = PermissionGuard.cacheSize();
    PermissionGuard.clearAllCacheNow();
    return {
      success: true,
      message: `权限缓存已刷新（清理 ${before} 条）`,
      data: { cleared: before, remaining: PermissionGuard.cacheSize() },
    };
  }

  /**
   * 创建权限
   */
  @Post()
  @Permissions('permission:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建权限', description: '创建新权限' })
  @ApiResponse({ status: 201, description: '权限创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 409, description: '权限编码已存在' })
  async createPermission(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() user: UserPayload,
  ) {
    const permission = await this.roleService.createPermission(dto, user.sub);
    return {
      success: true,
      message: '权限创建成功',
      data: permission,
    };
  }

  /**
   * 更新权限
   */
  @Put(':id')
  @Permissions('permission:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新权限', description: '更新权限信息' })
  @ApiResponse({ status: 200, description: '权限更新成功' })
  @ApiResponse({ status: 404, description: '权限不存在' })
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() user: UserPayload,
  ) {
    const permission = await this.roleService.updatePermission(
      id,
      dto,
      user.sub,
    );
    return {
      success: true,
      message: '权限更新成功',
      data: permission,
    };
  }

  /**
   * 删除权限
   */
  @Delete(':id')
  @Permissions('permission:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除权限', description: '删除指定权限' })
  @ApiResponse({ status: 200, description: '权限删除成功' })
  @ApiResponse({ status: 404, description: '权限不存在' })
  @ApiResponse({ status: 400, description: '权限下有子权限或已分配给角色' })
  async deletePermission(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.roleService.deletePermission(id, user.sub);
    return {
      success: true,
      message: '权限删除成功',
    };
  }

  /**
   * 获取权限详情
   */
  @Get(':id')
  @Permissions('permission:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取权限详情',
    description: '获取指定权限的详细信息',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '权限不存在' })
  async getPermissionById(@Param('id') id: string) {
    const permission = await this.roleService.getPermissionById(id);
    return {
      success: true,
      message: '获取权限详情成功',
      data: permission,
    };
  }

  /**
   * 查询权限列表
   */
  @Get()
  @Permissions('permission:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询权限列表', description: '查询权限列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findPermissions(
    @Query() query: QueryPermissionDto,
    @CurrentUser() user: UserPayload,
  ) {
    const permissions = await this.roleService.findPermissions(query);
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '查询权限列表成功',
      data: this.stripPermissionDeep(permissions, state),
    };
  }

  /**
   * 获取权限树
   */
  @Get('tree/all')
  @Permissions('permission:tree')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取权限树', description: '获取权限树形结构' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPermissionTree() {
    const tree = await this.roleService.getPermissionTree();
    return {
      success: true,
      message: '获取权限树成功',
      data: tree,
    };
  }
}
