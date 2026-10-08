import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../config/prisma.service';
import * as fs from 'fs';

@Injectable()
export class ExportCleanupScheduler {
    private readonly logger =
        new Logger(ExportCleanupScheduler.name);

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    /** 每天凌晨 02:30 — 清理过期导出文件 */
    @Cron('0 30 2 * * *')
    async cleanupExpiredExports() {
        this.logger.log('开始清理过期导出任务...');

        // 查找过期任务
        const expiredTasks =
            await this.prisma.exportTask.findMany({
                where: {
                    expiresAt: { lt: new Date() },
                },
            });

        let deletedFiles = 0;
        for (const task of expiredTasks) {
            // 删除文件
            if (
                task.filePath &&
                fs.existsSync(task.filePath)
            ) {
                try {
                    fs.unlinkSync(task.filePath);
                    deletedFiles++;
                } catch (err) {
                    this.logger.warn(
                        `删除文件失败: ${task.filePath}`,
                    );
                }
            }
        }

        // 删除过期任务记录
        const result =
            await this.prisma.exportTask.deleteMany({
                where: {
                    expiresAt: { lt: new Date() },
                },
            });

        this.logger.log(
            `清理过期导出完成：` +
            `删除任务 ${result.count} 条，` +
            `删除文件 ${deletedFiles} 个`,
        );
    }
}
