import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import { FieldPermissionService } from './field-permission.service';

/**
 * 字段级权限（面向当前登录用户）
 *
 * 任何登录用户都可以读取「自己」在某模块的字段权限，
 * 前端据此渲染：哪些字段隐藏、哪些只读、哪些可编辑。
 */
@ApiTags('field-permissions')
@Controller('field-permissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FieldPermissionController {
  constructor(
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: '获取当前用户在某模块的字段权限',
    description:
      '返回 canView / canEdit 两个字段标识列表，供前端渲染列表列、详情、表单',
  })
  async getMyFieldPermissions(
    @Query('module') module: string,
    @CurrentUser() user: UserPayload,
  ) {
    if (!module) {
      throw new BadRequestException('缺少 module 参数');
    }
    const state = await this.fieldPermissionService.resolve(
      user.sub,
      module,
      user.roles ?? [],
    );
    const dataScope = await this.fieldPermissionService.resolveDataScope(
      user.sub,
      module,
      user.roles ?? [],
    );
    return {
      success: true,
      message: '获取字段权限成功',
      data: {
        module,
        isSuperAdmin: state.isSuperAdmin,
        canView: Array.from(state.canView),
        canEdit: Array.from(state.canEdit),
        dataScope,
      },
    };
  }
}
