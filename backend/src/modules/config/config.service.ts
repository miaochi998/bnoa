import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateConfigDto,
  UpdateConfigDto,
  QueryConfigDto,
  BatchUpdateConfigDto,
  ConfigInfo,
  ConfigCategory,
  ConfigStatus,
  ConfigType,
  PaginationMeta,
} from './dto/config.dto';

/**
 * Prisma 配置类型
 */
interface PrismaConfig {
  id: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
  category: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * 系统配置服务
 * 提供系统配置的增删改查和缓存功能
 */
@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  private readonly configCache: Map<string, any> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  // ==================== 配置 CRUD ====================

  /**
   * 创建配置
   * @param dto 创建配置DTO
   * @param userId 操作人ID
   * @returns 配置信息
   */
  async createConfig(
    dto: CreateConfigDto,
    userId: string,
  ): Promise<ConfigInfo> {
    // 检查配置键是否已存在
    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: dto.key,
        deletedAt: null,
      },
    });

    if (existingConfig) {
      throw new ConflictException(`配置键 ${dto.key} 已存在`);
    }

    try {
      const config = await this.prisma.config.create({
        data: {
          key: dto.key,
          value: dto.value,
          type: dto.type,
          description: dto.description,
          category: dto.category,
          sortOrder: dto.sortOrder || 0,
          isActive: true,
          createdBy: userId,
        },
      });

      // 更新缓存
      this.updateCache(config.key, this.parseValue(config.value, config.type));

      this.logger.log(`配置创建成功: ${config.key}`);

      return this.toConfigInfo(config);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`创建配置失败: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * 更新配置
   * @param id 配置ID
   * @param dto 更新配置DTO
   * @param _userId 操作人ID
   * @returns 配置信息
   */
  async updateConfig(
    id: string,
    dto: UpdateConfigDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<ConfigInfo> {
    const config = await this.prisma.config.findFirst({
      where: { id, deletedAt: null },
    });

    if (!config) {
      throw new NotFoundException('配置不存在');
    }

    // 系统配置允许修改值，但不允许删除
    // 注释掉此限制，允许管理员通过系统设置修改存储配置等系统配置
    // if (config.isSystem && dto.value !== undefined) {
    //   throw new BadRequestException('系统配置不允许修改');
    // }

    try {
      const updatedConfig = await this.prisma.config.update({
        where: { id },
        data: {
          value: dto.value,
          description: dto.description,
          sortOrder: dto.sortOrder,
          isActive:
            dto.status === ConfigStatus.ACTIVE
              ? true
              : dto.status === ConfigStatus.INACTIVE
                ? false
                : undefined,
        },
      });

      // 更新缓存
      if (dto.value !== undefined) {
        this.updateCache(
          updatedConfig.key,
          this.parseValue(updatedConfig.value, updatedConfig.type),
        );
      }

      this.logger.log(`配置更新成功: ${updatedConfig.key}`);

      return this.toConfigInfo(updatedConfig);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`更新配置失败: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * 删除配置
   * @param id 配置ID
   * @param _userId 操作人ID
   */
  async deleteConfig(
    id: string, // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<void> {
    const config = await this.prisma.config.findFirst({
      where: { id, deletedAt: null },
    });

    if (!config) {
      throw new NotFoundException('配置不存在');
    }

    // 系统配置不允许删除
    if (config.isSystem) {
      throw new BadRequestException('系统配置不允许删除');
    }

    await this.prisma.config.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    // 清除缓存
    this.configCache.delete(config.key);

    this.logger.log(`配置删除成功: ${config.key}`);
  }

  /**
   * 获取配置详情
   * @param id 配置ID
   * @returns 配置信息
   */
  async getConfigById(id: string): Promise<ConfigInfo> {
    const config = await this.prisma.config.findFirst({
      where: { id, deletedAt: null },
    });

    if (!config) {
      throw new NotFoundException('配置不存在');
    }

    return this.toConfigInfo(config);
  }

  /**
   * 根据键获取配置
   * @param key 配置键
   * @returns 配置信息
   */
  async getConfigByKey(key: string): Promise<ConfigInfo | null> {
    const config = await this.prisma.config.findFirst({
      where: { key, deletedAt: null, isActive: true },
    });

    return config ? this.toConfigInfo(config) : null;
  }

  /**
   * 按 key 设置配置值（不存在则创建，存在则更新）
   * @param key 配置键
   * @param value 配置值
   * @param userId 操作人ID
   */
  async setConfigByKey(key: string, value: string, userId: string): Promise<void> {
    const existing = await this.prisma.config.findFirst({
      where: { key, deletedAt: null },
    });

    if (existing) {
      await this.prisma.config.update({
        where: { id: existing.id },
        data: { value },
      });
    } else {
      // 从 key 推断 category，如 "storage.s3Endpoint" -> "storage"
      const category = key.includes('.') ? key.split('.')[0] : 'general';
      await this.prisma.config.create({
        data: {
          key,
          value,
          type: ConfigType.STRING,
          description: key,
          category,
          sortOrder: 0,
          isActive: true,
          isSystem: true,
          createdBy: userId,
        },
      });
    }

    // 更新缓存
    this.updateCache(key, value);
  }

  /**
   * 查询配置列表
   * @param query 查询条件
   * @returns 配置列表和分页信息
   */
  async findConfigs(
    query: QueryConfigDto,
  ): Promise<{ items: ConfigInfo[]; meta: PaginationMeta }> {
    const { keyword, category, status, page = 1, pageSize = 20 } = query;

    const where: any = {
      deletedAt: null,
    };

    if (keyword) {
      where.OR = [
        { key: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.isActive = status === ConfigStatus.ACTIVE;
    }

    const [configs, total] = await Promise.all([
      this.prisma.config.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      }),

      this.prisma.config.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: configs.map((config) => this.toConfigInfo(config)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * 获取所有配置（用于缓存初始化）
   * @returns 配置列表
   */
  async findAllConfigs(): Promise<ConfigInfo[]> {
    const configs = await this.prisma.config.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    return configs.map((config) => this.toConfigInfo(config));
  }

  // ==================== 批量操作 ====================

  /**
   * 批量更新配置
   * @param dto 批量更新DTO
   * @param _userId 操作人ID
   */
  async batchUpdateConfigs(
    dto: BatchUpdateConfigDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.configs) {
        const config = await tx.config.findFirst({
          where: { key: item.key, deletedAt: null },
        });

        if (config) {
          await tx.config.update({
            where: { id: config.id },
            data: {
              value: item.value,
            },
          });

          // 更新缓存
          this.updateCache(
            config.key,
            this.parseValue(item.value, config.type),
          );
        }
      }
    });

    this.logger.log(`批量更新配置完成，共 ${dto.configs.length} 项`);
  }

  // ==================== 配置分组 ====================

  /**
   * 获取配置分组列表
   * @returns 分组列表
   */
  async getCategories(): Promise<ConfigCategory[]> {
    const configs = await this.prisma.config.findMany({
      where: { deletedAt: null },
      select: { category: true },
      distinct: ['category'],
    });

    const categories: ConfigCategory[] = [];

    for (const config of configs) {
      const count = await this.prisma.config.count({
        where: { category: config.category, deletedAt: null },
      });

      categories.push({
        name: config.category,
        label: this.getCategoryLabel(config.category),
        count,
      });
    }

    return categories;
  }

  /**
   * 根据分组获取配置
   * @param category 分组名称
   * @returns 配置列表
   */
  async getConfigsByCategory(category: string): Promise<ConfigInfo[]> {
    const configs = await this.prisma.config.findMany({
      where: { category, deletedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return configs.map((config) => this.toConfigInfo(config));
  }

  // ==================== 配置值获取（带缓存）====================

  /**
   * 获取配置值（带缓存）
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 配置值
   */
  async getValue<T>(key: string, defaultValue?: T): Promise<T> {
    // 先检查缓存
    if (this.configCache.has(key)) {
      return this.configCache.get(key) as T;
    }

    // 从数据库获取
    const config = await this.prisma.config.findFirst({
      where: { key, deletedAt: null, isActive: true },
    });

    if (!config) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new NotFoundException(`配置 ${key} 不存在`);
    }

    const value = this.parseValue(config.value, config.type);
    this.updateCache(key, value);

    return value as T;
  }

  /**
   * 获取字符串配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 字符串值
   */
  async getString(key: string, defaultValue?: string): Promise<string> {
    return this.getValue<string>(key, defaultValue);
  }

  /**
   * 获取数字配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 数字值
   */
  async getNumber(key: string, defaultValue?: number): Promise<number> {
    return this.getValue<number>(key, defaultValue);
  }

  /**
   * 获取布尔配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 布尔值
   */
  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean> {
    return this.getValue<boolean>(key, defaultValue);
  }

  /**
   * 获取 JSON 配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns JSON 对象
   */
  async getJSON<T>(key: string, defaultValue?: T): Promise<T> {
    return this.getValue<T>(key, defaultValue);
  }

  /**
   * 初始化配置缓存
   */
  async initCache(): Promise<void> {
    const configs = await this.findAllConfigs();

    for (const config of configs) {
      this.updateCache(config.key, this.parseValue(config.value, config.type));
    }

    this.logger.log(`配置缓存初始化完成，共 ${configs.length} 项`);
  }

  /**
   * 清除配置缓存
   */
  clearCache(): void {
    this.configCache.clear();
    this.logger.log('配置缓存已清除');
  }

  /**
   * 刷新配置缓存
   */
  async refreshCache(): Promise<void> {
    this.clearCache();
    await this.initCache();
  }

  // ==================== 私有方法 ====================

  private toConfigInfo(config: PrismaConfig): ConfigInfo {
    return {
      id: config.id,
      key: config.key,
      value: config.value,
      type: config.type as ConfigType,
      description: config.description ?? undefined,
      category: config.category,
      sortOrder: config.sortOrder,
      status: config.isActive ? ConfigStatus.ACTIVE : ConfigStatus.INACTIVE,
      isSystem: config.isSystem,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private parseValue(value: string, type: string): any {
    switch (type) {
      case ConfigType.NUMBER:
        return Number(value);

      case ConfigType.BOOLEAN:
        return value === 'true' || value === '1';

      case ConfigType.JSON:
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }

      case ConfigType.STRING:
      default:
        return value;
    }
  }

  private updateCache(key: string, value: any): void {
    this.configCache.set(key, value);
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      site: '站点配置',
      email: '邮件配置',
      storage: '存储配置',
      security: '安全配置',
      system: '系统配置',
    };

    return labels[category] || category;
  }

  // ==================== 缩略图配置 ====================

  /**
   * 缩略图配置键
   */
  private readonly THUMBNAIL_CONFIG_KEY = 'thumbnail_settings';

  /**
   * 默认缩略图配置
   */
  private readonly DEFAULT_THUMBNAIL_CONFIG = {
    width: 200,
    height: 200,
    quality: 80,
  };

  /**
   * 获取缩略图配置
   * @returns 缩略图配置
   */
  async getThumbnailConfig(): Promise<{ width: number; height: number; quality: number }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.THUMBNAIL_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_THUMBNAIL_CONFIG;
        }
      }

      return this.DEFAULT_THUMBNAIL_CONFIG;
    } catch (error) {
      this.logger.warn('获取缩略图配置失败，使用默认配置');
      return this.DEFAULT_THUMBNAIL_CONFIG;
    }
  }

  /**
   * 保存缩略图配置
   * @param config 缩略图配置
   * @param userId 操作人ID
   */
  async saveThumbnailConfig(
    config: { width: number; height: number; quality: number },
    userId: string,
  ): Promise<void> {
    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.THUMBNAIL_CONFIG_KEY,
        deletedAt: null,
      },
    });

    const value = JSON.stringify(config);

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value },
      });
      this.logger.log(`缩略图配置更新成功`);
    } else {
      await this.prisma.config.create({
        data: {
          key: this.THUMBNAIL_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '缩略图生成配置（宽度、高度、质量）',
          category: 'storage',
          sortOrder: 100,
          isActive: true,
          isSystem: true,
          createdBy: userId,
        },
      });
      this.logger.log(`缩略图配置创建成功`);
    }

    // 更新缓存
    this.updateCache(this.THUMBNAIL_CONFIG_KEY, config);
  }

  // ==================== 图片压缩配置 ====================

  private readonly COMPRESSION_CONFIG_KEY = 'compression_settings';
  private readonly DEFAULT_COMPRESSION_CONFIG = {
    quality: 60,
    maxWidth: 1920,
    maxHeight: 1080,
    threshold: 2.5, // MB
  };

  /**
   * 获取图片压缩配置
   * @returns 图片压缩配置
   */
  async getCompressionConfig(): Promise<{
    quality: number;
    maxWidth: number;
    maxHeight: number;
    threshold: number;
  }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.COMPRESSION_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_COMPRESSION_CONFIG;
        }
      }

      return this.DEFAULT_COMPRESSION_CONFIG;
    } catch (error) {
      this.logger.warn('获取图片压缩配置失败，使用默认配置');
      return this.DEFAULT_COMPRESSION_CONFIG;
    }
  }

  /**
   * 保存图片压缩配置
   * @param config 图片压缩配置
   * @param userId 操作人ID
   */
  async saveCompressionConfig(
    config: {
      quality: number;
      maxWidth: number;
      maxHeight: number;
      threshold: number;
    },
    userId: string,
  ): Promise<void> {
    // 验证参数范围
    if (config.quality < 10 || config.quality > 100) {
      throw new BadRequestException('压缩质量必须在10-100之间');
    }
    if (config.maxWidth < 100 || config.maxWidth > 10000) {
      throw new BadRequestException('最大宽度必须在100-10000之间');
    }
    if (config.maxHeight < 100 || config.maxHeight > 10000) {
      throw new BadRequestException('最大高度必须在100-10000之间');
    }
    if (config.threshold < 0 || config.threshold > 500) {
      throw new BadRequestException('压缩阈值必须在0-500MB之间');
    }

    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.COMPRESSION_CONFIG_KEY,
        deletedAt: null,
      },
    });

    const value = JSON.stringify(config);

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value },
      });
      this.logger.log(`图片压缩配置更新成功`);
    } else {
      await this.prisma.config.create({
        data: {
          key: this.COMPRESSION_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '图片压缩配置（质量、最大尺寸、阈值）',
          category: 'storage',
          sortOrder: 90,
          isActive: true,
          isSystem: true,
          createdBy: userId,
        },
      });
      this.logger.log(`图片压缩配置创建成功`);
    }

    // 更新缓存
    this.updateCache(this.COMPRESSION_CONFIG_KEY, config);
  }

  // ==================== 上传配置 ====================

  private readonly UPLOAD_CONFIG_KEY = 'upload_settings';
  private readonly DEFAULT_UPLOAD_CONFIG = {
    maxConcurrentUploads: 3,
  };

  /**
   * 获取上传配置
   * @returns 上传配置
   */
  async getUploadConfig(): Promise<{ maxConcurrentUploads: number }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.UPLOAD_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_UPLOAD_CONFIG;
        }
      }

      return this.DEFAULT_UPLOAD_CONFIG;
    } catch (error) {
      this.logger.warn('获取上传配置失败，使用默认配置');
      return this.DEFAULT_UPLOAD_CONFIG;
    }
  }

  /**
   * 保存上传配置
   * @param config 上传配置
   * @param userId 操作人ID
   */
  async saveUploadConfig(
    config: { maxConcurrentUploads: number },
    userId: string,
  ): Promise<void> {
    // 验证并行上传数量范围
    if (config.maxConcurrentUploads < 1 || config.maxConcurrentUploads > 10) {
      throw new BadRequestException('并行上传数量必须在1-10之间');
    }

    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.UPLOAD_CONFIG_KEY,
        deletedAt: null,
      },
    });

    const value = JSON.stringify(config);

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value },
      });
      this.logger.log(`上传配置更新成功: maxConcurrentUploads=${config.maxConcurrentUploads}`);
    } else {
      await this.prisma.config.create({
        data: {
          key: this.UPLOAD_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '上传配置（并行上传数量等）',
          category: 'storage',
          sortOrder: 110,
          isActive: true,
          isSystem: true,
          createdBy: userId,
        },
      });
      this.logger.log(`上传配置创建成功: maxConcurrentUploads=${config.maxConcurrentUploads}`);
    }

    // 更新缓存
    this.updateCache(this.UPLOAD_CONFIG_KEY, config);
  }

  // ==================== 编辑器图片配置 ====================

  private readonly EDITOR_IMAGE_CONFIG_KEY = 'editor_image_settings';
  private readonly DEFAULT_EDITOR_IMAGE_CONFIG = {
    maxWidth: 1920,
    maxHeight: 1080,
    maxSize: 20,
    formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    thumbnailWidth: 480,
    thumbnailHeight: 360,
  };

  /**
   * 获取编辑器图片配置
   */
  async getEditorImageConfig(): Promise<{
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    thumbnailWidth: number;
    thumbnailHeight: number;
  }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.EDITOR_IMAGE_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_EDITOR_IMAGE_CONFIG;
        }
      }

      return this.DEFAULT_EDITOR_IMAGE_CONFIG;
    } catch (error) {
      this.logger.warn('获取编辑器图片配置失败，使用默认配置');
      return this.DEFAULT_EDITOR_IMAGE_CONFIG;
    }
  }

  /**
   * 保存编辑器图片配置
   */
  async saveEditorImageConfig(
    config: {
      maxWidth: number;
      maxHeight: number;
      maxSize: number;
      formats: string[];
      thumbnailWidth: number;
      thumbnailHeight: number;
    },
    userId: string,
  ): Promise<void> {
    if (config.maxWidth < 100 || config.maxWidth > 10000) {
      throw new BadRequestException('最大宽度必须在100-10000之间');
    }
    if (config.maxHeight < 100 || config.maxHeight > 10000) {
      throw new BadRequestException('最大高度必须在100-10000之间');
    }
    if (config.maxSize < 1 || config.maxSize > 500) {
      throw new BadRequestException('最大大小必须在1-500MB之间');
    }
    if (!config.formats || config.formats.length === 0) {
      throw new BadRequestException('至少需要选择一种图片格式');
    }

    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.EDITOR_IMAGE_CONFIG_KEY,
        deletedAt: null,
      },
    });

    const value = JSON.stringify(config);

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value },
      });
      this.logger.log('编辑器图片配置更新成功');
    } else {
      await this.prisma.config.create({
        data: {
          key: this.EDITOR_IMAGE_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '编辑器图片上传配置（尺寸、大小、格式、缩略图）',
          category: 'storage',
          sortOrder: 120,
          isActive: true,
          isSystem: true,
          createdBy: userId,
        },
      });
      this.logger.log('编辑器图片配置创建成功');
    }

    this.updateCache(this.EDITOR_IMAGE_CONFIG_KEY, config);
  }

  // ==================== 编辑器视频配置 ====================

  private readonly EDITOR_VIDEO_CONFIG_KEY = 'editor_video_settings';
  private readonly DEFAULT_EDITOR_VIDEO_CONFIG = {
    maxSize: 200,
    formats: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v'],
  };

  /**
   * 获取编辑器视频配置
   */
  async getEditorVideoConfig(): Promise<{
    maxSize: number;
    formats: string[];
  }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.EDITOR_VIDEO_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_EDITOR_VIDEO_CONFIG;
        }
      }

      return this.DEFAULT_EDITOR_VIDEO_CONFIG;
    } catch (error) {
      this.logger.warn('获取编辑器视频配置失败，使用默认配置');
      return this.DEFAULT_EDITOR_VIDEO_CONFIG;
    }
  }

  /**
   * 保存编辑器视频配置
   */
  async saveEditorVideoConfig(
    config: {
      maxSize: number;
      formats: string[];
    },
    userId: string,
  ): Promise<void> {
    if (config.maxSize < 1 || config.maxSize > 5000) {
      throw new BadRequestException('最大大小必须在1-5000MB之间');
    }
    if (!config.formats || config.formats.length === 0) {
      throw new BadRequestException('至少需要选择一种视频格式');
    }

    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.EDITOR_VIDEO_CONFIG_KEY,
        deletedAt: null,
      },
    });

    const value = JSON.stringify(config);

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value },
      });
      this.logger.log('编辑器视频配置更新成功');
    } else {
      await this.prisma.config.create({
        data: {
          key: this.EDITOR_VIDEO_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '编辑器视频上传配置（大小、格式）',
          category: 'storage',
          sortOrder: 130,
          isActive: true,
          isSystem: true,
          createdBy: userId,
        },
      });
      this.logger.log('编辑器视频配置创建成功');
    }

    this.updateCache(this.EDITOR_VIDEO_CONFIG_KEY, config);
  }

  // ==================== 编辑器文件夹配置 ====================

  private readonly EDITOR_FOLDER_CONFIG_KEY = 'editor_folder_settings';
  private readonly DEFAULT_EDITOR_FOLDER_CONFIG = {
    imageFolderId: '',
    videoFolderId: '',
  };

  /**
   * 获取编辑器文件夹配置
   */
  async getEditorFolderConfig(): Promise<{
    imageFolderId: string;
    videoFolderId: string;
  }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.EDITOR_FOLDER_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_EDITOR_FOLDER_CONFIG;
        }
      }

      return this.DEFAULT_EDITOR_FOLDER_CONFIG;
    } catch (error) {
      this.logger.warn('获取编辑器文件夹配置失败，使用默认配置');
      return this.DEFAULT_EDITOR_FOLDER_CONFIG;
    }
  }

  /**
   * 保存编辑器文件夹配置
   */
  async saveEditorFolderConfig(
    config: {
      imageFolderId: string;
      videoFolderId: string;
    },
    userId: string,
  ): Promise<void> {
    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.EDITOR_FOLDER_CONFIG_KEY,
        deletedAt: null,
      },
    });

    const value = JSON.stringify(config);

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value },
      });
      this.logger.log('编辑器文件夹配置更新成功');
    } else {
      await this.prisma.config.create({
        data: {
          key: this.EDITOR_FOLDER_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '编辑器上传文件夹配置（图片/视频存储位置）',
          category: 'storage',
          sortOrder: 140,
          isActive: true,
          isSystem: true,
          createdBy: userId,
        },
      });
      this.logger.log('编辑器文件夹配置创建成功');
    }

    this.updateCache(this.EDITOR_FOLDER_CONFIG_KEY, config);
  }

  // ==================== 记事本编辑器图片配置 ====================

  private readonly NOTEBOOK_IMAGE_CONFIG_KEY = 'notebook_image_settings';
  private readonly DEFAULT_NOTEBOOK_IMAGE_CONFIG = {
    maxWidth: 1920,
    maxHeight: 1080,
    maxSize: 20,
    formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    thumbnailWidth: 480,
    thumbnailHeight: 360,
  };

  async getNotebookImageConfig(): Promise<{
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    thumbnailWidth: number;
    thumbnailHeight: number;
  }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: { key: this.NOTEBOOK_IMAGE_CONFIG_KEY, deletedAt: null, isActive: true },
      });
      if (config) {
        try { return JSON.parse(config.value); } catch { return this.DEFAULT_NOTEBOOK_IMAGE_CONFIG; }
      }
      return this.DEFAULT_NOTEBOOK_IMAGE_CONFIG;
    } catch {
      return this.DEFAULT_NOTEBOOK_IMAGE_CONFIG;
    }
  }

  async saveNotebookImageConfig(
    config: { maxWidth: number; maxHeight: number; maxSize: number; formats: string[]; thumbnailWidth: number; thumbnailHeight: number },
    userId: string,
  ): Promise<void> {
    if (config.maxWidth < 100 || config.maxWidth > 10000) throw new BadRequestException('最大宽度必须在100-10000之间');
    if (config.maxHeight < 100 || config.maxHeight > 10000) throw new BadRequestException('最大高度必须在100-10000之间');
    if (config.maxSize < 1 || config.maxSize > 500) throw new BadRequestException('最大大小必须在1-500MB之间');
    if (!config.formats || config.formats.length === 0) throw new BadRequestException('至少需要选择一种图片格式');

    const existing = await this.prisma.config.findFirst({ where: { key: this.NOTEBOOK_IMAGE_CONFIG_KEY, deletedAt: null } });
    const value = JSON.stringify(config);
    if (existing) {
      await this.prisma.config.update({ where: { id: existing.id }, data: { value } });
    } else {
      await this.prisma.config.create({
        data: { key: this.NOTEBOOK_IMAGE_CONFIG_KEY, value, type: ConfigType.JSON, description: '记事本编辑器图片上传配置', category: 'storage', sortOrder: 150, isActive: true, isSystem: true, createdBy: userId },
      });
    }
    this.updateCache(this.NOTEBOOK_IMAGE_CONFIG_KEY, config);
  }

  // ==================== 记事本编辑器视频配置 ====================

  private readonly NOTEBOOK_VIDEO_CONFIG_KEY = 'notebook_video_settings';
  private readonly DEFAULT_NOTEBOOK_VIDEO_CONFIG = {
    maxSize: 200,
    formats: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v'],
  };

  async getNotebookVideoConfig(): Promise<{ maxSize: number; formats: string[] }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: { key: this.NOTEBOOK_VIDEO_CONFIG_KEY, deletedAt: null, isActive: true },
      });
      if (config) {
        try { return JSON.parse(config.value); } catch { return this.DEFAULT_NOTEBOOK_VIDEO_CONFIG; }
      }
      return this.DEFAULT_NOTEBOOK_VIDEO_CONFIG;
    } catch {
      return this.DEFAULT_NOTEBOOK_VIDEO_CONFIG;
    }
  }

  async saveNotebookVideoConfig(
    config: { maxSize: number; formats: string[] },
    userId: string,
  ): Promise<void> {
    if (config.maxSize < 1 || config.maxSize > 5000) throw new BadRequestException('最大大小必须在1-5000MB之间');
    if (!config.formats || config.formats.length === 0) throw new BadRequestException('至少需要选择一种视频格式');

    const existing = await this.prisma.config.findFirst({ where: { key: this.NOTEBOOK_VIDEO_CONFIG_KEY, deletedAt: null } });
    const value = JSON.stringify(config);
    if (existing) {
      await this.prisma.config.update({ where: { id: existing.id }, data: { value } });
    } else {
      await this.prisma.config.create({
        data: { key: this.NOTEBOOK_VIDEO_CONFIG_KEY, value, type: ConfigType.JSON, description: '记事本编辑器视频上传配置', category: 'storage', sortOrder: 155, isActive: true, isSystem: true, createdBy: userId },
      });
    }
    this.updateCache(this.NOTEBOOK_VIDEO_CONFIG_KEY, config);
  }

  // ==================== 记事本编辑器文件夹配置 ====================

  private readonly NOTEBOOK_FOLDER_CONFIG_KEY = 'notebook_folder_settings';
  private readonly DEFAULT_NOTEBOOK_FOLDER_CONFIG = { imageFolderId: '', videoFolderId: '' };

  async getNotebookFolderConfig(): Promise<{ imageFolderId: string; videoFolderId: string }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: { key: this.NOTEBOOK_FOLDER_CONFIG_KEY, deletedAt: null, isActive: true },
      });
      if (config) {
        try { return JSON.parse(config.value); } catch { return this.DEFAULT_NOTEBOOK_FOLDER_CONFIG; }
      }
      return this.DEFAULT_NOTEBOOK_FOLDER_CONFIG;
    } catch {
      return this.DEFAULT_NOTEBOOK_FOLDER_CONFIG;
    }
  }

  async saveNotebookFolderConfig(
    config: { imageFolderId: string; videoFolderId: string },
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.config.findFirst({ where: { key: this.NOTEBOOK_FOLDER_CONFIG_KEY, deletedAt: null } });
    const value = JSON.stringify(config);
    if (existing) {
      await this.prisma.config.update({ where: { id: existing.id }, data: { value } });
    } else {
      await this.prisma.config.create({
        data: { key: this.NOTEBOOK_FOLDER_CONFIG_KEY, value, type: ConfigType.JSON, description: '记事本编辑器上传文件夹配置', category: 'storage', sortOrder: 160, isActive: true, isSystem: true, createdBy: userId },
      });
    }
    this.updateCache(this.NOTEBOOK_FOLDER_CONFIG_KEY, config);
  }

  // ==================== 产品图片配置 ====================

  private readonly PRODUCT_IMAGE_CONFIG_KEY = 'product_image_settings';
  private readonly DEFAULT_PRODUCT_IMAGE_CONFIG = {
    maxWidth: 800,
    maxHeight: 800,
    maxSize: 5,
    formats: ['jpeg', 'png', 'gif', 'webp'],
    realFolderId: null as string | null,
  };

  async getProductImageConfig(): Promise<{
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    realFolderId: string | null;
  }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.PRODUCT_IMAGE_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_PRODUCT_IMAGE_CONFIG;
        }
      }

      return this.DEFAULT_PRODUCT_IMAGE_CONFIG;
    } catch (error) {
      this.logger.warn('获取产品图片配置失败，使用默认配置');
      return this.DEFAULT_PRODUCT_IMAGE_CONFIG;
    }
  }

  async saveProductImageConfig(
    config: {
      maxWidth?: number;
      maxHeight?: number;
      maxSize?: number;
      formats?: string[];
      realFolderId?: string | null;
    },
    userId: string,
  ): Promise<void> {
    const current = await this.getProductImageConfig();
    const merged = { ...current, ...config };
    const value = JSON.stringify(merged);

    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.PRODUCT_IMAGE_CONFIG_KEY,
        deletedAt: null,
      },
    });

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value, updatedAt: new Date() },
      });
      this.logger.log('产品图片配置更新成功');
    } else {
      await this.prisma.config.create({
        data: {
          key: this.PRODUCT_IMAGE_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '产品图片上传配置（尺寸、大小、格式、存储文件夹）',
          category: 'product',
          isSystem: true,
          isActive: true,
        },
      });
      this.logger.log('产品图片配置创建成功');
    }

    this.updateCache(this.PRODUCT_IMAGE_CONFIG_KEY, merged);
  }

  // ==================== 平台Logo配置 ====================

  private readonly PLATFORM_LOGO_CONFIG_KEY = 'platform_logo_settings';
  private readonly DEFAULT_PLATFORM_LOGO_CONFIG = {
    maxWidth: 400,
    maxHeight: 400,
    maxSize: 2,
    formats: ['jpeg', 'png', 'svg', 'webp'],
    realFolderId: null as string | null,
  };

  async getPlatformLogoConfig(): Promise<{
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    realFolderId: string | null;
  }> {
    try {
      const config = await this.prisma.config.findFirst({
        where: {
          key: this.PLATFORM_LOGO_CONFIG_KEY,
          deletedAt: null,
          isActive: true,
        },
      });

      if (config) {
        try {
          return JSON.parse(config.value);
        } catch {
          return this.DEFAULT_PLATFORM_LOGO_CONFIG;
        }
      }

      return this.DEFAULT_PLATFORM_LOGO_CONFIG;
    } catch (error) {
      this.logger.warn('获取平台Logo配置失败，使用默认配置');
      return this.DEFAULT_PLATFORM_LOGO_CONFIG;
    }
  }

  async savePlatformLogoConfig(
    config: {
      maxWidth?: number;
      maxHeight?: number;
      maxSize?: number;
      formats?: string[];
      realFolderId?: string | null;
    },
    userId: string,
  ): Promise<void> {
    const current = await this.getPlatformLogoConfig();
    const merged = { ...current, ...config };
    const value = JSON.stringify(merged);

    const existingConfig = await this.prisma.config.findFirst({
      where: {
        key: this.PLATFORM_LOGO_CONFIG_KEY,
        deletedAt: null,
      },
    });

    if (existingConfig) {
      await this.prisma.config.update({
        where: { id: existingConfig.id },
        data: { value, updatedAt: new Date() },
      });
      this.logger.log('平台Logo配置更新成功');
    } else {
      await this.prisma.config.create({
        data: {
          key: this.PLATFORM_LOGO_CONFIG_KEY,
          value,
          type: ConfigType.JSON,
          description: '平台Logo上传配置（尺寸、大小、格式、存储文件夹）',
          category: 'platform',
          isSystem: true,
          isActive: true,
        },
      });
      this.logger.log('平台Logo配置创建成功');
    }

    this.updateCache(this.PLATFORM_LOGO_CONFIG_KEY, merged);
  }
}
