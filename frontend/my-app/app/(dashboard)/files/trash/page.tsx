'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiClient } from '@/lib/api';
import { FileItem } from '@/types/file';
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  MoreHorizontal,
  FileIcon,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-green-500" />;
  if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-purple-500" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-pink-500" />;
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className="w-5 h-5 text-green-500" />;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className="w-5 h-5 text-yellow-500" />;
  return <FileIcon className="w-5 h-5 text-muted-foreground" />;
}

export default function TrashPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [processing, setProcessing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);

  const fetchRetentionDays = async () => {
    try {
      const config = await apiClient.getRecycleBinRetentionDays();
      setRetentionDays(config.days);
    } catch (error) {
      console.error('Failed to fetch retention days:', error);
    }
  };

  const fetchDeletedFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDeletedFiles(page, pageSize);
      setFiles(response.items || []);
      setTotalCount(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 0);
    } catch (error) {
      console.error('Failed to fetch deleted files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedFiles();
    fetchRetentionDays();
  }, [page]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(files.map(f => f.id));
    } else {
      setSelectedFiles([]);
    }
  };

  const handleSelectFile = (fileId: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  const handleRestore = async (file: FileItem) => {
    try {
      setProcessing(true);
      await apiClient.restoreFile(file.id);
      fetchDeletedFiles();
    } catch (error) {
      console.error('Failed to restore file:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!fileToDelete) return;

    try {
      setProcessing(true);
      await apiClient.permanentDeleteFile(fileToDelete.id);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      fetchDeletedFiles();
    } catch (error) {
      console.error('Failed to permanently delete file:', error);
    } finally {
      setProcessing(false);
    }
  };

  const openDeleteDialog = (file: FileItem) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleBatchPermanentDelete = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setProcessing(true);
      await apiClient.batchPermanentDeleteFiles(selectedFiles);
      setBatchDeleteDialogOpen(false);
      setSelectedFiles([]);
      fetchDeletedFiles();
    } catch (error) {
      console.error('Failed to batch permanent delete files:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleClearRecycleBin = async () => {
    try {
      setProcessing(true);
      await apiClient.clearRecycleBin();
      setClearDialogOpen(false);
      fetchDeletedFiles();
    } catch (error) {
      console.error('Failed to clear recycle bin:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/files')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">回收站</h1>
            <p className="text-muted-foreground mt-1">已删除的文件将在{retentionDays}天后自动清除</p>
          </div>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-muted-foreground" />
              已删除文件
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedFiles.length > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    已选择 {selectedFiles.length} 项
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBatchDeleteDialogOpen(true)}
                    disabled={processing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    永久删除选中
                  </Button>
                </>
              )}
              {files.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearDialogOpen(true)}
                  disabled={processing}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  清空回收站
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Trash2 className="w-16 h-16 mb-4 opacity-50" />
              <p>回收站为空</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedFiles.length === files.length && files.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground">文件名</TableHead>
                    <TableHead className="text-muted-foreground w-24">大小</TableHead>
                    <TableHead className="text-muted-foreground w-40">删除时间</TableHead>
                    <TableHead className="text-muted-foreground w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id} className="border-border hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={(checked) => handleSelectFile(file.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.mimeType)}
                          <div className="min-w-0">
                            <p className="text-foreground font-medium truncate max-w-[300px]">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {file.extension.toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {file.deletedAt ? formatDate(file.deletedAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuItem onClick={() => handleRestore(file)} disabled={processing}>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              恢复
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(file)}
                              className="text-destructive"
                              disabled={processing}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              永久删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                <p className="text-sm text-muted-foreground">
                  共 {totalCount} 个文件
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

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              永久删除文件
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              确定要永久删除文件 <span className="text-foreground font-medium">"{fileToDelete?.name}"</span> 吗？
              <br />
              <span className="text-destructive">此操作无法撤销，文件将被彻底删除。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-input" disabled={processing}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processing}
            >
              {processing ? '删除中...' : '永久删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Permanent Delete Confirmation Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              批量永久删除文件
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              确定要永久删除选中的 <span className="text-foreground font-medium">{selectedFiles.length}</span> 个文件吗？
              <br />
              <span className="text-destructive">此操作无法撤销，文件将被彻底删除。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-input" disabled={processing}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchPermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processing}
            >
              {processing ? '删除中...' : '永久删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Recycle Bin Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              清空回收站
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              确定要清空回收站吗？这将永久删除回收站中的所有 <span className="text-foreground font-medium">{totalCount}</span> 个文件。
              <br />
              <span className="text-destructive">此操作无法撤销，所有文件将被彻底删除。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-input" disabled={processing}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearRecycleBin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processing}
            >
              {processing ? '清空中...' : '清空回收站'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
