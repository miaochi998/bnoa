import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../config/prisma.service';
import { TaskService } from '../task.service';

/**
 * 回收站清理定时任务
 * 每小时整点执行，查找过期文件并提交到 file-cleanup 队列
 */
@Injectable()
export class RecycleBinScheduler implements OnModuleInit {
    private readonly logger = new Logger(RecycleBinScheduler.name);
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly taskService: TaskService,
        @InjectQueue('file-cleanup')
        private readonly fileCleanupQueue: Queue,
    ) {
        this.enabled = this.config.get('TASK_RECYCLE_BIN_ENABLED', 'true') !== 'false';
    }

    onModuleInit() {
        this.taskService.registerScheduler('recycle-bin', {
            enabled: this.enabled,
            cron: '0 0 * * * *',
            description: '回收站过期文件清理',
            handler: () => this.handleCleanup(),
        });
    }

    @Cron('0 0 * * * *')
    async handleCleanup(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('回收站清理已禁用，跳过');
            return;
        }

        this.logger.log('开始清理回收站过期文件');

        try {
            const retentionDays = await this.getRetentionDays();
            const expirationDate = new Date();
            expirationDate.setDate(
                expirationDate.getDate() - retentionDays,
            );

            const expiredFiles = await this.prisma.file.findMany({
                where: {
                    deletedAt: { not: null, lt: expirationDate },
                },
            });

            if (expiredFiles.length === 0) {
                this.taskService.recordLastRun('recycle-bin');
                return;
            }

            let submitCount = 0;
            for (const file of expiredFiles) {
                try {
                    await this.prisma.file.delete({
                        where: { id: file.id },
                    });
                    await this.fileCleanupQueue.add('delete', {
                        fileId: file.id,
                        filePath: file.path,
                        thumbnailUrl: file.thumbnailUrl,
                        storageType: file.storageType,
                    });
                    submitCount++;
                } catch (error) {
                    this.logger.error(
                        `处理过期文件失败: ${file.id}`,
                        error,
                    );
                }
            }

            this.logger.log(
                `已提交 ${submitCount} 个过期文件到清理队列`,
            );
            this.taskService.recordLastRun('recycle-bin');
        } catch (error) {
            this.logger.error('清理回收站过期文件失败', error);
        }
    }

    private async getRetentionDays(): Promise<number> {
        try {
            const envDays = this.config.get<number>(
                'RECYCLE_BIN_RETENTION_DAYS',
            );
            if (envDays && envDays > 0) return envDays;

            const config = await this.prisma.config.findFirst({
                where: {
                    key: 'recycle_bin_retention_days',
                    isActive: true,
                    deletedAt: null,
                },
            });
            if (config?.value) {
                const days = parseInt(config.value, 10);
                if (!isNaN(days) && days > 0) return days;
            }
        } catch (error) {
            this.logger.warn(
                '获取回收站保留天数配置失败，使用默认值',
            );
        }
        return 30;
    }
}
