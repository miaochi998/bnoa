import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BackupConfigDto } from './dto/backup.dto';

export interface BackupConfig {
  enabled: boolean;
  scheduleCron: string;
  retentionDays: number;
  storageType: 'LOCAL' | 'RUSTFS';
  localPath: string;
  rustfsBucket: string;
  rustfsPrefix: string;
  includeDatabase: boolean;
  includeFiles: boolean;
  /** 实际使用的 RUSTFS 桶名（来自文件存储设置，只读） */
  effectiveRustfsBucket?: string;
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: false,
  scheduleCron: '0 2 * * *',
  retentionDays: 7,
  storageType: 'RUSTFS',
  localPath: 'backups',
  rustfsBucket: 'bnoa-backups',
  rustfsPrefix: 'backups/',
  includeDatabase: true,
  includeFiles: false,
};

const CONFIG_KEYS = {
  enabled: 'backup.enabled',
  scheduleCron: 'backup.scheduleCron',
  retentionDays: 'backup.retentionDays',
  storageType: 'backup.storageType',
  localPath: 'backup.localPath',
  rustfsBucket: 'backup.rustfsBucket',
  rustfsPrefix: 'backup.rustfsPrefix',
  includeDatabase: 'backup.includeDatabase',
  includeFiles: 'backup.includeFiles',
};

@Injectable()
export class BackupConfigService implements OnModuleInit {
  private readonly logger = new Logger(BackupConfigService.name);
  private cachedConfig: BackupConfig | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /** 旧版默认值（用于迁移到新默认：RUSTFS + 仅数据库） */
  private static readonly OLD_DEFAULT_STORAGE = 'LOCAL';
  private static readonly OLD_DEFAULT_INCLUDE_FILES = true;

  async onModuleInit() {
    await this.loadConfig();
    await this.migrateDefaultsIfNeeded();
  }

  /**
   * 若当前配置仍是旧默认（本地存储 + 勾选上传文件），则迁移为新默认（RustFS + 仅数据库）
   */
  private async migrateDefaultsIfNeeded(): Promise<void> {
    if (!this.cachedConfig) return;
    const c = this.cachedConfig;
    const isOldDefault =
      c.storageType === BackupConfigService.OLD_DEFAULT_STORAGE &&
      c.includeFiles === BackupConfigService.OLD_DEFAULT_INCLUDE_FILES;
    if (!isOldDefault) return;
    try {
      await this.prisma.systemConfig.upsert({
        where: { key: CONFIG_KEYS.storageType },
        update: { value: DEFAULT_CONFIG.storageType, updatedAt: new Date() },
        create: { key: CONFIG_KEYS.storageType, value: DEFAULT_CONFIG.storageType, group: 'backup', description: '默认存储类型' },
      });
      await this.prisma.systemConfig.upsert({
        where: { key: CONFIG_KEYS.includeFiles },
        update: { value: String(DEFAULT_CONFIG.includeFiles), updatedAt: new Date() },
        create: { key: CONFIG_KEYS.includeFiles, value: String(DEFAULT_CONFIG.includeFiles), group: 'backup', description: '是否包含上传文件' },
      });
      this.cachedConfig = { ...this.cachedConfig, storageType: DEFAULT_CONFIG.storageType, includeFiles: DEFAULT_CONFIG.includeFiles };
      this.logger.log('备份配置已从旧默认迁移为新默认（RUSTFS、仅数据库）');
    } catch (e) {
      this.logger.warn(`备份默认值迁移跳过: ${e?.message}`);
    }
  }

  private async loadConfig(): Promise<BackupConfig> {
    try {
      const configs = await this.prisma.systemConfig.findMany({
        where: { group: 'backup' },
      });

      if (configs.length === 0) {
        await this.initDefaultConfig();
        this.cachedConfig = DEFAULT_CONFIG;
        this.logger.log('备份配置已使用默认配置初始化');
        return this.cachedConfig;
      }

      this.cachedConfig = this.parseConfig(configs);
      this.logger.log('备份配置已从数据库加载');
      return this.cachedConfig;
    } catch (error) {
      this.logger.error(`加载备份配置失败: ${error.message}`);
      this.cachedConfig = DEFAULT_CONFIG;
      return this.cachedConfig;
    }
  }

