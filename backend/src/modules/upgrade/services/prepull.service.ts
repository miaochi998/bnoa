import { Injectable, Logger } from '@nestjs/common';
import { PortainerService } from './portainer.service';
import { RedisService } from '../../../common/services/redis.service';

export type PrepullStatus = 'pulling' | 'ready' | 'failed';

export interface PrepullState {
  status: PrepullStatus;
  startedAt: string;
  finishedAt?: string;
  message: string;
  attempts: number;
  durationMs?: number;
}

/**
 * 后台「异步预拉取镜像」服务（方向 A 的核心）。
 *
 * 目的：升级预检之所以慢（实测 224 秒），主因是预检里**同步阻塞**地等
 * `backend → Portainer API → docker.sock → daemon` 这条链路的拉取进度流结束。
 * 解法是"把拉取挪到没人等待的后台"：应用一旦发现新版本就提前把镜像拉到本机 daemon，
 * 用户点升级时预检只需查一次本机镜像列表（毫秒级）即可跳过拉取。
 *
 * 设计约束（务必保持）：
 * 1. **绝不阻塞调用方**：`triggerPrepull()` 是同步返回的 void，内部 fire-and-forget；
 * 2. **失败必须静默**：任何异常只 `logger.warn`，不抛给调用方，不影响检查更新/升级任何功能；
 * 3. **幂等**：同一版本 `pulling`/`ready` 直接跳过；`failed` 允许重试但受最小重试间隔限制；
 * 4. **不落库**：状态只存在内存 Map 里（重启丢失可接受 —— 镜像确实已在 daemon 上，
 *    重启后靠"先查本机镜像"的快速路径即可重新判为 ready）；
 * 5. **不并发拉取**：多个触发源（检查更新接口 + 定时任务）通过串行队列排队，避免把 Portainer 打爆。
 */
@Injectable()
export class PrepullService {
  private readonly logger = new Logger(PrepullService.name);

  /** 与 UpgradeService 的升级锁同键：升级进行中不抢占 daemon 拉取 */
  private readonly UPGRADE_LOCK_KEY = 'upgrade:lock';

  /** 失败后的最小重试间隔，避免定时任务/接口反复触发把 Portainer 刷爆 */
  private readonly MIN_RETRY_INTERVAL_MS = 10 * 60 * 1000;

  /** version -> 状态 */
  private readonly states = new Map<string, PrepullState>();

  /** 串行队列：同一时刻最多一个预拉取任务在跑 */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly portainerService: PortainerService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 触发预拉取（同步返回，**不 await、不阻塞**调用方，且**永不抛异常**）。
   *
   * @param version 目标版本号（如 `0.5.9`）
   * @param reason  触发源，仅用于日志（如 `check-api` / `cron`）
   */
  triggerPrepull(version: string, reason: string): void {
    try {
      if (!version) return;

      const now = Date.now();
      const previous = this.states.get(version);

      if (previous) {
        if (previous.status === 'pulling') {
          this.logger.debug(
            `[预拉取] ${version} 正在拉取中，跳过（触发源: ${reason}）`,
          );
          return;
        }
        if (previous.status === 'ready') {
          this.logger.debug(
            `[预拉取] ${version} 已就绪，跳过（触发源: ${reason}）`,
          );
          return;
        }
        // failed：允许重试，但要等过最小重试间隔
        const lastFinishedAt = Date.parse(
          previous.finishedAt || previous.startedAt,
        );
        if (
          !Number.isNaN(lastFinishedAt) &&
          now - lastFinishedAt < this.MIN_RETRY_INTERVAL_MS
        ) {
          this.logger.debug(
            `[预拉取] ${version} 上次失败未满重试间隔，跳过（触发源: ${reason}）`,
          );
          return;
        }
      }

      this.states.set(version, {
        status: 'pulling',
        startedAt: new Date().toISOString(),
        message: `已触发预拉取（触发源: ${reason}）`,
        attempts: (previous?.attempts ?? 0) + 1,
      });

      this.logger.log(
        `[预拉取] 已排入队列: ${version}（触发源: ${reason}，第 ${this.states.get(version)?.attempts ?? 1} 次）`,
      );

      // fire-and-forget：调用方（HTTP 检查更新接口 / 定时任务）立即返回
      this.enqueue(() => this.runPrepull(version, reason));
    } catch (error) {
      this.logger.warn(
        `[预拉取] 触发失败（已忽略）: ${this.errorMessage(error)}`,
      );
    }
  }

