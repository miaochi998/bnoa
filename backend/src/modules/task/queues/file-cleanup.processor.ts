import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../config/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { LocalStorageService } from '../../storage/local-storage.service';

/**
 * 文件物理删除队列处理器
 * 异步删除物理文件和缩略图，避免阻塞主进程
 */
@Processor('file-cleanup', { concurrency: 3 })
export class FileCleanupProcessor extends WorkerHost {
    private readonly logger =
        new Logger(FileCleanupProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly localStorageService: LocalStorageService,
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { fileId, filePath, thumbnailUrl, storageType } =
            job.data;

        this.logger.log(`开始删除物理文件: ${filePath}`);

        try {
            // 检查是否仍有其他记录引用此物理文件
            const refCount = await this.prisma.file.count({
                where: { path: filePath },
            });

            if (refCount > 0) {
                this.logger.log(
                    `物理文件仍有 ${refCount} 条引用，` +
                    `跳过删除: ${filePath}`,
                );
                return;
            }

            // 删除主文件
            if (storageType === 'LOCAL') {
                await this.localStorageService.deleteFile(
                    filePath,
                );
            } else {
                await this.storageService.delete(filePath);
            }
            this.logger.log(`物理文件已删除: ${filePath}`);

            // 删除缩略图
            if (thumbnailUrl) {
                await this.deleteThumbnail(
                    thumbnailUrl,
                    storageType,
                );
            }
        } catch (error) {
            this.logger.error(
                `删除物理文件失败: ${filePath}`,
                error,
            );
            throw error;
        }
    }

    private async deleteThumbnail(
        thumbnailUrl: string,
        storageType: string,
    ): Promise<void> {
        try {
            const url = new URL(thumbnailUrl);
            const pathParts =
                url.pathname.split('/').filter(Boolean);
            const thumbnailPath = pathParts.length > 1
                ? pathParts.slice(1).join('/')
                : pathParts.join('/');

            if (!thumbnailPath) return;

            if (storageType === 'LOCAL') {
                await this.localStorageService.deleteFile(
                    thumbnailPath,
                );
            } else {
                await this.storageService.delete(thumbnailPath);
            }
            this.logger.log(`缩略图已删除: ${thumbnailPath}`);
        } catch (error) {
            this.logger.warn(
                `删除缩略图失败: ${thumbnailUrl}`,
                error,
            );
        }
    }
}
