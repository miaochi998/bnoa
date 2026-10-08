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

@ApiTags('定时任务管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('tasks')
export class TaskController {
    constructor(private readonly taskService: TaskService) {}

    @Get()
    @Permissions('task:list')
    @ApiOperation({ summary: '查询所有定时任务状态' })
    async getSchedulers() {
        return {
            code: 200,
            message: 'success',
            data: this.taskService.getSchedulers(),
        };
    }

    @Get('queues')
    @Permissions('task:list')
    @ApiOperation({ summary: '查询所有队列状态' })
    async getQueues() {
        return {
            code: 200,
            message: 'success',
            data: await this.taskService.getQueues(),
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
