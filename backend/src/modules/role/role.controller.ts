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
import { RoleService } from './role.service';
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
  constructor(private readonly roleService: RoleService) {}

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
    return {
      success: true,
      message: '角色创建成功',
      data: role,
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
    const role = await this.roleService.updateRole(id, dto, user.sub);
    return {
      success: true,
      message: '角色更新成功',
      data: role,
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
  async getRoleById(@Param('id') id: string) {
    const role = await this.roleService.getRoleById(id);
    return {
      success: true,
      message: '获取角色详情成功',
      data: role,
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
  async findRoles(@Query() query: QueryRoleDto) {
    const result = await this.roleService.findRoles(query);
    return {
      success: true,
      message: '查询角色列表成功',
      data: result.items,
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
  async findAllRoles() {
    const roles = await this.roleService.findAllRoles();
    return {
      success: true,
      message: '获取所有角色成功',
      data: roles,
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
  async getUserRoles(@Param('userId') userId: string) {
    const roles = await this.roleService.getUserRoles(userId);
    return {
      success: true,
      message: '获取用户角色成功',
      data: roles,
    };
  }
}
