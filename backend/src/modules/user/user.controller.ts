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
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserInputRest } from './dto/create-user.dto';
import { UpdateUserInputRest } from './dto/update-user.dto';
import {
  UserFilterInputRest,
  PageInputRest,
  UserStatus,
} from './dto/user-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';

/**
 * 用户字段映射：用于「信息权限」的读取脱敏与写入过滤
 * 说明：`GET /users/me`（个人中心）**不做字段脱敏**——那是用户查看/修改自己的资料，
 *      否则会出现"管理员一配，用户连自己的邮箱手机都看不到"的体验问题。
 */
const USER_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'username', key: 'username' },
  { field: 'email', key: 'email' },
  { field: 'name', key: 'name' },
  { field: 'phone', key: 'phone' },
  { field: 'avatar', key: 'avatar' },
  { field: 'status', key: 'status' },
  { field: 'lastLoginAt', key: 'lastLoginAt' },
  { field: 'roles', key: 'roles' },
];

@ApiTags('用户管理')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'user',
      user.roles ?? [],
    );
  }

  @Get()
  @Permissions('user:list')
  @ApiOperation({ summary: '获取用户列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'roleId', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: UserStatus,
    @Query('roleId') roleId?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'lastLoginAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @CurrentUser() user?: UserPayload,
  ) {
    const filter: UserFilterInputRest = {
      keyword,
      status,
      roleId,
      sortBy,
      sortOrder,
    };
    const pageInput: PageInputRest = {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
    };
    const result = await this.userService.findAll(filter, pageInput);
    const state = await this.resolveFields(user as UserPayload);
    return {
      ...result,
      nodes: this.fieldPermissionService.stripHiddenFieldsForList(
        (result.nodes || []) as any[],
        USER_FIELD_MAP,
        state,
      ),
    };
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getMe(@CurrentUser() user: UserPayload) {
    return this.userService.getMe(user.sub);
  }

  @Get(':id')
  @Permissions('user:view')
  @ApiOperation({ summary: '获取用户详情' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    const detail = await this.userService.findById(id);
    const state = await this.resolveFields(user);
    return this.fieldPermissionService.stripHiddenFields(
      detail as any,
      USER_FIELD_MAP,
      state,
    );
  }

  @Post()
  @Permissions('user:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建用户' })
  async create(
    @Body() input: CreateUserInputRest,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      input as any,
      USER_FIELD_MAP,
      state,
    );
    if (!safe.username || !safe.email) {
      throw new ForbiddenException('创建用户所需的必填字段没有编辑权限');
    }
    const created = await this.userService.create(safe as CreateUserInputRest);
    return {
      success: true,
      message: '用户创建成功',
      data: created,
    };
  }

  @Put(':id')
  @Permissions('user:update')
  @ApiOperation({ summary: '更新用户' })
  async update(
    @Param('id') id: string,
    @Body() input: UpdateUserInputRest,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      input as any,
      USER_FIELD_MAP,
      state,
    );
    if (Object.keys(safe).length === 0) {
      throw new ForbiddenException('没有用户字段的编辑权限');
    }
    const updated = await this.userService.update(
      id,
      safe as UpdateUserInputRest,
      user.sub,
    );
    return {
      success: true,
      message: '用户更新成功',
      // 写响应同样脱敏（否则隐藏的 email/phone 可经更新接口读回）
      data: this.fieldPermissionService.stripHiddenFields(
        updated as any,
        USER_FIELD_MAP,
        state,
      ),
    };
  }

  @Delete(':id')
  @Permissions('user:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除用户' })
  async delete(@Param('id') id: string) {
    await this.userService.delete(id);
    return {
      success: true,
      message: '用户删除成功',
    };
  }

  @Post(':id/toggle-status')
  @Permissions('user:suspend')
  @ApiOperation({ summary: '切换用户状态' })
  async toggleStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'SUSPENDED',
  ) {
    const user = await this.userService.update(id, { status });
    return {
      success: true,
      message: status === 'ACTIVE' ? '用户已启用' : '用户已禁用',
      data: user,
    };
  }

  @Post('batch/suspend')
  @Permissions('user:batch-suspend')
  @ApiOperation({ summary: '批量禁用用户' })
  async batchSuspend(@Body('ids') ids: string[]) {
    for (const id of ids) {
      await this.userService.update(id, { status: 'SUSPENDED' });
    }
    return {
      success: true,
      message: `已禁用 ${ids.length} 个用户`,
    };
  }

  @Post('batch/delete')
  @Permissions('user:batch-delete')
  @ApiOperation({ summary: '批量删除用户' })
  async batchDelete(@Body('ids') ids: string[]) {
    for (const id of ids) {
      await this.userService.delete(id);
    }
    return {
      success: true,
      message: `已删除 ${ids.length} 个用户`,
    };
  }
}
