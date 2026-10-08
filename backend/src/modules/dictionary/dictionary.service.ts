import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import {
    CreateDictionaryDto,
    UpdateDictionaryDto,
} from './dto/dictionary.dto';

const CACHE_PREFIX = 'dict:';
const CACHE_TTL = 3600; // 1小时

@Injectable()
export class DictionaryService {
    private readonly logger = new Logger(DictionaryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) {}

    /**
     * 获取字典类型列表（去重 typeCode）
     */
    async getTypes(): Promise<{
        typeCode: string;
        typeName: string;
        count: number;
    }[]> {
        const items = await this.prisma.dictionary.findMany({
            where: { deletedAt: null },
            select: { typeCode: true, typeName: true },
            orderBy: { typeCode: 'asc' },
        });
        const map = new Map<
            string,
            { typeName: string; count: number }
        >();
        for (const item of items) {
            const existing = map.get(item.typeCode);
            if (existing) {
                existing.count++;
            } else {
                map.set(item.typeCode, {
                    typeName: item.typeName,
                    count: 1,
                });
            }
        }
        return Array.from(map.entries()).map(
            ([typeCode, { typeName, count }]) => ({
                typeCode,
                typeName,
                count,
            }),
        );
    }

    /**
     * 按 typeCode 获取条目列表
     */
    async getItemsByType(typeCode: string) {
        // 尝试缓存
        const cacheKey = CACHE_PREFIX + typeCode;
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const items = await this.prisma.dictionary.findMany({
            where: { typeCode, deletedAt: null },
            orderBy: [
                { sortOrder: 'asc' },
                { createdAt: 'asc' },
            ],
        });
        await this.redis.set(
            cacheKey,
            JSON.stringify(items),
            CACHE_TTL,
        );
        return items;
    }

    /**
     * 批量获取多个 typeCode 的条目
     */
    async getItemsByTypes(
        typeCodes: string[],
    ): Promise<Record<string, any[]>> {
        const result: Record<string, any[]> = {};
        for (const code of typeCodes) {
            result[code] = await this.getItemsByType(code);
        }
        return result;
    }

    /**
     * 创建字典条目
     */
    async create(dto: CreateDictionaryDto) {
        const existing = await this.prisma.dictionary.findFirst({
            where: {
                typeCode: dto.typeCode,
                itemCode: dto.itemCode,
                deletedAt: null,
            },
        });
        if (existing) {
            throw new ConflictException(
                `字典条目 ${dto.typeCode}.${dto.itemCode} 已存在`,
            );
        }
        const item = await this.prisma.dictionary.create({
            data: {
                typeCode: dto.typeCode,
                typeName: dto.typeName,
                itemCode: dto.itemCode,
                itemName: dto.itemName,
                itemValue: dto.itemValue,
                sortOrder: dto.sortOrder ?? 0,
                isDefault: dto.isDefault ?? false,
                description: dto.description,
                color: dto.color,
                icon: dto.icon,
            },
        });
        await this.clearCache(dto.typeCode);
        this.logger.log(
            `字典条目创建: ${dto.typeCode}.${dto.itemCode}`,
        );
        return item;
    }

    /**
     * 更新字典条目
     */
    async update(id: string, dto: UpdateDictionaryDto) {
        const item = await this.prisma.dictionary.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('字典条目不存在');
        }
        const updated = await this.prisma.dictionary.update({
            where: { id },
            data: {
                itemName: dto.itemName,
                itemValue: dto.itemValue,
                sortOrder: dto.sortOrder,
                isDefault: dto.isDefault,
                isActive: dto.isActive,
                description: dto.description,
                color: dto.color,
                icon: dto.icon,
            },
        });
        await this.clearCache(item.typeCode);
        this.logger.log(
            `字典条目更新: ${item.typeCode}.${item.itemCode}`,
        );
        return updated;
    }

    /**
     * 删除字典条目（软删除）
     */
    async delete(id: string) {
        const item = await this.prisma.dictionary.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('字典条目不存在');
        }
        await this.prisma.dictionary.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        await this.clearCache(item.typeCode);
        this.logger.log(
            `字典条目删除: ${item.typeCode}.${item.itemCode}`,
        );
    }

    /**
     * 启用/禁用字典条目
     */
    async toggle(id: string) {
        const item = await this.prisma.dictionary.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('字典条目不存在');
        }
        const updated = await this.prisma.dictionary.update({
            where: { id },
            data: { isActive: !item.isActive },
        });
        await this.clearCache(item.typeCode);
        return updated;
    }

    /**
     * 清除指定 typeCode 的缓存
     */
    private async clearCache(typeCode: string) {
        await this.redis.del(CACHE_PREFIX + typeCode);
    }
}
