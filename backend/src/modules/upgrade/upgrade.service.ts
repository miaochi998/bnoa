import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { VersionService } from './services/version.service';
import { PortainerService } from './services/portainer.service';
import { HealthCheckService } from './services/health-check.service';
import { RedisService } from '../../common/services/redis.service';

interface UpgradeStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: Record<string, any>;
}

function stepsToJson(steps: UpgradeStep[]): any {
  return JSON.parse(JSON.stringify(steps));
}

@Injectable()
export class UpgradeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UpgradeService.name);
  private readonly UPGRADE_LOCK_KEY = 'upgrade:lock';
  private readonly UPGRADE_LOCK_TTL = 3600;
  private readonly STALE_UPGRADE_TIMEOUT_MS = 10 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly versionService: VersionService,
    private readonly portainerService: PortainerService,
    private readonly healthCheckService: HealthCheckService,
    private readonly redisService: RedisService,
  ) {}

  async onApplicationBootstrap() {
    setTimeout(() => {
      this.versionService.initializeCurrentVersion().catch((err) => {
        this.logger.error(`初始化版本失败: ${err.message}`);
      });
      this.cleanupStaleUpgrades().catch((err) => {
        this.logger.error(`清理升级状态失败: ${err.message}`);
      });
    }, 3000);
  }

  private async cleanupStaleUpgrades(): Promise<void> {
    this.logger.log('检查并清理过期的升级状态...');

    try {
      const lockExists = await this.redisService.get(this.UPGRADE_LOCK_KEY);
      if (lockExists) {
        await this.redisService.del(this.UPGRADE_LOCK_KEY);
        this.logger.log('已清除升级锁');
      }

      const deployingUpgrades = await this.prisma.upgradeLog.findMany({
        where: { status: 'deploying' },
        orderBy: { startedAt: 'desc' },
      });

      for (const upgrade of deployingUpgrades) {
        const currentVersion = await this.versionService.getCurrentVersion();

        if (currentVersion.version === upgrade.versionTo) {
          const completedAt = new Date();
          await this.prisma.upgradeLog.update({
            where: { id: upgrade.id },
            data: {
              status: 'success',
              completedAt,
              durationMs: completedAt.getTime() - upgrade.startedAt.getTime(),
            },
          });
          this.logger.log(`升级记录 ${upgrade.id} 已标记为成功`);
        } else {
          const isStale =
            Date.now() - upgrade.startedAt.getTime() > this.STALE_UPGRADE_TIMEOUT_MS;
          if (isStale) {
            await this.prisma.upgradeLog.update({
              where: { id: upgrade.id },
              data: {
                status: 'failed',
                errorMessage: '升级超时：服务重启后版本未更新',
                completedAt: new Date(),
              },
            });
          }
        }
      }

      const staleThreshold = new Date(Date.now() - this.STALE_UPGRADE_TIMEOUT_MS);
      const staleRunning = await this.prisma.upgradeLog.findMany({
        where: { status: 'running', startedAt: { lt: staleThreshold } },
      });

      if (staleRunning.length > 0) {
        await this.prisma.upgradeLog.updateMany({
          where: { id: { in: staleRunning.map((u: any) => u.id) } },
          data: {
            status: 'failed',
            errorMessage: '升级超时：服务重启后自动标记为失败',
            completedAt: new Date(),
          },
        });
        this.logger.log(`已将 ${staleRunning.length} 条过期记录标记为失败`);
      }

      this.logger.log('升级状态清理完成');
    } catch (error) {
      this.logger.error(`清理升级状态失败: ${error.message}`);
    }
  }

  async isUpgradeInProgress(): Promise<boolean> {
    const lock = await this.redisService.get(this.UPGRADE_LOCK_KEY);
    return !!lock;
  }

  private async acquireLock(): Promise<boolean> {
    return await this.redisService.setNX(
      this.UPGRADE_LOCK_KEY,
      Date.now().toString(),
      this.UPGRADE_LOCK_TTL,
    );
  }

  private async releaseLock(): Promise<void> {
    await this.redisService.del(this.UPGRADE_LOCK_KEY);
  }

  async executeUpgrade(
    targetVersion: string,
    operatorId: string,
    operatorIp: string,
  ): Promise<any> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new Error('升级正在进行中，请稍后再试');
    }

    const currentVersion = await this.versionService.getCurrentVersion();
    const steps: UpgradeStep[] = [];

    const upgradeLog = await this.prisma.upgradeLog.create({
      data: {
        versionFrom: currentVersion.version,
        versionTo: targetVersion,
        upgradeType: 'upgrade',
        status: 'running',
        startedAt: new Date(),
        operatorId,
        operatorIp,
        stepsLog: [],
      },
    });

    try {
      // 步骤1: 预先更新版本记录
      const versionStep = await this.executeStep(
        'update_version',
        '更新版本记录',
        async () => {
          await this.versionService.setCurrentVersion(targetVersion);
          return { success: true, version: targetVersion };
        },
      );
      steps.push(versionStep);

      if (versionStep.status === 'failed') {
        throw new Error('版本记录更新失败');
      }

      await this.prisma.upgradeLog.update({
        where: { id: upgradeLog.id },
        data: { stepsLog: stepsToJson(steps) },
      });

      // 步骤2: 通过 Portainer API 更新堆栈
      const portainerEnabled = await this.portainerService.isEnabled();
      if (!portainerEnabled) {
        throw new Error('Portainer 集成未启用，请先在升级设置中配置 Portainer 连接参数');
      }

      // 在发送 Portainer 请求之前就设置 deploying 状态
      // 因为请求发出后后端容器可能随时被杀掉
      await this.prisma.upgradeLog.update({
        where: { id: upgradeLog.id },
        data: {
          status: 'deploying',
          stepsLog: stepsToJson([
            ...steps,
            {
              name: 'update_stack',
              status: 'running',
              message: '正在发送堆栈更新请求...',
              startedAt: new Date().toISOString(),
            },
          ]),
        },
      });

      // Fire-and-forget：updateStackVersion 会发送请求后立即返回
      // 不会因为容器重启导致的连接断开而抛出错误
      try {
        await this.portainerService.updateStackVersion(targetVersion, true);
      } catch (updateError) {
        // 即使这里出错，请求可能已经发出去了，不将状态改为 failed
        // cleanupStaleUpgrades 会在新容器启动后处理最终状态
        this.logger.warn(`Portainer 更新请求异常（可能已发出）: ${updateError.message}`);
      }

      this.logger.log(
        `升级已触发: ${currentVersion.version} -> ${targetVersion}，服务即将重启`,
      );

      return {
        id: upgradeLog.id,
        status: 'deploying',
        message: '升级已触发，服务正在重启中...',
        versionFrom: currentVersion.version,
        versionTo: targetVersion,
      };
    } catch (error) {
      this.logger.error(`升级失败: ${error.message}`);

      await this.prisma.upgradeLog.update({
        where: { id: upgradeLog.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message,
          stepsLog: stepsToJson(steps),
        },
      });

      await this.releaseLock();
      throw error;
    }
  }

  private async executeStep(
    name: string,
    description: string,
    action: () => Promise<any>,
  ): Promise<UpgradeStep> {
    const startTime = Date.now();
    const step: UpgradeStep = {
      name,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.logger.log(`执行步骤: ${description}`);

    try {
      const result = await action();
      step.status = 'success';
      step.result = result;
      step.completedAt = new Date().toISOString();
      step.durationMs = Date.now() - startTime;
      this.logger.log(`步骤完成: ${description} (${step.durationMs}ms)`);
    } catch (error) {
      step.status = 'failed';
      step.message = error.message;
      step.completedAt = new Date().toISOString();
      step.durationMs = Date.now() - startTime;
      this.logger.error(`步骤失败: ${description} - ${error.message}`);
    }

    return step;
  }

  async getUpgradeLogs(page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      this.prisma.upgradeLog.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: {
            select: { id: true, username: true, name: true },
          },
        },
      }),
      this.prisma.upgradeLog.count(),
    ]);

    const formattedLogs = logs.map((log: any) => ({
      id: log.id,
      versionFrom: log.versionFrom,
      versionTo: log.versionTo,
      upgradeType: log.upgradeType,
      status: log.status,
      startedAt: log.startedAt?.toISOString(),
      completedAt: log.completedAt?.toISOString(),
      durationMs: log.durationMs,
      stepsLog: log.stepsLog,
      errorMessage: log.errorMessage,
      operatorIp: log.operatorIp,
      createdAt: log.createdAt?.toISOString(),
      operator: log.operator
        ? {
            id: log.operator.id,
            username: log.operator.username,
            name: log.operator.name,
          }
        : null,
    }));

    return {
      items: formattedLogs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUpgradeProgress(upgradeId?: string): Promise<{
    inProgress: boolean;
    upgradeId: string | null;
    status: string | null;
    versionFrom: string | null;
    versionTo: string | null;
    steps: any[];
    startedAt: string | null;
    message: string;
  }> {
    if (upgradeId) {
      const log = await this.prisma.upgradeLog.findUnique({
        where: { id: upgradeId },
      });

      if (!log) {
        return {
          inProgress: false,
          upgradeId: null,
          status: null,
          versionFrom: null,
          versionTo: null,
          steps: [],
          startedAt: null,
          message: '升级记录不存在',
        };
      }

      return {
        inProgress: log.status === 'running' || log.status === 'deploying',
        upgradeId: log.id,
        status: log.status,
        versionFrom: log.versionFrom,
        versionTo: log.versionTo,
        steps: (log.stepsLog as any[]) || [],
        startedAt: log.startedAt?.toISOString() || null,
        message: this.getStatusMessage(log.status, log.errorMessage),
      };
    }

    const activeUpgrade = await this.prisma.upgradeLog.findFirst({
      where: { status: { in: ['running', 'deploying'] } },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeUpgrade) {
      return {
        inProgress: false,
        upgradeId: null,
        status: null,
        versionFrom: null,
        versionTo: null,
        steps: [],
        startedAt: null,
        message: '暂无升级记录',
      };
    }

    return {
      inProgress: true,
      upgradeId: activeUpgrade.id,
      status: activeUpgrade.status,
      versionFrom: activeUpgrade.versionFrom,
      versionTo: activeUpgrade.versionTo,
      steps: (activeUpgrade.stepsLog as any[]) || [],
      startedAt: activeUpgrade.startedAt?.toISOString() || null,
      message: this.getStatusMessage(
        activeUpgrade.status,
        activeUpgrade.errorMessage,
      ),
    };
  }

  private getStatusMessage(
    status: string,
    errorMessage?: string | null,
  ): string {
    switch (status) {
      case 'running':
        return '升级正在进行中...';
      case 'deploying':
        return '服务正在重启中，请稍候...';
      case 'success':
        return '升级成功完成';
      case 'failed':
        return errorMessage || '升级失败';
      default:
        return '未知状态';
    }
  }
}
