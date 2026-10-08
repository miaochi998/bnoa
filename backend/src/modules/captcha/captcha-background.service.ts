import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateBackgroundDto } from './dto/create-background.dto';

@Injectable()
export class CaptchaBackgroundService {
    private readonly logger = new Logger(
        CaptchaBackgroundService.name,
    );

    constructor(private readonly prisma: PrismaService) {}

    async findAll(options?: {
        enabled?: boolean;
    }) {
        const where: any = { deletedAt: null };
        if (options?.enabled !== undefined) {
            where.isEnabled = options.enabled;
        }
        return this.prisma.captchaBackground.findMany({
            where,
            orderBy: [
                { sortOrder: 'asc' },
                { createdAt: 'desc' },
            ],
        });
    }

    async findById(id: string) {
        const bg =
            await this.prisma.captchaBackground.findFirst({
                where: { id, deletedAt: null },
            });
        if (!bg) {
            throw new NotFoundException('背景图不存在');
        }
        return bg;
    }

    async getStats() {
        const [total, enabled, disabled] =
            await Promise.all([
                this.prisma.captchaBackground.count({
                    where: { deletedAt: null },
                }),
                this.prisma.captchaBackground.count({
                    where: {
                        deletedAt: null,
                        isEnabled: true,
                    },
                }),
                this.prisma.captchaBackground.count({
                    where: {
                        deletedAt: null,
                        isEnabled: false,
                    },
                }),
            ]);
        const result =
            await this.prisma.captchaBackground.aggregate(
                {
                    _sum: { fileSize: true },
                    where: { deletedAt: null },
                },
            );
        return {
            total,
            enabled,
            disabled,
            totalSize: result._sum.fileSize || 0,
        };
    }

    async create(
        input: CreateBackgroundDto,
        userId: string,
    ) {
        return this.prisma.captchaBackground.create({
            data: {
                fileName: input.fileName,
                filePath: input.filePath,
                fileSize: input.fileSize,
                mimeType: input.mimeType,
                width: input.width || 320,
                height: input.height || 160,
                storageType: input.storageType,
                folderId: input.folderId,
                createdBy: userId,
            },
        });
    }

    async batchCreate(
        inputs: CreateBackgroundDto[],
        userId: string,
    ) {
        const results = [];
        for (const input of inputs) {
            const bg = await this.create(input, userId);
            results.push(bg);
        }
        return results;
    }

    async update(
        id: string,
        input: {
            isEnabled?: boolean;
            sortOrder?: number;
        },
    ) {
        await this.findById(id);
        return this.prisma.captchaBackground.update({
            where: { id },
            data: input,
        });
    }

    async updateOrder(
        orders: { id: string; sortOrder: number }[],
    ) {
        for (const order of orders) {
            await this.prisma.captchaBackground.update({
                where: { id: order.id },
                data: { sortOrder: order.sortOrder },
            });
        }
        return true;
    }

    async delete(id: string) {
        await this.findById(id);
        await this.prisma.captchaBackground.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        return true;
    }

    async batchDelete(ids: string[]) {
        const result =
            await this.prisma.captchaBackground.updateMany(
                {
                    where: {
                        id: { in: ids },
                        deletedAt: null,
                    },
                    data: { deletedAt: new Date() },
                },
            );
        return result.count;
    }

    async getRandomBackground() {
        const count =
            await this.prisma.captchaBackground.count({
                where: {
                    isEnabled: true,
                    deletedAt: null,
                },
            });
        if (count === 0) {
            return null;
        }
        const skip = Math.floor(Math.random() * count);
        return this.prisma.captchaBackground.findFirst({
            where: {
                isEnabled: true,
                deletedAt: null,
            },
            skip,
        });
    }

    async getEnabledCount() {
        return this.prisma.captchaBackground.count({
            where: {
                isEnabled: true,
                deletedAt: null,
            },
        });
    }

    async syncFromFolder(
        realFolderId: string,
        userId: string,
    ) {
        const imageTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
        ];

        // 1. 找到所有映射到此 RealFolder 的虚拟文件夹
        const mappedFolders =
            await this.prisma.folder.findMany({
                where: {
                    realFolderId,
                    deletedAt: null,
                },
                select: { id: true },
            });

        if (mappedFolders.length === 0) {
            return {
                total: 0,
                added: 0,
                skipped: 0,
                list: [],
            };
        }

        // 2. 递归收集所有子文件夹 ID
        const allFolderIds = new Set(
            mappedFolders.map((f) => f.id),
        );
        const collectChildren = async (
            parentIds: string[],
        ) => {
            const children =
                await this.prisma.folder.findMany({
                    where: {
                        parentId: { in: parentIds },
                        deletedAt: null,
                    },
                    select: { id: true },
                });
            const newIds = children
                .map((c) => c.id)
                .filter((id) => !allFolderIds.has(id));
            if (newIds.length > 0) {
                newIds.forEach((id) =>
                    allFolderIds.add(id),
                );
                await collectChildren(newIds);
            }
        };
        await collectChildren(
            mappedFolders.map((f) => f.id),
        );

        // 3. 查询所有文件夹中的图片文件
        const files = await this.prisma.file.findMany({
            where: {
                folderId: {
                    in: Array.from(allFolderIds),
                },
                deletedAt: null,
                mimeType: { in: imageTypes },
                // 过滤掉缩略图文件
                NOT: {
                    path: { contains: '_thumb.' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // 4. 过滤已存在的记录
        const existing =
            await this.prisma.captchaBackground.findMany(
                {
                    where: { deletedAt: null },
                    select: { filePath: true },
                },
            );
        const existingPaths = new Set(
            existing.map((e) => e.filePath),
        );

        let added = 0;
        const results = [];
        for (const file of files) {
            const url = file.url || file.path;
            if (existingPaths.has(url)) {
                continue;
            }

            const bg =
                await this.prisma.captchaBackground.create(
                    {
                        data: {
                            fileName:
                                file.originalName ||
                                file.name,
                            filePath: url,
                            fileSize: Number(
                                file.size,
                            ),
                            mimeType: file.mimeType,
                            width: file.width || 320,
                            height:
                                file.height || 160,
                            storageType:
                                file.storageType ||
                                'RUSTFS',
                            folderId: realFolderId,
                            createdBy: userId,
                            isEnabled: true,
                        },
                    },
                );
            results.push(bg);
            added++;
        }

        return {
            total: files.length,
            added,
            skipped: files.length - added,
            list: results,
        };
    }
}
