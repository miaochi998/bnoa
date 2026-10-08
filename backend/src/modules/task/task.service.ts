import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
    SchedulerInfo,
    QueueInfo,
} from './interfaces/task.interfaces';

/**
 * 任务管理服务
 * 提供定时任务和队列的状态查询、手动触发能力
 */
@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);

    /** 已注册的 Scheduler 元信息 */
    private readonly schedulerMeta = new Map<string, {
        enabled: boolean;
        cron: string;
        description: string;
        handler: () => Promise<void>;
        lastRunAt?: Date;
    }>();

    constructor(
        private readonly schedulerRegistry: SchedulerRegistry,
        @InjectQueue('virus-scan')
        private readonly virusScanQueue: Queue,
        @InjectQueue('file-cleanup')
        private readonly fileCleanupQueue: Queue,
        @InjectQueue('audit-log')
        private readonly auditLogQueue: Queue,
    ) {}

    /**
     * 注册 Scheduler 元信息（供各 Scheduler 调用）
     */
    registerScheduler(
        name: string,
        meta: {
            enabled: boolean;
            cron: string;
            description: string;
            handler: () => Promise<void>;
        },
    ): void {
        this.schedulerMeta.set(name, { ...meta });
    }

    /**
     * 记录任务最后执行时间
     */
    recordLastRun(name: string): void {
        const meta = this.schedulerMeta.get(name);
        if (meta) {
            meta.lastRunAt = new Date();
        }
    }

    /**
     * 查询所有定时任务状态
     */
    getSchedulers(): SchedulerInfo[] {
        const result: SchedulerInfo[] = [];
        for (const [name, meta] of this.schedulerMeta) {
            result.push({
                name,
                enabled: meta.enabled,
                cron: meta.cron,
                description: meta.description,
                lastRunAt: meta.lastRunAt,
            });
        }
        return result;
    }

    /**
     * 查询所有队列状态
     */
    async getQueues(): Promise<QueueInfo[]> {
        const queues = [
            { name: 'virus-scan', queue: this.virusScanQueue },
            { name: 'file-cleanup', queue: this.fileCleanupQueue },
            { name: 'audit-log', queue: this.auditLogQueue },
        ];

        const result: QueueInfo[] = [];
        for (const { name, queue } of queues) {
            try {
                const [waiting, active, completed, failed, delayed] =
                    await Promise.all([
                        queue.getWaitingCount(),
                        queue.getActiveCount(),
                        queue.getCompletedCount(),
                        queue.getFailedCount(),
                        queue.getDelayedCount(),
                    ]);
                result.push({
                    name,
                    waiting,
                    active,
                    completed,
                    failed,
                    delayed,
                });
            } catch (error) {
                this.logger.warn(
                    `获取队列 ${name} 状态失败`,
                    error,
                );
            }
        }
        return result;
    }

    /**
     * 手动触发指定定时任务
     */
    async triggerScheduler(name: string): Promise<void> {
        const meta = this.schedulerMeta.get(name);
        if (!meta) {
            throw new NotFoundException(
                `定时任务不存在: ${name}`,
            );
        }

        this.logger.log(`手动触发定时任务: ${name}`);
        await meta.handler();
    }
}
