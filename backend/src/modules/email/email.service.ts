import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { EmailTemplateService } from './email-template.service';
import {
    SendEmailOptions,
    SendBatchEmailOptions,
    SendCodeOptions,
    EmailCategory,
    EmailJobData,
    CodePurpose,
    QueryEmailLogParams,
} from './interfaces/email.interfaces';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly templateService: EmailTemplateService,
        private readonly redis: RedisService,
        @InjectQueue('email')
        private readonly emailQueue: Queue,
    ) {
        this.enabled =
            this.config.get('EMAIL_ENABLED', 'true') !== 'false';
    }

    /** 发送单封邮件（异步入队） */
    async send(options: SendEmailOptions): Promise<string> {
        if (!this.enabled) {
            this.logger.warn('邮件服务已禁用，跳过发送');
            return '';
        }

        const html = await this.templateService.render(
            options.template, options.data,
        );

        const log = await this.prisma.emailLog.create({
            data: {
                to: options.to,
                subject: options.subject,
                template: options.template,
                templateData: this.sanitizeData(
                    options.data,
                ),
                category: options.category || 'system',
                userId: options.userId,
                status: 'PENDING',
            },
        });

        await this.emailQueue.add('send', {
            logId: log.id,
            to: options.to,
            subject: options.subject,
            html,
        } as EmailJobData, {
            priority: options.priority || 5,
            delay: options.delay,
            attempts: this.config.get<number>(
                'EMAIL_QUEUE_MAX_RETRIES', 3,
            ),
            backoff: {
                type: 'exponential',
                delay: this.config.get<number>(
                    'EMAIL_QUEUE_RETRY_DELAY', 10000,
                ),
            },
        });

        return log.id;
    }

    /** 发送验证码邮件 */
    async sendCode(options: SendCodeOptions): Promise<void> {
        const rateLimitSeconds = this.config.get<number>(
            'EMAIL_CODE_RATE_LIMIT_SECONDS', 60,
        );
        const limitKey = `email:limit:${options.to}`;
        const isLimited = await this.redis.exists(limitKey);
        if (isLimited) {
            throw new BadRequestException(
                `请${rateLimitSeconds}秒后再试`,
            );
        }

        const dailyLimit = this.config.get<number>(
            'EMAIL_CODE_DAILY_LIMIT', 10,
        );
        const dailyKey =
            `email:daily:${options.purpose}:${options.to}`;
        const dailyCount = await this.redis.get(dailyKey);
        if (
            dailyCount &&
            parseInt(dailyCount, 10) >= dailyLimit
        ) {
            throw new BadRequestException(
                '今日验证码发送次数已达上限',
            );
        }

        const codeLength = this.config.get<number>(
            'EMAIL_CODE_LENGTH', 6,
        );
        const expireMinutes = this.config.get<number>(
            'EMAIL_CODE_EXPIRE_MINUTES', 15,
        );

        const code = this.generateCode(codeLength);
        const redisKey =
            `email:code:${options.purpose}:${options.to}`;
        await this.redis.set(
            redisKey, code, expireMinutes * 60,
        );
        await this.redis.set(
            limitKey, '1', rateLimitSeconds,
        );

        const newCount = dailyCount
            ? parseInt(dailyCount, 10) + 1 : 1;
        const secondsUntilMidnight =
            this.getSecondsUntilMidnight();
        await this.redis.set(
            dailyKey,
            String(newCount),
            secondsUntilMidnight,
        );

        const subjectMap: Record<string, string> = {
            password_reset: '密码重置验证码',
            email_verify: '邮箱验证码',
            bind_email: '绑定邮箱验证码',
        };

        await this.send({
            to: options.to,
            subject: `【BNOA】${subjectMap[options.purpose] || '验证码'}`,
            template: 'verification-code',
            data: {
                code,
                purpose: subjectMap[options.purpose],
                expireMinutes,
            },
            category: EmailCategory.VERIFICATION,
            userId: options.userId,
            priority: 1,
        });
    }

    /** 验证邮箱验证码 */
    async verifyCode(
        email: string,
        purpose: CodePurpose,
        code: string,
    ): Promise<boolean> {
        const redisKey =
            `email:code:${purpose}:${email}`;
        const storedCode = await this.redis.get(redisKey);

        if (!storedCode || storedCode !== code) {
            return false;
        }

        await this.redis.del(redisKey);
        return true;
    }

    /** 批量发送 */
    async sendBatch(
        options: SendBatchEmailOptions,
    ): Promise<string[]> {
        const logIds: string[] = [];
        for (const recipient of options.recipients) {
            const logId = await this.send({
                to: recipient.to,
                subject: options.subject,
                template: options.template,
                data: recipient.data,
                category: options.category,
                userId: recipient.userId,
            });
            logIds.push(logId);
        }
        return logIds;
    }

    /** 查询邮件日志列表 */
    async queryLogs(params: QueryEmailLogParams) {
        const {
            page = 1,
            pageSize = 20,
            status,
            category,
            to,
            startDate,
            endDate,
        } = params;

        const where: any = { deletedAt: null };
        if (status) where.status = status;
        if (category) where.category = category;
        if (to) where.to = { contains: to };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }

        const [list, total] = await Promise.all([
            this.prisma.emailLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.emailLog.count({ where }),
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

    /** 获取日志统计 */
    async getLogStats() {
        const [total, success, pending, failed] =
            await Promise.all([
                this.prisma.emailLog.count({
                    where: { deletedAt: null },
                }),
                this.prisma.emailLog.count({
                    where: {
                        deletedAt: null,
                        status: 'SUCCESS',
                    },
                }),
                this.prisma.emailLog.count({
                    where: {
                        deletedAt: null,
                        status: 'PENDING',
                    },
                }),
                this.prisma.emailLog.count({
                    where: {
                        deletedAt: null,
                        status: 'FAILED',
                    },
                }),
            ]);

        const successRate = total > 0
            ? `${((success / total) * 100).toFixed(1)}%`
            : '0%';

        return {
            total, success, pending, failed, successRate,
        };
    }

    /** 清理指定天数前的日志 */
    async cleanupLogs(beforeDays: number): Promise<number> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - beforeDays);

        const result =
            await this.prisma.emailLog.updateMany({
                where: {
                    createdAt: { lt: cutoff },
                    deletedAt: null,
                },
                data: { deletedAt: new Date() },
            });

        this.logger.log(
            `清理 ${beforeDays} 天前邮件日志: ${result.count} 条`,
        );
        return result.count;
    }

    /** 手动重发失败邮件 */
    async resend(logId: string): Promise<void> {
        const log = await this.prisma.emailLog.findUnique({
            where: { id: logId },
        });

        if (!log) {
            throw new BadRequestException('日志记录不存在');
        }

        if (log.status !== 'FAILED') {
            throw new BadRequestException(
                '只能重发失败的邮件',
            );
        }

        const html = await this.templateService.render(
            log.template,
            (log.templateData as Record<string, any>) || {},
        );

        await this.prisma.emailLog.update({
            where: { id: logId },
            data: { status: 'PENDING', retryCount: 0 },
        });

        await this.emailQueue.add('send', {
            logId: log.id,
            to: log.to,
            subject: log.subject,
            html,
        } as EmailJobData, {
            attempts: this.config.get<number>(
                'EMAIL_QUEUE_MAX_RETRIES', 3,
            ),
            backoff: {
                type: 'exponential',
                delay: this.config.get<number>(
                    'EMAIL_QUEUE_RETRY_DELAY', 10000,
                ),
            },
        });
    }

    private generateCode(length: number): string {
        const chars = '0123456789';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(
                Math.floor(Math.random() * chars.length),
            );
        }
        return code;
    }

    private sanitizeData(
        data: Record<string, any>,
    ): Record<string, any> {
        const sanitized = { ...data };
        const sensitiveKeys = [
            'code', 'password', 'token', 'secret',
        ];
        for (const key of sensitiveKeys) {
            if (sanitized[key]) {
                sanitized[key] = '******';
            }
        }
        return sanitized;
    }

    private getSecondsUntilMidnight(): number {
        const now = new Date();
        const midnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
        );
        return Math.floor(
            (midnight.getTime() - now.getTime()) / 1000,
        );
    }
}
