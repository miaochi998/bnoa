import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    CreateShopDto,
    UpdateShopDto,
    QueryShopDto,
} from './dto/shop.dto';

const SHOP_INCLUDE = {
    platform: {
        select: { id: true, name: true, code: true },
    },
    creator: {
        select: { id: true, name: true, username: true },
    },
};

function mapShop(shop: any) {
    if (!shop) return shop;
    const { creator, ...rest } = shop;
    return { ...rest, manager: creator || null };
}

@Injectable()
export class ShopService {
    private readonly logger = new Logger(ShopService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateShopDto, userId: string) {
        const shop = await this.prisma.shop.create({
            data: {
                ...dto,
                createdBy: userId,
                updatedBy: userId,
            },
            include: SHOP_INCLUDE,
        });

        this.logger.log(`店铺创建成功: ${shop.name}`);
        return mapShop(shop);
    }

    async findAll(query: QueryShopDto) {
        const { keyword, platformId, managerId, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        if (keyword) {
            where.name = {
                contains: keyword,
                mode: 'insensitive',
            };
        }

        if (platformId) {
            where.platformId = platformId;
        }

        if (managerId) {
            where.managerId = managerId;
        }

        if (status) {
            where.status = status;
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.shop.findMany({
                where,
                skip,
                take: pageSize,
                include: SHOP_INCLUDE,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            this.prisma.shop.count({ where }),
        ]);

        return {
            list: list.map(mapShop),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findActive() {
        const shops = await this.prisma.shop.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            include: SHOP_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        return shops.map(mapShop);
    }

    async findById(id: string) {
        const shop = await this.prisma.shop.findFirst({
            where: { id, deletedAt: null },
            include: SHOP_INCLUDE,
        });
        if (!shop) {
            throw new NotFoundException('店铺不存在');
        }
        return mapShop(shop);
    }

    async update(
        id: string,
        dto: UpdateShopDto,
        userId: string,
    ) {
        await this.findById(id);

        const shop = await this.prisma.shop.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
            include: SHOP_INCLUDE,
        });

        this.logger.log(`店铺更新成功: ${shop.name}`);
        return mapShop(shop);
    }

    async delete(id: string, userId: string) {
        const shop = await this.findById(id);

        // 检查是否有关联链接
        const linkCount =
            await this.prisma.productLink.count({
                where: { shopId: id, deletedAt: null },
            });
        if (linkCount > 0) {
            throw new ConflictException(
                '该店铺下存在关联链接，无法删除',
            );
        }

        await this.prisma.shop.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });

        this.logger.log(`店铺删除成功: ${shop.name}`);
    }

    // ========== 别名管理 ==========

    async getAliases(shopId: string) {
        await this.findById(shopId);
        return this.prisma.shopAlias.findMany({
            where: { shopId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async addAlias(shopId: string, alias: string) {
        await this.findById(shopId);

        // 检查别名是否已被使用
        const existing = await this.prisma.shopAlias.findUnique({
            where: { alias },
            include: { shop: { select: { name: true } } },
        });
        if (existing) {
            throw new ConflictException(
                `别名"${alias}"已被店铺"${existing.shop.name}"使用`,
            );
        }

        const record = await this.prisma.shopAlias.create({
            data: { shopId, alias },
        });
        this.logger.log(`店铺别名添加成功: ${alias}`);
        return record;
    }

    async removeAlias(aliasId: string) {
        const alias = await this.prisma.shopAlias.findUnique({
            where: { id: aliasId },
        });
        if (!alias) {
            throw new NotFoundException('别名不存在');
        }
        await this.prisma.shopAlias.delete({
            where: { id: aliasId },
        });
        this.logger.log(`店铺别名删除成功: ${alias.alias}`);
    }

    // ========== 排序管理 ==========

    async reorderShops(ids: string[]) {
        const maxOrder = await this.prisma.shop.aggregate({
            _max: { sortOrder: true },
        });
        const baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.shop.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }
}
