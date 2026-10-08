'use client';

/**
 * 上传安全设置页面
 * 
 * 功能：
 * - 安全策略配置（格式白名单开关、格式黑名单开关等）
 * - 文件格式白名单管理
 * - 文件格式黑名单管理
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Shield,
  Save,
  Loader2,
  Plus,
  Trash2,
  FileType,
  AlertTriangle,
  CheckCircle,
  Settings,
  Pencil,
  ShieldBan,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

// 危险格式分类映射（前端显示用）
const DANGEROUS_FORMAT_MAP: Record<string, { name: string; category: string }> = {
  exe: { name: '可执行文件', category: '可执行文件' },
  bat: { name: 'BAT 批处理', category: '可执行文件' },
  cmd: { name: 'CMD 命令', category: '可执行文件' },
  com: { name: 'COM 程序', category: '可执行文件' },
  pif: { name: 'PIF 快捷方式', category: '可执行文件' },
  sh: { name: 'Shell 脚本', category: 'Shell脚本' },
  bash: { name: 'Bash 脚本', category: 'Shell脚本' },
  zsh: { name: 'Zsh 脚本', category: 'Shell脚本' },
  fish: { name: 'Fish 脚本', category: 'Shell脚本' },
  php: { name: 'PHP 脚本', category: '服务端脚本' },
  jsp: { name: 'JSP 脚本', category: '服务端脚本' },
  asp: { name: 'ASP 脚本', category: '服务端脚本' },
  aspx: { name: 'ASPX 脚本', category: '服务端脚本' },
  dll: { name: 'DLL 动态库', category: '动态库' },
  so: { name: 'SO 共享库', category: '动态库' },
  dylib: { name: 'DYLIB 动态库', category: '动态库' },
  scr: { name: '屏保程序', category: '其他危险格式' },
  vbs: { name: 'VBScript 脚本', category: '其他危险格式' },
  ps1: { name: 'PowerShell 脚本', category: '其他危险格式' },
  jar: { name: 'Java 可执行包', category: '其他危险格式' },
  msi: { name: 'MSI 安装包', category: '安装包' },
  app: { name: 'macOS 应用', category: '安装包' },
  deb: { name: 'DEB 安装包', category: '安装包' },
  rpm: { name: 'RPM 安装包', category: '安装包' },
  lnk: { name: 'Windows 快捷方式', category: '快捷方式' },
  url: { name: 'URL 快捷方式', category: '快捷方式' },
  docm: { name: 'Word 宏文件', category: '宏文件' },
  xlsm: { name: 'Excel 宏文件', category: '宏文件' },
  pptm: { name: 'PPT 宏文件', category: '宏文件' },
};

// 类型定义
interface SecurityConfig {
  enableFormatLimit: boolean;
  enableBlacklist: boolean;
  globalMaxFiles: number;
  dangerousExtensions: string[];
  enableVirusScan: boolean;
  scanTimeoutSeconds: number;
  autoQuarantine: boolean;
  minFreeSpaceBytes: number;
  enableSpaceCheck: boolean;
  updatedAt: string;
}

interface FileFormatConfig {
  id: string;
  fileExtension: string;
  displayName: string;
  mimeTypes: string[];
  maxSize: number;
  minSize: number;
  description?: string;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// 常用文件格式预设（包含图片、视频、音频、文档、办公、压缩包、镜像等）
const COMMON_FORMATS = [
  // 图片格式
  { ext: 'jpg', name: 'JPG 图片', mimes: ['image/jpeg'], maxSize: 10 * 1024 * 1024 },
  { ext: 'jpeg', name: 'JPEG 图片', mimes: ['image/jpeg'], maxSize: 10 * 1024 * 1024 },
  { ext: 'png', name: 'PNG 图片', mimes: ['image/png'], maxSize: 10 * 1024 * 1024 },
  { ext: 'gif', name: 'GIF 图片', mimes: ['image/gif'], maxSize: 5 * 1024 * 1024 },
  { ext: 'webp', name: 'WebP 图片', mimes: ['image/webp'], maxSize: 10 * 1024 * 1024 },
  { ext: 'svg', name: 'SVG 矢量图', mimes: ['image/svg+xml'], maxSize: 2 * 1024 * 1024 },
  { ext: 'ico', name: 'ICO 图标', mimes: ['image/x-icon', 'image/vnd.microsoft.icon'], maxSize: 1 * 1024 * 1024 },
  { ext: 'bmp', name: 'BMP 位图', mimes: ['image/bmp'], maxSize: 20 * 1024 * 1024 },
  { ext: 'tiff', name: 'TIFF 图片', mimes: ['image/tiff'], maxSize: 50 * 1024 * 1024 },
  // 视频格式
  { ext: 'mp4', name: 'MP4 视频', mimes: ['video/mp4'], maxSize: 500 * 1024 * 1024 },
  { ext: 'webm', name: 'WebM 视频', mimes: ['video/webm'], maxSize: 500 * 1024 * 1024 },
  { ext: 'mov', name: 'MOV 视频', mimes: ['video/quicktime'], maxSize: 500 * 1024 * 1024 },
  { ext: 'avi', name: 'AVI 视频', mimes: ['video/x-msvideo'], maxSize: 500 * 1024 * 1024 },
  { ext: 'mkv', name: 'MKV 视频', mimes: ['video/x-matroska'], maxSize: 500 * 1024 * 1024 },
  { ext: 'wmv', name: 'WMV 视频', mimes: ['video/x-ms-wmv'], maxSize: 500 * 1024 * 1024 },
  // 音频格式
  { ext: 'mp3', name: 'MP3 音频', mimes: ['audio/mpeg'], maxSize: 50 * 1024 * 1024 },
  { ext: 'wav', name: 'WAV 音频', mimes: ['audio/wav', 'audio/x-wav'], maxSize: 100 * 1024 * 1024 },
  { ext: 'flac', name: 'FLAC 音频', mimes: ['audio/flac'], maxSize: 100 * 1024 * 1024 },
  { ext: 'aac', name: 'AAC 音频', mimes: ['audio/aac'], maxSize: 50 * 1024 * 1024 },
  // 文档格式
  { ext: 'pdf', name: 'PDF 文档', mimes: ['application/pdf'], maxSize: 50 * 1024 * 1024 },
  { ext: 'txt', name: '文本文件', mimes: ['text/plain'], maxSize: 10 * 1024 * 1024 },
  { ext: 'rtf', name: 'RTF 文档', mimes: ['application/rtf', 'text/rtf'], maxSize: 20 * 1024 * 1024 },
  { ext: 'md', name: 'Markdown 文档', mimes: ['text/markdown'], maxSize: 10 * 1024 * 1024 },
  { ext: 'csv', name: 'CSV 表格', mimes: ['text/csv'], maxSize: 50 * 1024 * 1024 },
  // Office 办公格式
  { ext: 'doc', name: 'Word 文档 (旧版)', mimes: ['application/msword'], maxSize: 50 * 1024 * 1024 },
  { ext: 'docx', name: 'Word 文档', mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxSize: 50 * 1024 * 1024 },
  { ext: 'xls', name: 'Excel 表格 (旧版)', mimes: ['application/vnd.ms-excel'], maxSize: 50 * 1024 * 1024 },
  { ext: 'xlsx', name: 'Excel 表格', mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], maxSize: 50 * 1024 * 1024 },
  { ext: 'ppt', name: 'PowerPoint 幻灯片 (旧版)', mimes: ['application/vnd.ms-powerpoint'], maxSize: 100 * 1024 * 1024 },
  { ext: 'pptx', name: 'PowerPoint 幻灯片', mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], maxSize: 100 * 1024 * 1024 },
  // WPS 办公格式
  { ext: 'wps', name: 'WPS 文档', mimes: ['application/vnd.ms-works'], maxSize: 50 * 1024 * 1024 },
  { ext: 'et', name: 'WPS 表格', mimes: ['application/vnd.ms-works'], maxSize: 50 * 1024 * 1024 },
  { ext: 'dps', name: 'WPS 演示', mimes: ['application/vnd.ms-works'], maxSize: 100 * 1024 * 1024 },
  // OpenDocument 格式
  { ext: 'odt', name: 'OpenDocument 文档', mimes: ['application/vnd.oasis.opendocument.text'], maxSize: 50 * 1024 * 1024 },
  { ext: 'ods', name: 'OpenDocument 表格', mimes: ['application/vnd.oasis.opendocument.spreadsheet'], maxSize: 50 * 1024 * 1024 },
  { ext: 'odp', name: 'OpenDocument 演示', mimes: ['application/vnd.oasis.opendocument.presentation'], maxSize: 100 * 1024 * 1024 },
  // 压缩包格式
  { ext: 'zip', name: 'ZIP 压缩包', mimes: ['application/zip', 'application/x-zip-compressed'], maxSize: 1024 * 1024 * 1024 },
  { ext: 'rar', name: 'RAR 压缩包', mimes: ['application/x-rar-compressed', 'application/vnd.rar'], maxSize: 1024 * 1024 * 1024 },
  { ext: '7z', name: '7Z 压缩包', mimes: ['application/x-7z-compressed'], maxSize: 1024 * 1024 * 1024 },
  { ext: 'tar', name: 'TAR 归档', mimes: ['application/x-tar'], maxSize: 1024 * 1024 * 1024 },
  { ext: 'gz', name: 'GZ 压缩包', mimes: ['application/gzip'], maxSize: 1024 * 1024 * 1024 },
  // 镜像格式
  { ext: 'dmg', name: 'DMG 镜像', mimes: ['application/x-apple-diskimage'], maxSize: 10 * 1024 * 1024 * 1024 },
  { ext: 'iso', name: 'ISO 镜像', mimes: ['application/x-iso9660-image'], maxSize: 10 * 1024 * 1024 * 1024 },
  // 电子书格式
  { ext: 'epub', name: 'EPUB 电子书', mimes: ['application/epub+zip'], maxSize: 100 * 1024 * 1024 },
  { ext: 'mobi', name: 'MOBI 电子书', mimes: ['application/x-mobipocket-ebook'], maxSize: 100 * 1024 * 1024 },
  // 字体格式
  { ext: 'ttf', name: 'TTF 字体', mimes: ['font/ttf', 'application/x-font-ttf'], maxSize: 20 * 1024 * 1024 },
  { ext: 'otf', name: 'OTF 字体', mimes: ['font/otf', 'application/x-font-otf'], maxSize: 20 * 1024 * 1024 },
  { ext: 'woff', name: 'WOFF 字体', mimes: ['font/woff'], maxSize: 10 * 1024 * 1024 },
  { ext: 'woff2', name: 'WOFF2 字体', mimes: ['font/woff2'], maxSize: 10 * 1024 * 1024 },
];

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function UploadSecurityPage() {
  // 安全配置状态
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  
  // 格式列表状态
  const [formats, setFormats] = useState<FileFormatConfig[]>([]);
  const [formatsLoading, setFormatsLoading] = useState(true);
  
  // 格式配置对话框状态
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [editingFormat, setEditingFormat] = useState<FileFormatConfig | null>(null);
  const [formatForm, setFormatForm] = useState({
    fileExtension: '',
    displayName: '',
    mimeTypes: '',
    maxSize: '10',
    maxSizeUnit: 'MB',
    description: '',
    isEnabled: true,
  });
  const [savingFormat, setSavingFormat] = useState(false);
  
  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFormat, setDeletingFormat] = useState<FileFormatConfig | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  
  // 初始化常用格式对话框
  const [initDialogOpen, setInitDialogOpen] = useState(false);
  const [batchCreating, setBatchCreating] = useState(false);

  // 黑名单状态
  const [blacklistInput, setBlacklistInput] = useState('');
  const [addingBlacklist, setAddingBlacklist] = useState(false);
  const [initBlacklistDialogOpen, setInitBlacklistDialogOpen] = useState(false);
  const [batchCreatingBlacklist, setBatchCreatingBlacklist] = useState(false);

  // 获取安全配置
  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const response = await apiClient.getUploadSecurityConfig();
      setSecurityConfig(response);
    } catch (error) {
      console.error('获取安全配置失败:', error);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // 获取格式列表
  const fetchFormats = useCallback(async () => {
    setFormatsLoading(true);
    try {
      const response = await apiClient.getFileFormats();
      setFormats(response.items);
    } catch (error) {
      console.error('获取格式列表失败:', error);
      setFormats([]);
    } finally {
      setFormatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchFormats();
  }, [fetchConfig, fetchFormats]);

  // 重置格式表单
  const resetFormatForm = () => {
    setFormatForm({
      fileExtension: '',
      displayName: '',
      mimeTypes: '',
      maxSize: '10',
      maxSizeUnit: 'MB',
      description: '',
      isEnabled: true,
    });
  };

  // 处理安全配置变更
  const handleConfigChange = (field: keyof SecurityConfig, value: boolean | number | string[]) => {
    if (securityConfig) {
      setSecurityConfig({ ...securityConfig, [field]: value });
      setConfigDirty(true);
    }
  };

  // 保存安全配置
  const handleSaveConfig = async () => {
    if (!securityConfig) return;
    setUpdatingConfig(true);
    try {
      await apiClient.updateUploadSecurityConfig({
        enableFormatLimit: securityConfig.enableFormatLimit,
        enableBlacklist: securityConfig.enableBlacklist,
        enableVirusScan: securityConfig.enableVirusScan,
        autoQuarantine: securityConfig.autoQuarantine,
        enableSpaceCheck: securityConfig.enableSpaceCheck,
        scanTimeoutSeconds: securityConfig.scanTimeoutSeconds,
      });
      setConfigDirty(false);
    } catch (error) {
      console.error('保存配置失败:', error);
    } finally {
      setUpdatingConfig(false);
    }
  };

  // 打开添加格式对话框
  const handleAddFormat = () => {
    setEditingFormat(null);
    resetFormatForm();
    setFormatDialogOpen(true);
  };

  // 打开编辑格式对话框
  const handleEditFormat = (format: FileFormatConfig) => {
    setEditingFormat(format);
    const sizeInMB = format.maxSize / (1024 * 1024);
    let maxSize = sizeInMB.toString();
    let maxSizeUnit = 'MB';
    if (sizeInMB >= 1024) {
      maxSize = (sizeInMB / 1024).toString();
      maxSizeUnit = 'GB';
    } else if (sizeInMB < 1) {
      maxSize = (format.maxSize / 1024).toString();
      maxSizeUnit = 'KB';
    }
    setFormatForm({
      fileExtension: format.fileExtension,
      displayName: format.displayName,
      mimeTypes: format.mimeTypes.join(', '),
      maxSize,
      maxSizeUnit,
      description: format.description || '',
      isEnabled: format.isEnabled,
    });
    setFormatDialogOpen(true);
  };

  // 提交格式表单
  const handleSubmitFormat = async () => {
    // 表单验证
    if (!editingFormat && !formatForm.fileExtension.trim()) {
      alert('请输入文件扩展名');
      return;
    }
    if (!formatForm.displayName.trim()) {
      alert('请输入显示名称');
      return;
    }
    if (!formatForm.mimeTypes.trim()) {
      alert('请输入MIME类型');
      return;
    }
    if (!formatForm.maxSize || parseFloat(formatForm.maxSize) <= 0) {
      alert('请输入有效的最大文件大小');
      return;
    }

    const multipliers: Record<string, number> = {
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };
    const maxSizeBytes = parseFloat(formatForm.maxSize) * (multipliers[formatForm.maxSizeUnit] || 1024 * 1024);
    const mimeTypes = formatForm.mimeTypes.split(',').map(m => m.trim()).filter(Boolean);

    setSavingFormat(true);
    try {
      if (editingFormat) {
        // 更新格式
        await apiClient.updateFileFormat(editingFormat.id, {
          displayName: formatForm.displayName,
          mimeTypes,
          maxSize: maxSizeBytes,
          isEnabled: formatForm.isEnabled,
        });
      } else {
        // 创建格式
        await apiClient.createFileFormat({
          fileExtension: formatForm.fileExtension.toLowerCase().replace(/^\./, ''),
          displayName: formatForm.displayName,
          mimeTypes,
          maxSize: maxSizeBytes,
          isEnabled: formatForm.isEnabled,
        });
      }
      setFormatDialogOpen(false);
      setEditingFormat(null);
      resetFormatForm();
      fetchFormats();
    } catch (error: any) {
      console.error('保存格式失败:', error);
      alert(error.message || '保存格式失败');
    } finally {
      setSavingFormat(false);
    }
  };

  // 删除格式
  const handleDeleteFormat = (format: FileFormatConfig) => {
    setDeletingFormat(format);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteFormat = async () => {
    if (!deletingFormat) return;
    setDeletingLoading(true);
    try {
      await apiClient.deleteFileFormat(deletingFormat.id);
      setDeleteDialogOpen(false);
      setDeletingFormat(null);
      fetchFormats();
    } catch (error) {
      console.error('删除格式失败:', error);
    } finally {
      setDeletingLoading(false);
    }
  };

  // 切换格式启用状态
  const handleToggleFormat = async (format: FileFormatConfig) => {
    try {
      const result = await apiClient.toggleFileFormat(format.id);
      setFormats(prev => prev.map(f => 
        f.id === format.id ? { ...f, isEnabled: result.isEnabled } : f
      ));
    } catch (error) {
      console.error('切换状态失败:', error);
    }
  };

  // 初始化常用格式
  const handleInitCommonFormats = async () => {
    setBatchCreating(true);
    try {
      await apiClient.initCommonFormats();
      setInitDialogOpen(false);
      fetchFormats();
    } catch (error) {
      console.error('初始化失败:', error);
    } finally {
      setBatchCreating(false);
    }
  };

  // 黑名单：添加扩展名
  const handleAddBlacklist = async () => {
    const ext = blacklistInput.trim().toLowerCase().replace(/^\./, '');
    if (!ext) return;
    setAddingBlacklist(true);
    try {
      const result = await apiClient.addBlacklistExtension(ext);
      if (securityConfig) {
        setSecurityConfig({ ...securityConfig, dangerousExtensions: result.dangerousExtensions });
      }
      setBlacklistInput('');
    } catch (error) {
      console.error('添加失败:', error);
    } finally {
      setAddingBlacklist(false);
    }
  };

  // 黑名单：删除扩展名
  const handleRemoveBlacklist = async (ext: string) => {
    try {
      const result = await apiClient.removeBlacklistExtension(ext);
      if (securityConfig) {
        setSecurityConfig({ ...securityConfig, dangerousExtensions: result.dangerousExtensions });
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 黑名单：初始化常用危险格式
  const handleInitBlacklist = async () => {
    setBatchCreatingBlacklist(true);
    try {
      const result = await apiClient.initBlacklistFormats();
      if (securityConfig) {
        setSecurityConfig({ ...securityConfig, dangerousExtensions: result.dangerousExtensions });
      }
      setInitBlacklistDialogOpen(false);
    } catch (error) {
      console.error('初始化失败:', error);
    } finally {
      setBatchCreatingBlacklist(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          上传安全设置
        </h1>
        <p className="text-muted-foreground mt-1">管理文件上传的安全策略和格式白名单</p>
      </div>

      {/* 安全配置卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">安全策略配置</CardTitle>
                <CardDescription>控制上传验证的开关和参数</CardDescription>
              </div>
            </div>
            <Button onClick={handleSaveConfig} disabled={updatingConfig || !configDirty}>
              {updatingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存配置
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {configLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : securityConfig ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 格式白名单开关 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">启用格式白名单</Label>
                  <p className="text-sm text-muted-foreground">
                    开启后，只允许上传白名单中的文件格式
                  </p>
                </div>
                <Switch
                  checked={securityConfig.enableFormatLimit}
                  onCheckedChange={(checked) => handleConfigChange('enableFormatLimit', checked)}
                />
              </div>

              {/* 格式黑名单开关 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">启用格式黑名单</Label>
                  <p className="text-sm text-muted-foreground">
                    开启后，禁止上传黑名单中的危险文件格式
                  </p>
                </div>
                <Switch
                  checked={securityConfig.enableBlacklist}
                  onCheckedChange={(checked) => handleConfigChange('enableBlacklist', checked)}
                />
              </div>

              {/* 病毒扫描开关 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">启用病毒扫描</Label>
                  <p className="text-sm text-muted-foreground">
                    上传文件后进行病毒扫描（需配置ClamAV）
                  </p>
                </div>
                <Switch
                  checked={securityConfig.enableVirusScan}
                  onCheckedChange={(checked) => handleConfigChange('enableVirusScan', checked)}
                />
              </div>

              {/* 自动隔离开关 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">自动隔离可疑文件</Label>
                  <p className="text-sm text-muted-foreground">
                    检测到可疑文件时自动隔离
                  </p>
                </div>
                <Switch
                  checked={securityConfig.autoQuarantine}
                  onCheckedChange={(checked) => handleConfigChange('autoQuarantine', checked)}
                />
              </div>

              {/* 空间检查开关 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">启用空间检查</Label>
                  <p className="text-sm text-muted-foreground">
                    上传前检查存储空间是否充足
                  </p>
                </div>
                <Switch
                  checked={securityConfig.enableSpaceCheck}
                  onCheckedChange={(checked) => handleConfigChange('enableSpaceCheck', checked)}
                />
              </div>

              {/* 扫描超时 */}
              <div className="p-4 border rounded-lg space-y-2">
                <Label className="text-base font-medium">扫描超时时间（秒）</Label>
                <Input
                  type="number"
                  min={60}
                  max={3600}
                  value={securityConfig.scanTimeoutSeconds}
                  onChange={(e) => handleConfigChange('scanTimeoutSeconds', parseInt(e.target.value) || 300)}
                />
              </div>
            </div>
          ) : null}

        </CardContent>
      </Card>

      {/* 文件格式管理（Tab切换白名单/黑名单） */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="whitelist">
            <TabsList>
              <TabsTrigger value="whitelist">
                <FileType className="mr-1.5 h-4 w-4" />
                格式白名单
              </TabsTrigger>
              <TabsTrigger value="blacklist">
                <ShieldBan className="mr-1.5 h-4 w-4" />
                格式黑名单
              </TabsTrigger>
            </TabsList>

            {/* 白名单 Tab */}
            <TabsContent value="whitelist">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">文件格式白名单</h3>
                  <p className="text-sm text-muted-foreground">管理允许上传的文件格式及其限制</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setInitDialogOpen(true)} disabled={batchCreating}>
                    {batchCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    初始化常用格式
                  </Button>
                  <Button size="sm" onClick={handleAddFormat}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加格式
                  </Button>
                </div>
              </div>
              {formatsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : formats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileType className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">暂无格式配置</p>
                  <p className="text-sm mt-1">点击"初始化常用格式"快速添加常用文件格式</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>扩展名</TableHead>
                      <TableHead>显示名称</TableHead>
                      <TableHead>MIME 类型</TableHead>
                      <TableHead>最大大小</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formats.map((format) => (
                      <TableRow key={format.id}>
                        <TableCell className="font-mono">.{format.fileExtension}</TableCell>
                        <TableCell>{format.displayName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {format.mimeTypes.slice(0, 2).map((mime, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{mime}</Badge>
                            ))}
                            {format.mimeTypes.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{format.mimeTypes.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatFileSize(format.maxSize)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={format.isEnabled}
                            onCheckedChange={() => handleToggleFormat(format)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditFormat(format)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteFormat(format)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* 黑名单 Tab */}
            <TabsContent value="blacklist">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">文件格式黑名单</h3>
                  <p className="text-sm text-muted-foreground">管理禁止上传的危险文件格式</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setInitBlacklistDialogOpen(true)}>
                  初始化常用危险格式
                </Button>
              </div>

              {/* 添加黑名单输入 */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="输入扩展名，如：exe、bat、sh"
                  value={blacklistInput}
                  onChange={(e) => setBlacklistInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddBlacklist()}
                  className="max-w-xs"
                />
                <Button onClick={handleAddBlacklist} disabled={addingBlacklist || !blacklistInput.trim()}>
                  {addingBlacklist ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  添加
                </Button>
              </div>

              {/* 黑名单表格 */}
              {securityConfig && securityConfig.dangerousExtensions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldBan className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">暂无黑名单配置</p>
                  <p className="text-sm mt-1">点击"初始化常用危险格式"快速添加</p>
                </div>
              ) : securityConfig ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>扩展名</TableHead>
                      <TableHead>显示名称</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityConfig.dangerousExtensions.map((ext) => {
                      const info = DANGEROUS_FORMAT_MAP[ext];
                      return (
                        <TableRow key={ext}>
                          <TableCell className="font-mono">.{ext}</TableCell>
                          <TableCell>{info?.name || ext.toUpperCase()}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{info?.category || '自定义'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveBlacklist(ext)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 添加/编辑格式对话框 */}
      <Dialog open={formatDialogOpen} onOpenChange={setFormatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFormat ? '编辑文件格式' : '添加文件格式'}</DialogTitle>
            <DialogDescription>
              {editingFormat ? '修改文件格式的配置' : '添加新的允许上传的文件格式'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>文件扩展名</Label>
              <Input
                placeholder="如：jpg、png、pdf"
                value={formatForm.fileExtension}
                onChange={(e) => setFormatForm({ ...formatForm, fileExtension: e.target.value })}
                disabled={!!editingFormat}
              />
            </div>
            <div className="space-y-2">
              <Label>显示名称</Label>
              <Input
                placeholder="如：JPG 图片"
                value={formatForm.displayName}
                onChange={(e) => setFormatForm({ ...formatForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>MIME 类型（多个用逗号分隔）</Label>
              <Input
                placeholder="如：image/jpeg, image/jpg"
                value={formatForm.mimeTypes}
                onChange={(e) => setFormatForm({ ...formatForm, mimeTypes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>最大文件大小</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={formatForm.maxSize}
                  onChange={(e) => setFormatForm({ ...formatForm, maxSize: e.target.value })}
                  className="flex-1"
                />
                <select
                  value={formatForm.maxSizeUnit}
                  onChange={(e) => setFormatForm({ ...formatForm, maxSizeUnit: e.target.value })}
                  className="w-20 border rounded-md px-2 bg-background"
                >
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Input
                placeholder="格式说明"
                value={formatForm.description}
                onChange={(e) => setFormatForm({ ...formatForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>启用此格式</Label>
              <Switch
                checked={formatForm.isEnabled}
                onCheckedChange={(checked) => setFormatForm({ ...formatForm, isEnabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormatDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmitFormat} disabled={savingFormat}>
              {savingFormat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFormat ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除文件格式 "{deletingFormat?.displayName}" (.{deletingFormat?.fileExtension}) 吗？
              删除后，该格式的文件将无法上传。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFormat} disabled={deletingLoading}>
              {deletingLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 初始化常用格式确认对话框 */}
      <AlertDialog open={initDialogOpen} onOpenChange={setInitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>初始化常用格式</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>此操作将<strong className="text-destructive">删除所有现有格式配置</strong>，然后重新创建 {COMMON_FORMATS.length} 种标准格式（图片、视频、文档、压缩包、镜像等）。</p>
                <p>这可以在编辑或删除失误后恢复到初始状态。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleInitCommonFormats} disabled={batchCreating}>
              {batchCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 初始化黑名单确认对话框 */}
      <AlertDialog open={initBlacklistDialogOpen} onOpenChange={setInitBlacklistDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>初始化危险格式黑名单</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>此操作将<strong className="text-destructive">重置所有黑名单配置</strong>，恢复为默认的常用危险格式（可执行文件、脚本、动态库、安装包、宏文件等）。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleInitBlacklist} disabled={batchCreatingBlacklist}>
              {batchCreatingBlacklist && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
