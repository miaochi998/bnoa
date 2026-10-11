import {
    Controller, Get, Post, Patch, Delete, Put,
    Body, Param, Query, UseGuards,
    HttpCode, HttpStatus, ForbiddenException,
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
import {
    FieldKeyMapping,
    FieldPermissionService,
    FieldPermissionState,
} from '../role/field-permission.service';

/**
 * 通知字段映射：用于「信息权限」的读取脱敏与写入过滤
 * 范围：只作用于**通知管理端**（广播列表/详情、全员通知记录）。
 *      用户自己的通知（/notifications）属于个人数据，按既有原则不做字段脱敏。
 * 说明：广播与通知记录都有 title/content，统一按同一字段控制（避免同名 key 冲突）。
 */
const NOTIFICATION_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'broadcastNo', key: 'broadcastNo' },
    { field: 'title', key: 'title' },
    { field: 'content', key: 'content' },
    { field: 'targetType', key: 'targetType' },
    { field: 'status', key: 'status' },
    { field: 'targetCount', key: 'targetCount' },
    { field: 'sentCount', key: 'sentCount' },
    { field: 'readCount', key: 'readCount' },
    { field: 'userId', key: 'userId' },
];

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
        private readonly fieldPermissionService:
            FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'notification',
            user.roles ?? [],
        );
    }

    /** 递归脱敏（对象/数组/分页对象都兼容） */
    private stripDeep(node: any, state: FieldPermissionState): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        NOTIFICATION_FIELD_MAP,
        state,
      );
    }

    // ========== 广播管理 ==========

    @Get('broadcasts')
    @Permissions('notification:broadcast-list')
    @ApiOperation({ summary: '获取广播列表' })
    async getBroadcasts(
        @Query() query: QueryBroadcastDto,
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.broadcastService.getBroadcasts(
            query,
        );
        const state = await this.resolveFields(user);
        return this.stripDeep(data, state);
    }

    @Get('broadcasts/:id')
    @Permissions('notification:broadcast-list')
    @ApiOperation({ summary: '获取广播详情' })
    async getBroadcastDetail(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.broadcastService.getBroadcastById(
            id,
        );
        const state = await this.resolveFields(user);
        return this.stripDeep(data, state);
    }

    @Post('broadcasts')
    @Permissions('notification:broadcast-send')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '发送广播' })
    async createBroadcast(
        @CurrentUser() user: UserPayload,
        @Body() dto: CreateBroadcastDto,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            NOTIFICATION_FIELD_MAP,
            state,
        );
        if (!safe.title) {
            throw new ForbiddenException('没有「通知标题」的编辑权限');
        }
        return this.broadcastService.createBroadcast(
            safe as CreateBroadcastDto, user.sub,
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
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.service.getAdminNotifications(
            query,
        );
        const state = await this.resolveFields(user);
        return this.stripDeep(data, state);
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
