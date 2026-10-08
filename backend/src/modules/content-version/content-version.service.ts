import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SaveVersionDto } from './dto/save-version.dto';
import { QueryVersionsDto } from './dto/query-versions.dto';

@Injectable()
export class ContentVersionService {
    constructor(
        private readonly prisma: PrismaService,
    ) {}

    /**
     * 保存版本
     */
    async saveVersion(
        contentType: string,
        contentId: string,
        dto: SaveVersionDto,
        userId: string,
    ) {
        // 获取当前最大版本号
        const maxVersion =
            await this.prisma.contentVersion
                .findFirst({
                    where: {
                        contentType,
                        contentId,
                        deletedAt: null,
                    },
                    orderBy: {
                        versionNumber: 'desc',
                    },
                    select: { versionNumber: true },
                });

        const nextVersion =
            (maxVersion?.versionNumber || 0) + 1;

        // 计算字符数
        const htmlContent = dto.htmlContent || '';
        const plainText = htmlContent
            .replace(/<[^>]+>/g, '');
        const characterCount = plainText.length;

        const version =
            await this.prisma.contentVersion
                .create({
                    data: {
                        contentType,
                        contentId,
                        versionNumber: nextVersion,
                        content: dto.content,
                        htmlContent: dto.htmlContent,
                        versionType: dto.versionType,
                        versionName: dto.versionName,
                        characterCount,
                        wordCount: null,
                        createdBy: userId,
                    },
                    select: {
                        id: true,
                        versionNumber: true,
                        versionType: true,
                        versionName: true,
                        characterCount: true,
                        createdAt: true,
                    },
                });

        return version;
    }

    /**
     * 获取版本列表
     */
    async getVersions(
        contentType: string,
        contentId: string,
        query: QueryVersionsDto,
    ) {
        const {
            page = 1,
            pageSize = 20,
            type = 'all',
        } = query;

        const where: any = {
            contentType,
            contentId,
            deletedAt: null,
        };
        if (type !== 'all') {
            where.versionType = type;
        }

        const [list, total] = await Promise.all([
            this.prisma.contentVersion.findMany({
                where,
                orderBy: {
                    versionNumber: 'desc',
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    versionNumber: true,
                    versionType: true,
                    versionName: true,
                    characterCount: true,
                    wordCount: true,
                    createdBy: true,
                    createdAt: true,
                },
            }),
            this.prisma.contentVersion.count({
                where,
            }),
        ]);

        return {
            list,
            pagination: {
                page,
                pageSize,
                total,
                totalPages:
                    Math.ceil(total / pageSize),
            },
        };
    }

    /**
     * 获取版本详情
     */
    async getVersionDetail(
        contentType: string,
        contentId: string,
        versionId: string,
    ) {
        return this.prisma.contentVersion
            .findFirst({
                where: {
                    id: versionId,
                    contentType,
                    contentId,
                    deletedAt: null,
                },
            });
    }

    /**
     * 恢复版本
     */
    async restoreVersion(
        contentType: string,
        contentId: string,
        versionId: string,
        userId: string,
    ) {
        const sourceVersion =
            await this.prisma.contentVersion
                .findFirst({
                    where: {
                        id: versionId,
                        contentType,
                        contentId,
                        deletedAt: null,
                    },
                });

        if (!sourceVersion) {
            throw new Error('版本不存在');
        }

        // 创建恢复记录
        return this.saveVersion(
            contentType,
            contentId,
            {
                content: sourceVersion.content,
                htmlContent:
                    sourceVersion.htmlContent
                    || undefined,
                versionType: 'restore',
                versionName:
                    `从 v${sourceVersion.versionNumber} 恢复`,
            },
            userId,
        );
    }

    /**
     * 删除版本（软删除）
     */
    async deleteVersion(
        contentType: string,
        contentId: string,
        versionId: string,
    ) {
        return this.prisma.contentVersion.update({
            where: { id: versionId },
            data: { deletedAt: new Date() },
        });
    }
}
