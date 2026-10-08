import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    CreateProductDto,
    UpdateProductDto,
    ProductQueryDto,
} from './dto/product.dto';

@Injectable()
export class ProductService {
    private readonly logger = new Logger(ProductService.name);

    constructor(private readonly prisma: PrismaService) {}

    /** 生成下一个产品编码（格式 P + 6位数字，如 P000001） */
    async getNextProductCode(): Promise<string> {
        const products = await this.prisma.product.findMany({
            where: { deletedAt: null, code: { startsWith: 'P' } },
            select: { code: true },
        });
        let maxNum = 0;
        for (const p of products) {
            if (/^P\d+$/.test(p.code)) {
                const num = parseInt(p.code.slice(1), 10);
                if (!Number.isNaN(num) && num > maxNum) maxNum = num;
            }
        }
        return `P${String(maxNum + 1).padStart(6, '0')}`;
    }

    async create(dto: CreateProductDto, userId: string) {
        const code = (dto.code?.trim() || await this.getNextProductCode());
        const existing = await this.prisma.product.findFirst({
            where: { code, deletedAt: null },
        });
        if (existing) {
            throw new ConflictException(
                `产品编码 ${code} 已存在`,
            );
        }

        const product = await this.prisma.product.create({
            data: {
                ...dto,
                code,
                createdBy: userId,
                updatedBy: userId,
            },
        });

        this.logger.log(`产品创建成功: ${product.name}`);
        return product;
    }

    async update(
        id: string,
        dto: UpdateProductDto,
        userId: string,
    ) {
        const product = await this.prisma.product.findFirst({
            where: { id, deletedAt: null },
        });
        if (!product) {
            throw new NotFoundException('产品不存在');
        }

        const updated = await this.prisma.product.update({
            where: { id },
            data: {
                ...dto,
                updatedBy: userId,
            },
        });

        this.logger.log(`产品更新成功: ${updated.name}`);
        return updated;
    }

    async delete(id: string, userId: string) {
        const product = await this.prisma.product.findFirst({
            where: { id, deletedAt: null },
        });
        if (!product) {
            throw new NotFoundException('产品不存在');
        }

        // 删除前检查：是否有关联的供应商产品
        const spCount = await this.prisma.supplierProduct.count({
            where: { productId: id, deletedAt: null },
        });
        if (spCount > 0) {
            throw new ConflictException(
                `该产品存在 ${spCount} 个供应商关联，无法删除`,
            );
        }

        await this.prisma.product.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });

        this.logger.log(`产品删除成功: ${product.name}`);
    }

    async findById(id: string) {
        const product = await this.prisma.product.findFirst({
            where: { id, deletedAt: null },
        });
        if (!product) {
            throw new NotFoundException('产品不存在');
        }
        return product;
    }

    async findAll(query: ProductQueryDto) {
        const { keyword, status, brand } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        if (status) {
            where.status = status;
        }

        if (brand) {
            where.brand = brand;
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            this.prisma.product.count({ where }),
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

    async getBrands() {
        const products = await this.prisma.product.findMany({
            where: {
                brand: { not: null },
                deletedAt: null,
            },
            select: { brand: true },
            distinct: ['brand'],
        });

        return products.map(p => p.brand).filter(Boolean);
    }

    async reorderProducts(ids: string[]) {
        const maxOrder = await this.prisma.product.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.product.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }
}
