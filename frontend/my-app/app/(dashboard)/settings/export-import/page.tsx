'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { DictTag } from '@/components/shared/DictTag';
import {
    Download,
    Upload,
    FileText,
    Loader2,
    Trash2,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
} from 'lucide-react';

interface ExportModule {
    moduleName: string;
    displayName: string;
    supportedFormats: string[];
    supportsImport: boolean;
}

function formatDate(d: string): string {
    return new Date(d).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatSize(bytes: number | null): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default function ExportImportPage() {
    const [modules, setModules] = useState<ExportModule[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [taskLoading, setTaskLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    // 导出状态
    const [exportModule, setExportModule] = useState('');
    const [exportFormat, setExportFormat] = useState('xlsx');
    const [exporting, setExporting] = useState(false);

    // 导入状态
    const [importModule, setImportModule] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [importResult, setImportResult] = useState<any>(null);

    const fetchModules = useCallback(async () => {
        try {
            const data = await apiClient.getExportModules();
            setModules(data || []);
        } catch (e) {
            console.error('获取模块列表失败:', e);
        }
    }, []);

    const fetchTasks = useCallback(async () => {
        try {
            setTaskLoading(true);
            const res = await apiClient.getExportTasks({ page, pageSize: 15 });
            setTasks(res.data || []);
            setTotalPages(res.meta?.totalPages || 0);
        } catch (e) {
            console.error('获取任务列表失败:', e);
        } finally {
            setTaskLoading(false);
        }
    }, [page]);

    useEffect(() => { fetchModules(); }, [fetchModules]);
    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const selectedExportModule = modules.find(m => m.moduleName === exportModule);
    const importableModules = modules.filter(m => m.supportsImport);

    // 导出
    const handleExport = async () => {
        if (!exportModule) return;
        setExporting(true);
        try {
            const res = await apiClient.createExport({
                module: exportModule,
                format: exportFormat,
            });
            if (res.data?.async) {
                alert('数据量较大，导出任务已提交。完成后将通过通知提醒您。');
            } else if (res.data?.downloadUrl) {
                const url = apiClient.getExportDownloadUrl(res.data.taskId);
                window.open(url, '_blank');
            }
            fetchTasks();
        } catch (e: any) {
            alert(e.message || '导出失败');
        } finally {
            setExporting(false);
        }
    };

    // 导入预览
    const handleImportPreview = async () => {
        if (!importModule || !importFile) return;
        setImporting(true);
        setPreviewData(null);
        setImportResult(null);
        try {
            const data = await apiClient.importPreview(importModule, importFile);
            setPreviewData(data);
        } catch (e: any) {
            alert(e.message || '预览失败');
        } finally {
            setImporting(false);
        }
    };

    // 确认导入
    const handleImportConfirm = async () => {
        if (!importModule || !importFile) return;
        if (!confirm('确定执行导入？此操作不可撤销。')) return;
        setImporting(true);
        try {
            const res = await apiClient.importConfirm(importModule, importFile);
            setImportResult(res.data);
            setPreviewData(null);
            fetchTasks();
        } catch (e: any) {
            alert(e.message || '导入失败');
        } finally {
            setImporting(false);
        }
    };

    // 删除任务
    const handleDeleteTask = async (id: string) => {
        if (!confirm('确定删除此任务？')) return;
        try {
            await apiClient.deleteExportTask(id);
            fetchTasks();
        } catch (e: any) {
            alert(e.message || '删除失败');
        }
    };

    // 下载
    const handleDownload = (taskId: string) => {
        const url = apiClient.getExportDownloadUrl(taskId);
        window.open(url, '_blank');
    };

    const statusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            default: return <Clock className="w-4 h-4 text-muted-foreground" />;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">导入导出管理</h1>
                <p className="text-muted-foreground mt-1">导出系统数据或批量导入数据</p>
            </div>

            <Tabs defaultValue="export" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="export" className="gap-1.5">
                        <Download className="w-4 h-4" /> 导出数据
                    </TabsTrigger>
                    <TabsTrigger value="import" className="gap-1.5">
                        <Upload className="w-4 h-4" /> 导入数据
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="gap-1.5">
                        <FileText className="w-4 h-4" /> 任务记录
                    </TabsTrigger>
                </TabsList>

                {/* 导出面板 */}
                <TabsContent value="export">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">导出数据</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">选择模块</label>
                                    <Select value={exportModule} onValueChange={setExportModule}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="请选择要导出的模块" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {modules.map(m => (
                                                <SelectItem key={m.moduleName} value={m.moduleName}>
                                                    {m.displayName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">导出格式</label>
                                    <Select value={exportFormat} onValueChange={setExportFormat}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(selectedExportModule?.supportedFormats || ['xlsx', 'csv']).map(f => (
                                                <SelectItem key={f} value={f}>
                                                    {f === 'xlsx' ? 'Excel (.xlsx)' : f === 'csv' ? 'CSV (.csv)' : 'JSON (.json)'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button
                                        onClick={handleExport}
                                        disabled={!exportModule || exporting}
                                        className="w-full"
                                    >
                                        {exporting ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4 mr-2" />
                                        )}
                                        {exporting ? '导出中...' : '开始导出'}
                                    </Button>
                                </div>
                            </div>
                            {exportModule && (
                                <p className="text-sm text-muted-foreground">
                                    数据量小于 5000 条时将直接下载文件，超过时将异步处理并通过通知提醒。
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 导入面板 */}
                <TabsContent value="import">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">导入数据</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">选择模块</label>
                                    <Select value={importModule} onValueChange={(v) => {
                                        setImportModule(v);
                                        setPreviewData(null);
                                        setImportResult(null);
                                    }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="请选择要导入的模块" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {importableModules.map(m => (
                                                <SelectItem key={m.moduleName} value={m.moduleName}>
                                                    {m.displayName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">选择文件</label>
                                    <Input
                                        type="file"
                                        accept=".xlsx,.xls,.json"
                                        onChange={(e) => {
                                            setImportFile(e.target.files?.[0] || null);
                                            setPreviewData(null);
                                            setImportResult(null);
                                        }}
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleImportPreview}
                                        disabled={!importModule || !importFile || importing}
                                    >
                                        {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                        预览校验
                                    </Button>
                                    {previewData && (
                                        <Button
                                            onClick={handleImportConfirm}
                                            disabled={importing || previewData.validRows === 0}
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            确认导入
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* 预览结果 */}
                            {previewData && (
                                <div className="space-y-3">
                                    <div className="flex gap-4 text-sm">
                                        <span>总行数: <strong>{previewData.totalRows}</strong></span>
                                        <span className="text-green-600">有效: <strong>{previewData.validRows}</strong></span>
                                        <span className="text-red-600">无效: <strong>{previewData.invalidRows}</strong></span>
                                    </div>
                                    <div className="max-h-[300px] overflow-auto border rounded">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">行</TableHead>
                                                    <TableHead className="w-16">状态</TableHead>
                                                    {previewData.headers.map((h: string) => (
                                                        <TableHead key={h}>{h}</TableHead>
                                                    ))}
                                                    <TableHead>错误</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {previewData.rows.map((row: any) => (
                                                    <TableRow key={row.rowIndex} className={row.valid ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                                                        <TableCell>{row.rowIndex}</TableCell>
                                                        <TableCell>
                                                            {row.valid
                                                                ? <CheckCircle className="w-4 h-4 text-green-500" />
                                                                : <XCircle className="w-4 h-4 text-red-500" />}
                                                        </TableCell>
                                                        {previewData.headers.map((h: string) => (
                                                            <TableCell key={h} className="max-w-[200px] truncate">
                                                                {String(row.data[h] ?? '')}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell className="text-red-600 text-xs">
                                                            {row.errors.join('; ')}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* 导入结果 */}
                            {importResult && (
                                <div className="p-4 rounded-lg bg-muted space-y-2">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> 导入结果
                                    </h3>
                                    <div className="flex gap-4 text-sm">
                                        <span>总计: {importResult.total}</span>
                                        <span className="text-green-600">成功: {importResult.success}</span>
                                        <span className="text-red-600">失败: {importResult.failed}</span>
                                        <span className="text-muted-foreground">跳过: {importResult.skipped}</span>
                                    </div>
                                    {importResult.errors?.length > 0 && (
                                        <div className="text-xs text-red-600 max-h-[150px] overflow-auto">
                                            {importResult.errors.map((e: any, i: number) => (
                                                <div key={i}>第 {e.row} 行: {e.message}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 任务记录 */}
                <TabsContent value="tasks">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">任务记录</CardTitle>
                                <Button variant="outline" size="sm" onClick={fetchTasks}>
                                    <RefreshCw className={`w-4 h-4 mr-1 ${taskLoading ? 'animate-spin' : ''}`} />
                                    刷新
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {taskLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="flex flex-col items-center py-12 text-muted-foreground">
                                    <FileText className="w-12 h-12 mb-3 opacity-50" />
                                    <p>暂无任务记录</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>任务编号</TableHead>
                                            <TableHead>类型</TableHead>
                                            <TableHead>模块</TableHead>
                                            <TableHead>格式</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>进度</TableHead>
                                            <TableHead>文件大小</TableHead>
                                            <TableHead>创建时间</TableHead>
                                            <TableHead>操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tasks.map((task: any) => (
                                            <TableRow key={task.id}>
                                                <TableCell className="font-mono text-xs">{task.taskNo}</TableCell>
                                                <TableCell>
                                                    <DictTag typeCode="export_task_type" value={task.type} />
                                                </TableCell>
                                                <TableCell>{task.module}</TableCell>
                                                <TableCell>
                                                    <DictTag typeCode="export_format" value={task.format} />
                                                </TableCell>
                                                <TableCell>
                                                    <span className="flex items-center gap-1.5">
                                                        {statusIcon(task.status)}
                                                        <DictTag typeCode="export_task_status" value={task.status} />
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {task.totalRows ? (
                                                        <div className="flex items-center gap-2">
                                                            <Progress
                                                                value={((task.processedRows || 0) / task.totalRows) * 100}
                                                                className="w-16 h-2"
                                                            />
                                                            <span className="text-xs text-muted-foreground">
                                                                {task.processedRows || 0}/{task.totalRows}
                                                            </span>
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>{formatSize(task.fileSize)}</TableCell>
                                                <TableCell className="text-xs">{formatDate(task.createdAt)}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        {task.status === 'completed' && task.type === 'export' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDownload(task.id)}
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteTask(task.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {totalPages > 1 && (
                                <div className="flex justify-center gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        上一页
                                    </Button>
                                    <span className="text-sm text-muted-foreground leading-8">
                                        {page} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        下一页
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
