'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { AuditLog, AuditLogFilter } from '@/types/audit';
import { useDictionary } from '@/hooks/useDictionary';
import { DictSelect } from '@/components/shared/DictSelect';
import { DictTag } from '@/components/shared/DictTag';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Activity,
  Clock,
  User,
  Globe,
  Trash2,
  Download,
} from 'lucide-react';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AuditLogsPage() {
  const dict = useDictionary('audit_action');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState<AuditLogFilter>({});
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAuditLogs(filter, { page, pageSize });
      setLogs(response.items || []);
      setTotalCount(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 0);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filter]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      setFilter(prev => ({ ...prev, status: undefined }));
    } else {
      setFilter(prev => ({ ...prev, status: value as 'SUCCESS' | 'FAILURE' }));
    }
    setPage(1);
  };

  const handleModuleChange = (value: string) => {
    if (value === 'all') {
      setFilter(prev => ({ ...prev, module: undefined }));
    } else {
      setFilter(prev => ({ ...prev, module: value }));
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">审计日志</h1>
          <p className="text-muted-foreground mt-1">查看系统操作记录和安全事件</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            apiClient.createExport({ module: 'audit-log', format: 'xlsx' })
              .then(res => {
                if (res.data?.async) {
                  alert('数据量较大，导出任务已提交，完成后将通过通知提醒。');
                } else if (res.data?.taskId) {
                  window.open(
                    apiClient.getExportDownloadUrl(res.data.taskId),
                    '_blank',
                  );
                }
              })
              .catch(() => alert('导出失败'));
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          导出
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总记录数</p>
              <p className="text-2xl font-semibold text-foreground">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              操作日志
            </CardTitle>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索操作描述..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 bg-background border-input"
                />
              </div>
              <DictSelect
                typeCode="audit_module"
                value={filter.module || 'all'}
                onChange={handleModuleChange}
                showAll
                allLabel="全部模块"
                className="w-32 bg-background border-input"
              />
              <DictSelect
                typeCode="audit_status"
                value={filter.status || 'all'}
                onChange={handleStatusChange}
                showAll
                allLabel="全部状态"
                className="w-32 bg-background border-input"
              />
              <Button variant="outline" onClick={handleSearch}>
                搜索
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p>暂无审计日志</p>
            </div>
          ) : (
            <>
              {/* 批量操作栏 */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-muted rounded-lg">
                  <span className="text-sm">已选择 {selectedIds.length} 项</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`确定删除选中的 ${selectedIds.length} 条日志记录？`)) return;
                      try {
                        await apiClient.batchDeleteAuditLogs(selectedIds);
                        setSelectedIds([]);
                        fetchLogs();
                      } catch (error) {
                        console.error('删除失败:', error);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    批量删除
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === logs.length && logs.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(logs.map(l => l.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground">时间</TableHead>
                    <TableHead className="text-muted-foreground">用户</TableHead>
                    <TableHead className="text-muted-foreground">模块</TableHead>
                    <TableHead className="text-muted-foreground">操作</TableHead>
                    <TableHead className="text-muted-foreground">描述</TableHead>
                    <TableHead className="text-muted-foreground">IP地址</TableHead>
                    <TableHead className="text-muted-foreground">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-border hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(log.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds([...selectedIds, log.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== log.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatDate(log.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">{log.username || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DictTag typeCode="audit_module" value={log.module} />
                      </TableCell>
                      <TableCell className="text-foreground">
                        {dict.getLabel('audit_action', log.action)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {log.description || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          {log.ipAddress || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DictTag typeCode="audit_status" value={log.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                <p className="text-sm text-muted-foreground">
                  共 {totalCount} 条记录
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {page} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
