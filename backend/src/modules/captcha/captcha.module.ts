import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { RedisService } from '../../common/services/redis.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { CaptchaController } from './captcha.controller';
import { CaptchaSettingsController } from './captcha-settings.controller';
import { CaptchaService } from './captcha.service';
import { CaptchaBackgroundService } from './captcha-background.service';

@Module({
    imports: [
        PrismaModule,
        StorageModule,
        forwardRef(() => AuthModule),
    ],
    controllers: [
        CaptchaController,
        CaptchaSettingsController,
    ],
    providers: [
        CaptchaService,
        CaptchaBackgroundService,
        RedisService,
    ],
    exports: [CaptchaService, CaptchaBackgroundService],
})
export class CaptchaModule {}
