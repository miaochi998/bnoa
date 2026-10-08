'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { triggerDownload } from '@/lib/download';
import { toast } from 'sonner';
import {
  History,
  Search,
  Loader2,
  Eye,
  Download,
  RotateCcw,
  Ban,
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';
import type { NumberCheckRecord } from '@/types/number-check';

const PAGE_SIZE = 20;

export default function NumberCheckHistoryPage() {
  const [records, setRecords] = useState<NumberCheckRecord[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 筛选
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterBatchNo, setFilterBatchNo] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [detail, setDetail] = useState<NumberCheckRecord | null>(null);
  const [editRecord, setEditRecord] = useState<NumberCheckRecord | null>(null);
  const [editRemark, setEditRemark] = useState('');
  const [editSettled, setEditSettled] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.numberCheckListRecords({
        page,
        pageSize: PAGE_SIZE,
        keyword: filterKeyword || undefined,
        batchNo: filterBatchNo || undefined,
        status: filterStatus === 'ALL' ? undefined : filterStatus,
      });
      setRecords(res.data || []);
      setMeta(res.meta || { total: 0, page: 1, limit: PAGE_SIZE, totalPages: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterKeyword, filterBatchNo, filterStatus]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const openDetail = async (id: string) => {
    const d = await apiClient.numberCheckGetRecord(id);
    setDetail(d);
  };

  const openEdit = (record: NumberCheckRecord) => {
    setEditRecord(record);
    setEditRemark(record.remark || '');
    setEditSettled(record.isSettled);
  };

  const saveEdit = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      await apiClient.numberCheckUpdateRecord(editRecord.id, {
        remark: editRemark,
        isSettled: editSettled,
      });
      setEditRecord(null);
      toast.success('已保存');
      fetchRecords();
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleVoid = async (record: NumberCheckRecord) => {
    const target = record.status === 'VOID' ? 'ACTIVE' : 'VOID';
    try {
      await apiClient.numberCheckUpdateRecord(record.id, { status: target });
      toast.success(target === 'VOID' ? '已作废' : '已恢复');
      fetchRecords();
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    }
  };

  const downloadOriginal = async (batchNo: string) => {
    try {
      const { blob, filename } = await apiClient.numberCheckDownloadBatchFile(batchNo);
      triggerDownload(blob, filename);
    } catch (e: any) {
      toast.error(e.message || '下载失败（该批次可能无原始文件）');
    }
  };

  const totalPages = Math.max(1, meta.totalPages || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">历史编号台账</h1>
          <p className="text-sm text-muted-foreground">查看、维护已手动入库的编号记录</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>编号关键字</Label>
              <Input
                placeholder="搜索编号"
                value={filterKeyword}
                onChange={(e) => { setFilterKeyword(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-1">
              <Label>来源批次</Label>
              <Input
                placeholder="如 BATCH-20260822-001"
                value={filterBatchNo}
                onChange={(e) => { setFilterBatchNo(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-1">
              <Label>状态</Label>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部</SelectItem>
                  <SelectItem value="ACTIVE">正常</SelectItem>
                  <SelectItem value="VOID">已作废</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>&nbsp;</Label>
              <Button variant="ghost" onClick={() => { setFilterKeyword(''); setFilterBatchNo(''); setFilterStatus('ALL'); setPage(1); }}>
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>来源批次</TableHead>
                  <TableHead>导入时间</TableHead>
                  <TableHead>已结算</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>重复次数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.code}</TableCell>
                      <TableCell>{r.batchNo}</TableCell>
                      <TableCell>{new Date(r.importedAt).toLocaleString()}</TableCell>
                      <TableCell>{r.isSettled ? '是' : '否'}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.remark || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'VOID' ? 'destructive' : 'outline'}>
                          {r.status === 'VOID' ? '已作废' : '正常'}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.repeatCount ?? 1}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PermissionGate permission="number-check:detail">
                            <Button variant="ghost" size="icon" onClick={() => openDetail(r.id)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="number-check:update">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                              <span className="text-xs">编</span>
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="number-check:update">
                            <Button variant="ghost" size="icon" onClick={() => toggleVoid(r)}>
                              {r.status === 'VOID' ? (
                                <RotateCcw className="w-4 h-4" />
                              ) : (
                                <Ban className="w-4 h-4 text-destructive" />
                              )}
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="number-check:download">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!r.hasFile}
                              title={r.hasFile ? '下载原始文件' : '该批次无原始文件'}
                              onClick={() => downloadOriginal(r.batchNo)}
                            >
                              <Download className={r.hasFile ? 'w-4 h-4' : 'w-4 h-4 opacity-40'} />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-sm text-muted-foreground">
              共 {meta.total} 条 · 第 {meta.page}/{totalPages} 页
            </span>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              上一页
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              下一页
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>编号详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">编号：</span>
                <span className="font-mono">{detail.code}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">来源批次：</span>{detail.batchNo}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">导入时间：</span>
                {new Date(detail.importedAt).toLocaleString()}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">状态：</span>
                {detail.status === 'VOID' ? '已作废' : '正常'} · 命中历史 {detail.repeatCount ?? 1} 次
              </div>
              <div className="text-sm font-medium">同编号历史记录</div>
              <div className="max-h-48 overflow-y-auto border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>来源批次</TableHead>
                      <TableHead>导入时间</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.history || []).map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.batchNo}</TableCell>
                        <TableCell>{new Date(h.importedAt).toLocaleString()}</TableCell>
                        <TableCell>{h.status === 'VOID' ? '已作废' : '正常'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>编辑记录</DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>编号（不可修改）</Label>
                <Input value={editRecord.code} disabled className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>备注</Label>
                <Textarea value={editRemark} onChange={(e) => setEditRemark(e.target.value)} rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <Label>是否已结算</Label>
                <Switch checked={editSettled} onCheckedChange={setEditSettled} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)} disabled={saving}>
              取消
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
