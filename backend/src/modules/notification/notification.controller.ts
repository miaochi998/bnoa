import {
    Controller, Get, Patch, Delete, Put,
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
    CurrentUser, UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
    NotificationService,
} from './services/notification.service';
import {
    QueryNotificationDto,
} from './dto/query-notification.dto';
import {
    BatchIdsDto, MarkAllReadDto,
    UpdateSettingsDto,
} from './dto/batch-operation.dto';

@ApiTags('通知')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
    constructor(
        private readonly service:
            NotificationService,
    ) {}

    @Get()
    @ApiOperation({ summary: '获取通知列表' })
    async getNotifications(
        @CurrentUser() user: UserPayload,
        @Query() query: QueryNotificationDto,
    ) {
        return this.service.getUserNotifications(
            user.sub, query,
        );
    }

    @Get('unread-count')
    @ApiOperation({ summary: '获取未读数量' })
    async getUnreadCount(
        @CurrentUser() user: UserPayload,
    ) {
        const count =
            await this.service.getUnreadCount(user.sub);
        return { count };
    }

    @Get('stats')
    @ApiOperation({ summary: '获取通知统计' })
    async getStats(
        @CurrentUser() user: UserPayload,
    ) {
        return this.service.getNotificationStats(
            user.sub,
        );
    }

    @Get('settings')
    @ApiOperation({ summary: '获取通知偏好设置' })
    async getSettings(
        @CurrentUser() user: UserPayload,
    ) {
        const settings =
            await this.service.getUserSettings(
                user.sub,
            );
        return { settings };
    }

    @Put('settings')
    @ApiOperation({ summary: '更新通知偏好设置' })
    async updateSettings(
        @CurrentUser() user: UserPayload,
        @Body() dto: UpdateSettingsDto,
    ) {
        return this.service.updateUserSettings(
            user.sub, dto.settings,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: '获取通知详情' })
    async getNotification(
        @CurrentUser() user: UserPayload,
        @Param('id') id: string,
    ) {
        return this.service.getNotificationById(
            id, user.sub,
        );
    }

    @Patch(':id/read')
    @ApiOperation({ summary: '标记单条已读' })
    async markAsRead(
        @CurrentUser() user: UserPayload,
        @Param('id') id: string,
    ) {
        return this.service.markAsRead(
            id, user.sub,
        );
    }

    @Patch('batch-read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量标记已读' })
    async batchMarkAsRead(
        @CurrentUser() user: UserPayload,
        @Body() dto: BatchIdsDto,
    ) {
        return this.service.batchMarkAsRead(
            dto.ids, user.sub,
        );
    }

    @Patch('read-all')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '全部标记已读' })
    async markAllAsRead(
        @CurrentUser() user: UserPayload,
        @Body() dto: MarkAllReadDto,
    ) {
        return this.service.markAllAsRead(
            user.sub,
            dto.type ? { type: dto.type } : undefined,
        );
    }

    @Delete('batch')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量删除通知' })
    async batchDelete(
        @CurrentUser() user: UserPayload,
        @Body() dto: BatchIdsDto,
    ) {
        return this.service.batchDelete(
            dto.ids, user.sub,
        );
    }

    @Delete(':id')
    @ApiOperation({ summary: '删除通知' })
    async deleteNotification(
        @CurrentUser() user: UserPayload,
        @Param('id') id: string,
    ) {
        return this.service.deleteNotification(
            id, user.sub,
        );
    }
}
