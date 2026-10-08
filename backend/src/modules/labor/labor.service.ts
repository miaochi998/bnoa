import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    QueryLaborTypeDto,
    CreateLaborTypeDto,
    UpdateLaborTypeDto,
    CreateLaborRateDto,
    UpdateLaborRateDto,
} from './dto/labor.dto';

@Injectable()
export class LaborService {
    private readonly logger = new Logger(LaborService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ==================== 编码生成 ====================

    private async generateCode(): Promise<string> {
        const last = await this.prisma.laborType.findFirst({
            where: { code: { startsWith: 'JOB' } },
            orderBy: { code: 'desc' },
            select: { code: true },
        });
        const seq = last
            ? parseInt(last.code.slice(3), 10) + 1
            : 1;
        return `JOB${String(seq).padStart(3, '0')}`;
    }

    // ==================== 工种 CRUD ====================

    async findAllTypes(query: QueryLaborTypeDto) {
        const {
            keyword,
            billingType,
            status,
            page = 1,
            pageSize = 10,
        } = query;

        const where: any = { deletedAt: null };
        if (keyword) {
            where.OR = [
                {
                    name: {
                        contains: keyword,
                        mode: 'insensitive',
                    },
                },
                {
                    code: {
                        contains: keyword,
                        mode: 'insensitive',
                    },
                },
            ];
        }
        if (billingType) where.billingType = billingType;
        if (status) where.status = status;

        const [list, total] = await Promise.all([
            this.prisma.laborType.findMany({
                where,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    laborRates: {
                        where: { isCurrent: true },
                    },
                },
            }),
            this.prisma.laborType.count({ where }),
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

    async findTypeById(id: string) {
        const item = await this.prisma.laborType.findFirst({
            where: { id, deletedAt: null },
            include: {
                laborRates: { orderBy: { effectDate: 'desc' } },
            },
        });
        if (!item) {
            throw new NotFoundException('工种不存在');
        }
        return item;
    }

    async createType(
        dto: CreateLaborTypeDto,
        userId: string,
    ) {
        const code = await this.generateCode();
        return this.prisma.laborType.create({
            data: {
                code,
                name: dto.name,
                billingType: dto.billingType,
                createdBy: userId,
                updatedBy: userId,
            },
        });
    }

    async updateType(
        id: string,
        dto: UpdateLaborTypeDto,
        userId: string,
    ) {
        const item = await this.prisma.laborType.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('工种不存在');
        }

        return this.prisma.laborType.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
        });
    }

    async deleteType(id: string, userId: string) {
        const item = await this.prisma.laborType.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('工种不存在');
        }

        const rateCount = await this.prisma.laborRate
            .count({ where: { laborTypeId: id } });
        if (rateCount > 0) {
            throw new ConflictException(
                '该工种存在关联的工费标准，无法删除',
            );
        }

        return this.prisma.laborType.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedBy: userId,
            },
        });
    }

    // ==================== 工费标准 ====================

    async findRatesByTypeId(laborTypeId: string) {
        const item = await this.prisma.laborType.findFirst({
            where: { id: laborTypeId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('工种不存在');
        }

        return this.prisma.laborRate.findMany({
            where: { laborTypeId },
            orderBy: { effectDate: 'desc' },
        });
    }

    async createRate(
        laborTypeId: string,
        dto: CreateLaborRateDto,
        userId: string,
    ) {
        const item = await this.prisma.laborType.findFirst({
            where: { id: laborTypeId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('工种不存在');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.laborRate.updateMany({
                where: {
                    laborTypeId,
                    isCurrent: true,
                },
                data: { isCurrent: false },
            });

            return tx.laborRate.create({
                data: {
                    laborTypeId,
                    unitPrice: dto.unitPrice,
                    unit: dto.unit,
                    effectDate: new Date(dto.effectDate),
                    isCurrent: true,
                    remark: dto.remark,
                    createdBy: userId,
                },
            });
        });
    }

    async updateRate(
        laborTypeId: string,
        rateId: string,
        dto: UpdateLaborRateDto,
        userId: string,
    ) {
        const item = await this.prisma.laborType.findFirst({
            where: { id: laborTypeId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('工种不存在');
        }

        const rate = await this.prisma.laborRate.findFirst({
            where: { id: rateId, laborTypeId },
        });
        if (!rate) {
            throw new NotFoundException('工费标准不存在');
        }

        const data: any = {};
        if (dto.unitPrice !== undefined) data.unitPrice = dto.unitPrice;
        if (dto.unit !== undefined) data.unit = dto.unit;
        if (dto.effectDate !== undefined) data.effectDate = new Date(dto.effectDate);
        if (dto.remark !== undefined) data.remark = dto.remark;

        return this.prisma.laborRate.update({
            where: { id: rateId },
            data,
        });
    }

    async setCurrentRate(
        laborTypeId: string,
        rateId: string,
        userId: string,
    ) {
        const item = await this.prisma.laborType.findFirst({
            where: { id: laborTypeId, deletedAt: null },
        });
        if (!item) {
            throw new NotFoundException('工种不存在');
        }

        const rate = await this.prisma.laborRate.findFirst({
            where: { id: rateId, laborTypeId },
        });
        if (!rate) {
            throw new NotFoundException('工费标准不存在');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.laborRate.updateMany({
                where: { laborTypeId, isCurrent: true },
                data: { isCurrent: false },
            });
            return tx.laborRate.update({
                where: { id: rateId },
                data: { isCurrent: true },
            });
        });
    }

    async deleteRate(
        laborTypeId: string,
        rateId: string,
        userId: string,
    ) {
        const rate = await this.prisma.laborRate.findFirst({
            where: { id: rateId, laborTypeId },
        });
        if (!rate) {
            throw new NotFoundException('工费标准不存在');
        }

        await this.prisma.laborRate.delete({
            where: { id: rateId },
        });

        if (rate.isCurrent) {
            const latest =
                await this.prisma.laborRate.findFirst({
                    where: { laborTypeId },
                    orderBy: { effectDate: 'desc' },
                });
            if (latest) {
                await this.prisma.laborRate.update({
                    where: { id: latest.id },
                    data: { isCurrent: true },
                });
            }
        }
    }

    async reorderLaborTypes(ids: string[]) {
        const maxOrder = await this.prisma.laborType.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.laborType.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }
}
