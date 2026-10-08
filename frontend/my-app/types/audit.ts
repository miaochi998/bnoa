export interface AuditLog {
  id: string;
  module: string;
  action: string;
  targetType?: string;
  targetId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
  requestData?: Record<string, any>;
  responseData?: Record<string, any>;
  duration?: number;
  userId: string;
  username?: string;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AuditLogFilter {
  module?: string;
  action?: string;
  status?: 'SUCCESS' | 'FAILURE';
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditStatistics {
  totalLogs: number;
  successCount: number;
  failureCount: number;
  todayCount: number;
  moduleStats: { module: string; count: number }[];
}
