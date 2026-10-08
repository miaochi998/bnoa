import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../config/prisma.service';
import { EmailJobData } from '../../email/interfaces/email.interfaces';

interface SmtpConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    senderEmail: string;
    senderName: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
    private readonly logger = new Logger(
        EmailProcessor.name,
    );
    private transporter: nodemailer.Transporter | null =
        null;
    private cachedConfigHash = '';

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        super();
    }

    private async loadSmtpConfig(): Promise<SmtpConfig> {
        const configs =
            await this.prisma.config.findMany({
                where: {
                    category: 'email',
                    deletedAt: null,
                    isActive: true,
                },
            });

        const map: Record<string, string> = {};
        for (const c of configs) {
            map[c.key] = c.value;
        }

        const encryption =
            map['email.encryption'] || 'ssl';

        return {
            host:
                map['email.smtpHost'] ||
                this.config.get(
                    'SMTP_HOST',
                    'smtp.qq.com',
                ),
            port:
                parseInt(
                    map['email.smtpPort'] || '',
                ) ||
                this.config.get<number>(
                    'SMTP_PORT',
                    465,
                ),
            user:
                map['email.smtpUser'] ||
                this.config.get('SMTP_USER', ''),
            pass:
                map['email.smtpPass'] ||
                this.config.get('SMTP_PASS', ''),
            secure: encryption === 'ssl',
            senderEmail:
                map['email.senderEmail'] ||
                this.config.get(
                    'SMTP_FROM_ADDRESS',
                    '',
                ),
            senderName:
                map['email.senderName'] ||
                this.config.get(
                    'SMTP_FROM_NAME',
                    'BNOA 办公系统',
                ),
        };
    }

    private async getTransporter(
        smtp: SmtpConfig,
    ): Promise<nodemailer.Transporter> {
        const hash = [
            smtp.host,
            smtp.port,
            smtp.user,
            smtp.pass,
            smtp.secure,
        ].join('|');

        if (
            this.transporter &&
            this.cachedConfigHash === hash
        ) {
            return this.transporter;
        }

        if (this.transporter) {
            this.transporter.close();
        }

        this.transporter =
            nodemailer.createTransport({
                host: smtp.host,
                port: smtp.port,
                secure: smtp.secure,
                auth: {
                    user: smtp.user,
                    pass: smtp.pass,
                },
                pool: true,
                maxConnections: 3,
                maxMessages: 100,
            });
        this.cachedConfigHash = hash;

        return this.transporter;
    }

    async process(
        job: Job<EmailJobData>,
    ): Promise<void> {
        const { logId, to, subject, html } = job.data;

        await this.prisma.emailLog.update({
            where: { id: logId },
            data: { status: 'SENDING' },
        });

        try {
            const smtp = await this.loadSmtpConfig();
            const transporter =
                await this.getTransporter(smtp);

            await transporter.sendMail({
                from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
                to,
                subject,
                html,
            });

            await this.prisma.emailLog.update({
                where: { id: logId },
                data: {
                    status: 'SUCCESS',
                    sentAt: new Date(),
                    retryCount: job.attemptsMade,
                },
            });

            this.logger.log(
                `邮件发送成功: ${to} - ${subject}`,
            );
        } catch (error) {
            await this.prisma.emailLog.update({
                where: { id: logId },
                data: {
                    status: 'FAILED',
                    errorMessage:
                        (error as Error).message,
                    retryCount: job.attemptsMade,
                },
            });

            this.logger.error(
                `邮件发送失败: ${to} - ${(error as Error).message}`,
            );

            throw error;
        }
    }
}
