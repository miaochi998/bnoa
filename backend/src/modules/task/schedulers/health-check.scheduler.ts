import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TaskService } from '../task.service';
import { VirusScannerService } from '../../upload/security/virus-scanner.service';

/**
 * ClamAV 健康检查定时任务
 * 每5分钟执行，检查 ClamAV 服务可用性
 */
@Injectable()
export class HealthCheckScheduler implements OnModuleInit {
    private readonly logger =
        new Logger(HealthCheckScheduler.name);
    private readonly enabled: boolean;
    private lastStatus: boolean | null = null;

    constructor(
        private readonly config: ConfigService,
        private readonly taskService: TaskService,
        private readonly virusScanner: VirusScannerService,
    ) {
        this.enabled = this.config.get('TASK_HEALTH_CHECK_ENABLED', 'true') !== 'false';
    }

    onModuleInit() {
        this.taskService.registerScheduler('health-check', {
            enabled: this.enabled,
            cron: '0 */5 * * * *',
            description: 'ClamAV 健康检查',
            handler: () => this.handleCheck(),
        });
    }

    @Cron('0 */5 * * * *')
    async handleCheck(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('ClamAV 健康检查已禁用，跳过');
            return;
        }

        try {
            const available =
                await this.virusScanner.isAvailable();

            if (this.lastStatus !== null &&
                this.lastStatus !== available) {
                if (available) {
                    this.logger.log(
                        'ClamAV 服务已恢复可用',
                    );
                } else {
                    this.logger.warn(
                        'ClamAV 服务不可用',
                    );
                }
            }

            this.lastStatus = available;
            this.taskService.recordLastRun('health-check');
        } catch (error) {
            this.logger.error('ClamAV 健康检查失败', error);
        }
    }
}
