import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';
import {
    NotificationController,
} from './notification.controller';
import {
    NotificationAdminController,
} from './notification-admin.controller';
import {
    NotificationService,
} from './services/notification.service';
import {
    NotificationHelperService,
} from './services/notification-helper.service';
import {
    BroadcastService,
} from './services/broadcast.service';

@Module({
    imports: [
        PrismaModule,
        ConfigModule,
        AuthModule,
    ],
    controllers: [
        NotificationController,
        NotificationAdminController,
    ],
    providers: [
        NotificationService,
        NotificationHelperService,
        BroadcastService,
    ],
    exports: [NotificationHelperService],
})
export class NotificationModule {}