  private async initDefaultConfig(): Promise<void> {
    const configs = [
      { key: CONFIG_KEYS.enabled, value: String(DEFAULT_CONFIG.enabled), group: 'backup', description: '是否启用备份功能' },
      { key: CONFIG_KEYS.scheduleCron, value: DEFAULT_CONFIG.scheduleCron, group: 'backup', description: '定时备份 cron 表达式' },
      { key: CONFIG_KEYS.retentionDays, value: String(DEFAULT_CONFIG.retentionDays), group: 'backup', description: '保留天数' },
      { key: CONFIG_KEYS.storageType, value: DEFAULT_CONFIG.storageType, group: 'backup', description: '默认存储类型' },
      { key: CONFIG_KEYS.localPath, value: DEFAULT_CONFIG.localPath, group: 'backup', description: '本地上传根目录相对路径' },
      { key: CONFIG_KEYS.rustfsBucket, value: DEFAULT_CONFIG.rustfsBucket, group: 'backup', description: 'RustFS 桶名' },
      { key: CONFIG_KEYS.rustfsPrefix, value: DEFAULT_CONFIG.rustfsPrefix, group: 'backup', description: 'RustFS 路径前缀' },
      { key: CONFIG_KEYS.includeDatabase, value: String(DEFAULT_CONFIG.includeDatabase), group: 'backup', description: '是否包含数据库' },
      { key: CONFIG_KEYS.includeFiles, value: String(DEFAULT_CONFIG.includeFiles), group: 'backup', description: '是否包含上传文件' },
    ];

    await this.prisma.systemConfig.createMany({ data: configs });
  }

  private parseConfig(configs: { key: string; value: string }[]): BackupConfig {
    const configMap = new Map(configs.map(c => [c.key, c.value]));

    return {
      enabled: configMap.get(CONFIG_KEYS.enabled) === 'true',
      scheduleCron: configMap.get(CONFIG_KEYS.scheduleCron) || DEFAULT_CONFIG.scheduleCron,
      retentionDays: parseInt(configMap.get(CONFIG_KEYS.retentionDays) || String(DEFAULT_CONFIG.retentionDays), 10),
      storageType: (configMap.get(CONFIG_KEYS.storageType) as 'LOCAL' | 'RUSTFS') || DEFAULT_CONFIG.storageType,
      localPath: configMap.get(CONFIG_KEYS.localPath) || DEFAULT_CONFIG.localPath,
      rustfsBucket: configMap.get(CONFIG_KEYS.rustfsBucket) || DEFAULT_CONFIG.rustfsBucket,
      rustfsPrefix: configMap.get(CONFIG_KEYS.rustfsPrefix) || DEFAULT_CONFIG.rustfsPrefix,
      includeDatabase: configMap.get(CONFIG_KEYS.includeDatabase) !== 'false',
      includeFiles: configMap.get(CONFIG_KEYS.includeFiles) !== 'false',
    };
  }

  async getConfig(): Promise<BackupConfig> {
    if (!this.cachedConfig) {
      await this.loadConfig();
    }
    const base = this.cachedConfig || DEFAULT_CONFIG;
    return {
      ...base,
      effectiveRustfsBucket: this.storageService.getBucketName(),
    };
  }

  async saveConfig(dto: BackupConfigDto): Promise<BackupConfig> {
    const configs = [
      { key: CONFIG_KEYS.enabled, value: String(dto.enabled), group: 'backup' },
      { key: CONFIG_KEYS.scheduleCron, value: dto.scheduleCron, group: 'backup' },
      { key: CONFIG_KEYS.retentionDays, value: String(dto.retentionDays), group: 'backup' },
      { key: CONFIG_KEYS.storageType, value: dto.storageType, group: 'backup' },
      { key: CONFIG_KEYS.localPath, value: dto.localPath || DEFAULT_CONFIG.localPath, group: 'backup' },
      { key: CONFIG_KEYS.rustfsBucket, value: dto.rustfsBucket || DEFAULT_CONFIG.rustfsBucket, group: 'backup' },
      { key: CONFIG_KEYS.rustfsPrefix, value: dto.rustfsPrefix || DEFAULT_CONFIG.rustfsPrefix, group: 'backup' },
      { key: CONFIG_KEYS.includeDatabase, value: String(dto.includeDatabase), group: 'backup' },
      { key: CONFIG_KEYS.includeFiles, value: String(dto.includeFiles), group: 'backup' },
    ];

    for (const config of configs) {
      await this.prisma.systemConfig.upsert({
        where: { key: config.key },
        update: { value: config.value, updatedAt: new Date() },
        create: config,
      });
    }

    this.cachedConfig = {
      enabled: dto.enabled,
      scheduleCron: dto.scheduleCron,
      retentionDays: dto.retentionDays,
      storageType: dto.storageType,
      localPath: dto.localPath || DEFAULT_CONFIG.localPath,
      rustfsBucket: dto.rustfsBucket || DEFAULT_CONFIG.rustfsBucket,
      rustfsPrefix: dto.rustfsPrefix || DEFAULT_CONFIG.rustfsPrefix,
      includeDatabase: dto.includeDatabase,
      includeFiles: dto.includeFiles,
    };

    this.logger.log('备份配置已保存');
    return this.cachedConfig;
  }
}
