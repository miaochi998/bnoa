import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    QueryConsumableDto,
    CreateConsumableDto,
    UpdateConsumableDto,
    QueryConsumableSupplierDto,
    CreateConsumableSupplierDto,
    UpdateConsumableSupplierDto,
    CreateConsumablePriceDto,
    UpdateConsumablePriceDto,
} from './dto/consumable.dto';

@Injectable()
export class ConsumableService {
    private readonly logger = new Logger(ConsumableService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ==================== 编码生成 ====================

    private async generateCode(
        prefix: string,
        model: 'consumable' | 'consumableSupplier',
    ): Promise<string> {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10)
            .replace(/-/g, '');
        const pattern = `${prefix}${dateStr}`;

        let lastCode: string | null = null;
        if (model === 'consumable') {
            const last = await this.prisma.consumable.findFirst({
                where: { code: { startsWith: pattern } },
                orderBy: { code: 'desc' },
                select: { code: true },
            });
            lastCode = last?.code || null;
        } else {
            const last =
                await this.prisma.consumableSupplier.findFirst({
                    where: { code: { startsWith: pattern } },
                    orderBy: { code: 'desc' },
                    select: { code: true },
                });
            lastCode = last?.code || null;
        }

        const seq = lastCode
            ? parseInt(lastCode.slice(-3), 10) + 1
            : 1;
        return `${pattern}${String(seq).padStart(3, '0')}`;
    }

    // ==================== 耗材 CRUD ====================

