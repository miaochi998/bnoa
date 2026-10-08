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

@ApiTags('用户管理')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

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
    return this.userService.findAll(filter, pageInput);
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getMe(@CurrentUser() user: UserPayload) {
    return this.userService.getMe(user.sub);
  }

  @Get(':id')
  @Permissions('user:view')
  @ApiOperation({ summary: '获取用户详情' })
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()
  @Permissions('user:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建用户' })
  async create(@Body() input: CreateUserInputRest) {
    const user = await this.userService.create(input);
    return {
      success: true,
      message: '用户创建成功',
      data: user,
    };
  }

  @Put(':id')
  @Permissions('user:update')
  @ApiOperation({ summary: '更新用户' })
  async update(@Param('id') id: string, @Body() input: UpdateUserInputRest) {
    const user = await this.userService.update(id, input);
    return {
      success: true,
      message: '用户更新成功',
      data: user,
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
