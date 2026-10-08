import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

export interface UpgradeConfig {
  githubOwner: string;
  githubRepo: string;
  githubToken: string;
  dockerImagePrefix: string;
  portainerEnabled: boolean;
  portainerUrl: string;
  portainerApiKey: string;
  portainerStackId: number;
  portainerEndpointId: number;
}

const DEFAULT_CONFIG: UpgradeConfig = {
  githubOwner: '',
  githubRepo: '',
  githubToken: '',
  dockerImagePrefix: '',
  portainerEnabled: false,
  portainerUrl: '',
  portainerApiKey: '',
  portainerStackId: 0,
  portainerEndpointId: 0,
};

@Injectable()
export class UpgradeConfigService implements OnModuleInit {
  private readonly logger = new Logger(UpgradeConfigService.name);
  private readonly CONFIG_KEY = 'upgrade_service_config';
  private cachedConfig: UpgradeConfig | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<UpgradeConfig> {
    try {
      const record = await this.prisma.systemConfig.findUnique({
        where: { key: this.CONFIG_KEY },
      });

      if (record) {
        this.cachedConfig = JSON.parse(record.value) as UpgradeConfig;
        this.logger.log('升级配置已从数据库加载');
      } else {
        this.cachedConfig = this.getConfigFromEnv();
        await this.saveConfig(this.cachedConfig);
        this.logger.log('升级配置已从环境变量初始化');
      }

      return this.cachedConfig;
    } catch (error) {
      this.logger.error(`加载升级配置失败: ${error.message}`);
      this.cachedConfig = DEFAULT_CONFIG;
      return this.cachedConfig;
    }
  }

  private getConfigFromEnv(): UpgradeConfig {
    return {
      githubOwner: process.env.GITHUB_OWNER || '',
      githubRepo: process.env.GITHUB_REPO || '',
      githubToken: process.env.GITHUB_TOKEN || '',
      dockerImagePrefix: process.env.DOCKER_IMAGE_PREFIX || '',
      portainerEnabled: !!process.env.PORTAINER_URL,
      portainerUrl: process.env.PORTAINER_URL || '',
      portainerApiKey: process.env.PORTAINER_API_KEY || '',
      portainerStackId: parseInt(process.env.PORTAINER_STACK_ID || '0', 10),
      portainerEndpointId: parseInt(process.env.PORTAINER_ENDPOINT_ID || '0', 10),
    };
  }

  async getConfig(): Promise<UpgradeConfig> {
    if (!this.cachedConfig) {
      await this.loadConfig();
    }
    return this.cachedConfig || DEFAULT_CONFIG;
  }

  async saveConfig(config: UpgradeConfig): Promise<void> {
    try {
      const value = JSON.stringify(config);
      const existing = await this.prisma.systemConfig.findUnique({
        where: { key: this.CONFIG_KEY },
      });

      if (existing) {
        await this.prisma.systemConfig.update({
          where: { key: this.CONFIG_KEY },
          data: { value, updatedAt: new Date() },
        });
      } else {
        await this.prisma.systemConfig.create({
          data: {
            key: this.CONFIG_KEY,
            value,
            group: 'upgrade',
            description: '在线升级服务配置',
          },
        });
      }

      this.cachedConfig = config;
      this.logger.log('升级配置已保存');
    } catch (error) {
      this.logger.error(`保存升级配置失败: ${error.message}`);
      throw error;
    }
  }

  async updateConfig(partialConfig: Partial<UpgradeConfig>): Promise<UpgradeConfig> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...partialConfig };
    await this.saveConfig(newConfig);
    return newConfig;
  }

  async refreshCache(): Promise<UpgradeConfig> {
    this.cachedConfig = null;
    return await this.loadConfig();
  }

  async isConfigComplete(): Promise<{
    complete: boolean;
    missing: string[];
  }> {
    const config = await this.getConfig();
    const missing: string[] = [];

    if (!config.githubOwner) missing.push('GitHub 仓库所有者');
    if (!config.githubRepo) missing.push('GitHub 仓库名称');
    if (!config.dockerImagePrefix) missing.push('Docker 镜像前缀');

    if (config.portainerEnabled) {
      if (!config.portainerUrl) missing.push('Portainer URL');
      if (!config.portainerApiKey) missing.push('Portainer API Token');
      if (!config.portainerStackId) missing.push('Portainer 堆栈 ID');
      if (!config.portainerEndpointId) missing.push('Portainer 端点 ID');
    }

    return { complete: missing.length === 0, missing };
  }

  async getConfigStatus(): Promise<{
    configured: boolean;
    portainerEnabled: boolean;
    githubConfigured: boolean;
    dockerConfigured: boolean;
  }> {
    const config = await this.getConfig();
    return {
      configured: !!(config.githubOwner && config.githubRepo && config.dockerImagePrefix),
      portainerEnabled: config.portainerEnabled && !!config.portainerUrl,
      githubConfigured: !!(config.githubOwner && config.githubRepo),
      dockerConfigured: !!config.dockerImagePrefix,
    };
  }
}
