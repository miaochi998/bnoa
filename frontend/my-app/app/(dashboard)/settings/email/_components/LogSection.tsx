'use client'

import { getApiBaseUrl } from '@/lib/config';

import {
    useState,
    useEffect,
    useCallback,
} from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Loader2,
    Trash2,
    RefreshCw,
    RotateCcw,
    CheckCircle,
    XCircle,
    Clock,
    BarChart3,
} from 'lucide-react';

const API_URL =
    getApiBaseUrl();

interface LogItem {
    id: string;
    to: string;
    subject: string;
    template: string;
    status: string;
    category: string;
    error: string | null;
    sentAt: string | null;
    createdAt: string;
}

interface LogStats {
    total: number;
    success: number;
    failed: number;
    pending: number;
    successRate: string;
}

const STATUS_BADGE: Record<
    string,
    {
        label: string;
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }
> = {
    SUCCESS: {
        label: '成功',
        variant: 'default',
    },
    FAILED: {
        label: '失败',
        variant: 'destructive',
    },
    PENDING: {
        label: '待发送',
        variant: 'secondary',
    },
    QUEUED: {
        label: '队列中',
        variant: 'outline',
    },
};

const CATEGORY_LABELS: Record<string, string> = {
    verification: '验证码',
    notification: '通知',
    alert: '告警',
    system: '系统',
};

