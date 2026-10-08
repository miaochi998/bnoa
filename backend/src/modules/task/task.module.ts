import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../config/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { UploadModule } from '../upload/upload.module';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { AuthModule } from '../auth/auth.module';

// 定时任务
import { RecycleBinScheduler } from './schedulers/recycle-bin.scheduler';
import { ShareCleanupScheduler } from './schedulers/share-cleanup.scheduler';
import { TokenCleanupScheduler } from './schedulers/token-cleanup.scheduler';
import { SessionCleanupScheduler } from './schedulers/session-cleanup.scheduler';
import { AuditArchiveScheduler } from './schedulers/audit-archive.scheduler';
import { SecurityCleanupScheduler } from './schedulers/security-cleanup.scheduler';
import { DiskCheckScheduler } from './schedulers/disk-check.scheduler';
import { HealthCheckScheduler } from './schedulers/health-check.scheduler';
import { EmailLogCleanupScheduler } from './schedulers/email-log-cleanup.scheduler';
import { NotificationCleanupScheduler } from './schedulers/notification-cleanup.scheduler';
import { ExportCleanupScheduler } from './schedulers/export-cleanup.scheduler';

// 队列处理器
import { VirusScanProcessor } from './queues/virus-scan.processor';
import { FileCleanupProcessor } from './queues/file-cleanup.processor';
import { AuditLogProcessor } from './queues/audit-log.processor';
import { EmailProcessor } from './queues/email.processor';
import { NotificationProcessor } from './queues/notification.processor';

/**
 * 定时任务与任务队列模块
 * 统一管理所有定时任务和异步队列
 */
@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        StorageModule,
        AuthModule,
        UploadModule,
        ScheduleModule.forRoot(),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get<string>(
                        'REDIS_HOST', 'localhost',
                    ),
                    port: config.get<number>(
                        'REDIS_PORT', 6382,
                    ),
                    password:
                        config.get<string>(
                            'REDIS_PASSWORD', '',
                        ) || undefined,
                    db: config.get<number>(
                        'REDIS_TASK_DB', 1,
                    ),
                },
            }),
        }),
        BullModule.registerQueue(
            { name: 'virus-scan' },
            { name: 'file-cleanup' },
            { name: 'audit-log' },
            { name: 'email' },
            { name: 'notification' },
        ),
    ],
    providers: [
        TaskService,
        // 定时任务
        RecycleBinScheduler,
        ShareCleanupScheduler,
        TokenCleanupScheduler,
        SessionCleanupScheduler,
        AuditArchiveScheduler,
        SecurityCleanupScheduler,
        DiskCheckScheduler,
        HealthCheckScheduler,
        EmailLogCleanupScheduler,
        NotificationCleanupScheduler,
        ExportCleanupScheduler,
        // 队列处理器
        VirusScanProcessor,
        FileCleanupProcessor,
        AuditLogProcessor,
        EmailProcessor,
        NotificationProcessor,
    ],
    controllers: [TaskController],
    exports: [TaskService],
})
export class TaskModule {}
