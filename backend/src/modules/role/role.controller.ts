import {
  BadRequestException,
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
import { RoleService } from './role.service';
import {
  DataScope,
  FieldKeyMapping,
  FieldPermissionService,
  RoleFieldConfigItem,
} from './field-permission.service';

/** 角色字段映射：用于「信息权限」的读取脱敏与写入过滤 */
const ROLE_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'name', key: 'name' },
  { field: 'code', key: 'code' },
  { field: 'description', key: 'description' },
  // RoleInfo（role.service.toRoleInfo）返回的是 status（由 role.isActive 派生），
  // 不是 isActive —— 键名不符会让「角色状态」的字段权限配置完全不生效。
  { field: 'status', key: 'status' },
  { field: 'permissionCount', key: 'permissionCount' },
  { field: 'userCount', key: 'userCount' },
  { field: 'isSystem', key: 'isSystem' },
  { field: 'createdAt', key: 'createdAt' },
];
import {
  CreateRoleDto,
  UpdateRoleDto,
  QueryRoleDto,
  AssignPermissionsDto,
  AssignRolesDto,
} from './dto/role.dto';

/**
 * 角色管理控制器
 * 提供角色 CRUD 和权限分配接口
 */
@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'role',
      user.roles ?? [],
    );
  }

  /** 递归脱敏（角色对象 / 数组 / 分页对象都兼容） */
  private stripRoleDeep(node: any, state: any): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      ROLE_FIELD_MAP,
      state,
    );
  }

  /**
   * 创建角色
   */
  @Post()
  @Permissions('role:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建角色', description: '创建新角色并分配权限' })
  @ApiResponse({ status: 201, description: '角色创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 409, description: '角色编码已存在' })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: UserPayload,
  ) {
    const role = await this.roleService.createRole(dto, user.sub);
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '角色创建成功',
      // 写响应与读接口一致地脱敏，避免回显隐藏字段
      data: this.stripRoleDeep(role, state),
    };
  }

  /**
   * 更新角色
   */
  @Put(':id')
  @Permissions('role:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新角色', description: '更新角色信息和权限' })
  @ApiResponse({ status: 200, description: '角色更新成功' })
  @ApiResponse({ status: 404, description: '角色不存在' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    // 写过滤：被配成「只读」的字段即使请求里传了也不生效。
    // ⚠️ permissionIds（功能权限）不属于字段权限管辖范围 —— 它不在
    // ROLE_FIELD_MAP 中，因此会原样透传，不会被过滤掉。
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto,
      ROLE_FIELD_MAP,
      state,
    );
    // ⚠️ role.service.updateRole 的落库写法是 `isActive: dto.status === ACTIVE`：
    // status 被字段权限剔除（或调用方本就没传）时会被当成 INACTIVE 直接把角色停用。
    // 这里回填库内当前状态，保证「只读只代表不生效」，而不是被静默停用。
    if (safe.status === undefined) {
      const current = await this.roleService.getRoleById(id);
      safe.status = current.status;
    }
    const role = await this.roleService.updateRole(id, safe, user.sub);
    return {
      success: true,
      message: '角色更新成功',
      // 写响应与读接口一致地脱敏，避免回显隐藏字段
      data: this.stripRoleDeep(role, state),
    };
  }

  /**
   * 删除角色
   */
  @Delete(':id')
  @Permissions('role:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除角色', description: '删除指定角色' })
  @ApiResponse({ status: 200, description: '角色删除成功' })
  @ApiResponse({ status: 404, description: '角色不存在' })
  @ApiResponse({ status: 400, description: '角色下有关联用户' })
  async deleteRole(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    await this.roleService.deleteRole(id, user.sub);
    return {
      success: true,
      message: '角色删除成功',
    };
  }

  /**
   * 获取角色详情
   */
  @Get(':id')
  @Permissions('role:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取角色详情',
    description: '获取指定角色的详细信息',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '角色不存在' })
  async getRoleById(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    const role = await this.roleService.getRoleById(id);
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '获取角色详情成功',
      data: this.stripRoleDeep(role, state),
    };
  }

  /**
   * 查询角色列表
   */
  @Get()
  @Permissions('role:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询角色列表', description: '分页查询角色列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findRoles(
    @Query() query: QueryRoleDto,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.roleService.findRoles(query);
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '查询角色列表成功',
      data: this.stripRoleDeep(result.items, state),
      meta: result.meta,
    };
  }

  /**
   * 获取所有角色
   */
  @Get('all/list')
  @Permissions('role:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取所有角色', description: '获取所有启用的角色' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findAllRoles(@CurrentUser() user: UserPayload) {
    const roles = await this.roleService.findAllRoles();
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '获取所有角色成功',
      data: this.stripRoleDeep(roles, state),
    };
  }

  /**
   * 分配权限给角色
   */
  @Post(':id/permissions')
  @Permissions('role:assign-permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '分配权限', description: '为角色分配权限' })
  @ApiResponse({ status: 200, description: '分配成功' })
  @ApiResponse({ status: 404, description: '角色不存在' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() user: UserPayload,
  ) {
    await this.roleService.assignPermissions(id, dto, user.sub);
    return {
      success: true,
      message: '权限分配成功',
    };
  }

  /**
   * 获取角色的权限列表
   */
  @Get(':id/permissions')
  @Permissions('role:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取角色权限',
    description: '获取指定角色的权限列表',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRolePermissions(@Param('id') id: string) {
    const permissions = await this.roleService.getRolePermissions(id);
    return {
      success: true,
      message: '获取角色权限成功',
      data: permissions,
    };
  }

  /**
   * 分配角色给用户
   */
  @Post('assign-to-user/:userId')
  @Permissions('role:assign-permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '分配角色给用户', description: '为用户分配角色' })
  @ApiResponse({ status: 200, description: '分配成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async assignRolesToUser(
    @Param('userId') userId: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() user: UserPayload,
  ) {
    await this.roleService.assignRolesToUser(userId, dto, user.sub);
    return {
      success: true,
      message: '角色分配成功',
    };
  }

  /**
   * 获取用户的角色列表
   */
  @Get('user/:userId/roles')
  @Permissions('role:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取用户角色',
    description: '获取指定用户的角色列表',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUserRoles(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
  ) {
    const roles = await this.roleService.getUserRoles(userId);
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '获取用户角色成功',
      data: this.stripRoleDeep(roles, state),
    };
  }

  /**
   * 数据范围：读取该角色各模块的「能看到哪些数据」配置
   */
  @Get(':id/data-scopes')
  @Permissions('role:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取角色数据范围',
    description: '返回支持数据范围的模块及该角色的当前取值',
  })
  async getRoleDataScopes(@Param('id') id: string) {
    const data = await this.fieldPermissionService.getRoleDataScopes(id);
    return { success: true, message: '获取角色数据范围成功', data };
  }

  /**
   * 数据范围：保存某模块的「能看到哪些数据」
   */
  @Put(':id/data-scopes')
  @Permissions('role:assign-permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存角色数据范围' })
  async saveRoleDataScope(
    @Param('id') id: string,
    @Body() body: { module: string; dataScope: DataScope },
  ) {
    if (!body?.module) throw new BadRequestException('缺少 module 参数');
    await this.fieldPermissionService.saveRoleDataScope(
      id,
      body.module,
      body.dataScope,
    );
    return { success: true, message: '保存数据范围成功' };
  }

  // ==================== 字段级权限 ====================

  /**
   * 字段权限：已登记的模块与字段清单（供配置界面渲染）
   */
  @Get('field-permissions/registry')
  @Permissions('role:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取字段权限注册表',
    description: '返回已登记字段权限的模块、信息组与字段清单',
  })
  async getFieldPermissionRegistry() {
    return {
      success: true,
      message: '获取字段注册表成功',
      data: this.fieldPermissionService.getModulesWithFields(),
    };
  }

  /**
   * 字段权限：读取某角色在某模块的配置（含默认值回显）
   */
  @Get(':id/field-permissions')
  @Permissions('role:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取角色字段权限',
    description: '读取指定角色在指定模块的字段级权限配置',
  })
  async getRoleFieldPermissions(
    @Param('id') id: string,
    @Query('module') module: string,
  ) {
    if (!module) throw new BadRequestException('缺少 module 参数');
    const data = await this.fieldPermissionService.getRoleFieldConfig(
      id,
      module,
    );
    return {
      success: true,
      message: '获取角色字段权限成功',
      data,
    };
  }

  /**
   * 字段权限：保存某角色在某模块的配置（整模块覆盖）
   */
  @Put(':id/field-permissions')
  @Permissions('role:assign-permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '保存角色字段权限',
    description:
      '整模块覆盖保存；自动保证「能改必能看、不能看必不能改」',
  })
  async saveRoleFieldPermissions(
    @Param('id') id: string,
    @Body()
    body: {
      module: string;
      items: RoleFieldConfigItem[];
      dataScope?: DataScope;
    },
    @CurrentUser() user: UserPayload,
  ) {
    if (!body?.module) throw new BadRequestException('缺少 module 参数');
    const result = await this.fieldPermissionService.saveRoleFieldConfig(
      id,
      body.module,
      body.items ?? [],
      user.sub,
    );
    // 数据范围（能看到「哪些条」数据）与字段权限一并保存
    if (body.dataScope) {
      await this.fieldPermissionService.saveRoleDataScope(
        id,
        body.module,
        body.dataScope,
      );
    }
    return {
      success: true,
      message: '保存角色字段权限成功',
      data: result,
    };
  }
}
