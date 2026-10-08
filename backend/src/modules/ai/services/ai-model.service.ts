import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { CreateModelDto, UpdateModelDto } from '../dto/model.dto';

@Injectable()
export class AIModelService {
    private readonly logger = new Logger(AIModelService.name);

    constructor(private readonly prisma: PrismaService) {}

    async getAllModels() {
        return this.prisma.aiModel.findMany({
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
        });
    }

    async getEnabledModels() {
        return this.prisma.aiModel.findMany({
            where: { deletedAt: null, isEnabled: true },
            orderBy: { sortOrder: 'asc' },
        });
    }

    async getModelById(id: string) {
        const model = await this.prisma.aiModel.findFirst({
            where: { id, deletedAt: null },
        });
        if (!model) {
            throw new NotFoundException('模型不存在');
        }
        return model;
    }

    async getModelByName(name: string) {
        const model = await this.prisma.aiModel.findFirst({
            where: { name, deletedAt: null },
        });
        if (!model) {
            throw new NotFoundException(`模型 ${name} 不存在`);
        }
        if (!model.isEnabled) {
            throw new BadRequestException(
                `模型 ${name} 已被禁用`,
            );
        }
        return model;
    }

    async createModel(dto: CreateModelDto) {
        const existing = await this.prisma.aiModel.findFirst({
            where: { name: dto.name, deletedAt: null },
        });
        if (existing) {
            throw new ConflictException(
                `模型标识 ${dto.name} 已存在`,
            );
        }

        if (dto.isDefault) {
            await this.prisma.aiModel.updateMany({
                where: { isDefault: true, deletedAt: null },
                data: { isDefault: false },
            });
        }

        const model = await this.prisma.aiModel.create({
            data: {
                name: dto.name,
                displayName: dto.displayName,
                provider: dto.provider,
                modelId: dto.modelId,
                apiEndpoint: dto.apiEndpoint,
                description: dto.description,
                isEnabled: dto.isEnabled ?? true,
                isDefault: dto.isDefault ?? false,
                isFree: dto.isFree ?? false,
                sortOrder: dto.sortOrder ?? 0,
                config: dto.config ?? undefined,
            },
        });

        this.logger.log(`模型创建成功: ${model.name}`);
        return model;
    }

    async updateModel(id: string, dto: UpdateModelDto) {
        const model = await this.getModelById(id);

        if (dto.isDefault) {
            await this.prisma.aiModel.updateMany({
                where: {
                    isDefault: true,
                    deletedAt: null,
                    id: { not: id },
                },
                data: { isDefault: false },
            });
        }

        // config 合并逻辑：如果 apiKey 为空则保留原值
        let mergedConfig = dto.config;
        if (dto.config && model.config) {
            const existingConfig =
                model.config as Record<string, any>;
            const newConfig = dto.config;
            if (!newConfig.apiKey && existingConfig.apiKey) {
                mergedConfig = {
                    ...newConfig,
                    apiKey: existingConfig.apiKey,
                };
            }
        }

        const updated = await this.prisma.aiModel.update({
            where: { id },
            data: {
                // name 不可更新
                displayName: dto.displayName,
                provider: dto.provider,
                modelId: dto.modelId,
                apiEndpoint: dto.apiEndpoint,
                description: dto.description,
                isEnabled: dto.isEnabled,
                isDefault: dto.isDefault,
                isFree: dto.isFree,
                sortOrder: dto.sortOrder,
                config: mergedConfig ?? undefined,
            },
        });

        this.logger.log(`模型更新成功: ${updated.name}`);
        return updated;
    }

    async deleteModel(id: string) {
        const model = await this.getModelById(id);

        if (model.isDefault) {
            throw new BadRequestException('默认模型不可删除');
        }

        await this.prisma.aiModel.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        this.logger.log(`模型已软删除: ${model.name}`);
    }

    async toggleModel(id: string, isEnabled: boolean) {
        const model = await this.getModelById(id);

        if (model.isDefault && !isEnabled) {
            throw new BadRequestException(
                '默认模型不可禁用',
            );
        }

        const updated = await this.prisma.aiModel.update({
            where: { id },
            data: { isEnabled },
        });

        this.logger.log(
            `模型 ${model.name} 已${isEnabled ? '启用' : '禁用'}`,
        );
        return updated;
    }

    /**
     * API Key 脱敏：只保留前4位 + ***
     */
    maskConfig(config: any): any {
        if (!config) return config;
        const masked = { ...config };
        if (masked.apiKey && typeof masked.apiKey === 'string') {
            masked.apiKey =
                masked.apiKey.length > 4
                    ? masked.apiKey.substring(0, 4) + '***'
                    : '***';
        }
        return masked;
    }
}
