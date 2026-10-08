'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { triggerDownload } from '@/lib/download';
import { toast } from 'sonner';
import {
  ScanSearch,
  Search,
  Upload,
  Eraser,
  Plus,
  Download,
  Loader2,
  X,
  History,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';
import type { DedupResultItem, ImportSheet } from '@/types/number-check';

function splitCodes(text: string): string[] {
  return text
    .split(/[，,、\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function NumberCheckPage() {
  const [inputText, setInputText] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DedupResultItem[] | null>(null);
  const [stats, setStats] = useState<any>(null);

  // 导入预览弹窗
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importData, setImportData] = useState<{
    fileId: string;
    fileName: string;
    sheets: ImportSheet[];
  } | null>(null);
  const [sheet, setSheet] = useState('Sheet1');
  const [columnIndex, setColumnIndex] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);

  // 手动入库弹窗
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchCodes, setBatchCodes] = useState<string[]>([]);
  const [batchImportedAt, setBatchImportedAt] = useState('');
  const [batchSettled, setBatchSettled] = useState(false);
  const [batchRemark, setBatchRemark] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await apiClient.numberCheckGetStats();
      setStats(s);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setCodes(splitCodes(inputText));
  }, [inputText]);

  const repeatItems = useMemo(
    () => (results || []).filter((r) => r.result === 'repeat'),
    [results],
  );

  const handleDedup = async () => {
    if (codes.length === 0) return;
    setLoading(true);
    try {
      const res = await apiClient.numberCheckDedup(codes);
      setResults(res?.results || []);
      loadStats();
    } catch (e: any) {
      toast.error(e.message || '查重失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const { blob, filename } = await apiClient.numberCheckExportDuplicates(codes);
      triggerDownload(blob, filename);
    } catch (e: any) {
      toast.error(e.message || '导出失败');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const data = await apiClient.numberCheckImportPreview(file);
      setImportData(data);
      setSheet(data.sheets?.[0]?.name || 'Sheet1');
      setColumnIndex(data.sheets?.[0]?.suggestedColumnIndex || 0);
      setHasHeader(data.sheets?.[0]?.suggestedHasHeader ?? true);
      setImportOpen(true);
    } catch (e: any) {
      toast.error(e.message || '文件解析失败');
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!importData) return;
    setImportLoading(true);
    try {
      const res = await apiClient.numberCheckImportCodes({
        fileId: importData.fileId,
        sheet,
        columnIndex,
        hasHeader,
      });
      const newCodes = res?.codes || [];
      setCodes((prev) => Array.from(new Set([...prev, ...newCodes])));
      setImportOpen(false);
      toast.success(`已导入 ${newCodes.length} 个编号`);
    } catch (e: any) {
      toast.error(e.message || '解析编号失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 手动入库：只入库"未重复"的编号（若已有查重结果），否则用当前输入
  const openBatch = () => {
    const list = results
      ? results.filter((r) => r.result === 'not_repeat').map((r) => r.code)
      : codes;
    setBatchCodes(list);
    setBatchImportedAt(new Date().toISOString().slice(0, 16));
    setBatchSettled(false);
    setBatchRemark('');
    setBatchOpen(true);
  };

  const handleBatchSave = async () => {
    if (batchCodes.length === 0) return;
    setBatchSaving(true);
    try {
      await apiClient.numberCheckCreateBatch({
        codes: batchCodes,
        importedAt: batchImportedAt
          ? new Date(batchImportedAt).toISOString()
          : undefined,
        isSettled: batchSettled,
        remark: batchRemark || undefined,
      });
      setBatchOpen(false);
      toast.success(`已入库 ${batchCodes.length} 条`);
      loadStats();
    } catch (e: any) {
      toast.error(e.message || '入库失败');
    } finally {
      setBatchSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ScanSearch className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">编号查重</h1>
          <p className="text-sm text-muted-foreground">
            识别并比对编号，标记重复订单编号
          </p>
        </div>
        <PermissionGate permission="number-check:download">
          <Button variant="outline" onClick={() => (window.location.href = '/number-check/history')}>
            <History className="w-4 h-4 mr-1" /> 历史记录
          </Button>
        </PermissionGate>
        <PermissionGate permission="number-check:config">
          <Button variant="outline" onClick={() => (window.location.href = '/number-check/settings')}>
            <Settings className="w-4 h-4 mr-1" /> 设置
          </Button>
        </PermissionGate>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '历史编号总数', value: stats?.totalRecords ?? 0 },
          { label: '今日入库数', value: stats?.todayCreated ?? 0 },
          { label: '今日重复命中', value: stats?.todayDupHits ?? 0 },
          { label: '最近批次', value: stats?.recentBatchNo || '--' },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-semibold mt-1 truncate">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium">编号输入</CardTitle>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <PermissionGate permission="number-check:import">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                上传表格
              </Button>
            </PermissionGate>
            <PermissionGate permission="number-check:create">
              <Button variant="outline" size="sm" onClick={openBatch}>
                <Plus className="w-4 h-4 mr-1" /> 手动入库
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="粘贴/输入编号，可用空格、逗号、顿号、回车分隔..."
            rows={4}
            className="font-mono"
          />
          {codes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {codes.map((code, i) => (
                <Badge key={`${code}-${i}`} variant="secondary" className="gap-1 pr-1">
                  <span className="max-w-[200px] truncate">{code}</span>
                  <button
                    className="hover:text-destructive"
                    onClick={() => setCodes((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <PermissionGate permission="number-check:dedup">
              <Button onClick={handleDedup} disabled={loading || codes.length === 0}>
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                查重
              </Button>
            </PermissionGate>
            <Button
              variant="ghost"
              onClick={() => {
                setInputText('');
                setResults(null);
              }}
            >
              <Eraser className="w-4 h-4 mr-1" /> 清空
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结果区：仅显示重复编号 */}
      {results && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">查重结果</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">重复 {repeatItems.length}</Badge>
              <Badge variant="secondary">
                未重复 {results.filter((r) => r.result === 'not_repeat').length}
              </Badge>
              <Badge variant="secondary">
                空 {results.filter((r) => r.result === 'empty').length}
              </Badge>
              {repeatItems.length > 0 && (
                <PermissionGate permission="number-check:export">
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-1" /> 导出重复清单
                  </Button>
                </PermissionGate>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {repeatItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
                <div className="text-lg font-medium">无重复</div>
                <div className="text-sm">本批编号与历史记录无重复</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>历史命中</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repeatItems.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-mono">{r.code}</TableCell>
                      <TableCell>
                        <span className="text-destructive">重复</span>
                        {r.intraBatchDuplicate && (
                          <Badge variant="outline" className="ml-2 text-warning">
                            同批重复
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[480px]">
                        {r.matches?.length > 0 ? (
                          <div className="space-y-1">
                            {r.matches.map((m) => (
                              <div key={m.id} className="text-xs text-muted-foreground">
                                {m.batchNo} · {new Date(m.importedAt).toLocaleString()} ·{' '}
                                {m.isSettled ? '已结算' : '未结算'} · {m.remark || '-'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 导入预览弹窗（限高，内容可滚动） */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>导入预览</DialogTitle>
          </DialogHeader>
          {importData && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div className="text-sm text-muted-foreground">
                文件：{importData.fileName}
              </div>
              {importData.sheets.length > 1 && (
                <div className="space-y-2">
                  <Label>选择工作表</Label>
                  <Select value={sheet} onValueChange={setSheet}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {importData.sheets.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}（{s.totalRows} 行）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(() => {
                const current =
                  importData.sheets.find((s) => s.name === sheet) ||
                  importData.sheets[0];
                const maxCols = Math.max(
                  0,
                  ...(current?.previewRows || []).map((r) => r.length),
                );
                return (
                  <>
                    <div className="space-y-2">
                      <Label>编号列</Label>
                      <Select
                        value={String(columnIndex)}
                        onValueChange={(v) => setColumnIndex(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择编号所在列" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: maxCols }).map((_, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              第 {idx + 1} 列
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>首行为表头</Label>
                      <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
                    </div>
                    <div className="max-h-[300px] overflow-auto border border-border rounded-md">
                      <Table>
                        <TableBody>
                          {(current?.previewRows || [])
                            .slice(0, 200)
                            .map((row, ri) => (
                              <TableRow key={ri}>
                                {row.map((cell, ci) => (
                                  <TableCell
                                    key={ci}
                                    className={
                                      ci === columnIndex
                                        ? 'bg-primary/10 font-mono whitespace-nowrap'
                                        : 'font-mono whitespace-nowrap'
                                    }
                                  >
                                    {cell}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button onClick={handleImportConfirm} disabled={importLoading}>
              {importLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              确认导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 手动入库弹窗（仅 导入时间/是否已结算/备注） */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>手动入库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              本次将入库 {batchCodes.length} 条编号
            </div>
            <div className="space-y-2">
              <Label>导入时间</Label>
              <Input
                type="datetime-local"
                value={batchImportedAt}
                onChange={(e) => setBatchImportedAt(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>是否已结算</Label>
              <Switch checked={batchSettled} onCheckedChange={setBatchSettled} />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={batchRemark}
                onChange={(e) => setBatchRemark(e.target.value)}
                placeholder="本批编号的补充说明"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)} disabled={batchSaving}>
              取消
            </Button>
            <Button onClick={handleBatchSave} disabled={batchSaving || batchCodes.length === 0}>
              {batchSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              确认入库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
