import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { UpgradeConfigService } from './upgrade-config.service';

@Injectable()
export class PortainerService {
  private readonly logger = new Logger(PortainerService.name);
  private client: AxiosInstance | null = null;

  constructor(private readonly configService: UpgradeConfigService) {}

  private async getClient(): Promise<AxiosInstance> {
    const config = await this.configService.getConfig();

    if (!this.client || !config.portainerUrl) {
      this.client = axios.create({
        baseURL: config.portainerUrl,
        timeout: 60000,
        headers: {
          'X-API-Key': config.portainerApiKey,
          'Content-Type': 'application/json',
        },
      });
    }

    return this.client;
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.configService.getConfig();
    return (
      config.portainerEnabled &&
      !!config.portainerUrl &&
      !!config.portainerApiKey &&
      !!config.portainerStackId &&
      !!config.portainerEndpointId
    );
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    stackInfo?: any;
  }> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      return { success: false, message: 'Portainer 集成未启用或配置不完整' };
    }

    try {
      const config = await this.configService.getConfig();
      const client = await this.getClient();
      const response = await client.get(`/api/stacks/${config.portainerStackId}`);
      return {
        success: true,
        message: '连接成功',
        stackInfo: {
          id: response.data.Id,
          name: response.data.Name,
          status: response.data.Status,
        },
      };
    } catch (error) {
      this.logger.error(`Portainer 连接测试失败: ${error.message}`);
      return { success: false, message: `连接失败: ${error.message}` };
    }
  }

  async getStackFile(): Promise<string> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('Portainer 集成未启用');
    }

    try {
      const config = await this.configService.getConfig();
      const client = await this.getClient();
      const response = await client.get(`/api/stacks/${config.portainerStackId}/file`);
      return response.data.StackFileContent;
    } catch (error) {
      this.logger.error(`获取堆栈配置失败: ${error.message}`);
      throw new Error(`获取堆栈配置失败: ${error.message}`);
    }
  }

  /**
   * 获取堆栈的环境变量列表
   */
  async getStackEnv(): Promise<Array<{ name: string; value: string }>> {
    const config = await this.configService.getConfig();
    const client = await this.getClient();
    const response = await client.get(`/api/stacks/${config.portainerStackId}`);
    return response.data.Env || [];
  }

  /**
   * 更新堆栈版本并重新部署（fire-and-forget 模式）
   * 
   * 重要：Portainer 重新部署堆栈时会重启后端容器自身，
   * 所以不能 await PUT 请求的响应——后端进程会在响应返回前被杀掉。
   * 策略：发送请求后立即返回，不等待 Portainer 的响应。
   */
  async updateStackVersion(
    newVersion: string,
    pullImage: boolean = true,
  ): Promise<{ success: boolean; message: string }> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('Portainer 集成未启用');
    }

    const config = await this.configService.getConfig();
    const client = await this.getClient();

    // 1. 获取当前堆栈配置文件（不做修改，原样提交）
    this.logger.log(`获取堆栈配置...`);
    const stackFile = await this.getStackFile();

    // 2. 获取当前环境变量并更新 APP_VERSION
    this.logger.log(`获取堆栈环境变量...`);
    const env = await this.getStackEnv();
    const updatedEnv = env.map((e) =>
      e.name === 'APP_VERSION' ? { ...e, value: newVersion } : e,
    );

    // 如果环境变量中没有 APP_VERSION，则添加
    if (!updatedEnv.find((e) => e.name === 'APP_VERSION')) {
      updatedEnv.push({ name: 'APP_VERSION', value: newVersion });
    }

    this.logger.log(`更新 APP_VERSION 环境变量为 ${newVersion}，重新部署堆栈 (pullImage: ${pullImage})...`);

    // 3. Fire-and-forget：发送更新请求后不等待响应
    // 因为 Portainer 会重启后端容器，await 永远不会正常返回
    client.put(
      `/api/stacks/${config.portainerStackId}?endpointId=${config.portainerEndpointId}`,
      {
        stackFileContent: stackFile,
        env: updatedEnv,
        prune: false,
        pullImage: pullImage,
      },
    ).then(() => {
      this.logger.log(`Portainer 堆栈更新请求已被接受，版本: ${newVersion}`);
    }).catch((error) => {
      // 预期会因为容器重启导致连接断开，这不是真正的错误
      this.logger.warn(`Portainer 请求结束（可能因容器重启断开）: ${error.message}`);
    });

    // 给 Portainer 一点时间接收请求
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.log(`堆栈更新请求已发送，服务即将重启，版本: ${newVersion}`);
    return { success: true, message: `堆栈更新请求已发送，服务正在重启中...` };
  }

  /**
   * 从堆栈环境变量中提取当前镜像版本
   */
  async getCurrentImageVersion(): Promise<string | null> {
    try {
      const env = await this.getStackEnv();
      const appVersion = env.find((e) => e.name === 'APP_VERSION');
      return appVersion ? appVersion.value : null;
    } catch (error) {
      this.logger.error(`获取当前镜像版本失败: ${error.message}`);
      return null;
    }
  }

  async getContainers(): Promise<
    Array<{
      id: string;
      name: string;
      image: string;
      state: string;
      status: string;
    }>
  > {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('Portainer 集成未启用');
    }

    try {
      const config = await this.configService.getConfig();
      const client = await this.getClient();
      const response = await client.get(
        `/api/endpoints/${config.portainerEndpointId}/docker/containers/json?all=true`,
      );

      return response.data
        .filter((c: any) => c.Names.some((n: string) => n.includes('bnoa')))
        .map((c: any) => ({
          id: c.Id,
          name: c.Names[0]?.replace(/^\//, '') || '',
          image: c.Image,
          state: c.State,
          status: c.Status,
        }));
    } catch (error) {
      this.logger.error(`获取容器列表失败: ${error.message}`);
      throw new Error(`获取容器列表失败: ${error.message}`);
    }
  }

  /**
   * 获取栈内容器「实际运行」的镜像与版本
   *
   * ⚠️ 与 getStackEnv() 读到的 APP_VERSION（期望值）有本质区别：
   * 这里读的是 Docker 容器**真实使用的镜像 tag**，是判断「升级是否真的生效」的唯一可靠依据。
   *
   * 背景：若 stack compose 里镜像 tag 被硬编码（未使用 ${APP_VERSION} 变量），
   * 更新栈变量后容器仍会以旧镜像重建 —— 只看 APP_VERSION 会得到"已升级"的错误结论。
   */
  async getRunningVersions(): Promise<{
    backendVersion: string | null;
    frontendVersion: string | null;
    versionsConsistent: boolean;
    allHealthy: boolean;
    containers: Array<{
      name: string;
      image: string;
      version: string | null;
      state: string;
      status: string;
      healthy: boolean;
    }>;
  }> {
    const containers = await this.getContainers();

    const parsed = containers.map((c) => {
      // 从 image 引用中解析 tag：形如 miaochi/bnoa-backend:0.5.0 或 name@sha256:...
      const atIdx = c.image.indexOf('@');
      const ref = atIdx >= 0 ? c.image.slice(0, atIdx) : c.image;
      const lastColon = ref.lastIndexOf(':');
      const lastSlash = ref.lastIndexOf('/');
      const version = lastColon > lastSlash ? ref.slice(lastColon + 1) : null;

      // 注意：无 healthcheck 的容器（如 redis）状态里没有 "(healthy)"，
      // 因此以「running 且非 unhealthy」作为健康判据，避免误判。
      const healthy = c.state === 'running' && !/unhealthy/i.test(c.status);

      return {
        name: c.name,
        image: c.image,
        version,
        state: c.state,
        status: c.status,
        healthy,
      };
    });

    const backend = parsed.find((c) => c.name.endsWith('-backend'));
    const frontend = parsed.find((c) => c.name.endsWith('-frontend'));

    return {
      backendVersion: backend?.version ?? null,
      frontendVersion: frontend?.version ?? null,
      versionsConsistent:
        !!backend?.version && backend.version === frontend?.version,
      allHealthy: parsed.length > 0 && parsed.every((c) => c.healthy),
      containers: parsed,
    };
  }

  /**
   * 检查栈 compose 里 OA 镜像是否使用了 ${APP_VERSION} 变量
   *
   * 典型故障：镜像行被写死成 `image: miaochi/bnoa-backend:0.4.0`，
   * 此时更新栈变量 APP_VERSION 毫无作用 —— 重建后仍是旧镜像，且不报任何错。
   * 因此在升级前预检此项，把注定失败的升级挡在动手之前。
   */
  async isStackFileUsingVersionVar(): Promise<{
    ok: boolean;
    hardcoded: string[];
  }> {
    const content = await this.getStackFile();

    const hardcoded = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('image:'))
      // 只关心 OA 自己的镜像（backend / frontend），postgres/redis/clamav 用固定 tag 属正常
      .filter((l) => /bnoa|(?:^|[^a-z])-?(backend|frontend):/.test(l))
      .filter((l) => !l.includes('${'));

    return { ok: hardcoded.length === 0, hardcoded };
  }

  /**
   * 通过 Docker daemon 拉取镜像，用于升级前预检与预拉取。
   *
   * ⚠️ 为什么不由后端直接请求 Docker Hub：
   * 本环境服务器**容器内无法直连** Docker Hub / registry（实测均超时，仅 api.github.com 可达）；
   * daemon 则配置了 4 个镜像加速器（轩辕镜像等），能正常拉取。故**必须借助 daemon**。
   *
   * ⚠️ 本环境的特殊语义（实测确认）：
   * - 镜像**存在**时 → 加速器命中 → 快速返回 `Status: Image is up to date`；
   * - 镜像**不存在**时 → 加速器无缓存 → **回源 Docker Hub → 超时**，
   *   且与"网络故障"表现一致，**无法区分**。
   * 因此这里区分三态，避免把网络抖动误判成"镜像不存在"而拦掉正常升级：
   * - `ready`   镜像已就绪（顺带完成预拉取，升级重建更快）
   * - `missing` **确定**不存在（404 / manifest unknown 等明确信号）→ 调用方应拦截
   * - `unknown` 无法判定（超时、网络错误等）→ 调用方应放行
   */
  async pullImage(
    repo: string,
    tag: string,
  ): Promise<{ status: 'ready' | 'missing' | 'unknown'; message: string }> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('Portainer 集成未启用');
    }

    const config = await this.configService.getConfig();
    const client = await this.getClient();
    const ref = `${repo}:${tag}`;

    try {
      await client.post(
        `/api/endpoints/${config.portainerEndpointId}/docker/images/create`,
        null,
        {
          params: { fromImage: repo, tag },
          // ⚠️ 这里只是"尽力而为"的兜底，不是可靠的整体超时：
          // Docker/Portainer 的拉取接口返回的是**流式响应**（持续吐 JSON 进度行），
          // axios 的 timeout 针对"整个请求"，对"持续有数据到达"的流可能不生效
          // （实测曾有单次拉取 994 秒未触发超时）。
          // 因此拉取耗时的正经解法是"提前异步预拉取"（PrepullService）+ 预检前先查本机镜像，
          // 本处把 300s 收紧到 60s：镜像不在本机时能更快落到 unknown 分支并放行，不再白等。
          timeout: 60000,
        },
      );
      return { status: 'ready', message: `${ref} 已就绪（预拉取完成）` };
    } catch (error) {
      const httpStatus = error.response?.status;
      const detail =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error?.message ||
        error?.code ||
        '未知原因';
      const detailStr = String(detail);

      // 仅"明确不存在"才判定 missing；本环境下不存在通常表现为超时，故不会走到这里，
      // 但保留该分支以兼容加速器直接返回明确 404 / manifest unknown 的情况。
      const explicitlyMissing =
        httpStatus === 404 ||
        /manifest unknown|not found|no such (image|manifest|repository)|不存在/i.test(
          detailStr,
        );

      if (explicitlyMissing) {
        return { status: 'missing', message: `${ref} 不存在（${detailStr}）` };
      }
      return {
        status: 'unknown',
        message: `${ref} 预拉取未完成（${detailStr}）`,
      };
    }
  }

  /**
   * 预拉取 OA 的前后端镜像（backend + frontend），用于升级前预检。
   *
   * 语义：
   * - 任一镜像**确定不存在** → `ok=false`（调用方拦截，避免白等 10 分钟）；
   * - 出现 `unknown`（网络/超时）→ **立即短路并放行**，不再试下一个镜像（避免重复等待）；
   * - 全部 `ready` → `ok=true`，此时镜像已在本地，升级重建更快。
   */
  async pullOaImages(
    version: string,
  ): Promise<{ ok: boolean; message: string }> {
    const { results, allReady } = await this.pullOaImagesDetailed(version);
    const message = results.map((r) => r.message).join('；');

    if (results.some((r) => r.status === 'missing')) {
      return { ok: false, message };
    }
    if (!allReady) {
      // 存在 unknown（未能判定）→ 放行
      return { ok: true, message: `${message}（未能完成校验，按原流程继续）` };
    }
    return { ok: true, message };
  }

  /**
   * 结构化版本的 OA 镜像预拉取（供后台异步预拉取 PrepullService 使用）。
   *
   * 与 pullOaImages 的差异：不把三态压成 ok/message，而是原样返回每个镜像的
   * `ready | missing | unknown`，调用方才能如实记录"预拉取到底成没成"。
   * 短路规则与 pullOaImages 保持一致：任一镜像非 ready 就不再继续拉下一个。
   */
  async pullOaImagesDetailed(version: string): Promise<{
    allReady: boolean;
    results: Array<{
      ref: string;
      status: 'ready' | 'missing' | 'unknown';
      message: string;
    }>;
    message: string;
  }> {
    const config = await this.configService.getConfig();
    const prefix = config.dockerImagePrefix || 'miaochi/bnoa';
    const results: Array<{
      ref: string;
      status: 'ready' | 'missing' | 'unknown';
      message: string;
    }> = [];

    for (const suffix of ['backend', 'frontend']) {
      const repo = `${prefix}-${suffix}`;
      const r = await this.pullImage(repo, version);
      results.push({
        ref: `${repo}:${version}`,
        status: r.status,
        message: r.message,
      });

      if (r.status !== 'ready') {
        break;
      }
    }

    return {
      allReady:
        results.length === 2 && results.every((r) => r.status === 'ready'),
      results,
      message: results.map((r) => r.message).join('；'),
    };
  }

  /**
   * 列出本机 daemon 全部镜像的 RepoTags（已做 registry 前缀归一化）。
   *
   * 接口：`GET /api/endpoints/{endpointId}/docker/images/json`
   * （Portainer 透传 Docker Engine API，返回的是**镜像对象数组**）。
   *
   * 实测确认（2026-10-10，测试机 192.168.2.6 / Endpoint 1，57 个镜像）：
   * 每个元素形如
   *   { Id, ParentId, RepoTags: ["miaochi/bnoa-backend:0.5.8"], RepoDigests, Created, Size, SharedSize, Containers, Labels }
   * 注意 `RepoTags` **可能为 null**（dangling 镜像）、也可能是**多个 tag 的数组**，
   * 所以必须逐个 tag 精确匹配，不能拿字段直接比较。
   */
  private async listImageRepoTags(): Promise<string[]> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('Portainer 集成未启用');
    }

    const config = await this.configService.getConfig();
    const client = await this.getClient();
    const response = await client.get(
      `/api/endpoints/${config.portainerEndpointId}/docker/images/json`,
    );

    const images: any[] = Array.isArray(response.data) ? response.data : [];
    const tags: string[] = [];
    for (const image of images) {
      const repoTags = image?.RepoTags;
      if (!Array.isArray(repoTags)) continue;
      for (const t of repoTags) {
        if (typeof t === 'string' && t) tags.push(this.normalizeImageRef(t));
      }
    }
    return tags;
  }

  /**
   * 归一化镜像引用，避免同一镜像因 registry 前缀写法不同而漏判：
   * `docker.io/miaochi/bnoa-backend:0.5.8` 与 `miaochi/bnoa-backend:0.5.8` 视为同一引用。
   */
  private normalizeImageRef(ref: string): string {
    return String(ref || '')
      .trim()
      .replace(
        /^(?:docker\.io|index\.docker\.io|registry-1\.docker\.io)\//,
        '',
      );
  }

  /**
   * 本机 daemon 是否已有指定镜像（`repo:tag` 精确匹配 RepoTags）。
   *
   * ⚠️ 这是**只读查询**；查询失败会抛出异常，调用方必须捕获并**回退到直接拉取**的
   * 旧行为 —— 绝不能因为"查不到"就跳过镜像校验。
   */
  async isImagePresent(repo: string, tag: string): Promise<boolean> {
    const tags = await this.listImageRepoTags();
    return tags.includes(this.normalizeImageRef(`${repo}:${tag}`));
  }

  /**
   * 查询 OA 前后端镜像是否**都**已在本机（预检/预拉取用，**不抛异常**）。
   *
   * 返回 `queryOk=false` 表示"查询本身失败"（网络/接口异常/未启用），
   * 调用方据此回退到原来的 `pullOaImages` 行为。
   */
  async areOaImagesPresent(version: string): Promise<{
    queryOk: boolean;
    present: boolean;
    missing: string[];
    message: string;
  }> {
    const config = await this.configService.getConfig();
    const prefix = config.dockerImagePrefix || 'miaochi/bnoa';
    const refs = ['backend', 'frontend'].map(
      (s) => `${prefix}-${s}:${version}`,
    );

    try {
      const tags = await this.listImageRepoTags();
      const missing = refs.filter(
        (ref) => !tags.includes(this.normalizeImageRef(ref)),
      );

      return {
        queryOk: true,
        present: missing.length === 0,
        missing,
        message:
          missing.length === 0
            ? `${refs.join('、')} 已在本机`
            : `本机缺少镜像：${missing.join('、')}`,
      };
    } catch (error) {
      this.logger.warn(`查询本机镜像列表失败: ${error.message}`);
      return {
        queryOk: false,
        present: false,
        missing: refs,
        message: `查询本机镜像失败：${error.message}`,
      };
    }
  }

  resetClient(): void {
    this.client = null;
  }
}
