import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { VersionService } from '../services/version.service';
import { PrepullService } from '../services/prepull.service';

/**
 * 定时「检查更新 + 后台预拉取镜像」调度器（方向 A 的触发②）。
 *
 * 为什么需要它：升级预检的耗时几乎全部来自"同步等镜像拉取完成"。
 * 只靠用户在页面上点"检查更新"来触发预拉取，若用户检查完立刻点升级，
 * 镜像往往还没拉完。定时任务能保证镜像**提前**就在本机 daemon 上，
 * 用户点升级时预检只需一次本机镜像查询（毫秒级）即可跳过拉取。
 *
 * 守卫开关：环境变量 `UPGRADE_PREPULL_ENABLED=false` 可整体关闭（默认开启）。
 * 失败一律静默（只 warn），不影响任何既有功能。
 */
@Injectable()
export class PrepullScheduler {
  private readonly logger = new Logger(PrepullScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly versionService: VersionService,
    private readonly prepullService: PrepullService,
  ) {
    this.enabled =
      this.config.get('UPGRADE_PREPULL_ENABLED', 'true') !== 'false';
  }

  /** 每 6 小时主动检查一次新版本并预拉取 */
  @Cron('0 0 */6 * * *')
  async handlePrepullCheck(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        '[预拉取] 定时预拉取已禁用（UPGRADE_PREPULL_ENABLED=false），跳过',
      );
      return;
    }

    try {
      const result = await this.versionService.checkForUpdate();

      if (!result.hasUpdate || !result.latestVersion) {
        this.logger.debug(
          `[预拉取] 定时检查：当前 ${result.currentVersion} 已是最新，无需预拉取`,
        );
        return;
      }

      this.logger.log(
        `[预拉取] 定时检查发现新版本 ${result.latestVersion}（当前 ${result.currentVersion}），触发后台预拉取`,
      );
      // 异步触发：不 await（拉取可能数十秒到数分钟）
      this.prepullService.triggerPrepull(result.latestVersion, 'cron');
    } catch (error) {
      // 检查更新失败（GitHub 不可达等）属预期情况，静默处理
      this.logger.warn(
        `[预拉取] 定时检查更新失败（已忽略）: ${(error as Error)?.message || error}`,
      );
    }
  }
}
