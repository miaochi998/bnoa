export interface NotificationTemplate {
    type: string;
    category: string;
    defaultTitle: string;
    defaultContent: string;
    defaultPriority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    canDisable: boolean;
    emailEnabled: boolean;
}

export const NOTIFICATION_TEMPLATES: Record<
    string, NotificationTemplate
> = {
    system_announce: {
        type: 'system_announce',
        category: 'system',
        defaultTitle: '系统公告',
        defaultContent: '{content}',
        defaultPriority: 'NORMAL',
        canDisable: false,
        emailEnabled: false,
    },
    system_maintenance: {
        type: 'system_maintenance',
        category: 'system',
        defaultTitle: '系统维护通知',
        defaultContent: '系统将于 {time} 进行维护',
        defaultPriority: 'HIGH',
        canDisable: false,
        emailEnabled: true,
    },
    system_security: {
        type: 'system_security',
        category: 'system',
        defaultTitle: '安全提醒',
        defaultContent: '您的账号发生了 {event}',
        defaultPriority: 'URGENT',
        canDisable: false,
        emailEnabled: true,
    },
    approval_pending: {
        type: 'approval_pending',
        category: 'approval',
        defaultTitle: '您有新的审批待处理',
        defaultContent: '{applicant} 提交了 {approvalType}',
        defaultPriority: 'HIGH',
        canDisable: true,
        emailEnabled: true,
    },
    approval_result: {
        type: 'approval_result',
        category: 'approval',
        defaultTitle: '审批结果通知',
        defaultContent: '您提交的 {approvalType} 已{result}',
        defaultPriority: 'NORMAL',
        canDisable: true,
        emailEnabled: false,
    },
    approval_cc: {
        type: 'approval_cc',
        category: 'approval',
        defaultTitle: '审批抄送通知',
        defaultContent: '{applicant} 的 {approvalType} 已抄送给您',
        defaultPriority: 'LOW',
        canDisable: true,
        emailEnabled: false,
    },
    file_shared: {
        type: 'file_shared',
        category: 'file',
        defaultTitle: '文件共享通知',
        defaultContent: '{sharer} 共享了 {fileName} 给您',
        defaultPriority: 'NORMAL',
        canDisable: true,
        emailEnabled: false,
    },
    file_comment: {
        type: 'file_comment',
        category: 'file',
        defaultTitle: '文件评论通知',
        defaultContent: '{commenter} 评论了您的文件 {fileName}',
        defaultPriority: 'LOW',
        canDisable: true,
        emailEnabled: false,
    },
    file_upload_complete: {
        type: 'file_upload_complete',
        category: 'file',
        defaultTitle: '上传完成通知',
        defaultContent: '文件 {fileName} 已上传完成',
        defaultPriority: 'LOW',
        canDisable: true,
        emailEnabled: false,
    },
    task_assigned: {
        type: 'task_assigned',
        category: 'task',
        defaultTitle: '任务分配通知',
        defaultContent: '{assigner} 分配了任务 {taskName} 给您',
        defaultPriority: 'HIGH',
        canDisable: true,
        emailEnabled: true,
    },
    task_deadline: {
        type: 'task_deadline',
        category: 'task',
        defaultTitle: '任务截止提醒',
        defaultContent: '任务 {taskName} 将于 {deadline} 截止',
        defaultPriority: 'HIGH',
        canDisable: true,
        emailEnabled: true,
    },
    task_completed: {
        type: 'task_completed',
        category: 'task',
        defaultTitle: '任务完成通知',
        defaultContent: '任务 {taskName} 已完成',
        defaultPriority: 'NORMAL',
        canDisable: true,
        emailEnabled: false,
    },
    mention: {
        type: 'mention',
        category: 'interaction',
        defaultTitle: '@提及通知',
        defaultContent: '{mentioner} 在 {context} 中提及了您',
        defaultPriority: 'NORMAL',
        canDisable: true,
        emailEnabled: false,
    },
    comment_reply: {
        type: 'comment_reply',
        category: 'interaction',
        defaultTitle: '回复通知',
        defaultContent: '{replier} 回复了您的评论',
        defaultPriority: 'LOW',
        canDisable: true,
        emailEnabled: false,
    },
    like: {
        type: 'like',
        category: 'interaction',
        defaultTitle: '点赞通知',
        defaultContent: '{liker} 点赞了您的 {content}',
        defaultPriority: 'LOW',
        canDisable: true,
        emailEnabled: false,
    },
};

export const NOTIFICATION_CATEGORIES = {
    system: {
        label: '系统通知',
        types: [
            'system_announce',
            'system_maintenance',
            'system_security',
        ],
    },
    approval: {
        label: '审批通知',
        types: [
            'approval_pending',
            'approval_result',
            'approval_cc',
        ],
    },
    file: {
        label: '文件通知',
        types: [
            'file_shared',
            'file_comment',
            'file_upload_complete',
        ],
    },
    task: {
        label: '任务通知',
        types: [
            'task_assigned',
            'task_deadline',
            'task_completed',
        ],
    },
    interaction: {
        label: '互动通知',
        types: ['mention', 'comment_reply', 'like'],
    },
};
