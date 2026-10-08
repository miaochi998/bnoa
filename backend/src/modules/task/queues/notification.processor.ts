import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../config/prisma.service';
import {
    NotificationJobData,
} from '../../notification/interfaces/notification.interfaces';

@Processor('notification')
export class NotificationProcessor
    extends WorkerHost {
    private readonly logger =
        new Logger(NotificationProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
    ) {
        super();
    }

    async process(
        job: Job<NotificationJobData>,
    ): Promise<void> {
        const { broadcastId, userIds } = job.data;

        this.logger.log(
            `处理通知队列任务: ${broadcastId}，` +
            `用户数: ${userIds.length}`,
        );

        const batchSize = 100;
        let created = 0;

        for (
            let i = 0; i < userIds.length;
            i += batchSize
        ) {
            const batch = userIds.slice(
                i, i + batchSize,
            );

            const data = batch.map((userId) => ({
                userId,
                broadcastId,
            }));

            const result =
                await this.prisma.notification
                    .createMany({ data });
            created += result.count;

            await job.updateProgress(
                Math.round(
                    (i + batch.length) /
                    userIds.length * 100,
                ),
            );
        }

        await this.prisma.notificationBroadcast
            .update({
                where: { id: broadcastId },
                data: {
                    sentCount: created,
                    status: 'SENT',
                    sentAt: new Date(),
                },
            });

        this.logger.log(
            `通知队列任务完成: ${broadcastId}，` +
            `创建: ${created}`,
        );
    }
}
