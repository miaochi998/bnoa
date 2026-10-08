import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

/**
 * 仪表盘控制器
 * 提供仪表盘统计数据接口
 */
@ApiTags('仪表盘')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 获取仪表盘统计数据
   */
  @Get('stats')
  @Permissions('dashboard:stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取仪表盘统计',
    description: '获取仪表盘所需的统计数据，包括用户数、角色数、文件数、今日登录数等',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDashboardStats() {
    const stats = await this.dashboardService.getDashboardStats();
    return {
      success: true,
      message: '获取仪表盘统计成功',
      data: stats,
    };
  }

  /**
   * 获取当前用户个人统计
   */
  @Get('my-stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取个人统计',
    description: '获取当前登录用户的文件数、空间、共享等统计',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getMyStats(@CurrentUser() user: UserPayload) {
    const userId = user.sub ?? user.userId ?? '';
    const stats = await this.dashboardService.getMyStats(userId);
    return {
      success: true,
      message: '获取个人统计成功',
      data: stats,
    };
  }

  /**
   * 获取当前用户最近上传的文件
   */
  @Get('recent-files')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取最近文件',
    description: '获取当前登录用户最近上传的5个文件',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRecentFiles(@CurrentUser() user: UserPayload) {
    const userId = user.sub ?? user.userId ?? '';
    const files = await this.dashboardService.getRecentFiles(userId);
    return {
      success: true,
      message: '获取最近文件成功',
      data: files,
    };
  }
}
