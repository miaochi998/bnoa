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
    this.logger.log('检查并核对未完成的升级状态...');

    try {
      const lockExists = await this.redisService.get(this.UPGRADE_LOCK_KEY);
      if (lockExists) {
        await this.redisService.del(this.UPGRADE_LOCK_KEY);
        this.logger.log('已清除升级锁');
      }

      // ⚠️ 判据已改正：以**容器实际运行的镜像**为准（verifyAndFinalize），
      // 不再比对 OA 自记的版本记录——那只是期望值，会导致无条件"假成功"。
      const pendingUpgrades = await this.prisma.upgradeLog.findMany({
        where: { status: { in: ['deploying', 'running'] } },
        orderBy: { startedAt: 'desc' },
      });

      if (pendingUpgrades.length === 0) {
        this.logger.log('无未完成的升级记录');
        return;
      }

      for (const upgrade of pendingUpgrades) {
        const result = await this.verifyAndFinalize(upgrade);
        this.logger.log(
          `升级 ${upgrade.id} 核对结果: ${result.verdict} — ${result.detail}`,
        );
      }

      this.logger.log('升级状态核对完成');
    } catch (error) {
      this.logger.error(`清理升级状态失败: ${error.message}`);
    }
  }

  /**
   * 核对「容器实际运行的镜像」是否已变为目标版本，并据此定性升级结果。
   *
   * ⚠️ 这是升级成功与否的**唯一可靠判据**：不再使用 OA 自记的版本记录
   * （那只是期望值，且过去在步骤1 就被写成目标值 → 自检必然"假成功"）。
   * 只有核对通过才写入版本记录（setCurrentVersion），使版本记录始终反映真实运行状态。
   *
   * 调用时机（两处，缺一不可）：
   *   ① 后端启动时 cleanupStaleUpgrades —— 升级会重启后端自身，进程内无法等待结果；
   *   ② 前端轮询 /progress 时懒触发 —— 覆盖"启动自检时镜像仍在拉取中"的情况。
   */
  private async verifyAndFinalize(upgradeLog: {
    id: string;
    versionFrom: string;
    versionTo: string;
    startedAt: Date;
  }): Promise<{
    verdict: 'success' | 'pending' | 'failed' | 'unknown';
    actualVersion: string | null;
    detail: string;
  }> {
    let running: Awaited<ReturnType<PortainerService['getRunningVersions']>>;
    try {
      running = await this.portainerService.getRunningVersions();
    } catch (error) {
      return {
        verdict: 'unknown',
        actualVersion: null,
        detail: `无法查询容器状态：${error.message}`,
      };
    }

    const actual = running.backendVersion;
    const elapsed = Date.now() - new Date(upgradeLog.startedAt).getTime();
    const isStale = elapsed > this.STALE_UPGRADE_TIMEOUT_MS;

    // ① 核对通过：容器实际镜像已是目标版本，且前后端一致
    if (actual === upgradeLog.versionTo && running.versionsConsistent) {
      const completedAt = new Date();
      try {
        await this.versionService.setCurrentVersion(upgradeLog.versionTo);
      } catch (error) {
        this.logger.warn(`写入版本记录失败（不影响升级结论）: ${error.message}`);
      }

      const steps = await this.getStepsOf(upgradeLog.id);
      await this.prisma.upgradeLog.update({
        where: { id: upgradeLog.id },
        data: {
          status: 'success',
          completedAt,
          durationMs:
            completedAt.getTime() - new Date(upgradeLog.startedAt).getTime(),
          errorMessage: null,
          stepsLog: stepsToJson([
            ...steps.filter((s) => s.name !== 'verify_runtime'),
            {
              name: 'verify_runtime',
              status: 'success',
              message: `已核对容器实际镜像：${actual}`,
              startedAt: completedAt.toISOString(),
              completedAt: completedAt.toISOString(),
              result: {
                actualVersion: actual,
                backendVersion: running.backendVersion,
                frontendVersion: running.frontendVersion,
                containers: running.containers,
              },
            },
          ]),
        },
      });
      this.logger.log(`升级已核对通过：容器实际镜像 ${actual}`);
      return {
        verdict: 'success',
        actualVersion: actual,
        detail: `容器实际镜像已为 ${actual}`,
      };
    }

    if (!isStale) {
      return {
        verdict: 'pending',
        actualVersion: actual,
        detail: `容器当前实际运行 ${actual ?? '未知'}，目标 ${upgradeLog.versionTo}`,
      };
    }

    // ② 超时仍未达成 → 判失败，并给出可操作原因
    const reason = await this.explainUpgradeFailure(
      upgradeLog.versionTo,
      actual,
      running,
    );
    const steps = await this.getStepsOf(upgradeLog.id);
    await this.prisma.upgradeLog.update({
      where: { id: upgradeLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: reason,
        stepsLog: stepsToJson([
          ...steps.filter((s) => s.name !== 'verify_runtime'),
          {
            name: 'verify_runtime',
            status: 'failed',
            message: reason,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            result: {
              actualVersion: actual,
              targetVersion: upgradeLog.versionTo,
              containers: running.containers,
            },
          },
        ]),
      },
    });
    this.logger.error(`升级核对失败：${reason}`);
    return { verdict: 'failed', actualVersion: actual, detail: reason };
  }

  private async getStepsOf(upgradeLogId: string): Promise<UpgradeStep[]> {
    const log = await this.prisma.upgradeLog.findUnique({
      where: { id: upgradeLogId },
    });
    return (((log?.stepsLog as unknown) as UpgradeStep[]) || []).slice();
  }

  /**
   * 失败归因：主动检查栈配置与镜像可用性，把"已知的坑"翻译成可操作提示
   */
  private async explainUpgradeFailure(
    targetVersion: string,
    actualVersion: string | null,
    running: Awaited<ReturnType<PortainerService['getRunningVersions']>>,
  ): Promise<string> {
    const hints: string[] = [];

    try {
      const stackCheck =
        await this.portainerService.isStackFileUsingVersionVar();
      if (!stackCheck.ok) {
        hints.push(
          `栈的镜像定义写死了 tag、未使用 \${APP_VERSION} 变量：${stackCheck.hardcoded.join(' | ')}`,
        );
      }
    } catch {
      /* 诊断失败不影响结论 */
    }

    try {
      const imageCheck =
        await this.versionService.checkImageExists(targetVersion);
      if (imageCheck.exists === false) {
        hints.push(`Docker Hub 上未找到目标镜像：${imageCheck.detail}`);
      }
    } catch {
      /* 同上 */
    }

    const unhealthy = (running.containers || []).filter((c) => !c.healthy);
    if (unhealthy.length > 0) {
      hints.push(
        `以下容器未处于健康状态：${unhealthy.map((c) => `${c.name}(${c.status})`).join('、')}`,
      );
    }

    if (hints.length === 0) {
      hints.push('可登录服务器查看 Portainer 中该栈的容器日志，确认镜像拉取是否失败');
    }

    return (
      `等待超时：目标版本 ${targetVersion}，但容器实际运行仍是 ${actualVersion ?? '未知'}\n` +
      `可能原因：\n${hints.map((h) => `· ${h}`).join('\n')}`
    );
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
      const portainerEnabled = await this.portainerService.isEnabled();
      if (!portainerEnabled) {
        throw new Error('Portainer 集成未启用，请先在升级设置中配置 Portainer 连接参数');
      }

      // 步骤1: 升级前预检（全部只读，不修改任何状态）
      //
      // ⚠️ 历史教训：此处原为 `setCurrentVersion(targetVersion)`（提前把版本记录改成目标值），
      // 导致后续"成功判定"退化成「自己写的期望值 == 目标值」的自我验证 ——
      // 无论容器实际是否升级，后端重启后自检都会判定成功（测试机曾因此静默假成功）。
      // 现在改为：预检只读；版本记录仅在**核对容器实际镜像通过后**才更新（见 verifyAndFinalize）。
      const preflightStep = await this.executeStep(
        'preflight',
        '升级前预检',
        async () => {
          const running = await this.portainerService.getRunningVersions();

          // ① 栈的镜像定义必须使用 ${APP_VERSION} 变量，否则升级注定静默失效
          const stackCheck =
            await this.portainerService.isStackFileUsingVersionVar();
          if (!stackCheck.ok) {
            throw new Error(
              '栈的镜像定义写死了 tag、未使用 ${APP_VERSION} 变量，升级不会生效。' +
                `请先在 Portainer 中把以下行改为变量形式：${stackCheck.hardcoded.join(' | ')}`,
            );
          }

          // ② 目标版本镜像必须存在（查询本身失败时不阻断，避免网络抖动误拦）
          const imageCheck =
            await this.versionService.checkImageExists(targetVersion);
          if (imageCheck.exists === false) {
            throw new Error(
              `目标镜像不存在：${imageCheck.detail}。请确认该版本已构建并推送到 Docker Hub。`,
            );
          }

          return {
            currentRunningVersion: running.backendVersion,
            containersHealthy: running.allHealthy,
            stackImageUsesVariable: stackCheck.ok,
            imageCheck: imageCheck.detail,
          };
        },
      );
      steps.push(preflightStep);

      if (preflightStep.status === 'failed') {
        throw new Error(preflightStep.message || '升级前预检未通过');
      }

      await this.prisma.upgradeLog.update({
        where: { id: upgradeLog.id },
        data: {
          stepsLog: stepsToJson([
            ...steps,
            {
              name: 'update_stack',
              status: 'pending',
              message: '等待发送堆栈更新请求...',
            },
          ]),
        },
      });

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
    errorMessage: string | null;
    actualVersion: string | null;
    containers: any[];
    allHealthy: boolean;
    elapsedSeconds: number;
  }> {
    const log = upgradeId
      ? await this.prisma.upgradeLog.findUnique({ where: { id: upgradeId } })
      : await this.prisma.upgradeLog.findFirst({
          where: { status: { in: ['running', 'deploying'] } },
          orderBy: { startedAt: 'desc' },
        });

    // 始终附上「容器实际运行状态」——它是判定升级结果唯一的事实依据，
    // 也让前端在没有进行中升级时也能展示真实版本。
    let running: Awaited<
      ReturnType<PortainerService['getRunningVersions']>
    > | null = null;
    try {
      running = await this.portainerService.getRunningVersions();
    } catch (error) {
      this.logger.warn(`查询容器实际状态失败: ${error.message}`);
    }

    if (!log) {
      return {
        inProgress: false,
        upgradeId: null,
        status: null,
        versionFrom: null,
        versionTo: null,
        steps: [],
        startedAt: null,
        message: upgradeId ? '升级记录不存在' : '暂无升级记录',
        errorMessage: null,
        actualVersion: running?.backendVersion ?? null,
        containers: running?.containers ?? [],
        allHealthy: running?.allHealthy ?? false,
        elapsedSeconds: 0,
      };
    }

    // ⚠️ 懒验证：升级进行中时，借前端这次轮询去核对容器实际镜像。
    // 必须放在这里的原因：升级会重启后端自身，进程内拿不到结果；
    // 而启动自检只执行一次，可能早于镜像拉取完成（此时不应误判失败）。
    let current = log;
    if (log.status === 'running' || log.status === 'deploying') {
      const verdict = await this.verifyAndFinalize(log);
      const refreshed = await this.prisma.upgradeLog.findUnique({
        where: { id: log.id },
      });
      if (refreshed) current = refreshed;
      this.logger.debug(`懒验证结果: ${verdict.verdict} — ${verdict.detail}`);
    }

    const steps = ((current.stepsLog as unknown) as UpgradeStep[]) || [];

    return {
      inProgress: current.status === 'running' || current.status === 'deploying',
      upgradeId: current.id,
      status: current.status,
      versionFrom: current.versionFrom,
      versionTo: current.versionTo,
      steps,
      startedAt: current.startedAt?.toISOString() || null,
      message: this.getStatusMessage(
        current.status,
        current.errorMessage,
        running?.backendVersion,
      ),
      errorMessage: current.errorMessage || null,
      actualVersion: running?.backendVersion ?? null,
      containers: running?.containers ?? [],
      allHealthy: running?.allHealthy ?? false,
      elapsedSeconds: Math.round(
        (Date.now() - new Date(current.startedAt).getTime()) / 1000,
      ),
    };
  }

  private getStatusMessage(
    status: string,
    errorMessage?: string | null,
    actualVersion?: string | null,
  ): string {
    switch (status) {
      case 'running':
        return '升级正在进行中...';
      case 'deploying':
        return actualVersion
          ? `服务正在重启 / 拉取镜像中（容器当前实际运行 ${actualVersion}）...`
          : '服务正在重启中，请稍候...';
      case 'success':
        return actualVersion
          ? `升级成功完成（已核对容器实际镜像 ${actualVersion}）`
          : '升级成功完成';
      case 'failed':
        return errorMessage || '升级失败';
      default:
        return '未知状态';
    }
  }
}
