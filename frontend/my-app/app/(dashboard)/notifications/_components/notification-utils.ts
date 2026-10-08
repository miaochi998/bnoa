import {
    Bell, Megaphone, Wrench, ShieldAlert,
    ClipboardCheck, CheckCircle, Copy,
    Share2, MessageSquare, UploadCloud,
    UserPlus, Clock, CheckSquare, AtSign,
    Reply, ThumbsUp, Mail, Settings,
    FileCheck, FolderOpen, ListTodo,
    type LucideIcon,
} from 'lucide-react';

export function getNotificationIcon(
    type: string,
): LucideIcon {
    const iconMap: Record<string, LucideIcon> = {
        system_announce: Megaphone,
        system_maintenance: Wrench,
        system_security: ShieldAlert,
        approval_pending: ClipboardCheck,
        approval_result: CheckCircle,
        approval_cc: Copy,
        file_shared: Share2,
        file_comment: MessageSquare,
        file_upload_complete: UploadCloud,
        task_assigned: UserPlus,
        task_deadline: Clock,
        task_completed: CheckSquare,
        mention: AtSign,
        comment_reply: Reply,
        like: ThumbsUp,
    };
    return iconMap[type] || Bell;
}

export function getNotificationTypeName(
    type: string,
): string {
    const nameMap: Record<string, string> = {
        system_announce: '系统公告',
        system_maintenance: '系统维护',
        system_security: '安全提醒',
        approval_pending: '待审批',
        approval_result: '审批结果',
        approval_cc: '审批抄送',
        file_shared: '文件共享',
        file_comment: '文件评论',
        file_upload_complete: '上传完成',
        task_assigned: '任务分配',
        task_deadline: '任务截止',
        task_completed: '任务完成',
        mention: '@提及',
        comment_reply: '回复通知',
        like: '点赞',
    };
    return nameMap[type] || '通知';
}

export const PRIORITY_STYLES: Record<
    string, string
> = {
    URGENT: 'bg-destructive/10 text-destructive',
    HIGH: 'bg-orange-500/10 text-orange-600',
    NORMAL: 'bg-primary/10 text-primary',
    LOW: 'bg-muted text-muted-foreground',
};

export const PRIORITY_LABELS: Record<
    string, string
> = {
    URGENT: '紧急',
    HIGH: '重要',
    NORMAL: '普通',
    LOW: '低',
};

export const NOTIFICATION_TABS = [
    {
        key: 'all', label: '全部',
        icon: Bell,
    },
    {
        key: 'unread', label: '未读',
        icon: Mail,
    },
    {
        key: 'system', label: '系统',
        icon: Settings,
        types: [
            'system_announce',
            'system_maintenance',
            'system_security',
        ],
    },
    {
        key: 'approval', label: '审批',
        icon: FileCheck,
        types: [
            'approval_pending',
            'approval_result',
            'approval_cc',
        ],
    },
    {
        key: 'file', label: '文件',
        icon: FolderOpen,
        types: [
            'file_shared',
            'file_comment',
            'file_upload_complete',
        ],
    },
    {
        key: 'task', label: '任务',
        icon: ListTodo,
        types: [
            'task_assigned',
            'task_deadline',
            'task_completed',
        ],
    },
];

export function formatRelativeTime(
    date: string,
): string {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return new Date(date).toLocaleDateString(
        'zh-CN',
    );
}
