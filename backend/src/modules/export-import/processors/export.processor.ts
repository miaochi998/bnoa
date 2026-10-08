import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExportService } from '../services/export.service';
import { ExportTaskService } from '../services/export-task.service';
import {
    NotificationHelperService,
} from '../../notification/services/notification-helper.service';
import {
    ExportJobData,
} from '../interfaces/export-import.interfaces';

@Processor('export', { concurrency: 2 })
export class ExportProcessor extends WorkerHost {
    private readonly logger =
        new Logger(ExportProcessor.name);

    constructor(
        private readonly exportService: ExportService,
        private readonly taskService: ExportTaskService,
        private readonly notificationHelper:
            NotificationHelperService,
    ) {
        super();
    }

    async process(job: Job<ExportJobData>) {
        const { taskId, module, format, params, userId } =
            job.data;

        this.logger.log(
            `开始异步导出: ${taskId} [${module}]`,
        );

        try {
            const adapter =
                this.exportService.getAdapter(module);
            await this.exportService.executeExport(
                taskId, adapter, format, params,
            );

            // 发送通知
            await this.notificationHelper
                .createNotification({
                    userId,
                    type: 'system',
                    title: '导出完成',
                    content:
                        `您的${adapter.displayName}导出已完成，点击查看下载。`,
                    priority: 'NORMAL',
                    actionUrl:
                        `/settings/export-import?taskId=${taskId}`,
                });

            this.logger.log(
                `异步导出完成: ${taskId}`,
            );
        } catch (err) {
            this.logger.error(
                `异步导出失败: ${taskId}`,
                (err as Error).stack,
            );
            await this.taskService.updateTask(
                taskId, {
                    status: 'failed',
                    errorMessage:
                        (err as Error).message,
                },
            );

            // 通知用户失败
            await this.notificationHelper
                .createNotification({
                    userId,
                    type: 'system',
                    title: '导出失败',
                    content:
                        `导出任务失败：${(err as Error).message}`,
                    priority: 'HIGH',
                });

            throw err;
        }
    }
}