    async findAllConsumables(query: QueryConsumableDto) {
        const {
            keyword,
            category,
            status,
            page = 1,
            pageSize = 10,
        } = query;

        const where: any = { deletedAt: null };
        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        if (category) where.category = category;
        if (status) where.status = status;

        const [list, total] = await Promise.all([
            this.prisma.consumable.findMany({
                where,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { consumablePrices: {
                        where: { isCurrent: true },
                        include: { consumableSupplier: true },
                    },
                },
            }),
            this.prisma.consumable.count({ where }),
        ]);

        return {
            list: list.map((c: any) => this.mapConsumable(c)),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findConsumableById(id: string) {
        const item = await this.prisma.consumable.findFirst({
            where: { id, deletedAt: null },
            include: { consumablePrices: {
                    include: { consumableSupplier: true },
                    orderBy: { effectDate: 'desc' },
                },
            },
        });
        if (!item) {
            throw new NotFoundException('耗材不存在');
        }
        return this.mapConsumable(item);
    }

    async createConsumable(
        dto: CreateConsumableDto,
        userId: string,
    ) {
        const code = await this.generateCode(
            'CON', 'consumable',
        );
        return this.prisma.consumable.create({
            data: {
                code,
                name: dto.name,
                category: dto.category,
                specDesc: dto.specDesc,
                image: dto.image,
                remark: dto.remark,
                createdBy: userId,
                updatedBy: userId,
            },
        });
    }

    async updateConsumable(
        id: string,
        dto: UpdateConsumableDto,
        userId: string,
    ) {
        const item = await this.prisma.consumable.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('耗材不存在');
        }

        return this.prisma.consumable.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
        });
    }

    async deleteConsumable(id: string, userId: string) {
        const item = await this.prisma.consumable.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('耗材不存在');
        }

        const priceCount = await this.prisma.consumablePrice
            .count({ where: { consumableId: id } });
        if (priceCount > 0) {
            throw new ConflictException(
                '该耗材存在关联的价格记录，无法删除',
            );
        }

        return this.prisma.consumable.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });
    }

    // ==================== 耗材价格 ====================

    async findPricesByConsumableId(consumableId: string) {
        const item = await this.prisma.consumable.findFirst({
            where: { id: consumableId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('耗材不存在');
        }

        const prices = await this.prisma.consumablePrice.findMany({
            where: { consumableId },
            include: { consumableSupplier: true },
            orderBy: { effectDate: 'desc' },
        });
        return prices.map((p: any) => this.mapPrice(p));
    }

    async createPrice(
        consumableId: string,
        dto: CreateConsumablePriceDto,
        userId: string,
    ) {
        const item = await this.prisma.consumable.findFirst({
            where: { id: consumableId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('耗材不存在');
        }

        const supplier =
            await this.prisma.consumableSupplier.findFirst({
                where: {
                    id: dto.supplierId,
                    deletedAt: null,
                },
            });
        if (!supplier) {
            throw new NotFoundException('耗材供应商不存在');
        }

        // 事务：旧价格 isCurrent=false，插入新价格
        return this.prisma.$transaction(async (tx) => {
            await tx.consumablePrice.updateMany({
                where: {
                    consumableId,
                    isCurrent: true,
                },
                data: { isCurrent: false },
            });

            return tx.consumablePrice.create({
                data: {
                    consumableId,
                    supplierId: dto.supplierId,
                    unitPrice: dto.unitPrice,
                    effectDate: new Date(dto.effectDate),
                    isCurrent: true,
                    batchNote: dto.batchNote,
                    createdBy: userId,
                },
                include: { consumableSupplier: true },
            });
        });
    }

    async updatePrice(
        consumableId: string,
        priceId: string,
        dto: UpdateConsumablePriceDto,
        userId: string,
    ) {
        const item = await this.prisma.consumable.findFirst({
            where: { id: consumableId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('耗材不存在');
        }

        const price = await this.prisma.consumablePrice.findFirst({
            where: { id: priceId, consumableId },
        });
        if (!price) {
            throw new NotFoundException('价格记录不存在');
        }

        if (dto.supplierId !== undefined) {
            const supplier =
                await this.prisma.consumableSupplier.findFirst({
                    where: { id: dto.supplierId, deletedAt: null },
                });
            if (!supplier) {
                throw new NotFoundException('耗材供应商不存在');
            }
        }

        const data: any = {};
        if (dto.supplierId !== undefined) data.supplierId = dto.supplierId;
        if (dto.unitPrice !== undefined) data.unitPrice = dto.unitPrice;
        if (dto.effectDate !== undefined) data.effectDate = new Date(dto.effectDate);
        if (dto.batchNote !== undefined) data.batchNote = dto.batchNote;

        return this.prisma.consumablePrice.update({
            where: { id: priceId },
            data,
            include: { consumableSupplier: true },
        });
    }

    async setCurrentPrice(
        consumableId: string,
        priceId: string,
        userId: string,
    ) {
        const item = await this.prisma.consumable.findFirst({
            where: { id: consumableId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('耗材不存在');
        }

        const price = await this.prisma.consumablePrice
            .findFirst({
                where: { id: priceId, consumableId },
            });
        if (!price) {
            throw new NotFoundException('价格记录不存在');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.consumablePrice.updateMany({
                where: { consumableId, isCurrent: true },
                data: { isCurrent: false },
            });
            return tx.consumablePrice.update({
                where: { id: priceId },
                data: { isCurrent: true },
                include: { consumableSupplier: true },
            });
        });
    }

    async deletePrice(
        consumableId: string,
        priceId: string,
        userId: string,
    ) {
        const price = await this.prisma.consumablePrice
            .findFirst({
                where: { id: priceId, consumableId },
            });
        if (!price) {
            throw new NotFoundException('价格记录不存在');
        }

        await this.prisma.consumablePrice.delete({
            where: { id: priceId },
        });

        // 如果删的是当前价格，自动将最新的设为当前
        if (price.isCurrent) {
            const latest =
                await this.prisma.consumablePrice.findFirst({
                    where: { consumableId },
                    orderBy: { effectDate: 'desc' },
                });
            if (latest) {
                await this.prisma.consumablePrice.update({
                    where: { id: latest.id },
                    data: { isCurrent: true },
                });
            }
        }
    }

    // ==================== 耗材供应商 CRUD ====================

    async findAllSuppliers(query: QueryConsumableSupplierDto) {
        const {
            keyword,
            status,
            page = 1,
            pageSize = 10,
        } = query;

        const where: any = { deletedAt: null };
        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        if (status) where.status = status;

        const [list, total] = await Promise.all([
            this.prisma.consumableSupplier.findMany({
                where,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.consumableSupplier.count({ where }),
        ]);

        return {
            list,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findAllSuppliersForSelect() {
        return this.prisma.consumableSupplier.findMany({
            where: { deletedAt: null, status: 'ACTIVE' },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        });
    }

    // ========== 排序管理 ==========

    async reorderConsumables(ids: string[]) {
        const maxOrder = await this.prisma.consumable.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.consumable.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }

    async reorderConsumableSuppliers(ids: string[]) {
        const maxOrder = await this.prisma.consumableSupplier.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.consumableSupplier.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }

    async createSupplier(
        dto: CreateConsumableSupplierDto,
        userId: string,
    ) {
        const code = await this.generateCode(
            'CS', 'consumableSupplier',
        );
        return this.prisma.consumableSupplier.create({
            data: {
                code,
                name: dto.name,
                contact: dto.contact,
                phone: dto.phone,
                remark: dto.remark,
                createdBy: userId,
                updatedBy: userId,
            },
        });
    }

    async updateSupplier(
        id: string,
        dto: UpdateConsumableSupplierDto,
        userId: string,
    ) {
        const item =
            await this.prisma.consumableSupplier.findFirst({
                where: { id, deletedAt: null },
            });
        if (!item) {
            throw new NotFoundException('耗材供应商不存在');
        }

        return this.prisma.consumableSupplier.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
        });
    }

    async deleteSupplier(id: string, userId: string) {
        const item =
            await this.prisma.consumableSupplier.findFirst({
                where: { id, deletedAt: null },
            });
        if (!item) {
            throw new NotFoundException('耗材供应商不存在');
        }

        const priceCount = await this.prisma.consumablePrice
            .count({ where: { supplierId: id } });
        if (priceCount > 0) {
            throw new ConflictException(
                '该供应商存在关联的价格记录，无法删除',
            );
        }

        return this.prisma.consumableSupplier.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });
    }

    private mapPrice(p: any) {
        const { consumableSupplier, ...rest } = p;
        return { ...rest, supplier: consumableSupplier || null };
    }

    private mapConsumable(c: any) {
        const { consumablePrices, ...rest } = c;
        return {
            ...rest,
            prices: (consumablePrices || []).map((p: any) => this.mapPrice(p)),
        };
    }
}
