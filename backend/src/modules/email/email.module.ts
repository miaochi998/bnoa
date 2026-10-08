import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../config/prisma.module';
import { RedisService } from '../../common/services/redis.service';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailController } from './email.controller';

@Global()
@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        BullModule.registerQueue({ name: 'email' }),
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => ({
                secret: cfg.get<string>('JWT_SECRET'),
            }),
        }),
    ],
    providers: [
        EmailService,
        EmailTemplateService,
        RedisService,
    ],
    controllers: [EmailController],
    exports: [EmailService],
})
export class EmailModule {}
