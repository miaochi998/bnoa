'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Users, Shield, FileText, Activity, Upload, FolderOpen,
    User, HardDrive, Share2, TrendingUp, Settings,
    ClipboardList, File, Image, Video, Music, Archive,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { DashboardStats, MyStats, RecentFile } from '@/lib/api';
import { usePermissionStore } from '@/lib/stores/permission-store';

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

function getFileIcon(mimeType: string) {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('zip') || mimeType.includes('rar')
        || mimeType.includes('tar')) return Archive;
    if (mimeType.includes('pdf')) return FileText;
    return File;
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} 天前`;
    return date.toLocaleDateString('zh-CN');
}

export default function DashboardPage() {
    const [adminStats, setAdminStats] = useState<DashboardStats | null>(
        null,
    );
    const [myStats, setMyStats] = useState<MyStats | null>(null);
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
    const [loading, setLoading] = useState(true);
    const { hasPermission, loaded: permLoaded } = usePermissionStore();

    const canViewAdminStats = permLoaded && hasPermission('dashboard:stats');
    const canViewFiles = permLoaded && hasPermission('file:list');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const promises: Promise<void>[] = [];

                promises.push(
                    apiClient.getMyStats().then((data) => {
                        setMyStats(data);
                    }),
                );

                if (canViewAdminStats) {
                    promises.push(
                        apiClient.getDashboardStats().then((data) => {
                            setAdminStats(data);
                        }),
                    );
                }

                if (canViewFiles) {
                    promises.push(
                        apiClient.getRecentFiles().then((data) => {
                            setRecentFiles(data);
                        }),
                    );
                }

                await Promise.allSettled(promises);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (permLoaded) {
            fetchData();
        }
    }, [permLoaded, canViewAdminStats, canViewFiles]);

    const adminStatCards = adminStats
        ? [
            { title: '总用户数', value: adminStats.totalUsers, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
            { title: '角色数量', value: adminStats.totalRoles, icon: Shield, color: 'text-success', bgColor: 'bg-success/10' },
            { title: '系统文件总数', value: adminStats.totalFiles, icon: FileText, color: 'text-warning', bgColor: 'bg-warning/10' },
            { title: '今日登录', value: adminStats.todayLogins, icon: Activity, color: 'text-info', bgColor: 'bg-info/10' },
        ]
        : [];

    const myStatCards = myStats
        ? [
            { title: '我的文件', value: myStats.myFiles.toString(), icon: FolderOpen, color: 'text-primary', bgColor: 'bg-primary/10' },
            { title: '已用空间', value: formatFileSize(myStats.usedSpace), icon: HardDrive, color: 'text-warning', bgColor: 'bg-warning/10' },
            { title: '收到的共享', value: myStats.sharedToMe.toString(), icon: Share2, color: 'text-success', bgColor: 'bg-success/10' },
            { title: '近7天上传', value: myStats.recentUploads.toString(), icon: TrendingUp, color: 'text-info', bgColor: 'bg-info/10' },
        ]
        : [];

    const quickActions = [
        { title: '上传文件', desc: '上传文档资源', href: '/files', icon: Upload, color: 'text-primary', bgColor: 'bg-primary/10', permission: 'file:upload' },
        { title: '我的文件', desc: '查看管理文件', href: '/files', icon: FolderOpen, color: 'text-warning', bgColor: 'bg-warning/10', permission: 'file:manage' },
        { title: '个人资料', desc: '编辑个人信息', href: '/profile', icon: User, color: 'text-success', bgColor: 'bg-success/10', permission: null as string | null },
        { title: '创建用户', desc: '添加新用户账号', href: '/users', icon: Users, color: 'text-primary', bgColor: 'bg-primary/10', permission: 'user:create' },
        { title: '角色管理', desc: '配置权限角色', href: '/roles', icon: Shield, color: 'text-success', bgColor: 'bg-success/10', permission: 'role:manage' },
        { title: '审计日志', desc: '系统操作记录', href: '/audit-logs', icon: ClipboardList, color: 'text-info', bgColor: 'bg-info/10', permission: 'audit:view' },
        { title: '系统配置', desc: '管理系统参数', href: '/settings', icon: Settings, color: 'text-warning', bgColor: 'bg-warning/10', permission: 'system:config' },
    ].filter((a) => a.permission === null || hasPermission(a.permission));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">仪表盘</h1>
                <p className="text-muted-foreground mt-1">欢迎回来，这里是系统概览</p>
            </div>

            {canViewAdminStats && (
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-3">系统统计</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {adminStatCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <Card key={card.title} className="bg-card border-border">
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-muted-foreground">{card.title}</p>
                                                <p className="text-2xl font-semibold text-foreground mt-1">
                                                    {loading ? '-' : card.value.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className={`p-3 rounded-lg ${card.bgColor}`}>
                                                <Icon className={`h-5 w-5 ${card.color}`} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">个人统计</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {myStatCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <Card key={card.title} className="bg-card border-border">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground">{card.title}</p>
                                            <p className="text-2xl font-semibold text-foreground mt-1">
                                                {loading ? '-' : card.value}
                                            </p>
                                        </div>
                                        <div className={`p-3 rounded-lg ${card.bgColor}`}>
                                            <Icon className={`h-5 w-5 ${card.color}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-card border-border lg:col-span-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold text-foreground">快速操作</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link key={action.title} href={action.href}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-card-hover transition-colors duration-200">
                                    <div className={`w-9 h-9 rounded-lg ${action.bgColor} flex items-center justify-center shrink-0`}>
                                        <Icon className={`h-4 w-4 ${action.color}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground">{action.title}</p>
                                        <p className="text-xs text-muted-foreground">{action.desc}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </CardContent>
                </Card>

                {canViewFiles && (
                    <Card className="bg-card border-border lg:col-span-1">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold text-foreground">最近文件</CardTitle>
                                <Link href="/files" className="text-xs text-primary hover:underline">查看全部</Link>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {loading ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">加载中...</p>
                            ) : recentFiles.length === 0 ? (
                                <div className="py-8 text-center">
                                    <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">暂无文件</p>
                                    <p className="text-xs text-muted-foreground mt-1">上传文件后将在此显示</p>
                                </div>
                            ) : (
                                recentFiles.map((file) => {
                                    const Icon = getFileIcon(file.mimeType);
                                    return (
                                        <div key={file.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-card-hover transition-colors">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Icon className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-foreground truncate">{file.originalName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatFileSize(file.size)} · {formatTime(file.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                )}

                {canViewAdminStats && (
                    <Card className="bg-card border-border lg:col-span-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold text-foreground">系统状态</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[
                                { label: 'API 服务', status: '运行中' },
                                { label: '数据库', status: '已连接' },
                                { label: 'Redis', status: '已连接' },
                                { label: '文件存储', status: '正常' },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{item.label}</span>
                                    <span className="flex items-center gap-2 text-sm text-success">
                                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