export default function LogSection() {
    const [stats, setStats] =
        useState<LogStats | null>(null);
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] =
        useState('all');
    const [categoryFilter, setCategoryFilter] =
        useState('all');
    const [cleanupOpen, setCleanupOpen] =
        useState(false);
    const [cleanupDays, setCleanupDays] =
        useState('30');
    const [cleaning, setCleaning] = useState(false);
    const [resending, setResending] = useState<
        string | null
    >(null);

    const getToken = () =>
        localStorage.getItem('accessToken');

    const loadStats = useCallback(async () => {
        try {
            const res = await fetch(
                `${API_URL}/email/logs/stats`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                },
            );
            const json = await res.json();
            const data =
                json.data?.data || json.data || json;
            if (data && data.total !== undefined) {
                setStats(data);
            }
        } catch {
            // 忽略
        }
    }, []);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', String(page));
            params.append('pageSize', '20');
            if (statusFilter !== 'all') {
                params.append(
                    'status',
                    statusFilter,
                );
            }
            if (categoryFilter !== 'all') {
                params.append(
                    'category',
                    categoryFilter,
                );
            }
            const res = await fetch(
                `${API_URL}/email/logs?${params.toString()}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                },
            );
            const json = await res.json();
            const data =
                json.data?.data || json.data;
            if (data) {
                setLogs(data.list || []);
                const pagination =
                    data.pagination || {};
                setTotalPages(
                    pagination.totalPages || 1,
                );
            }
        } catch {
            // 忽略
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, categoryFilter]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const handleCleanup = async () => {
        setCleaning(true);
        try {
            const res = await fetch(
                `${API_URL}/email/logs/cleanup`,
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                    body: JSON.stringify({
                        beforeDays:
                            parseInt(cleanupDays),
                    }),
                },
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    err.message || '清理失败',
                );
            }
            const json = await res.json();
            const msg =
                json.data?.message ||
                json.message ||
                '清理完成';
            alert(msg);
            setCleanupOpen(false);
            loadStats();
            loadLogs();
        } catch (err: any) {
            alert(err.message || '清理日志失败');
        } finally {
            setCleaning(false);
        }
    };

    const handleResend = async (id: string) => {
        setResending(id);
        try {
            const res = await fetch(
                `${API_URL}/email/logs/${id}/resend`,
                {
                    method: 'POST',
                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                },
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    err.message || '重发失败',
                );
            }
            alert('已重新加入发送队列');
            loadLogs();
        } catch (err: any) {
            alert(err.message || '重发失败');
        } finally {
            setResending(null);
        }
    };

    const formatTime = (str: string | null) => {
        if (!str) return '-';
        return new Date(str).toLocaleString(
            'zh-CN',
        );
    };

    const s = stats || {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        successRate: '0%',
    };

    return (
        <div className="space-y-6">
            {/* 统计概览 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                    label="总发送"
                    value={s.total}
                    icon={
                        <BarChart3 className="h-4 w-4" />
                    }
                />
                <StatCard
                    label="发送成功"
                    value={s.success}
                    icon={
                        <CheckCircle className="h-4 w-4" />
                    }
                    color="text-emerald-500"
                />
                <StatCard
                    label="发送失败"
                    value={s.failed}
                    icon={
                        <XCircle className="h-4 w-4" />
                    }
                    color="text-red-500"
                />
                <StatCard
                    label="待发送"
                    value={s.pending}
                    icon={
                        <Clock className="h-4 w-4" />
                    }
                    color="text-amber-500"
                />
                <StatCard
                    label="成功率"
                    value={s.successRate}
                    icon={
                        <BarChart3 className="h-4 w-4" />
                    }
                />
            </div>

            {/* 筛选与操作 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-32 bg-background">
                            <SelectValue placeholder="状态" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                全部状态
                            </SelectItem>
                            <SelectItem value="SUCCESS">
                                成功
                            </SelectItem>
                            <SelectItem value="FAILED">
                                失败
                            </SelectItem>
                            <SelectItem value="PENDING">
                                待发送
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={categoryFilter}
                        onValueChange={(v) => {
                            setCategoryFilter(v);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-32 bg-background">
                            <SelectValue placeholder="类型" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                全部类型
                            </SelectItem>
                            <SelectItem value="verification">
                                验证码
                            </SelectItem>
                            <SelectItem value="notification">
                                通知
                            </SelectItem>
                            <SelectItem value="alert">
                                告警
                            </SelectItem>
                            <SelectItem value="system">
                                系统
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            loadStats();
                            loadLogs();
                        }}
                    >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        刷新
                    </Button>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        setCleanupOpen(true)
                    }
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    清理日志
                </Button>
            </div>

            {/* 日志表格 */}
            <div className="rounded-lg border border-border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[160px]">
                                发送时间
                            </TableHead>
                            <TableHead>
                                邮件主题
                            </TableHead>
                            <TableHead className="w-[80px]">
                                类型
                            </TableHead>
                            <TableHead className="w-[180px]">
                                收件人
                            </TableHead>
                            <TableHead className="w-[80px]">
                                状态
                            </TableHead>
                            <TableHead>
                                错误信息
                            </TableHead>
                            <TableHead className="w-[80px]">
                                操作
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="h-32 text-center"
                                >
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="h-32 text-center text-muted-foreground"
                                >
                                    暂无日志记录
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => {
                                const badge =
                                    STATUS_BADGE[
                                        log.status
                                    ] || {
                                        label: log.status,
                                        variant:
                                            'outline' as const,
                                    };
                                return (
                                    <TableRow
                                        key={log.id}
                                    >
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatTime(
                                                log.sentAt ||
                                                    log.createdAt,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate">
                                            {
                                                log.subject
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground">
                                                {CATEGORY_LABELS[
                                                    log
                                                        .category
                                                ] ||
                                                    log.category}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[180px] truncate">
                                            {log.to}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    badge.variant
                                                }
                                            >
                                                {
                                                    badge.label
                                                }
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                            {log.error ||
                                                '-'}
                                        </TableCell>
                                        <TableCell>
                                            {log.status ===
                                                'FAILED' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2"
                                                    onClick={() =>
                                                        handleResend(
                                                            log.id,
                                                        )
                                                    }
                                                    disabled={
                                                        resending ===
                                                        log.id
                                                    }
                                                >
                                                    {resending ===
                                                    log.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="h-3 w-3" />
                                                    )}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setPage((p) =>
                                Math.max(1, p - 1),
                            )
                        }
                        disabled={page <= 1}
                    >
                        上一页
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        {page} / {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setPage((p) =>
                                Math.min(
                                    totalPages,
                                    p + 1,
                                ),
                            )
                        }
                        disabled={
                            page >= totalPages
                        }
                    >
                        下一页
                    </Button>
                </div>
            )}

            {/* 清理日志 Dialog */}
            <Dialog
                open={cleanupOpen}
                onOpenChange={setCleanupOpen}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            清理邮件日志
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-muted-foreground">
                            选择要清理的日志范围，删除后不可恢复
                        </p>
                        <Select
                            value={cleanupDays}
                            onValueChange={
                                setCleanupDays
                            }
                        >
                            <SelectTrigger className="w-full bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30">
                                    30 天前
                                </SelectItem>
                                <SelectItem value="60">
                                    60 天前
                                </SelectItem>
                                <SelectItem value="90">
                                    90 天前
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCleanupOpen(
                                        false,
                                    )
                                }
                            >
                                取消
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={
                                    handleCleanup
                                }
                                disabled={cleaning}
                            >
                                {cleaning ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-1" />
                                )}
                                确认清理
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color?: string;
}) {
    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                {icon}
                <span className="text-xs">
                    {label}
                </span>
            </div>
            <p
                className={`text-2xl font-semibold ${color || 'text-foreground'}`}
            >
                {value}
            </p>
        </div>
    );
}
