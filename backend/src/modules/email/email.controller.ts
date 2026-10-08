import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { PrismaService } from '../../config/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
    QueryEmailLogDto,
    SendTestEmailDto,
    UpdateEmailConfigDto,
    UpdateTemplateDto,
    TestTemplateDto,
    CleanupLogsDto,
} from './dto/email.dto';
import { EmailCategory } from './interfaces/email.interfaces';

/** 模板元数据（可用变量定义） */
const TEMPLATE_META: Record<string, {
    label: string;
    subject: string;
    variables: Array<{
        name: string;
        description: string;
    }>;
}> = {
    'verification-code': {
        label: '验证码邮件',
        subject: '【BNOA】验证码',
        variables: [
            { name: 'code', description: '验证码' },
            { name: 'expireMinutes', description: '过期时间' },
            { name: 'purpose', description: '用途' },
        ],
    },
    'password-changed': {
        label: '密码修改通知',
        subject: '【BNOA】密码修改通知',
        variables: [
            { name: 'username', description: '用户名' },
        ],
    },
    'welcome': {
        label: '欢迎邮件',
        subject: '【BNOA】欢迎加入',
        variables: [
            { name: 'name', description: '姓名' },
            { name: 'username', description: '用户名' },
            { name: 'email', description: '邮箱' },
        ],
    },
    'security-alert': {
        label: '安全告警',
        subject: '【BNOA 安全告警】',
        variables: [
            { name: 'severity', description: '严重程度' },
            { name: 'alertType', description: '告警类型' },
            { name: 'details', description: '详情' },
            { name: 'actionRequired', description: '建议操作' },
        ],
    },
    'file-shared': {
        label: '文件分享通知',
        subject: '【BNOA】有人向您共享了文件夹',
        variables: [
            { name: 'recipientName', description: '收件人' },
            { name: 'sharerName', description: '分享人' },
            { name: 'folderName', description: '文件夹名' },
            { name: 'permissions', description: '权限' },
        ],
    },
    'login-alert': {
        label: '异地登录告警',
        subject: '【BNOA】异常登录提醒',
        variables: [
            { name: 'username', description: '用户名' },
            { name: 'loginTime', description: '登录时间' },
            { name: 'ip', description: 'IP 地址' },
            { name: 'deviceInfo', description: '设备信息' },
        ],
    },
};

