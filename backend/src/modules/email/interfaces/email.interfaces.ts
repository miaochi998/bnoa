/** 邮件发送选项 */
export interface SendEmailOptions {
    /** 收件人邮箱 */
    to: string;
    /** 邮件主题 */
    subject: string;
    /** 模板名称 */
    template: string;
    /** 模板变量 */
    data: Record<string, any>;
    /** 邮件分类 */
    category?: EmailCategory;
    /** 关联用户 ID */
    userId?: string;
    /** 优先级（1-10，数字越小优先级越高） */
    priority?: number;
    /** 延迟发送（毫秒） */
    delay?: number;
}

/** 批量发送选项 */
export interface SendBatchEmailOptions {
    /** 收件人列表 */
    recipients: Array<{
        to: string;
        data: Record<string, any>;
        userId?: string;
    }>;
    /** 共用主题 */
    subject: string;
    /** 共用模板 */
    template: string;
    /** 邮件分类 */
    category?: EmailCategory;
}

/** 验证码发送选项 */
export interface SendCodeOptions {
    /** 收件人邮箱 */
    to: string;
    /** 验证码用途 */
    purpose: CodePurpose;
    /** 关联用户 ID */
    userId?: string;
}

/** 邮件分类 */
export enum EmailCategory {
    VERIFICATION = 'verification',
    NOTIFICATION = 'notification',
    ALERT = 'alert',
    SYSTEM = 'system',
}

/** 验证码用途 */
export enum CodePurpose {
    PASSWORD_RESET = 'password_reset',
    EMAIL_VERIFY = 'email_verify',
    BIND_EMAIL = 'bind_email',
}

/** 邮件队列 Job 数据 */
export interface EmailJobData {
    /** 邮件日志 ID */
    logId: string;
    /** 收件人 */
    to: string;
    /** 主题 */
    subject: string;
    /** 已渲染的 HTML 内容 */
    html: string;
}

/** 邮件日志查询参数 */
export interface QueryEmailLogParams {
    page?: number;
    pageSize?: number;
    status?: string;
    category?: string;
    to?: string;
    startDate?: string;
    endDate?: string;
}
