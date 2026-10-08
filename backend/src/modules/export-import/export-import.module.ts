import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { ExportImportController } from './export-import.controller';
import { ExportService } from './services/export.service';
import { ImportService } from './services/import.service';
import { ExportTaskService } from './services/export-task.service';
import { ExportProcessor } from './processors/export.processor';

// 适配器
import { UserAdapter } from './adapters/user.adapter';
import { AuditLogAdapter } from './adapters/audit-log.adapter';
import { SecurityLogAdapter } from './adapters/security-log.adapter';
import { EmailLogAdapter } from './adapters/email-log.adapter';
import { NotificationAdapter } from './adapters/notification.adapter';
import { DictionaryAdapter } from './adapters/dictionary.adapter';
import { ConfigAdapter } from './adapters/config.adapter';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        NotificationModule,
        BullModule.registerQueue({ name: 'export' }),
    ],
    controllers: [ExportImportController],
    providers: [
        ExportService,
        ImportService,
        ExportTaskService,
        ExportProcessor,
        // 适配器
        UserAdapter,
        AuditLogAdapter,
        SecurityLogAdapter,
        EmailLogAdapter,
        NotificationAdapter,
        DictionaryAdapter,
        ConfigAdapter,
    ],
    exports: [ExportService, ExportTaskService],
})
export class ExportImportModule implements OnModuleInit {
    constructor(
        private readonly exportService: ExportService,
        private readonly userAdapter: UserAdapter,
        private readonly auditLogAdapter: AuditLogAdapter,
        private readonly securityLogAdapter: SecurityLogAdapter,
        private readonly emailLogAdapter: EmailLogAdapter,
        private readonly notificationAdapter: NotificationAdapter,
        private readonly dictionaryAdapter: DictionaryAdapter,
        private readonly configAdapter: ConfigAdapter,
    ) {}

    onModuleInit() {
        // 注册所有适配器
        this.exportService.registerAdapter(
            this.userAdapter,
        );
        this.exportService.registerAdapter(
            this.auditLogAdapter,
        );
        this.exportService.registerAdapter(
            this.securityLogAdapter,
        );
        this.exportService.registerAdapter(
            this.emailLogAdapter,
        );
        this.exportService.registerAdapter(
            this.notificationAdapter,
        );
        this.exportService.registerAdapter(
            this.dictionaryAdapter,
        );
        this.exportService.registerAdapter(
            this.configAdapter,
        );
    }
}
