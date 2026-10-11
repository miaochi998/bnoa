import {
    Controller,
    Get,
    Post,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TaskService } from './task.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
    FieldKeyMapping,
    FieldPermissionService,
} from '../role/field-permission.service';

/** 任务字段映射：用于「信息权限」读取脱敏（任务本身不可编辑） */
const TASK_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'description', key: 'description' },
    { field: 'cron', key: 'cron' },
    { field: 'enabled', key: 'enabled' },
    { field: 'lastRunAt', key: 'lastRunAt' },
];

@ApiTags('定时任务管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('tasks')
export class TaskController {
    constructor(
        private readonly taskService: TaskService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'task',
            user.roles ?? [],
        );
    }

    /** 递归脱敏 */
    private stripTaskDeep(node: any, state: any): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        TASK_FIELD_MAP,
        state,
      );
    }

    @Get()
    @Permissions('task:list')
    @ApiOperation({ summary: '查询所有定时任务状态' })
    async getSchedulers(@CurrentUser() user: UserPayload) {
        const state = await this.resolveFields(user);
        return {
            code: 200,
            message: 'success',
            data: this.stripTaskDeep(this.taskService.getSchedulers(), state),
        };
    }

    @Get('queues')
    @Permissions('task:list')
    @ApiOperation({ summary: '查询所有队列状态' })
    async getQueues(@CurrentUser() user: UserPayload) {
        const state = await this.resolveFields(user);
        return {
            code: 200,
            message: 'success',
            data: this.stripTaskDeep(await this.taskService.getQueues(), state),
        };
    }

    @Post(':name/trigger')
    @Permissions('task:trigger')
    @ApiOperation({ summary: '手动触发指定定时任务' })
    async triggerScheduler(@Param('name') name: string) {
        await this.taskService.triggerScheduler(name);
        return {
            code: 200,
            message: `任务 ${name} 已触发`,
        };
    }
}
