import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../config/prisma.service';
import { VirusScannerService } from '../../upload/security/virus-scanner.service';

/**
 * 病毒扫描队列处理器
 * 异步扫描上传的文件，发现病毒时自动隔离
 */
@Processor('virus-scan', { concurrency: 2 })
export class VirusScanProcessor extends WorkerHost {
    private readonly logger =
        new Logger(VirusScanProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly virusScanner: VirusScannerService,
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { fileId, filePath, fileName } = job.data;

        this.logger.log(`开始扫描文件: ${fileName}`);

        try {
            const result =
                await this.virusScanner.scanFile(filePath);

            if (!result.isClean) {
                this.logger.warn(
                    `检测到病毒: ${fileName} - ` +
                    result.threats.join(', '),
                );

                await this.prisma.securityLog.create({
                    data: {
                        type: 'VIRUS_DETECTED',
                        severity: 'CRITICAL',
                        status: 'NEW',
                        fileId,
                        fileName,
                        details: `检测到威胁: ${result.threats.join(', ')}`,
                        metadata: {
                            scanDetails: result.scanDetails,
                            scanTime: result.scanTime,
                            threats: result.threats,
                        },
                    },
                });
            }

            this.logger.log(
                `扫描完成: ${fileName} ` +
                `(${result.scanTime}ms, ` +
                `${result.isClean ? '安全' : '发现威胁'})`,
            );
        } catch (error) {
            this.logger.error(
                `扫描文件失败: ${fileName}`,
                error,
            );
            throw error;
        }
    }
}
