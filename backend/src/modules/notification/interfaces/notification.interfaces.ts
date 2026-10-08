export interface CreateNotificationParams {
    userId: string;
    type: string;
    title: string;
    content: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    relatedType?: string;
    relatedId?: string;
    actionUrl?: string;
}

export interface NotificationJobData {
    type: 'broadcast';
    broadcastId: string;
    userIds: string[];
    notification: {
        type: string;
        priority: string;
        title: string;
        content: string;
        actionUrl?: string;
    };
}

export interface NotificationStats {
    total: number;
    unread: number;
    read: number;
    byType: { type: string; count: number }[];
    byPriority: { priority: string; count: number }[];
}
