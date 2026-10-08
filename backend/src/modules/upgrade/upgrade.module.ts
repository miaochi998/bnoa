import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { AuthModule } from '../auth/auth.module';
import { UpgradeController } from './upgrade.controller';
import { UpgradeService } from './upgrade.service';
import { UpgradeConfigService } from './services/upgrade-config.service';
import { VersionService } from './services/version.service';
import { PortainerService } from './services/portainer.service';
import { HealthCheckService } from './services/health-check.service';

@Module({
  imports: [AuthModule],
  controllers: [UpgradeController],
  providers: [
    PrismaService,
    RedisService,
    UpgradeService,
    UpgradeConfigService,
    VersionService,
    PortainerService,
    HealthCheckService,
  ],
  exports: [UpgradeService, VersionService],
})
export class UpgradeModule {}
