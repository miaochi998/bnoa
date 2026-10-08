import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { BackupService } from './backup.service';
import { BackupConfigService } from './backup-config.service';

const BACKUP_CRON_NAME = 'backup-scheduled';

@Injectable()
export class BackupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly configService: BackupConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    this.syncCronFromConfig();
  }

  /** 将配置的 5 段 cron（分 时 日 月 周）转为 6 段（秒 分 时 日 月 周） */
  private toSixPartCron(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    if (parts.length >= 6) return cron;
    if (parts.length === 5) return `0 ${cron}`;
    return '0 0 2 * * *';
  }

  /** 根据当前配置启用/更新/禁用定时备份 cron */
  async syncCronFromConfig() {
    try {
      if (this.schedulerRegistry.doesExist('cron', BACKUP_CRON_NAME)) {
        this.schedulerRegistry.deleteCronJob(BACKUP_CRON_NAME);
      }
      const config = await this.configService.getConfig();
      if (!config.enabled) {
        this.logger.log('备份定时任务未启用');
        return;
      }
      const cronExpr = this.toSixPartCron(config.scheduleCron);
      const job = new CronJob(cronExpr, () => {
        void this.runScheduledBackup();
      });
      this.schedulerRegistry.addCronJob(BACKUP_CRON_NAME, job);
      job.start();
      this.logger.log(`备份定时任务已启用: ${config.scheduleCron} -> ${cronExpr}`);
    } catch (err) {
      this.logger.warn(`同步备份定时任务失败: ${err.message}`);
    }
  }

  private async runScheduledBackup() {
    const config = await this.configService.getConfig();
    if (!config.enabled) return;

    this.logger.log('开始执行定时备份...');
    try {
      const result = await this.backupService.createBackup(
        { backupType: 'FULL', triggerType: 'SCHEDULED' },
      );
      this.logger.log(`定时备份完成: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`定时备份失败: ${error.message}`);
    }

    try {
      const removed = await this.backupService.cleanupExpiredBackups();
      if (removed > 0) {
        this.logger.log(`已清理过期备份 ${removed} 条`);
      }
    } catch (err) {
      this.logger.warn(`清理过期备份失败: ${err.message}`);
    }
  }
}
