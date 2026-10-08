import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { CryptoUtil } from '../../common/utils/crypto.util';
import {
    CreateShareDto,
    ShareAccess,
} from './dto/create-share.dto';
import * as crypto from 'crypto';

/**
 * 分享创建响应
 */
export interface CreateShareResponse {
    id: string;
    fileId: string;
    code: string;
    access: string;
    password?: string;
    expireAt: Date | null;
    createdAt: Date;
}

/**
 * 分享信息响应（公开，不含文件 URL）
 */
export interface ShareInfoPublicResponse {
    fileName: string;
    fileSize: number;
    mimeType: string;
    hasPassword: boolean;
    access: string;
    expireAt: Date | null;
    expired: boolean;
}

/**
 * 访问分享响应
 */
export interface AccessShareResponse {
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    access: string;
    thumbnailUrl?: string;
}

/**
 * 分享列表项
 */
export interface ShareListItem {
    id: string;
    fileId: string;
    code: string;
    access: string;
    hasPassword: boolean;
    expireAt: Date | null;
    createdAt: Date;
    file: {
        id: string;
        name: string;
        size: number;
        mimeType: string;
    };
}

/**
 * 分享服务
 * 提供文件分享相关功能
 */
@Injectable()
export class ShareService {
    private readonly logger = new Logger(ShareService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly localStorageService: LocalStorageService,
    ) {}

    /**
     * 创建分享
     */
    async create(
        dto: CreateShareDto,
        userId: string,
    ): Promise<CreateShareResponse> {
        const file = await this.prisma.file.findFirst({
            where: {
                id: dto.fileId,
                uploadedBy: userId,
                deletedAt: null,
            },
        });

        if (!file) {
            throw new NotFoundException('文件不存在');
        }

        const shareCode = this.generateShareCode();
        const expireDays = dto.expireDays ?? 7;
        const expireAt =
            expireDays > 0
                ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000)
                : null;

        // 密码 bcrypt hash
        const hashedPassword = dto.password
            ? await CryptoUtil.hashPassword(dto.password)
            : null;

        const access = dto.access || ShareAccess.DOWNLOAD;

        await this.prisma.file.update({
            where: { id: dto.fileId },
            data: {
                shareCode,
                shareExpireAt: expireAt,
                sharePassword: hashedPassword,
                shareAccess: access,
            },
        });

        return {
            id: file.id,
            fileId: file.id,
            code: shareCode,
            access,
            password: dto.password || undefined,
            expireAt,
            createdAt: file.createdAt,
        };
    }

    /**
     * 获取分享信息（公开，无需密码）
     */
    async getShareInfo(
        shareCode: string,
    ): Promise<ShareInfoPublicResponse> {
        const file = await this.prisma.file.findUnique({
            where: { shareCode },
        });

        if (!file) {
            throw new NotFoundException('分享不存在');
        }

        const expired =
            !!file.shareExpireAt && new Date() > file.shareExpireAt;

        return {
            fileName: file.name,
            fileSize: Number(file.size),
            mimeType: file.mimeType,
            hasPassword: !!file.sharePassword,
            access: file.shareAccess || ShareAccess.DOWNLOAD,
            expireAt: file.shareExpireAt,
            expired,
        };
    }

    /**
     * 访问分享（验证密码后返回文件 URL）
     */
    async accessShare(
        shareCode: string,
        password?: string,
    ): Promise<AccessShareResponse> {
        const file = await this.prisma.file.findUnique({
            where: { shareCode },
        });

        if (!file) {
            throw new NotFoundException('分享不存在');
        }

        if (file.shareExpireAt && new Date() > file.shareExpireAt) {
            throw new ForbiddenException('分享已过期');
        }

        // 验证密码
        if (file.sharePassword) {
            if (!password) {
                throw new BadRequestException('需要输入访问密码');
            }
            const valid = await CryptoUtil.comparePassword(
                password,
                file.sharePassword,
            );
            if (!valid) {
                throw new ForbiddenException('密码错误');
            }
        }

        return {
            url: file.url,
            fileName: file.name,
            mimeType: file.mimeType,
            size: Number(file.size),
            access: file.shareAccess || ShareAccess.DOWNLOAD,
            thumbnailUrl: file.thumbnailUrl || undefined,
        };
    }

    /**
     * 获取用户的分享列表
     */
    async findByUser(userId: string): Promise<ShareListItem[]> {
        const files = await this.prisma.file.findMany({
            where: {
                uploadedBy: userId,
                shareCode: { not: null },
                deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        });

        return files.map((file) => ({
            id: file.id,
            fileId: file.id,
            code: file.shareCode!,
            access: file.shareAccess || ShareAccess.DOWNLOAD,
            hasPassword: !!file.sharePassword,
            expireAt: file.shareExpireAt,
            createdAt: file.createdAt,
            file: {
                id: file.id,
                name: file.name,
                size: Number(file.size),
                mimeType: file.mimeType,
            },
        }));
    }

    /**
     * 取消分享
     */
    async cancel(fileId: string, userId: string): Promise<void> {
        const file = await this.prisma.file.findFirst({
            where: {
                id: fileId,
                uploadedBy: userId,
                shareCode: { not: null },
            },
        });

        if (!file) {
            throw new NotFoundException('分享不存在');
        }

        await this.prisma.file.update({
            where: { id: fileId },
            data: {
                shareCode: null,
                shareExpireAt: null,
                sharePassword: null,
                shareAccess: null,
            },
        });

        this.logger.log(`分享已取消: ${fileId}`);
    }

    /**
     * 清理过期分享
     */
    async cleanupExpiredShares(): Promise<void> {
        try {
            const result = await this.prisma.file.updateMany({
                where: {
                    shareCode: { not: null },
                    shareExpireAt: { lt: new Date() },
                },
                data: {
                    shareCode: null,
                    shareExpireAt: null,
                    sharePassword: null,
                    shareAccess: null,
                },
            });

            if (result.count > 0) {
                this.logger.log(
                    `已清理 ${result.count} 个过期分享`,
                );
            }
        } catch (error) {
            this.logger.error('清理过期分享失败', error);
        }
    }

    /**
     * 获取分享文件内容（代理下载）
     */
    async getFileBuffer(
        shareCode: string,
    ): Promise<{
        buffer: Buffer;
        fileName: string;
        mimeType: string;
        size: number;
    }> {
        const file = await this.prisma.file.findUnique({
            where: { shareCode },
        });

        if (!file) {
            throw new NotFoundException('分享不存在');
        }

        if (file.shareExpireAt && new Date() > file.shareExpireAt) {
            throw new ForbiddenException('分享已过期');
        }

        if (!file.path) {
            throw new NotFoundException('文件路径不存在');
        }

        let buffer: Buffer;
        if (file.storageType === 'LOCAL') {
            buffer = await this.localStorageService.downloadFile(
                file.path,
            );
        } else {
            buffer = await this.storageService.download(
                file.path,
            );
        }

        return {
            buffer,
            fileName: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            size: buffer.length,
        };
    }

    /**
     * 生成分享码
     */
    private generateShareCode(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}
