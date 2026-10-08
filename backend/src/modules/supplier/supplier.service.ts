import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    CreateSupplierDto,
    UpdateSupplierDto,
    SupplierQueryDto,
} from './dto/supplier.dto';
import {
    CreateSupplierProductDto,
    UpdateSupplierProductDto,
    SupplierProductQueryDto,
} from './dto/supplier-product.dto';

const SP_INCLUDE = {
    supplier: {
        select: { id: true, name: true, code: true },
    },
    product: {
        select: { id: true, name: true, code: true },
    },
};

@Injectable()
export class SupplierService {
    private readonly logger = new Logger(SupplierService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateSupplierDto, userId: string) {
        const today = new Date();
        const dateStr =
            today.getFullYear().toString() +
            String(today.getMonth() + 1).padStart(2, '0') +
            String(today.getDate()).padStart(2, '0');

        const count = await this.prisma.supplier.count({
            where: { code: { startsWith: `SUP${dateStr}` } },
        });

        const code = `SUP${dateStr}${String(count + 1).padStart(3, '0')}`;

        const supplier = await this.prisma.supplier.create({
            data: { ...dto, code, createdBy: userId },
        });

        this.logger.log(`供应商创建成功: ${supplier.name}`);
        return supplier;
    }

    async update(
        id: string,
        dto: UpdateSupplierDto,
        userId: string,
    ) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, deletedAt: null },
        });
        if (!supplier) {
            throw new NotFoundException('供应商不存在');
        }

        const updated = await this.prisma.supplier.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
        });

        this.logger.log(`供应商更新成功: ${updated.name}`);
        return updated;
    }

    async delete(id: string, userId: string) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, deletedAt: null },
        });
        if (!supplier) {
            throw new NotFoundException('供应商不存在');
        }

        const spCount = await this.prisma.supplierProduct.count({
            where: { supplierId: id, deletedAt: null },
        });
        if (spCount > 0) {
            throw new ConflictException(
                '该供应商存在关联产品，无法删除',
            );
        }


        await this.prisma.supplier.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });

        this.logger.log(`供应商删除成功: ${supplier.name}`);
    }

    async findById(id: string) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, deletedAt: null },
        });
        if (!supplier) {
            throw new NotFoundException('供应商不存在');
        }
        return supplier;
    }

    async findAll(query: SupplierQueryDto) {
        const { keyword, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        if (status) {
            where.status = status;
        }

        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.supplier.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            this.prisma.supplier.count({ where }),
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

    async findAllForSelect() {
        return this.prisma.supplier.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        });
    }

    // ========== 供应商-产品关联管理 ==========

    async createSupplierProduct(
        dto: CreateSupplierProductDto,
        userId: string,
    ) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id: dto.supplierId, deletedAt: null },
        });
        if (!supplier) {
            throw new NotFoundException('供应商不存在');
        }

        const product = await this.prisma.product.findFirst({
            where: { id: dto.productId, deletedAt: null },
        });
        if (!product) {
            throw new NotFoundException('产品不存在');
        }

        const existing = await this.prisma.supplierProduct.findFirst({
            where: {
                supplierId: dto.supplierId,
                productId: dto.productId,
                styleName: dto.styleName ?? null,
                deletedAt: null,
            },
        });
        if (existing) {
            throw new ConflictException(
                '该供应商-产品-款式关联已存在',
            );
        }

        const sp = await this.prisma.supplierProduct.create({
            data: { ...dto, createdBy: userId },
            include: SP_INCLUDE,
        });

        this.logger.log(
            `供应商产品关联创建: ${supplier.name} - ${product.name}`,
        );
        return sp;
    }

    async updateSupplierProduct(
        id: string,
        dto: UpdateSupplierProductDto,
        userId: string,
    ) {
        const sp = await this.prisma.supplierProduct.findFirst({
            where: { id, deletedAt: null },
        });
        if (!sp) {
            throw new NotFoundException('供应商-产品关联不存在');
        }

        return this.prisma.supplierProduct.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
            include: SP_INCLUDE,
        });
    }

    async deleteSupplierProduct(
        id: string,
        userId: string,
    ) {
        const sp = await this.prisma.supplierProduct.findFirst({
            where: { id, deletedAt: null },
        });
        if (!sp) {
            throw new NotFoundException('供应商-产品关联不存在');
        }

        await this.prisma.supplierProduct.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });

        this.logger.log(`供应商产品关联删除: ${id}`);
    }

    async findSupplierProductById(id: string) {
        const sp = await this.prisma.supplierProduct.findFirst({
            where: { id, deletedAt: null },
            include: SP_INCLUDE,
        });
        if (!sp) {
            throw new NotFoundException('供应商-产品关联不存在');
        }
        return sp;
    }

    async findAllSupplierProducts(
        query: SupplierProductQueryDto,
    ) {
        const { supplierId, productId, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        if (supplierId) {
            where.supplierId = supplierId;
        }
        if (productId) {
            where.productId = productId;
        }
        if (status) {
            where.status = status;
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.supplierProduct.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
                include: SP_INCLUDE,
            }),
            this.prisma.supplierProduct.count({ where }),
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

    async findSuppliersByProduct(productId: string) {
        return this.prisma.supplierProduct.findMany({
            where: {
                productId,
                status: 'ACTIVE',
                deletedAt: null,
            },
            include: { supplier: true },
            orderBy: { supplyPrice: 'asc' },
        });
    }

    async findProductsBySupplier(supplierId: string) {
        return this.prisma.supplierProduct.findMany({
            where: {
                supplierId,
                status: 'ACTIVE',
                deletedAt: null,
            },
            include: { product: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ========== 排序管理 ==========

    async reorderSuppliers(ids: string[]) {
        const maxOrder = await this.prisma.supplier.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.supplier.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }

    async reorderSupplierProducts(ids: string[]) {
        const maxOrder = await this.prisma.supplierProduct.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.supplierProduct.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }
}
