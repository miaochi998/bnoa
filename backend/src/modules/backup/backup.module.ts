import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupConfigService } from './backup-config.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [BackupController],
  providers: [BackupService, BackupConfigService, BackupSchedulerService],
  exports: [BackupService, BackupConfigService],
})
export class BackupModule {}
