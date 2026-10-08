import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import { TaskService } from '../task.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 磁盘空间巡检定时任务
 * 每30分钟执行，检查磁盘空间，低于阈值时记录安全告警
 */
@Injectable()
export class DiskCheckScheduler implements OnModuleInit {
    private readonly logger =
        new Logger(DiskCheckScheduler.name);
    private readonly enabled: boolean;
    private readonly minFreeBytes: number;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly taskService: TaskService,
    ) {
        this.enabled = this.config.get('TASK_DISK_CHECK_ENABLED', 'true') !== 'false';
        this.minFreeBytes = this.config.get<number>(
            'MIN_FREE_SPACE_BYTES', 1073741824,
        );
    }

    onModuleInit() {
        this.taskService.registerScheduler('disk-check', {
            enabled: this.enabled,
            cron: '0 */30 * * * *',
            description: '磁盘空间巡检',
            handler: () => this.handleCheck(),
        });
    }

    @Cron('0 */30 * * * *')
    async handleCheck(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('磁盘空间巡检已禁用，跳过');
            return;
        }

        try {
            const freeBytes = await this.getFreeDiskSpace();
            if (freeBytes === null) return;

            if (freeBytes < this.minFreeBytes) {
                const freeGB =
                    (freeBytes / 1073741824).toFixed(2);
                const minGB =
                    (this.minFreeBytes / 1073741824).toFixed(2);

                this.logger.warn(
                    `磁盘空间不足: 剩余 ${freeGB}GB，` +
                    `阈值 ${minGB}GB`,
                );

                await this.prisma.securityLog.create({
                    data: {
                        type: 'DISK_SPACE_LOW',
                        severity: 'WARNING',
                        status: 'NEW',
                        details:
                            `磁盘剩余空间 ${freeGB}GB，` +
                            `低于阈值 ${minGB}GB`,
                        metadata: {
                            freeBytes,
                            minFreeBytes: this.minFreeBytes,
                        },
                    },
                });
            }

            this.taskService.recordLastRun('disk-check');
        } catch (error) {
            this.logger.error('磁盘空间巡检失败', error);
        }
    }

    private async getFreeDiskSpace(): Promise<number | null> {
        try {
            const { stdout } = await execAsync(
                "df -k / | tail -1 | awk '{print $4}'",
            );
            const freeKB = parseInt(stdout.trim(), 10);
            if (isNaN(freeKB)) return null;
            return freeKB * 1024;
        } catch {
            this.logger.warn('获取磁盘空间信息失败');
            return null;
        }
    }
}
