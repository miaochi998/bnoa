'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUploadQueueContext } from '@/contexts/UploadQueueContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { FolderTree } from '@/components/files/FolderTree';
import { FileUploadDialog } from '@/components/files/FileUploadDialog';
import { AdvancedUploadDialog } from '@/components/files/AdvancedUploadDialog';
import { FilePreview } from '@/components/files/FilePreview';
import { FileShareDialog } from '@/components/files/FileShareDialog';
import { FolderShareDialog } from '@/components/files/FolderShareDialog';
import { PermissionGate } from '@/components/PermissionGate';
import { FileDetailPanel } from '@/components/files/FileDetailPanel';
import { apiClient } from '@/lib/api';
import { FileItem, FileFilter, FolderTreeNodeWithShare, SharePermission, FOLDER_SCOPE_IDS, FolderScope } from '@/types/file';
import {
  Search,
  Upload,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  X,
  Download,
  Share2,
  FolderInput,
  FileIcon,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  List,
  Grid,
  LayoutGrid,
  CheckSquare,
  Square,
  XSquare,
  Copy,
  Scissors,
  Package,
  ArrowUpDown,
  Filter,
  FolderPlus,
  Move,
  Cloud,
  HardDrive,
  Clipboard,
  ClipboardPaste,
  Folder,
  Code,
  FileQuestion,
  ChevronDown,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

function getFileIcon(mimeType: string, size: 'sm' | 'md' | 'lg' = 'md') {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';
  if (mimeType.startsWith('image/')) return <ImageIcon className={`${sizeClass} text-green-500`} />;
  if (mimeType.startsWith('video/')) return <Film className={`${sizeClass} text-purple-500`} />;
  if (mimeType.startsWith('audio/')) return <Music className={`${sizeClass} text-pink-500`} />;
  if (mimeType.includes('pdf')) return <FileText className={`${sizeClass} text-red-500`} />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className={`${sizeClass} text-blue-500`} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className={`${sizeClass} text-green-500`} />;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className={`${sizeClass} text-yellow-500`} />;
  return <FileIcon className={`${sizeClass} text-muted-foreground`} />;
}

type ViewMode = 'large-grid' | 'detail' | 'grid';
type SortBy = 'createdAt' | 'name' | 'size';
type SortOrder = 'desc' | 'asc';
type StorageFilter = 'all' | 'rustfs' | 'local';
type FileTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive' | 'other';
type FileSizeFilter = 'all' | 'lt1mb' | '1to10mb' | '10to100mb' | 'gt100mb' | 'custom';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export default function FilesPage() {
  const router = useRouter();
  const uploadQueue = useUploadQueueContext();
  const { user } = useAuth();
  const isAdmin = user?.roles?.some((r: any) => r.code === 'super_admin') ?? false;
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(FOLDER_SCOPE_IDS.PERSONAL);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [saving, setSaving] = useState(false);
  // 新增状态
  const [viewMode, setViewMode] = useState<ViewMode>('large-grid');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [storageFilter, setStorageFilter] = useState<StorageFilter>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [fileSizeFilter, setFileSizeFilter] = useState<FileSizeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [clipboard, setClipboard] = useState<{ files: string[]; action: 'copy' | 'cut' } | null>(null);
  const [storageStats, setStorageStats] = useState<{ totalFiles: number; totalSize: number } | null>(null);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderTreeRef, setFolderTreeRef] = useState<{ openCreateDialog: (parentId?: string) => void; openRenameDialog: (folder: any) => void; openMappingDialog: (folder: any) => void; getSelectedFolder: () => any } | null>(null);
  const [moveTargetDialogOpen, setMoveTargetDialogOpen] = useState(false);
  const [copyTargetDialogOpen, setCopyTargetDialogOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string | undefined>();
  const [folders, setFolders] = useState<any[]>([]);
  const [clearFolderDialogOpen, setClearFolderDialogOpen] = useState(false);
  const [clearingFolder, setClearingFolder] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [selectedMappingRealFolderId, setSelectedMappingRealFolderId] = useState<string>('');
  const [realFolders, setRealFolders] = useState<any[]>([]);
  const [detailFile, setDetailFile] = useState<FileItem | null>(null);
  const [folderShareDialogOpen, setFolderShareDialogOpen] = useState(false);
  const [shareFolderTarget, setShareFolderTarget] = useState<FolderTreeNodeWithShare | null>(null);
  const [folderPermissions, setFolderPermissions] = useState<SharePermission[] | undefined>(undefined);
  const [isCurrentFolderSystemShared, setIsCurrentFolderSystemShared] = useState(false);
  const [folderRefreshKey, setFolderRefreshKey] = useState(0);

  // 辅助函数：判断是否为分类范围选中
  const isScopeSelection = (id?: string): boolean => {
    return id === FOLDER_SCOPE_IDS.PERSONAL ||
      id === FOLDER_SCOPE_IDS.SHARED_WITH_ME ||
      id === FOLDER_SCOPE_IDS.SYSTEM_SHARED;
  };

  const getFolderScope = (id?: string): FolderScope | undefined => {
    switch (id) {
      case FOLDER_SCOPE_IDS.PERSONAL: return 'personal';
      case FOLDER_SCOPE_IDS.SHARED_WITH_ME: return 'sharedWithMe';
      case FOLDER_SCOPE_IDS.SYSTEM_SHARED: return 'systemShared';
      default: return undefined;
    }
  };

  // 权限判断：如果 folderPermissions 为 undefined 表示个人文件夹或根目录，拥有全部权限
  const hasPermission = (perm: SharePermission) => {
    if (!folderPermissions) return true; // 个人文件夹或未选择文件夹
    return folderPermissions.includes(perm);
  };
  const canView = hasPermission('VIEW');
  const canDownload = hasPermission('DOWNLOAD');
  const canUpload = hasPermission('UPLOAD');
  const canEdit = hasPermission('EDIT');
  const canDelete = hasPermission('DELETE');
  // 文件夹管理权限：系统共享文件夹只有管理员可以管理
  const canManageFolder = !isCurrentFolderSystemShared || isAdmin;

  const fetchStorageStats = async () => {
    try {
      const response = await apiClient.getFileStats(storageFilter !== 'all' ? storageFilter : undefined);
      setStorageStats(response);
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const folderScope = getFolderScope(selectedFolderId);
      const filter: FileFilter = {
        keyword: keyword || undefined,
        folderId: folderScope ? undefined : selectedFolderId,
        folderScope,
        storageMode: storageFilter !== 'all' ? storageFilter : undefined,
      };
      const response = await apiClient.getFiles(filter, { page, pageSize });
      setFiles(response.items || []);
      setTotalCount(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 0);
    } catch (error) {
      console.error('Failed to fetch files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // 刷新文件列表并返回更新后的数据（用于同步更新详情面板）
  const fetchFilesAndReturn = async (): Promise<FileItem[] | undefined> => {
    try {
      const folderScope = getFolderScope(selectedFolderId);
      const filter: FileFilter = {
        keyword: keyword || undefined,
        folderId: folderScope ? undefined : selectedFolderId,
        folderScope,
        storageMode: storageFilter !== 'all' ? storageFilter : undefined,
      };
      const response = await apiClient.getFiles(filter, { page, pageSize });
      const items = response.items || [];
      setFiles(items);
      setTotalCount(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 0);
      return items;
    } catch (error) {
      console.error('Failed to fetch files:', error);
      setFiles([]);
      return undefined;
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchStorageStats();
  }, [selectedFolderId, page, keyword, storageFilter]);

  // 🔑 监听上传队列完成状态，自动刷新文件列表
  // 策略1：监听 completedCount 变化（每个文件完成后刷新）
  // 策略2：监听 isUploading 从 true 变为 false（所有文件完成后刷新）
  // 使用 ref 记录上一次的完成数量，避免初次渲染时触发刷新
  const prevCompletedCountRef = useRef(uploadQueue.completedCount);
  const prevIsUploadingRef = useRef(uploadQueue.isUploading);
  // 防抖定时器，避免短时间内多次刷新
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const wasUploading = prevIsUploadingRef.current;
    const isNowUploading = uploadQueue.isUploading;
    const prevCompleted = prevCompletedCountRef.current;
    const currentCompleted = uploadQueue.completedCount;
    
    // 更新 ref
    prevIsUploadingRef.current = isNowUploading;
    prevCompletedCountRef.current = currentCompleted;
    
    // 条件1：上传全部完成（从上传中变为非上传中，且有完成的文件）
    // 条件2：新完成了文件（completedCount 增加）
    const allComplete = wasUploading && !isNowUploading && currentCompleted > 0;
    const newFileCompleted = currentCompleted > prevCompleted;
    
    if (allComplete || newFileCompleted) {
      // 使用防抖，避免短时间内多次刷新
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        console.log('[FilesPage] 检测到上传完成，自动刷新文件列表', { allComplete, newFileCompleted });
        fetchFiles();
        fetchStorageStats();
        setFolderRefreshKey(k => k + 1);
      }, 500); // 500ms 防抖
    }
    
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [uploadQueue.isUploading, uploadQueue.completedCount]);

  const handleSearch = () => {
    setPage(1);
    fetchFiles();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(files.map(f => f.id));
    } else {
      setSelectedFiles([]);
    }
  };

  const handleInvertSelection = () => {
    const newSelection = files
      .filter(f => !selectedFiles.includes(f.id))
      .map(f => f.id);
    setSelectedFiles(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
  };

  const handleBatchDownload = async () => {
    for (const fileId of selectedFiles) {
      const file = files.find(f => f.id === fileId);
      if (file) {
        try {
          // 使用后端下载API确保文件完整性
          const response = await fetch(`${getApiBaseUrl()}/files/${fileId}/download`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            },
          });
          
          if (!response.ok) {
            throw new Error('下载失败');
          }
          
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch (error) {
          console.error('Download failed:', error);
        }
      }
    }
  };

  const handlePackageDownload = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      // 调用后端打包下载API
      const response = await fetch(`${getApiBaseUrl()}/files/package-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ fileIds: selectedFiles }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '打包下载失败');
      }
      
      // 获取blob并下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `files-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Package download failed:', error);
      alert('打包下载失败：' + (error as Error).message);
    }
  };

  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split('-') as [SortBy, SortOrder];
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  const handleCopy = () => {
    if (selectedFiles.length > 0) {
      setClipboard({ files: [...selectedFiles], action: 'copy' });
    }
  };

  const handleCut = () => {
    if (selectedFiles.length > 0) {
      setClipboard({ files: [...selectedFiles], action: 'cut' });
    }
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.files.length === 0) return;
    
    // 检查是否在同一文件夹中粘贴剪切的文件
    if (clipboard.action === 'cut') {
      const currentFolderFiles = files.filter(f => clipboard.files.includes(f.id));
      if (currentFolderFiles.length > 0) {
        alert('不能在同一文件夹中粘贴剪切的文件');
        return;
      }
    }
    
    try {
      for (const fileId of clipboard.files) {
        if (clipboard.action === 'cut') {
          await apiClient.moveFile(fileId, selectedFolderId || '');
        } else {
          await apiClient.copyFile(fileId, selectedFolderId);
        }
      }
      if (clipboard.action === 'cut') {
        if (detailFile && clipboard.files.includes(detailFile.id)) setDetailFile(null);
        setClipboard(null);
      }
      fetchFiles();
      setSelectedFiles([]);
    } catch (error) {
      console.error('Failed to paste files:', error);
      alert('粘贴失败：' + (error as Error).message);
    }
  };

  // 获取文件夹列表用于移动/复制弹窗
  const fetchFolders = async () => {
    try {
      const data = await apiClient.getFolders();
      setFolders(data);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  };

  // 打开移动文件弹窗
  const openMoveDialog = () => {
    if (selectedFiles.length === 0) return;
    fetchFolders();
    setTargetFolderId(undefined);
    setMoveTargetDialogOpen(true);
  };

  // 打开复制文件弹窗
  const openCopyDialog = () => {
    if (selectedFiles.length === 0) return;
    fetchFolders();
    setTargetFolderId(undefined);
    setCopyTargetDialogOpen(true);
  };

  // 执行移动文件
  const handleMoveFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      setSaving(true);
      await apiClient.batchMoveFiles(selectedFiles, targetFolderId || '');
      setMoveTargetDialogOpen(false);
      if (detailFile && selectedFiles.includes(detailFile.id)) setDetailFile(null);
      setSelectedFiles([]);
      fetchFiles();
    } catch (error) {
      console.error('Failed to move files:', error);
      alert('移动失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 执行复制文件
  const handleCopyFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      setSaving(true);
      await apiClient.batchCopyFiles(selectedFiles, targetFolderId);
      setCopyTargetDialogOpen(false);
      setSelectedFiles([]);
      fetchFiles();
    } catch (error) {
      console.error('Failed to copy files:', error);
      alert('复制失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 清空文件夹
  const handleClearFolder = async () => {
    if (!selectedFolderId) return;
    
    try {
      setClearingFolder(true);
      await apiClient.clearFolder(selectedFolderId);
      setClearFolderDialogOpen(false);
      setDetailFile(null);
      fetchFiles();
    } catch (error) {
      console.error('Failed to clear folder:', error);
      alert('清空文件夹失败：' + (error as Error).message);
    } finally {
      setClearingFolder(false);
    }
  };

  // 检查文件夹是否有子文件夹
  const checkFolderHasChildren = async () => {
    if (!selectedFolderId) return;
    
    try {
      const folderData = await apiClient.getFolders(selectedFolderId);
      if (folderData && folderData.length > 0) {
        alert('该文件夹包含子文件夹，无法清空。请先删除或移动子文件夹。');
        return;
      }
      setClearFolderDialogOpen(true);
    } catch (error) {
      console.error('Failed to check folder children:', error);
      setClearFolderDialogOpen(true);
    }
  };

  // 获取真实文件夹列表
  const fetchRealFolders = async () => {
    try {
      const data = await apiClient.getRealFolders();
      setRealFolders(data);
    } catch (error) {
      console.error('Failed to fetch real folders:', error);
    }
  };

  // 打开重命名文件夹弹窗
  const openRenameFolderDialog = async () => {
    if (!selectedFolderId) return;
    try {
      const folder = await apiClient.getFolder(selectedFolderId);
      setNewFolderNameInput(folder.name);
      setRenameFolderDialogOpen(true);
    } catch (error) {
      console.error('Failed to get folder:', error);
    }
  };

  // 打开修改映射弹窗
  const openMappingDialog = async () => {
    if (!selectedFolderId) return;
    try {
      await fetchRealFolders();
      const folder = await apiClient.getFolder(selectedFolderId);
      setSelectedMappingRealFolderId(folder.realFolderId || '');
      setMappingDialogOpen(true);
    } catch (error) {
      console.error('Failed to get folder:', error);
    }
  };

  // 重命名文件夹
  const handleRenameFolderSubmit = async () => {
    if (!selectedFolderId || !newFolderNameInput.trim()) return;
    
    try {
      setSaving(true);
      await apiClient.updateFolder(selectedFolderId, { name: newFolderNameInput.trim() });
      setRenameFolderDialogOpen(false);
      setNewFolderNameInput('');
      fetchFiles();
      setFolderRefreshKey(k => k + 1);
    } catch (error) {
      console.error('Failed to rename folder:', error);
      alert('重命名失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 修改映射
  const handleUpdateMappingSubmit = async () => {
    if (!selectedFolderId || !selectedMappingRealFolderId) return;
    
    try {
      setSaving(true);
      await apiClient.updateFolder(selectedFolderId, { realFolderId: selectedMappingRealFolderId });
      setMappingDialogOpen(false);
      fetchFiles();
    } catch (error) {
      console.error('Failed to update mapping:', error);
      alert('修改映射失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 创建文件夹
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      setSaving(true);
      await apiClient.createFolder({
        name: newFolderName.trim(),
        parentId: selectedFolderId || undefined,
      });
      setCreateFolderOpen(false);
      setNewFolderName('');
      fetchFiles();
      setFolderRefreshKey(k => k + 1);
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('创建文件夹失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const getFilteredFiles = () => {
    let filtered = files;
    
    // 文件类型筛选
    if (fileTypeFilter !== 'all') {
      filtered = filtered.filter(file => {
        const mimeType = file.mimeType.toLowerCase();
        switch (fileTypeFilter) {
          case 'image': return mimeType.startsWith('image/');
          case 'video': return mimeType.startsWith('video/');
          case 'audio': return mimeType.startsWith('audio/');
          case 'document': return mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('text');
          case 'code': return mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css') || mimeType.includes('xml') || mimeType.includes('python') || mimeType.includes('java') || mimeType.includes('c++') || mimeType.includes('php');
          case 'archive': return mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z') || mimeType.includes('gzip');
          case 'other': return !mimeType.startsWith('image/') && !mimeType.startsWith('video/') && !mimeType.startsWith('audio/') && !mimeType.includes('pdf') && !mimeType.includes('word') && !mimeType.includes('zip') && !mimeType.includes('javascript') && !mimeType.includes('json');
          default: return true;
        }
      });
    }

    // 文件大小筛选
    if (fileSizeFilter !== 'all') {
      filtered = filtered.filter(file => {
        const sizeMB = file.size / (1024 * 1024);
        switch (fileSizeFilter) {
          case 'lt1mb': return sizeMB < 1;
          case '1to10mb': return sizeMB >= 1 && sizeMB < 10;
          case '10to100mb': return sizeMB >= 10 && sizeMB < 100;
          case 'gt100mb': return sizeMB >= 100;
          default: return true;
        }
      });
    }

    // 修改日期筛选
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(file => {
        const fileDate = new Date(file.updatedAt || file.createdAt);
        switch (dateFilter) {
          case 'today': 
            return fileDate >= today;
          case 'week': 
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return fileDate >= weekAgo;
          case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return fileDate >= monthStart;
          case 'year':
            const yearStart = new Date(now.getFullYear(), 0, 1);
            return fileDate >= yearStart;
          default: return true;
        }
      });
    }
    
    return filtered;
  };

  const filteredFiles = getFilteredFiles();

  const handleSelectFile = (fileId: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  const handleFileClick = (file: FileItem, event: React.MouseEvent) => {
    // Ctrl/Cmd + 点击：多选
    if (event.ctrlKey || event.metaKey) {
      const isSelected = selectedFiles.includes(file.id);
      handleSelectFile(file.id, !isSelected);
    } else {
      // 普通点击：单选并显示详情
      setSelectedFiles([file.id]);
      setDetailFile(file);
    }
  };

  const handlePreview = (file: FileItem) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const handleShare = (file: FileItem) => {
    setShareFile(file);
    setShareDialogOpen(true);
  };

  const handleRename = (file: FileItem) => {
    setRenameFile(file);
    setNewFileName(file.name);
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = async () => {
    if (!renameFile || !newFileName.trim()) return;

    try {
      setSaving(true);
      await apiClient.renameFile(renameFile.id, newFileName.trim());
      setRenameDialogOpen(false);
      setRenameFile(null);
      setNewFileName('');
      // 刷新文件列表后同步更新详情面板
      const updatedFiles = await fetchFilesAndReturn();
      if (detailFile) {
        const updated = updatedFiles?.find(f => f.id === detailFile.id);
        setDetailFile(updated || null);
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`确定要删除文件 "${file.name}" 吗？文件将移入回收站。`)) return;

    try {
      await apiClient.deleteFile(file.id);
      if (detailFile?.id === file.id) setDetailFile(null);
      fetchFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedFiles.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedFiles.length} 个文件吗？`)) return;

    try {
      await apiClient.batchDeleteFiles(selectedFiles);
      if (detailFile && selectedFiles.includes(detailFile.id)) setDetailFile(null);
      setSelectedFiles([]);
      fetchFiles();
    } catch (error) {
      console.error('Failed to batch delete files:', error);
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (file.url) {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Download failed:', error);
        // 降级方案：直接打开链接
        window.open(file.url, '_blank');
      }
    }
  };

  // 获取当前文件夹名称用于面包屑
  const getCurrentFolderName = () => {
    switch (selectedFolderId) {
      case FOLDER_SCOPE_IDS.PERSONAL: return '个人文件夹';
      case FOLDER_SCOPE_IDS.SHARED_WITH_ME: return '共享给我的';
      case FOLDER_SCOPE_IDS.SYSTEM_SHARED: return '系统共享';
      default: return currentFolder?.name || '个人文件夹';
    }
  };

  // 是否为只读分类（共享给我的 / 系统共享）
  const isReadOnlyScope = selectedFolderId === FOLDER_SCOPE_IDS.SHARED_WITH_ME ||
    selectedFolderId === FOLDER_SCOPE_IDS.SYSTEM_SHARED;

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* 左侧边栏 */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        {/* 存储位置切换 - 仅管理员可见 */}
        {isAdmin && (
          <Card className="flex flex-row border border-border bg-card rounded-lg p-1 gap-1">
            <button
              className={`flex-1 flex flex-col items-center py-2 px-2 text-xs transition-colors rounded-md ${
                storageFilter === 'all' 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => setStorageFilter('all')}
            >
              <Package className="w-4 h-4 mb-0.5" />
              全部
            </button>
            <button
              className={`flex-1 flex flex-col items-center py-2 px-2 text-xs transition-colors rounded-md ${
                storageFilter === 'rustfs' 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => setStorageFilter('rustfs')}
            >
              <Cloud className="w-4 h-4 mb-0.5" />
              RUSTFS
            </button>
            <button
              className={`flex-1 flex flex-col items-center py-2 px-2 text-xs transition-colors rounded-md ${
                storageFilter === 'local' 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => setStorageFilter('local')}
            >
              <HardDrive className="w-4 h-4 mb-0.5" />
              本地
            </button>
          </Card>
        )}

        {/* 文件详情面板 - 放在最上方 */}
        <FileDetailPanel
          file={detailFile}
          onClose={() => setDetailFile(null)}
          onDownload={canDownload ? handleDownload : undefined}
          onShare={canEdit ? handleShare : undefined}
        />

        {/* 文件夹树 */}
        <FolderTree
            selectedFolderId={selectedFolderId}
            onSelectFolder={(folderId, permissions, folderName, isSystemShared) => {
              setSelectedFolderId(folderId);
              setFolderPermissions(permissions);
              setCurrentFolder(folderId && folderName ? { id: folderId, name: folderName } : null);
              setIsCurrentFolderSystemShared(isSystemShared ?? false);
            }}
            onRefresh={fetchFiles}
            onShareFolder={(folder) => {
              setShareFolderTarget(folder);
              setFolderShareDialogOpen(true);
            }}
            isAdmin={isAdmin}
            refreshKey={folderRefreshKey}
          />

        {/* 存储空间统计 */}
        {storageStats && (
          <Card className="bg-card border-border p-4 mt-4">
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              存储空间
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">文件数量</span>
                <span className="text-foreground font-medium">{storageStats.totalFiles} 个</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已用空间</span>
                <span className="text-foreground font-medium">{formatFileSize(storageStats.totalSize)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((storageStats.totalSize / (1024 * 1024 * 1024)) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {formatFileSize(storageStats.totalSize)} / 1 GB
              </p>
            </div>
          </Card>
        )}

      </div>

      {/* File List */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 bg-card border-border flex flex-col">
          <CardHeader className="pb-4">
            {/* 面包屑导航 + 文件夹操作按钮 + 工具按钮 */}
            <div className="flex items-center justify-between">
              {/* 面包屑导航 */}
              <div className="flex items-center gap-2 text-foreground">
                <span className="font-medium">{getCurrentFolderName()}</span>
              </div>
              
              {/* 文件夹操作 + 工具按钮 */}
              <div className="flex items-center gap-2">
                {!isReadOnlyScope && canEdit && canManageFolder && (
                  <PermissionGate permission="folder:manage">
                    <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(true)}>
                      <FolderPlus className="w-4 h-4 mr-2" />
                      新建文件夹
                    </Button>
                  </PermissionGate>
                )}
                {selectedFolderId && !isScopeSelection(selectedFolderId) && canManageFolder && (
                  <>
                    {canEdit && (
                      <PermissionGate permission="folder:manage">
                        <Button variant="outline" size="sm" onClick={openRenameFolderDialog}>
                          <Edit className="w-4 h-4 mr-2" />
                          重命名
                        </Button>
                      </PermissionGate>
                    )}
                    {isAdmin && isCurrentFolderSystemShared && canEdit && (
                      <Button variant="outline" size="sm" onClick={openMappingDialog}>
                        <FolderInput className="w-4 h-4 mr-2" />
                        修改映射
                      </Button>
                    )}
                    {canDelete && (
                      <PermissionGate permission="file:delete">
                        <Button variant="outline" size="sm" onClick={checkFolderHasChildren}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          清空文件夹
                        </Button>
                      </PermissionGate>
                    )}
                  </>
                )}
                <div className="h-4 w-px bg-border mx-1" />
                {!isReadOnlyScope && (
                  <Button variant="outline" size="sm" onClick={() => router.push('/files/trash')}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    回收站
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={fetchFiles}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
                {!isReadOnlyScope && canUpload && (
                  <PermissionGate permission="file:upload">
                    <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      上传文件
                    </Button>
                  </PermissionGate>
                )}
              </div>
            </div>

            {/* Search, Sort, Filter, View Controls */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索文件..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9 bg-background border-input"
                  />
                </div>
                {/* 排序 */}
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[140px] bg-background border-input">
                    <SelectValue placeholder="排序" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="createdAt-desc">最新上传在前</SelectItem>
                    <SelectItem value="createdAt-asc">最新上传在后</SelectItem>
                    <SelectItem value="updatedAt-desc">最近更新在前</SelectItem>
                    <SelectItem value="updatedAt-asc">最近更新在后</SelectItem>
                    <SelectItem value="name-asc">名称升序</SelectItem>
                    <SelectItem value="name-desc">名称降序</SelectItem>
                  </SelectContent>
                </Select>
                {/* 高级筛选下拉弹窗 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant={(fileSizeFilter !== 'all' || dateFilter !== 'all' || fileTypeFilter !== 'all') ? 'secondary' : 'outline'} 
                      size="sm"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      高级筛选
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-72 bg-card border-border p-4" align="start">
                    <h3 className="text-sm font-medium text-foreground mb-4">筛选条件</h3>
                    
                    {/* 文件大小 */}
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">文件大小</p>
                      <Select value={fileSizeFilter} onValueChange={(v) => setFileSizeFilter(v as FileSizeFilter)}>
                        <SelectTrigger className="w-full bg-background border-input">
                          <SelectValue placeholder="全部" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="all">全部</SelectItem>
                          <SelectItem value="lt1mb">&lt;1MB</SelectItem>
                          <SelectItem value="1to10mb">1-10MB</SelectItem>
                          <SelectItem value="10to100mb">10-100MB</SelectItem>
                          <SelectItem value="gt100mb">&gt;100MB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 修改日期 */}
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">修改日期</p>
                      <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                        <SelectTrigger className="w-full bg-background border-input">
                          <SelectValue placeholder="全部时间" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="all">全部时间</SelectItem>
                          <SelectItem value="today">今天</SelectItem>
                          <SelectItem value="week">最近7天</SelectItem>
                          <SelectItem value="month">本月</SelectItem>
                          <SelectItem value="year">本年</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 文件类型 */}
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">文件类型</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={fileTypeFilter === 'image' ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFileTypeFilter(fileTypeFilter === 'image' ? 'all' : 'image')}
                        >
                          <ImageIcon className="w-3 h-3 mr-1" />
                          图片
                        </Button>
                        <Button
                          variant={fileTypeFilter === 'video' ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFileTypeFilter(fileTypeFilter === 'video' ? 'all' : 'video')}
                        >
                          <Film className="w-3 h-3 mr-1" />
                          视频
                        </Button>
                        <Button
                          variant={fileTypeFilter === 'audio' ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFileTypeFilter(fileTypeFilter === 'audio' ? 'all' : 'audio')}
                        >
                          <Music className="w-3 h-3 mr-1" />
                          音频
                        </Button>
                        <Button
                          variant={fileTypeFilter === 'document' ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFileTypeFilter(fileTypeFilter === 'document' ? 'all' : 'document')}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          文档
                        </Button>
                        <Button
                          variant={fileTypeFilter === 'code' ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFileTypeFilter(fileTypeFilter === 'code' ? 'all' : 'code')}
                        >
                          <Code className="w-3 h-3 mr-1" />
                          代码
                        </Button>
                        <Button
                          variant={fileTypeFilter === 'archive' ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFileTypeFilter(fileTypeFilter === 'archive' ? 'all' : 'archive')}
                        >
                          <Archive className="w-3 h-3 mr-1" />
                          压缩包
                        </Button>
                        <Button
                          variant={fileTypeFilter === 'other' ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFileTypeFilter(fileTypeFilter === 'other' ? 'all' : 'other')}
                        >
                          <FileQuestion className="w-3 h-3 mr-1" />
                          其他
                        </Button>
                      </div>
                    </div>

                    {/* 筛选结果统计 */}
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        共找到 <span className="text-foreground font-medium">{filteredFiles.length}</span> 个文件
                      </p>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* 视图切换 */}
              <div className="flex items-center gap-1 border border-border rounded-md p-1">
                <Button
                  variant={viewMode === 'large-grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode('large-grid')}
                  title="大网格视图"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'detail' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode('detail')}
                  title="详情视图"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode('grid')}
                  title="小网格视图"
                >
                  <Grid className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 选择操作栏 */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleSelectAll(true)}>
                <CheckSquare className="w-4 h-4 mr-1" />
                全选
              </Button>
              <Button variant="outline" size="sm" onClick={handleInvertSelection}>
                <Square className="w-4 h-4 mr-1" />
                反选
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearSelection}>
                <XSquare className="w-4 h-4 mr-1" />
                清空
              </Button>
              {/* 快捷选择下拉菜单 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    选择
                    <ChevronRight className="w-4 h-4 ml-1 rotate-90" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border">
                  <DropdownMenuItem onClick={() => {
                    const imageFiles = filteredFiles.filter(f => f.mimeType.startsWith('image/')).map(f => f.id);
                    setSelectedFiles(imageFiles);
                  }}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    选择所有图片
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const videoFiles = filteredFiles.filter(f => f.mimeType.startsWith('video/')).map(f => f.id);
                    setSelectedFiles(videoFiles);
                  }}>
                    <Film className="w-4 h-4 mr-2" />
                    选择所有视频
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const docFiles = filteredFiles.filter(f => 
                      f.mimeType.includes('pdf') || f.mimeType.includes('word') || f.mimeType.includes('document')
                    ).map(f => f.id);
                    setSelectedFiles(docFiles);
                  }}>
                    <FileText className="w-4 h-4 mr-2" />
                    选择所有文档
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 已选文件统计 */}
              <div className="flex-1" />
              <span className="text-sm text-muted-foreground">
                共 {filteredFiles.length} 项
              </span>

              {selectedFiles.length > 0 && (
                <>
                  <div className="h-4 w-px bg-border mx-2" />
                  <span className="text-sm text-primary font-medium">
                    ✓ 已选择 {selectedFiles.length} 个文件 · 共 {formatFileSize(
                      filteredFiles.filter(f => selectedFiles.includes(f.id)).reduce((sum, f) => sum + f.size, 0)
                    )}
                  </span>
                  {canDownload && (
                    <Button variant="outline" size="sm" onClick={handleBatchDownload}>
                      <Download className="w-4 h-4 mr-1" />
                      下载
                    </Button>
                  )}
                  {canEdit && (
                    <PermissionGate permission="file:move">
                      <Button variant="outline" size="sm" onClick={openMoveDialog}>
                        <Move className="w-4 h-4 mr-1" />
                        移动
                      </Button>
                    </PermissionGate>
                  )}
                  {canEdit && (
                    <PermissionGate permission="file:copy">
                      <Button variant="outline" size="sm" onClick={openCopyDialog}>
                        <Copy className="w-4 h-4 mr-1" />
                        复制
                      </Button>
                    </PermissionGate>
                  )}
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={handleCut}>
                      <Scissors className="w-4 h-4 mr-1" />
                      剪切
                    </Button>
                  )}
                  {canDownload && (
                    <Button variant="outline" size="sm" onClick={handlePackageDownload}>
                      <Package className="w-4 h-4 mr-1" />
                      打包下载
                    </Button>
                  )}
                  {canDelete && (
                    <PermissionGate permission="file:delete">
                      <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </PermissionGate>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                    <X className="w-4 h-4 mr-1" />
                    取消选择
                  </Button>
                </>
              )}

              {clipboard && clipboard.files.length > 0 && (
                <>
                  <div className="h-4 w-px bg-border mx-2" />
                  <span className="text-sm text-muted-foreground">
                    剪贴板: {clipboard.files.length} 项 ({clipboard.action === 'copy' ? '复制' : '剪切'})
                  </span>
                  <Button variant="outline" size="sm" onClick={handlePaste}>
                    <ClipboardPaste className="w-4 h-4 mr-1" />
                    粘贴到此
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setClipboard(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <FileIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>{fileTypeFilter !== 'all' ? '没有符合筛选条件的文件' : '暂无文件'}</p>
                {!isReadOnlyScope && canUpload && (
                  <PermissionGate permission="file:upload">
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      上传文件
                    </Button>
                  </PermissionGate>
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto">
                  {/* 详情视图 */}
                  {viewMode === 'detail' && (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="text-muted-foreground">名称</TableHead>
                          <TableHead className="text-muted-foreground w-20">类型</TableHead>
                          <TableHead className="text-muted-foreground w-20">大小</TableHead>
                          <TableHead className="text-muted-foreground w-36">创建时间</TableHead>
                          <TableHead className="text-muted-foreground w-36">修改时间</TableHead>
                          <TableHead className="text-muted-foreground w-28">文件夹</TableHead>
                          <TableHead className="text-muted-foreground w-24 text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFiles.map((file) => (
                          <TableRow
                            key={file.id}
                            className="border-border hover:bg-muted/50 cursor-pointer"
                            onClick={(e) => handleFileClick(file, e)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedFiles.includes(file.id)}
                                onCheckedChange={(checked) => handleSelectFile(file.id, !!checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {getFileIcon(file.mimeType)}
                                <div className="min-w-0">
                                  <p className="text-foreground font-medium truncate max-w-[200px]" title={file.name}>
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {file.extension.toLowerCase()}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {file.mimeType.startsWith('image/') ? '图片' :
                               file.mimeType.startsWith('video/') ? '视频' :
                               file.mimeType.startsWith('audio/') ? '音频' :
                               file.mimeType.includes('pdf') ? 'PDF' :
                               file.mimeType.includes('word') ? '文档' :
                               file.mimeType.includes('excel') ? '表格' :
                               file.mimeType.includes('zip') || file.mimeType.includes('rar') ? '压缩包' : '文件'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatFileSize(file.size)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(file.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(file.updatedAt || file.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              <span className="truncate max-w-[100px] block" title={file.folderName || '根目录'}>
                                {file.folderName || '根目录'}
                              </span>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border">
                                  <PermissionGate permission="file:preview">
                                    <DropdownMenuItem onClick={() => handlePreview(file)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      预览
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  {canDownload && (
                                    <DropdownMenuItem onClick={() => handleDownload(file)}>
                                      <Download className="w-4 h-4 mr-2" />
                                      下载
                                    </DropdownMenuItem>
                                  )}
                                  {canEdit && (
                                    <PermissionGate permission="file:share">
                                      <DropdownMenuItem onClick={() => handleShare(file)}>
                                        <Share2 className="w-4 h-4 mr-2" />
                                        分享
                                      </DropdownMenuItem>
                                    </PermissionGate>
                                  )}
                                  {(canEdit || canDelete) && (
                                    <DropdownMenuSeparator className="bg-border" />
                                  )}
                                  {canEdit && (
                                    <PermissionGate permission="file:rename">
                                      <DropdownMenuItem onClick={() => handleRename(file)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        重命名
                                      </DropdownMenuItem>
                                    </PermissionGate>
                                  )}
                                  {canDelete && (
                                    <PermissionGate permission="file:delete">
                                      <DropdownMenuItem
                                        onClick={() => handleDelete(file)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        删除
                                      </DropdownMenuItem>
                                    </PermissionGate>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* 大网格视图 */}
                  {viewMode === 'large-grid' && (
                    <div className="grid gap-4 p-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {filteredFiles.map((file) => (
                        <ContextMenu key={file.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              className={`relative group rounded-lg border cursor-pointer transition-all overflow-hidden ${
                                selectedFiles.includes(file.id)
                                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                                  : 'border-border hover:border-primary/50 bg-card'
                              }`}
                              onClick={(e) => handleFileClick(file, e)}
                            >
                              {/* 选择框 */}
                              <div
                                className="absolute top-2 left-2 z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedFiles.includes(file.id)}
                                  onCheckedChange={(checked) => handleSelectFile(file.id, !!checked)}
                                  className="bg-background/80 border-primary/50"
                                />
                              </div>

                              {/* 缩略图区域 - 大尺寸 */}
                              <div className="aspect-[4/3] flex items-center justify-center bg-muted/30 overflow-hidden">
                                {(file.thumbnailUrl || (file.mimeType.startsWith('image/') && file.url)) ? (
                                  <img
                                    src={file.thumbnailUrl || file.url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-full">
                                    {getFileIcon(file.mimeType, 'lg')}
                                  </div>
                                )}
                              </div>

                              {/* 文件信息 */}
                              <div className="p-3 bg-card/80">
                                <p className="text-sm font-medium text-foreground truncate text-center" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground text-center mt-1">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-card border-border">
                            <PermissionGate permission="file:preview">
                              <ContextMenuItem onClick={() => handlePreview(file)}>
                                <Eye className="w-4 h-4 mr-2" />
                                预览
                              </ContextMenuItem>
                            </PermissionGate>
                            {canDownload && (
                              <ContextMenuItem onClick={() => handleDownload(file)}>
                                <Download className="w-4 h-4 mr-2" />
                                下载
                              </ContextMenuItem>
                            )}
                            {canEdit && (
                              <PermissionGate permission="file:share">
                                <ContextMenuItem onClick={() => handleShare(file)}>
                                  <Share2 className="w-4 h-4 mr-2" />
                                  分享
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {(canEdit || canDelete) && <ContextMenuSeparator />}
                            {canEdit && (
                              <PermissionGate permission="file:rename">
                                <ContextMenuItem onClick={() => handleRename(file)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  重命名
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {canEdit && (
                              <PermissionGate permission="file:copy">
                                <ContextMenuItem onClick={() => setClipboard({ files: [file.id], action: 'copy' })}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  复制
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {canEdit && (
                              <PermissionGate permission="file:move">
                                <ContextMenuItem onClick={() => setClipboard({ files: [file.id], action: 'cut' })}>
                                  <Scissors className="w-4 h-4 mr-2" />
                                  剪切
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {canDelete && <ContextMenuSeparator />}
                            {canDelete && (
                              <PermissionGate permission="file:delete">
                                <ContextMenuItem onClick={() => handleDelete(file)} className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  删除
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  )}

                  {/* 小网格视图 */}
                  {viewMode === 'grid' && (
                    <div className="grid gap-3 p-2 grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                      {filteredFiles.map((file) => (
                        <ContextMenu key={file.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              className={`relative group rounded-lg border cursor-pointer transition-all overflow-hidden ${
                                selectedFiles.includes(file.id)
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : 'border-border hover:border-primary/50 bg-card'
                              }`}
                              onClick={(e) => handleFileClick(file, e)}
                            >
                              {/* 选择框 */}
                              <div
                                className="absolute top-1 left-1 z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedFiles.includes(file.id)}
                                  onCheckedChange={(checked) => handleSelectFile(file.id, !!checked)}
                                  className="bg-background/80 border-primary/50 h-4 w-4"
                                />
                              </div>

                              {/* 缩略图区域 - 小尺寸 */}
                              <div className="aspect-square flex items-center justify-center bg-muted/30 overflow-hidden">
                                {(file.thumbnailUrl || (file.mimeType.startsWith('image/') && file.url)) ? (
                                  <img
                                    src={file.thumbnailUrl || file.url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-full">
                                    {getFileIcon(file.mimeType, 'md')}
                                  </div>
                                )}
                              </div>

                              {/* 文件信息 */}
                              <div className="p-1.5 bg-card/80">
                                <p className="text-xs font-medium text-foreground truncate text-center" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground text-center">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-card border-border">
                            <PermissionGate permission="file:preview">
                              <ContextMenuItem onClick={() => handlePreview(file)}>
                                <Eye className="w-4 h-4 mr-2" />
                                预览
                              </ContextMenuItem>
                            </PermissionGate>
                            {canDownload && (
                              <ContextMenuItem onClick={() => handleDownload(file)}>
                                <Download className="w-4 h-4 mr-2" />
                                下载
                              </ContextMenuItem>
                            )}
                            {canEdit && (
                              <PermissionGate permission="file:share">
                                <ContextMenuItem onClick={() => handleShare(file)}>
                                  <Share2 className="w-4 h-4 mr-2" />
                                  分享
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {(canEdit || canDelete) && <ContextMenuSeparator />}
                            {canEdit && (
                              <PermissionGate permission="file:rename">
                                <ContextMenuItem onClick={() => handleRename(file)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  重命名
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {canEdit && (
                              <PermissionGate permission="file:copy">
                                <ContextMenuItem onClick={() => setClipboard({ files: [file.id], action: 'copy' })}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  复制
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {canEdit && (
                              <PermissionGate permission="file:move">
                                <ContextMenuItem onClick={() => setClipboard({ files: [file.id], action: 'cut' })}>
                                  <Scissors className="w-4 h-4 mr-2" />
                                  剪切
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                            {canDelete && <ContextMenuSeparator />}
                            {canDelete && (
                              <PermissionGate permission="file:delete">
                                <ContextMenuItem onClick={() => handleDelete(file)} className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  删除
                                </ContextMenuItem>
                              </PermissionGate>
                            )}
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      显示第 {(page - 1) * pageSize + 1} 至 {Math.min(page * pageSize, totalCount)} 项，共 {totalCount} 项
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">每页</span>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                        <SelectTrigger className="w-[70px] h-8 bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">条</span>
                    </div>
                  </div>
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

      {/* Upload Dialog - 使用完整版上传组件 */}
      <AdvancedUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        folderId={isScopeSelection(selectedFolderId) ? undefined : selectedFolderId}
        onSuccess={fetchFiles}
        isAdmin={isAdmin}
      />

      {/* Preview Dialog */}
      <FilePreview
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onShare={canEdit ? handleShare : undefined}
        canDownload={canDownload}
      />

      {/* Share Dialog */}
      <FileShareDialog
        file={shareFile}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />

      {/* Folder Share Dialog */}
      <FolderShareDialog
        folder={shareFolderTarget}
        open={folderShareDialogOpen}
        onOpenChange={setFolderShareDialogOpen}
        onSuccess={() => {
          fetchFiles();
          setFolderRefreshKey(k => k + 1);
        }}
      />

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">新建文件夹</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="请输入文件夹名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="bg-background border-input"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleCreateFolder} disabled={saving || !newFolderName.trim()}>
              {saving ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename File Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">重命名文件</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="请输入新文件名"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="bg-background border-input"
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleRenameSubmit} disabled={saving || !newFileName.trim()}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">重命名文件夹</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="请输入新名称"
              value={newFolderNameInput}
              onChange={(e) => setNewFolderNameInput(e.target.value)}
              className="bg-background border-input"
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolderSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleRenameFolderSubmit} disabled={saving || !newFolderNameInput.trim()}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">修改映射关系</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedMappingRealFolderId} onValueChange={setSelectedMappingRealFolderId}>
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder="选择真实文件夹" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {realFolders.map((rf) => (
                  <SelectItem key={rf.id} value={rf.id}>
                    {rf.pathName} ({rf.displayName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              上传到此文件夹的文件将存储到该目录
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleUpdateMappingSubmit} disabled={saving || !selectedMappingRealFolderId}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Folder Dialog */}
      <Dialog open={clearFolderDialogOpen} onOpenChange={setClearFolderDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">清空文件夹</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              确定要清空此文件夹中的所有文件吗？文件将被移入回收站。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearFolderDialogOpen(false)} disabled={clearingFolder}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClearFolder} disabled={clearingFolder}>
              {clearingFolder ? '清空中...' : '清空'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Files Dialog */}
      <Dialog open={moveTargetDialogOpen} onOpenChange={setMoveTargetDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">移动文件</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              选择要移动到的目标文件夹（已选择 {selectedFiles.length} 个文件）
            </p>
            <Select value={targetFolderId || 'root'} onValueChange={(v) => setTargetFolderId(v === 'root' ? undefined : v)}>
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder="选择目标文件夹" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="root">根目录</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTargetDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleMoveFiles} disabled={saving}>
              {saving ? '移动中...' : '移动'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Files Dialog */}
      <Dialog open={copyTargetDialogOpen} onOpenChange={setCopyTargetDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">复制文件</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              选择要复制到的目标文件夹（已选择 {selectedFiles.length} 个文件）
            </p>
            <Select value={targetFolderId || 'root'} onValueChange={(v) => setTargetFolderId(v === 'root' ? undefined : v)}>
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder="选择目标文件夹" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="root">根目录</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyTargetDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleCopyFiles} disabled={saving}>
              {saving ? '复制中...' : '复制'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
