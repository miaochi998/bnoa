'use client';

/**
 * 安全中心仪表板页面 (Phase 3)
 * 
 * 布局结构：
 * - 统计卡片区：安全事件、待审核文件、扫描状态
 * - 系统健康状态
 * - 快捷入口区
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FileSearch,
  Settings,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface SecurityStats {
  totalFiles: number;
  pendingScan: number;
  clean: number;
  threatDetected: number;
  verifiedSafe: number;
  quarantined: number;
  scanFailed: number;
  scannerAvailable: boolean;
}

export default function SecurityDashboardPage() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 调用后端安全统计API
      const response = await apiClient.getSecurityStats();
      setStats(response);
    } catch (err) {
      console.error('获取安全统计失败:', err);
      setError('获取安全统计失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    fetchStats();
  };

  const statCards = [
    {
      title: '待审核文件',
      value: stats?.threatDetected ?? 0,
      subtitle: '检测到潜在威胁',
      icon: ShieldAlert,
      iconColor: 'text-red-500',
      href: '/security/scan-review?status=THREAT_DETECTED',
    },
    {
      title: '已验证安全',
      value: stats?.verifiedSafe ?? 0,
      subtitle: '人工确认安全',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      href: '/security/scan-review?status=VERIFIED_SAFE',
    },
    {
      title: '已隔离文件',
      value: stats?.quarantined ?? 0,
      subtitle: '危险文件已隔离',
      icon: ShieldX,
      iconColor: 'text-orange-500',
      href: '/security/scan-review?status=QUARANTINED',
    },
    {
      title: '扫描通过',
      value: stats?.clean ?? 0,
      subtitle: '自动扫描安全',
      icon: ShieldCheck,
      iconColor: 'text-blue-500',
      href: '/security/scan-review?status=ACTIVE',
    },
  ];

  const quickLinks = [
    {
      title: '扫描审核',
      description: '审核检测到威胁的文件',
      icon: FileSearch,
      href: '/security/scan-review',
      color: 'text-red-500',
    },
    {
      title: '安全日志',
      description: '查看安全事件记录',
      icon: Activity,
      href: '/audit-logs?type=security',
      color: 'text-blue-500',
    },
    {
      title: '安全设置',
      description: '配置病毒扫描策略',
      icon: Settings,
      href: '/settings/security',
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            安全中心
          </h1>
          <p className="text-muted-foreground">监控系统安全状态，处理安全事件</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 统计卡片区 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Link key={card.title} href={card.href}>
              <Card className="cursor-pointer hover:bg-card-hover transition-colors border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{card.title}</p>
                      <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* 扫描器状态 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {stats?.scannerAvailable ? (
              <>
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <span className="text-green-600 dark:text-green-400">ClamAV 病毒扫描引擎运行正常</span>
                <Badge variant="outline" className="ml-2">在线</Badge>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-yellow-600 dark:text-yellow-400">ClamAV 扫描引擎不可用，新上传的文件将跳过扫描</span>
                <Badge variant="secondary" className="ml-2">离线</Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 系统健康状态 + 快捷入口 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 系统健康状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              系统健康状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">病毒扫描引擎</span>
                <Badge variant={stats?.scannerAvailable ? 'default' : 'secondary'}>
                  {stats?.scannerAvailable ? '正常' : '离线'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">待处理威胁</span>
                <Badge variant={stats?.threatDetected ? 'destructive' : 'default'}>
                  {stats?.threatDetected ?? 0} 个
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">已隔离文件</span>
                <Badge variant="outline">{stats?.quarantined ?? 0} 个</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">扫描失败</span>
                <Badge variant={stats?.scanFailed ? 'destructive' : 'secondary'}>
                  {stats?.scanFailed ?? 0} 个
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 快捷入口 */}
        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickLinks.map((link) => (
                <Link key={link.title} href={link.href}>
                  <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                    <div className={`p-2 rounded-lg bg-muted`}>
                      <link.icon className={`h-5 w-5 ${link.color}`} />
                    </div>
                    <div>
                      <p className="font-medium">{link.title}</p>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 待处理提醒 */}
      {stats && stats.threatDetected > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    有 {stats.threatDetected} 个文件需要审核
                  </p>
                  <p className="text-sm text-muted-foreground">
                    这些文件检测到潜在威胁，请尽快处理
                  </p>
                </div>
              </div>
              <Link href="/security/scan-review?status=THREAT_DETECTED">
                <Button variant="destructive" size="sm">
                  立即处理
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
