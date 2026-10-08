import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../config/prisma.service';

/**
 * 审计日志异步写入队列处理器
 * 非关键任务，失败仅记录警告日志
 */
@Processor('audit-log', { concurrency: 5 })
export class AuditLogProcessor extends WorkerHost {
    private readonly logger =
        new Logger(AuditLogProcessor.name);

    constructor(private readonly prisma: PrismaService) {
        super();
    }

    async process(job: Job): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: job.data,
            });
        } catch (error) {
            this.logger.warn(
                `异步写入审计日志失败: ${job.id}`,
                error,
            );
        }
    }
}
