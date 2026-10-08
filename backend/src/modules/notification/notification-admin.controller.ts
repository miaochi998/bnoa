import {
    Controller, Get, Post, Patch, Delete, Put,
    Body, Param, Query, UseGuards,
    HttpCode, HttpStatus,
} from '@nestjs/common';
import {
    ApiTags, ApiOperation, ApiBearerAuth,
} from '@nestjs/swagger';
import {
    JwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import {
    PermissionGuard,
} from '../../common/guards/permission.guard';
import {
    Permissions,
} from '../../common/decorators/permissions.decorator';
import {
    CurrentUser, UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
    NotificationService,
} from './services/notification.service';
import {
    BroadcastService,
} from './services/broadcast.service';
import {
    QueryBroadcastDto,
    QueryAdminNotificationDto,
} from './dto/query-notification.dto';
import { CreateBroadcastDto } from './dto/broadcast.dto';
import {
    MaintenanceDto, UpdateConfigDto,
} from './dto/batch-operation.dto';

@ApiTags('通知管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('admin/notifications')
export class NotificationAdminController {
    constructor(
        private readonly service:
            NotificationService,
        private readonly broadcastService:
            BroadcastService,
    ) {}

    // ========== 广播管理 ==========

    @Get('broadcasts')
    @Permissions('notification:broadcast-list')
    @ApiOperation({ summary: '获取广播列表' })
    async getBroadcasts(
        @Query() query: QueryBroadcastDto,
    ) {
        return this.broadcastService.getBroadcasts(
            query,
        );
    }

    @Get('broadcasts/:id')
    @Permissions('notification:broadcast-list')
    @ApiOperation({ summary: '获取广播详情' })
    async getBroadcastDetail(
        @Param('id') id: string,
    ) {
        return this.broadcastService.getBroadcastById(
            id,
        );
    }

    @Post('broadcasts')
    @Permissions('notification:broadcast-send')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '发送广播' })
    async createBroadcast(
        @CurrentUser() user: UserPayload,
        @Body() dto: CreateBroadcastDto,
    ) {
        return this.broadcastService.createBroadcast(
            dto, user.sub,
        );
    }

    @Patch('broadcasts/:id/cancel')
    @Permissions('notification:broadcast-cancel')
    @ApiOperation({ summary: '取消广播' })
    async cancelBroadcast(
        @Param('id') id: string,
    ) {
        return this.broadcastService.cancelBroadcast(
            id,
        );
    }

    @Delete('broadcasts/:id')
    @Permissions('notification:broadcast-delete')
    @ApiOperation({ summary: '删除广播' })
    async deleteBroadcast(
        @Param('id') id: string,
    ) {
        return this.broadcastService.deleteBroadcast(
            id,
        );
    }

    // ========== 通知记录 ==========

    @Get('records')
    @Permissions('notification:record-list')
    @ApiOperation({ summary: '获取通知记录' })
    async getRecords(
        @Query() query: QueryAdminNotificationDto,
    ) {
        return this.service.getAdminNotifications(
            query,
        );
    }

    // ========== 系统维护 ==========

    @Post('maintenance')
    @Permissions('notification:maintenance')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '通知系统维护' })
    async maintenance(
        @Body() dto: MaintenanceDto,
    ) {
        return this.service.performMaintenance(
            dto.operation, dto.params,
        );
    }

    // ========== 全局配置 ==========

    @Get('config')
    @Permissions('notification:config')
    @ApiOperation({ summary: '获取通知全局配置' })
    async getConfig() {
        return this.service.getGlobalConfig();
    }

    @Put('config')
    @Permissions('notification:config-update')
    @ApiOperation({ summary: '更新通知全局配置' })
    async updateConfig(
        @Body() dto: UpdateConfigDto,
    ) {
        await this.service.updateGlobalConfig(dto);
        return { message: '配置更新成功' };
    }
}
