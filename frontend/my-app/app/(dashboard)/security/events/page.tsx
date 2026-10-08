'use client';

/**
 * 安全事件管理页面
 * 监控和处理系统安全事件
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RefreshCw,
  Loader2,
  MoreHorizontal,
  Eye,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Shield,
  ShieldAlert,
  ShieldX,
  Search,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { DictTag } from '@/components/shared/DictTag';
import { DictSelect } from '@/components/shared/DictSelect';

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  status: string;
  userId?: string;
  username?: string;
  ipAddress?: string;
  location?: string;
  details?: string;
  actionTaken?: string;
  notes?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

interface EventStats {
  totalCount: number;
  newCount: number;
  investigatingCount: number;
  resolvedCount: number;
}

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

const PAGE_SIZE = 20;

export default function SecurityEventsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);

  // 筛选状态
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ipAddressFilter, setIpAddressFilter] = useState('');

  // 对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [batchAcknowledgeDialogOpen, setBatchAcknowledgeDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [acknowledgeStatus, setAcknowledgeStatus] = useState<string>('INVESTIGATING');
  const [actionTaken, setActionTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const totalPages = Math.ceil((stats?.totalCount || 0) / PAGE_SIZE);

  // 获取事件列表
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 调用后端API获取安全事件列表
      const response = await apiClient.getSecurityEvents({
        eventType: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        ipAddress: ipAddressFilter || undefined,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });

      setStats(response.statistics);
      setEvents(response.items);
    } catch (error) {
      console.error('获取安全事件失败:', error);
      setEvents([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter, severityFilter, statusFilter, ipAddressFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
    setSelectedIds([]);
  };

  const handleReset = () => {
    setEventTypeFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setIpAddressFilter('');
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(events.map(e => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const openDetailDialog = (event: SecurityEvent) => {
    setSelectedEvent(event);
    setDetailDialogOpen(true);
  };

  const openAcknowledgeDialog = (event: SecurityEvent) => {
    setSelectedEvent(event);
    setAcknowledgeStatus('INVESTIGATING');
    setActionTaken('');
    setNotes('');
    setAcknowledgeDialogOpen(true);
  };

  const handleAcknowledge = async () => {
    if (!selectedEvent) return;
    setActionLoading(true);
    try {
      await apiClient.acknowledgeEvent(selectedEvent.id, {
        status: acknowledgeStatus,
        actionTaken,
        notes,
      });
      setAcknowledgeDialogOpen(false);
      handleRefresh();
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchAcknowledge = async () => {
    setActionLoading(true);
    try {
      await apiClient.batchAcknowledgeEvents(selectedIds, notes);
      setBatchAcknowledgeDialogOpen(false);
      setNotes('');
      setSelectedIds([]);
      handleRefresh();
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusCardClick = (status: string | null) => {
    if (status === null) {
      setStatusFilter('all');
    } else {
      setStatusFilter(status);
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            安全事件管理
          </h1>
          <p className="text-muted-foreground">监控和处理系统安全事件</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleStatusCardClick(null)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">全部事件</span>
              <AlertCircle className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.totalCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${statusFilter === 'NEW' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleStatusCardClick('NEW')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">待处理</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.newCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${statusFilter === 'INVESTIGATING' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleStatusCardClick('INVESTIGATING')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">处理中</span>
              <Loader2 className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.investigatingCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${statusFilter === 'RESOLVED' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleStatusCardClick('RESOLVED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">已解决</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.resolvedCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <DictSelect
              typeCode="security_event_type"
              value={eventTypeFilter}
              onChange={setEventTypeFilter}
              showAll
              allLabel="全部类型"
              className="w-40"
            />

            <DictSelect
              typeCode="security_event_severity"
              value={severityFilter}
              onChange={setSeverityFilter}
              showAll
              allLabel="全部程度"
              className="w-40"
            />

            <DictSelect
              typeCode="security_event_status"
              value={statusFilter}
              onChange={setStatusFilter}
              showAll
              allLabel="全部状态"
              className="w-40"
            />

            <div className="flex gap-2">
              <Input
                placeholder="IP地址"
                value={ipAddressFilter}
                onChange={(e) => setIpAddressFilter(e.target.value)}
                className="w-40"
              />
              <Button variant="outline" size="icon" onClick={fetchData}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" onClick={handleReset}>
              <X className="h-4 w-4 mr-1" />
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 事件列表 */}
      <Card>
        <CardHeader>
          <CardTitle>事件列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无安全事件</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === events.length && events.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>事件类型</TableHead>
                    <TableHead>严重程度</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>IP地址</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(event.id)}
                            onCheckedChange={(checked) => handleSelectOne(event.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <DictTag typeCode="security_event_type" value={event.eventType} />
                        </TableCell>
                        <TableCell>
                          <DictTag typeCode="security_event_severity" value={event.severity} />
                        </TableCell>
                        <TableCell>{event.username || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{event.ipAddress || '-'}</TableCell>
                        <TableCell>
                          <DictTag typeCode="security_event_status" value={event.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelativeTime(event.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openAcknowledgeDialog(event)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                确认事件
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetailDialog(event)}>
                                <Eye className="h-4 w-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                      </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 批量操作栏 */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-4 mt-4 p-3 bg-muted rounded-lg">
                  <span className="text-sm">已选择 {selectedIds.length} 项</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNotes('');
                      setBatchAcknowledgeDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    批量确认
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`确定删除选中的 ${selectedIds.length} 条事件记录？`)) return;
                      try {
                        await apiClient.batchDeleteEvents(selectedIds);
                        setSelectedIds([]);
                        handleRefresh();
                      } catch (error) {
                        console.error('删除失败:', error);
                      }
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    批量删除
                  </Button>
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 事件详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>事件详情</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">事件类型:</span>
                  <p className="font-medium"><DictTag typeCode="security_event_type" value={selectedEvent.eventType} /></p>
                </div>
                <div>
                  <span className="text-muted-foreground">严重程度:</span>
                  <p><DictTag typeCode="security_event_severity" value={selectedEvent.severity} /></p>
                </div>
                <div>
                  <span className="text-muted-foreground">状态:</span>
                  <p><DictTag typeCode="security_event_status" value={selectedEvent.status} /></p>
                </div>
                <div>
                  <span className="text-muted-foreground">用户:</span>
                  <p className="font-medium">{selectedEvent.username || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">IP地址:</span>
                  <p className="font-mono">{selectedEvent.ipAddress || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">位置:</span>
                  <p>{selectedEvent.location || '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">创建时间:</span>
                  <p>{new Date(selectedEvent.createdAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>

              {selectedEvent.details && (
                <div>
                  <span className="text-sm text-muted-foreground">详情:</span>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedEvent.details), null, 2);
                      } catch {
                        return selectedEvent.details;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {selectedEvent.acknowledgedBy && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-2">处理记录</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">处理人:</span>
                      <p>{selectedEvent.acknowledgedBy}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">处理时间:</span>
                      <p>{selectedEvent.acknowledgedAt ? new Date(selectedEvent.acknowledgedAt).toLocaleString('zh-CN') : '-'}</p>
                    </div>
                    {selectedEvent.actionTaken && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">采取措施:</span>
                        <p>{selectedEvent.actionTaken}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedEvent?.status === 'NEW' && (
              <Button onClick={() => { setDetailDialogOpen(false); openAcknowledgeDialog(selectedEvent); }}>
                确认事件
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认事件对话框 */}
      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认安全事件</DialogTitle>
            <DialogDescription>
              确认事件并记录处理措施
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">事件类型:</span>
                  <p className="font-medium"><DictTag typeCode="security_event_type" value={selectedEvent.eventType} /></p>
                </div>
                <div>
                  <span className="text-muted-foreground">严重程度:</span>
                  <p><DictTag typeCode="security_event_severity" value={selectedEvent.severity} /></p>
                </div>
                <div>
                  <span className="text-muted-foreground">IP地址:</span>
                  <p className="font-mono">{selectedEvent.ipAddress || '-'}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">更新状态为</label>
                <DictSelect
                  typeCode="security_event_status"
                  value={acknowledgeStatus}
                  onChange={setAcknowledgeStatus}
                  excludeValues={['NEW']}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">处理备注</label>
                <Textarea
                  placeholder="记录处理情况..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium">采取的措施</label>
                <Textarea
                  placeholder="例如：封禁IP、通知运维团队..."
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAcknowledge} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量确认对话框 */}
      <Dialog open={batchAcknowledgeDialogOpen} onOpenChange={setBatchAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量确认事件</DialogTitle>
            <DialogDescription>
              将 {selectedIds.length} 个事件标记为已确认
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">处理备注</label>
              <Textarea
                placeholder="批量处理备注..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAcknowledgeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchAcknowledge} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认 ({selectedIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
