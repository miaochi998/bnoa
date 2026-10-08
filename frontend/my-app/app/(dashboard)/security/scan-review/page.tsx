'use client';

/**
 * 扫描审核页面 (Phase 3)
 * 审核检测到潜在威胁的文件，确认安全或隔离危险文件
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { DictSelect } from '@/components/shared/DictSelect';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  FileWarning,
  CheckCircle,
  XCircle,
  Loader2,
  MoreHorizontal,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { DictTag } from '@/components/shared/DictTag';
import { useSearchParams } from 'next/navigation';

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

interface ScanFile {
  id: string;
  name: string;
  originalName: string;
  extension: string;
  size: number;
  mimeType: string;
  status: string;
  virusScanResult: string | null;
  virusScanAt: string | null;
  quarantinedAt: string | null;
  quarantineReason: string | null;
  uploadedBy: string;
  uploaderName?: string;
  createdAt: string;
}

interface ScanStats {
  pending: number;
  clean: number;
  threatDetected: number;
  verifiedSafe: number;
  quarantined: number;
  failed: number;
  scannerAvailable: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseScanResult(scanResult: string | null): string[] {
  if (!scanResult) return [];
  if (scanResult.startsWith('threat_detected:')) {
    return scanResult.replace('threat_detected:', '').split(',').filter(Boolean);
  }
  return [];
}

const PAGE_SIZE = 20;

export default function ScanReviewPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'THREAT_DETECTED';
  
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<ScanFile[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // 对话框状态
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [quarantineDialogOpen, setQuarantineDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [batchVerifyDialogOpen, setBatchVerifyDialogOpen] = useState(false);
  const [batchQuarantineDialogOpen, setBatchQuarantineDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ScanFile | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [quarantineReason, setQuarantineReason] = useState('');
  const [deleteFromStorage, setDeleteFromStorage] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 获取文件列表和统计数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 调用后端API获取扫描文件列表
      const response = await apiClient.getScanFiles({ 
        status: statusFilter === 'ALL' ? undefined : statusFilter, 
        page: currentPage, 
        pageSize: PAGE_SIZE 
      });
      
      // 设置统计数据
      if (response.statistics) {
        setStats({
          pending: response.statistics.byStatus?.PENDING || 0,
          clean: response.statistics.byStatus?.ACTIVE || 0,
          threatDetected: response.statistics.byStatus?.THREAT_DETECTED || 0,
          verifiedSafe: response.statistics.byStatus?.VERIFIED_SAFE || 0,
          quarantined: response.statistics.byStatus?.QUARANTINED || 0,
          failed: 0,
          scannerAvailable: response.statistics.scannerHealth?.available || false,
        });
      }

      // 设置文件列表
      const files = response.items.map((item: any) => ({
        id: item.id,
        name: item.fileName,
        originalName: item.originalName,
        extension: item.extension,
        size: item.fileSize,
        mimeType: item.mimeType,
        status: item.status,
        virusScanResult: item.virusScanResult,
        virusScanAt: item.virusScanAt,
        quarantinedAt: item.quarantinedAt,
        quarantineReason: item.quarantineReason,
        uploadedBy: item.uploadedBy?.id || '',
        uploaderName: item.uploadedBy?.username || item.uploadedBy?.name || '',
        createdAt: item.createdAt,
      }));
      
      setFiles(files);
      setTotalCount(response.pagination.total);
    } catch (error) {
      console.error('获取扫描文件失败:', error);
      setFiles([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
    setSelectedIds([]);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(files.map(f => f.id));
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

  const handleVerify = async () => {
    if (!selectedFile) return;
    setActionLoading(true);
    try {
      // 调用后端API确认文件安全
      await apiClient.verifyFileSafe(selectedFile.id, verifyNote);
      setVerifyDialogOpen(false);
      setVerifyNote('');
      setSelectedFile(null);
      handleRefresh();
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuarantine = async () => {
    if (!selectedFile) return;
    setActionLoading(true);
    try {
      // 调用后端API隔离文件
      await apiClient.quarantineFile(selectedFile.id, quarantineReason, deleteFromStorage);
      setQuarantineDialogOpen(false);
      setQuarantineReason('');
      setDeleteFromStorage(false);
      setSelectedFile(null);
      handleRefresh();
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescan = async (fileId: string) => {
    try {
      // 调用后端API重新扫描
      await apiClient.rescanFile(fileId);
      handleRefresh();
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  const handleBatchVerify = async () => {
    setActionLoading(true);
    try {
      // 调用后端API批量确认安全
      await apiClient.batchVerifyFiles(selectedIds, verifyNote);
      setBatchVerifyDialogOpen(false);
      setVerifyNote('');
      setSelectedIds([]);
      handleRefresh();
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchQuarantine = async () => {
    setActionLoading(true);
    try {
      // 调用后端API批量隔离
      await apiClient.batchQuarantineFiles(selectedIds, quarantineReason, deleteFromStorage);
      setBatchQuarantineDialogOpen(false);
      setQuarantineReason('');
      setDeleteFromStorage(false);
      setSelectedIds([]);
      handleRefresh();
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const openVerifyDialog = (file: ScanFile) => {
    setSelectedFile(file);
    setVerifyNote('');
    setVerifyDialogOpen(true);
  };

  const openQuarantineDialog = (file: ScanFile) => {
    setSelectedFile(file);
    setQuarantineReason('');
    setDeleteFromStorage(false);
    setQuarantineDialogOpen(true);
  };

  const openDetailDialog = (file: ScanFile) => {
    setSelectedFile(file);
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            安全扫描审核
          </h1>
          <p className="text-muted-foreground">审核检测到潜在威胁的文件，确认安全或隔离危险文件</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { key: 'PENDING', label: '等待扫描', value: stats?.pending, icon: <Loader2 className="h-4 w-4" /> },
          { key: 'ACTIVE', label: '安全', value: stats?.clean, icon: <ShieldCheck className="h-4 w-4 text-green-500" /> },
          { key: 'THREAT_DETECTED', label: '待审核', value: stats?.threatDetected, icon: <ShieldAlert className="h-4 w-4 text-red-500" /> },
          { key: 'VERIFIED_SAFE', label: '已验证安全', value: stats?.verifiedSafe, icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
          { key: 'QUARANTINED', label: '已隔离', value: stats?.quarantined, icon: <ShieldX className="h-4 w-4 text-orange-500" /> },
          { key: 'FAILED', label: '扫描失败', value: stats?.failed, icon: <XCircle className="h-4 w-4 text-red-500" /> },
        ].map((item) => (
          <Card
            key={item.key}
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${statusFilter === item.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => handleStatusFilterChange(item.key)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                {item.icon}
              </div>
              <p className="text-2xl font-bold mt-1">{item.value ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 扫描器状态 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {stats?.scannerAvailable ? (
              <>
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <span className="text-green-600 dark:text-green-400">ClamAV 扫描引擎运行正常</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-yellow-600 dark:text-yellow-400">ClamAV 扫描引擎不可用，新上传的文件将跳过扫描</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 文件列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>文件列表</CardTitle>
            <DictSelect
              typeCode="scan_file_status"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              showAll
              allLabel="全部状态"
              allValue="ALL"
              className="w-40"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileWarning className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无数据</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === files.length && files.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>文件名</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>检测结果</TableHead>
                    <TableHead>上传者</TableHead>
                    <TableHead>扫描时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const threats = parseScanResult(file.virusScanResult);
                    return (
                      <TableRow key={file.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(file.id)}
                            onCheckedChange={(checked) => handleSelectOne(file.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={file.name}>
                          {file.name}
                        </TableCell>
                        <TableCell>{formatFileSize(file.size)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{file.extension}</Badge>
                        </TableCell>
                        <TableCell>
                          <DictTag typeCode="scan_file_status" value={file.status} />
                        </TableCell>
                        <TableCell>
                          {threats.length > 0 ? (
                            <span className="text-red-500 text-sm">{threats.join(', ')}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{file.uploaderName || '-'}</TableCell>
                        <TableCell>
                          {file.virusScanAt
                            ? formatRelativeTime(file.virusScanAt)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {file.status === 'THREAT_DETECTED' && (
                                <>
                                  <DropdownMenuItem onClick={() => openVerifyDialog(file)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    确认安全
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openQuarantineDialog(file)}>
                                    <ShieldX className="h-4 w-4 mr-2" />
                                    隔离文件
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(file.status === 'PENDING' || file.status === 'FAILED') && (
                                <DropdownMenuItem onClick={() => handleRescan(file.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  重新扫描
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openDetailDialog(file)}>
                                <Eye className="h-4 w-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                      setVerifyNote('');
                      setBatchVerifyDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    批量确认安全
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setQuarantineReason('');
                      setDeleteFromStorage(false);
                      setBatchQuarantineDialogOpen(true);
                    }}
                  >
                    <ShieldX className="h-4 w-4 mr-1" />
                    批量隔离
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

      {/* 确认安全对话框 */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认文件安全</DialogTitle>
            <DialogDescription>
              您确认此文件为误报，将标记为"已验证安全"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">文件名</p>
              <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">大小</p>
              <p className="text-sm text-muted-foreground">{selectedFile ? formatFileSize(selectedFile.size) : '-'}</p>
            </div>
            {selectedFile && parseScanResult(selectedFile.virusScanResult).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">检测到的威胁</p>
                <p className="text-sm text-red-500">{parseScanResult(selectedFile.virusScanResult).join(', ')}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-1">审核备注</p>
              <Textarea
                placeholder="破解版软件，ClamAV误报，已人工验证安全"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleVerify} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认安全
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 隔离对话框 */}
      <Dialog open={quarantineDialogOpen} onOpenChange={setQuarantineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">隔离危险文件</DialogTitle>
            <DialogDescription>
              此文件将被标记为危险并隔离，用户将无法下载
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">文件名</p>
              <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
            </div>
            {selectedFile && parseScanResult(selectedFile.virusScanResult).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">检测到的威胁</p>
                <p className="text-sm text-red-500">{parseScanResult(selectedFile.virusScanResult).join(', ')}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-1">隔离原因</p>
              <Textarea
                placeholder="确认为恶意软件，立即隔离"
                value={quarantineReason}
                onChange={(e) => setQuarantineReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="deleteFromStorage"
                checked={deleteFromStorage}
                onCheckedChange={(checked) => setDeleteFromStorage(!!checked)}
              />
              <label htmlFor="deleteFromStorage" className="text-sm">
                同时从存储中删除物理文件
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuarantineDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleQuarantine}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认隔离
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文件详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>文件扫描详情</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">基本信息</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">文件名:</span>
                  <span className="truncate">{selectedFile.name}</span>
                  <span className="text-muted-foreground">大小:</span>
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span className="text-muted-foreground">类型:</span>
                  <span>{selectedFile.extension}</span>
                  <span className="text-muted-foreground">上传者:</span>
                  <span>{selectedFile.uploaderName || '-'}</span>
                  <span className="text-muted-foreground">上传时间:</span>
                  <span>{new Date(selectedFile.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">扫描结果</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">状态:</span>
                  <DictTag typeCode="scan_file_status" value={selectedFile.status} />
                  <span className="text-muted-foreground">扫描时间:</span>
                  <span>{selectedFile.virusScanAt ? new Date(selectedFile.virusScanAt).toLocaleString('zh-CN') : '-'}</span>
                  <span className="text-muted-foreground">威胁名称:</span>
                  <span className="text-red-500">{parseScanResult(selectedFile.virusScanResult).join(', ') || '-'}</span>
                </div>
              </div>

              {selectedFile.quarantinedAt && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">隔离记录</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">隔离时间:</span>
                    <span>{new Date(selectedFile.quarantinedAt).toLocaleString('zh-CN')}</span>
                    <span className="text-muted-foreground">隔离原因:</span>
                    <span>{selectedFile.quarantineReason || '-'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedFile?.status === 'THREAT_DETECTED' && (
              <>
                <Button variant="outline" onClick={() => { setDetailDialogOpen(false); openVerifyDialog(selectedFile); }}>
                  确认安全
                </Button>
                <Button variant="destructive" onClick={() => { setDetailDialogOpen(false); openQuarantineDialog(selectedFile); }}>
                  隔离
                </Button>
              </>
            )}
            {(selectedFile?.status === 'PENDING' || selectedFile?.status === 'FAILED') && (
              <Button variant="outline" onClick={() => { handleRescan(selectedFile.id); setDetailDialogOpen(false); }}>
                重新扫描
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量确认安全对话框 */}
      <Dialog open={batchVerifyDialogOpen} onOpenChange={setBatchVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量确认安全</DialogTitle>
            <DialogDescription>
              将 {selectedIds.length} 个文件标记为"已验证安全"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">审核备注</p>
              <Textarea
                placeholder="批量确认：经人工验证，这些文件为误报"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchVerifyDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchVerify} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认安全 ({selectedIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量隔离对话框 */}
      <Dialog open={batchQuarantineDialogOpen} onOpenChange={setBatchQuarantineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">批量隔离文件</DialogTitle>
            <DialogDescription>
              将 {selectedIds.length} 个文件标记为危险并隔离
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">隔离原因</p>
              <Textarea
                placeholder="批量隔离：确认为恶意软件"
                value={quarantineReason}
                onChange={(e) => setQuarantineReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="batchDeleteFromStorage"
                checked={deleteFromStorage}
                onCheckedChange={(checked) => setDeleteFromStorage(!!checked)}
              />
              <label htmlFor="batchDeleteFromStorage" className="text-sm">
                同时从存储中删除物理文件
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchQuarantineDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchQuarantine}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认隔离 ({selectedIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
