import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import { TaskService } from '../task.service';

/**
 * RefreshToken 清理定时任务
 * 每天凌晨2点执行，删除过期或已撤销的刷新令牌
 */
@Injectable()
export class TokenCleanupScheduler implements OnModuleInit {
    private readonly logger =
        new Logger(TokenCleanupScheduler.name);
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly taskService: TaskService,
    ) {
        this.enabled = this.config.get('TASK_TOKEN_CLEANUP_ENABLED', 'true') !== 'false';
    }

    onModuleInit() {
        this.taskService.registerScheduler('token-cleanup', {
            enabled: this.enabled,
            cron: '0 0 2 * * *',
            description: 'RefreshToken 过期清理',
            handler: () => this.handleCleanup(),
        });
    }

    @Cron('0 0 2 * * *')
    async handleCleanup(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('Token清理已禁用，跳过');
            return;
        }

        this.logger.log('开始清理过期 RefreshToken');

        try {
            const result =
                await this.prisma.refreshToken.deleteMany({
                    where: {
                        OR: [
                            { expiresAt: { lt: new Date() } },
                            { isRevoked: true },
                        ],
                    },
                });

            this.logger.log(
                `已清理 ${result.count} 个过期/已撤销 Token`,
            );
            this.taskService.recordLastRun('token-cleanup');
        } catch (error) {
            this.logger.error('清理过期 Token 失败', error);
        }
    }
}