  /** 读取某版本的预拉取状态（供预检结果/日志展示用，没有则返回 undefined） */
  getStatus(version: string): Readonly<PrepullState> | undefined {
    const state = this.states.get(version);
    return state ? { ...state } : undefined;
  }

  /** 串行执行，保证同一时刻只有一个拉取任务（异常不污染队列） */
  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error) => {
      this.logger.warn(
        `[预拉取] 队列任务异常（已忽略）: ${this.errorMessage(error)}`,
      );
    });
  }

  /**
   * 真正的预拉取流程：
   *   ① 升级进行中 / Portainer 未启用 → 直接放弃（删掉状态，允许下次再试）
   *   ② 本机已有镜像 → 直接就绪（重启后内存状态丢失时的快速路径）
   *   ③ 交给 daemon 预拉取（backend + frontend）
   *   ④ 仍无法确认时复查一次本机镜像（拉取可能仍在 daemon 侧继续）
   */
  private async runPrepull(version: string, reason: string): Promise<void> {
    const startedAt = Date.now();

    try {
      const entry = this.states.get(version);
      if (!entry || entry.status !== 'pulling') return;

      if (await this.isUpgradeRunning()) {
        this.states.delete(version);
        this.logger.debug(
          `[预拉取] 升级进行中，跳过 ${version}（触发源: ${reason}）`,
        );
        return;
      }

      if (!(await this.portainerService.isEnabled())) {
        this.states.delete(version);
        this.logger.debug(`[预拉取] Portainer 未启用，跳过 ${version}`);
        return;
      }

      const local = await this.portainerService.areOaImagesPresent(version);
      if (local.queryOk && local.present) {
        this.markReady(version, `${local.message}（无需拉取）`, startedAt);
        return;
      }

      const pull = await this.portainerService.pullOaImagesDetailed(version);
      if (pull.allReady) {
        this.markReady(version, pull.message, startedAt);
        return;
      }

      // 未能确认（超时/网络）时再查一次本机：拉取有可能仍在 daemon 侧继续完成
      const recheck = await this.portainerService.areOaImagesPresent(version);
      if (recheck.queryOk && recheck.present) {
        this.markReady(version, `${recheck.message}（无需拉取）`, startedAt);
        return;
      }

      this.markFailed(
        version,
        `预拉取未完成：${pull.message || local.message}`,
        startedAt,
      );
    } catch (error) {
      this.markFailed(
        version,
        `预拉取异常：${this.errorMessage(error)}`,
        startedAt,
      );
    }
  }

  private markReady(version: string, message: string, startedAt: number): void {
    const durationMs = Date.now() - startedAt;
    const previous = this.states.get(version);
    this.states.set(version, {
      status: 'ready',
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      message,
      attempts: previous?.attempts ?? 1,
      durationMs,
    });
    this.logger.log(`[预拉取] 就绪: ${version}（${durationMs}ms）— ${message}`);
  }

  private markFailed(
    version: string,
    message: string,
    startedAt: number,
  ): void {
    const durationMs = Date.now() - startedAt;
    const previous = this.states.get(version);
    this.states.set(version, {
      status: 'failed',
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      message,
      attempts: previous?.attempts ?? 1,
      durationMs,
    });
    // 静默失败：只 warn，不抛出、不改变升级流程
    this.logger.warn(
      `[预拉取] 失败: ${version}（${durationMs}ms）— ${message}`,
    );
  }

  /** 升级进行中则不做预拉取（避免与 Portainer 的重建/拉取相互干扰） */
  private async isUpgradeRunning(): Promise<boolean> {
    try {
      const lock = await this.redisService.get(this.UPGRADE_LOCK_KEY);
      return !!lock;
    } catch (error) {
      // Redis 异常时按"未在升级"处理：预拉取本身是只读加镜像，风险可控
      this.logger.debug(`[预拉取] 读取升级锁失败: ${this.errorMessage(error)}`);
      return false;
    }
  }

  private errorMessage(error: unknown): string {
    return (error as Error)?.message || String(error);
  }
}
