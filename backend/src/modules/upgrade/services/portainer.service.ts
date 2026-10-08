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

  resetClient(): void {
    this.client = null;
  }
}