@ApiTags('邮件管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('email')
export class EmailController {
    constructor(
        private readonly emailService: EmailService,
        private readonly templateService: EmailTemplateService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {}

    // ==================== 日志接口 ====================

    @Get('logs')
    @Permissions('email:log')
    @ApiOperation({ summary: '查询邮件日志列表' })
    async getLogs(@Query() query: QueryEmailLogDto) {
        return this.emailService.queryLogs(query);
    }

    @Get('logs/stats')
    @Permissions('email:log')
    @ApiOperation({ summary: '获取日志统计' })
    async getLogStats() {
        return this.emailService.getLogStats();
    }

    @Get('logs/:id')
    @Permissions('email:log')
    @ApiOperation({ summary: '查询单条日志详情' })
    async getLogDetail(@Param('id') id: string) {
        const log = await this.prisma.emailLog.findUnique({
            where: { id },
        });
        if (!log) {
            throw new NotFoundException('日志记录不存在');
        }
        return log;
    }

    @Post('logs/:id/resend')
    @Permissions('email:resend')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '手动重发失败邮件' })
    async resend(@Param('id') id: string) {
        await this.emailService.resend(id);
        return { message: '已重新加入发送队列' };
    }

    @Delete('logs/cleanup')
    @Permissions('email:cleanup')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '清理日志' })
    async cleanupLogs(@Body() dto: CleanupLogsDto) {
        const count = await this.emailService.cleanupLogs(
            dto.beforeDays,
        );
        return { message: `已清理 ${count} 条日志` };
    }

    // ==================== 配置接口 ====================

    @Get('config')
    @Permissions('email:config')
    @ApiOperation({ summary: '获取邮件配置' })
    async getConfig() {
        const configs = await this.prisma.config.findMany({
            where: {
                category: 'email',
                deletedAt: null,
                isActive: true,
            },
        });

        const configMap: Record<string, any> = {};
        for (const c of configs) {
            configMap[c.key] = this.parseConfigValue(
                c.value, c.type,
            );
        }

        return {
            senderEmail: configMap['email.senderEmail']
                || this.configService.get('SMTP_FROM_ADDRESS', ''),
            senderName: configMap['email.senderName']
                || this.configService.get('SMTP_FROM_NAME', 'BNOA 办公系统'),
            smtpHost: configMap['email.smtpHost']
                || this.configService.get('SMTP_HOST', 'smtp.qq.com'),
            smtpPort: configMap['email.smtpPort']
                || this.configService.get<number>('SMTP_PORT', 465),
            smtpUser: configMap['email.smtpUser']
                || this.configService.get('SMTP_USER', ''),
            smtpPass: configMap['email.smtpPass']
                ? '********' : '',
            encryption: configMap['email.encryption'] || 'ssl',
            provider: configMap['email.provider'] || 'qq',
            notifications: configMap['email.notifications'] || {
                PASSWORD_RESET_CODE: true,
                PASSWORD_CHANGED: true,
                LOGIN_REMOTE: false,
                SECURITY_ALERT: true,
                WELCOME: true,
                FILE_SHARE: true,
            },
        };
    }

    @Patch('config')
    @Permissions('email:config-update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新邮件配置' })
    async updateConfig(@Body() dto: UpdateEmailConfigDto) {
        const fields: Array<{
            key: string;
            value: any;
            type: string;
        }> = [];

        if (dto.senderEmail !== undefined) {
            fields.push({
                key: 'email.senderEmail',
                value: dto.senderEmail,
                type: 'STRING',
            });
        }
        if (dto.senderName !== undefined) {
            fields.push({
                key: 'email.senderName',
                value: dto.senderName,
                type: 'STRING',
            });
        }
        if (dto.smtpHost !== undefined) {
            fields.push({
                key: 'email.smtpHost',
                value: dto.smtpHost,
                type: 'STRING',
            });
        }
        if (dto.smtpPort !== undefined) {
            fields.push({
                key: 'email.smtpPort',
                value: String(dto.smtpPort),
                type: 'NUMBER',
            });
        }
        if (dto.smtpUser !== undefined) {
            fields.push({
                key: 'email.smtpUser',
                value: dto.smtpUser,
                type: 'STRING',
            });
        }
        if (dto.smtpPass !== undefined) {
            fields.push({
                key: 'email.smtpPass',
                value: dto.smtpPass,
                type: 'STRING',
            });
        }
        if (dto.encryption !== undefined) {
            fields.push({
                key: 'email.encryption',
                value: dto.encryption,
                type: 'STRING',
            });
        }
        if (dto.provider !== undefined) {
            fields.push({
                key: 'email.provider',
                value: dto.provider,
                type: 'STRING',
            });
        }
        if (dto.notifications !== undefined) {
            fields.push({
                key: 'email.notifications',
                value: JSON.stringify(dto.notifications),
                type: 'JSON',
            });
        }

        for (const field of fields) {
            await this.prisma.config.upsert({
                where: { key: field.key },
                update: { value: field.value },
                create: {
                    key: field.key,
                    value: field.value,
                    type: field.type,
                    category: 'email',
                    description: `邮件配置: ${field.key}`,
                    isSystem: true,
                    isActive: true,
                },
            });
        }

        return { message: '邮件配置更新成功' };
    }

    @Post('test')
    @Permissions('email:test')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '发送测试邮件' })
    async sendTestEmail(@Body() dto: SendTestEmailDto) {
        await this.emailService.send({
            to: dto.to,
            subject: '【BNOA】测试邮件',
            template: 'welcome',
            data: {
                name: '测试用户',
                username: 'test',
                email: dto.to,
            },
            category: EmailCategory.SYSTEM,
        });
        return { message: '测试邮件已加入发送队列' };
    }

    // ==================== 模板接口 ====================

    @Get('templates')
    @Permissions('email:template')
    @ApiOperation({ summary: '获取模板列表' })
    async getTemplates() {
        const names = this.templateService.getTemplateNames();
        return names.map(name => ({
            name,
            ...(TEMPLATE_META[name] || {
                label: name, subject: '', variables: [],
            }),
        }));
    }

    @Get('templates/:name')
    @Permissions('email:template')
    @ApiOperation({ summary: '获取单个模板详情' })
    async getTemplate(@Param('name') name: string) {
        const source =
            this.templateService.getTemplateSource(name);
        if (source === null) {
            throw new NotFoundException(
                `模板 ${name} 不存在`,
            );
        }

        const meta = TEMPLATE_META[name] || {
            label: name, subject: '', variables: [],
        };

        return { name, content: source, ...meta };
    }

    @Patch('templates/:name')
    @Permissions('email:template-update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新模板内容' })
    async updateTemplate(
        @Param('name') name: string,
        @Body() dto: UpdateTemplateDto,
    ) {
        this.templateService.saveTemplateSource(
            name, dto.content,
        );

        // 如果提供了 subject，保存到配置
        if (dto.subject) {
            await this.prisma.config.upsert({
                where: {
                    key: `email.template.${name}.subject`,
                },
                update: { value: dto.subject },
                create: {
                    key: `email.template.${name}.subject`,
                    value: dto.subject,
                    type: 'STRING',
                    category: 'email',
                    description: `模板 ${name} 的邮件标题`,
                    isSystem: true,
                    isActive: true,
                },
            });
        }

        return { message: '模板更新成功' };
    }

    @Post('templates/:name/test')
    @Permissions('email:test')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '发送模板测试邮件' })
    async testTemplate(
        @Param('name') name: string,
        @Body() dto: TestTemplateDto,
    ) {
        const meta = TEMPLATE_META[name];
        if (!meta) {
            throw new NotFoundException(
                `模板 ${name} 不存在`,
            );
        }

        // 使用模拟数据填充变量
        const mockData: Record<string, string> = {};
        for (const v of meta.variables) {
            mockData[v.name] = `[${v.description}]`;
        }
        // 特殊变量填充
        if (mockData['code']) mockData['code'] = '888888';
        if (mockData['expireMinutes']) {
            mockData['expireMinutes'] = '15';
        }

        await this.emailService.send({
            to: dto.to,
            subject: `${meta.subject}（测试）`,
            template: name,
            data: mockData,
            category: EmailCategory.SYSTEM,
        });

        return { message: '测试邮件已加入发送队列' };
    }

    private parseConfigValue(
        value: string, type: string,
    ): any {
        switch (type) {
            case 'NUMBER':
                return Number(value);
            case 'BOOLEAN':
                return value === 'true' || value === '1';
            case 'JSON':
                try { return JSON.parse(value); }
                catch { return value; }
            default:
                return value;
        }
    }
}
