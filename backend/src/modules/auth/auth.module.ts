import { Module, forwardRef } from '@nestjs/common';
import { CaptchaModule } from '../captcha/captcha.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MulterModule } from '@nestjs/platform-express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../../config/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiration = configService.get<string>(
          'JWT_ACCESS_EXPIRATION',
          '15m',
        );
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiration as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
    }),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    PrismaModule,
    forwardRef(() => StorageModule),
    CaptchaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
