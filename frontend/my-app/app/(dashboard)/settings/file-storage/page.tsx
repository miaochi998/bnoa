'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Cloud,
  HardDrive,
  Image as ImageIcon,
  FolderOpen,
  Save,
  TestTube,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Check,
  X,
  Video,
  PenTool,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { RealFolder } from '@/types/file';

interface RustFSConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

interface ImageCompressionConfig {
  enabled: boolean;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  threshold: number;
}

interface ThumbnailConfig {
  width: number;
  height: number;
  quality: number;
}

export default function FileStorageSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // RustFS 配置
  const [rustfsConfig, setRustfsConfig] = useState<RustFSConfig>({
    endpoint: '',
    bucket: '',
    accessKey: '',
    secretKey: '',
    region: 'us-east-1',
  });

  // 本地存储配置
  const [localUploadRoot, setLocalUploadRoot] = useState('/uploads/');

  // 图片压缩配置
  const [compressionConfig, setCompressionConfig] = useState<ImageCompressionConfig>({
    enabled: true,
    quality: 60,
    maxWidth: 1920,
    maxHeight: 1080,
    threshold: 1.5,
  });

  // 缩略图配置
  const [thumbnailConfig, setThumbnailConfig] = useState<ThumbnailConfig>({
    width: 200,
    height: 200,
    quality: 80,
  });
  const [savingThumbnailConfig, setSavingThumbnailConfig] = useState(false);

  // 真实文件夹管理
  const [realFolders, setRealFolders] = useState<RealFolder[]>([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<RealFolder | null>(null);
  const [newFolder, setNewFolder] = useState({
    pathName: '',
    displayName: '',
    description: '',
    sortOrder: 0,
  });

  // 回收站配置
  const [recycleBinRetentionDays, setRecycleBinRetentionDays] = useState(30);
  const [savingRetentionDays, setSavingRetentionDays] = useState(false);

  // 🔑 并行上传配置
  const [maxConcurrentUploads, setMaxConcurrentUploads] = useState(3);
  const [savingUploadConfig, setSavingUploadConfig] = useState(false);

  // 编辑器图片配置
  const [editorImageConfig, setEditorImageConfig] = useState({
    maxWidth: 1920,
    maxHeight: 1080,
    maxSize: 20,
    formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    thumbnailWidth: 480,
    thumbnailHeight: 360,
  });
  const [savingEditorImageConfig, setSavingEditorImageConfig] = useState(false);

  // 编辑器视频配置
  const [editorVideoConfig, setEditorVideoConfig] = useState({
    maxSize: 200,
    formats: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v'],
  });
  const [savingEditorVideoConfig, setSavingEditorVideoConfig] = useState(false);

  // 编辑器文件夹配置
  const [editorFolderConfig, setEditorFolderConfig] = useState({
    imageFolderId: '',
    videoFolderId: '',
  });
  const [savingEditorFolderConfig, setSavingEditorFolderConfig] = useState(false);

  // 图片格式选项
  const IMAGE_FORMAT_OPTIONS = [
    { value: 'jpg', label: 'JPG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
    { value: 'gif', label: 'GIF' },
    { value: 'bmp', label: 'BMP' },
    { value: 'svg', label: 'SVG' },
  ];

  // 视频格式选项
  const VIDEO_FORMAT_OPTIONS = [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM' },
    { value: 'avi', label: 'AVI' },
    { value: 'mov', label: 'MOV' },
    { value: 'mkv', label: 'MKV' },
    { value: 'wmv', label: 'WMV' },
    { value: 'flv', label: 'FLV' },
    { value: 'm4v', label: 'M4V' },
    { value: '3gp', label: '3GP' },
    { value: 'mpeg', label: 'MPEG' },
    { value: 'mpg', label: 'MPG' },
    { value: 'ogv', label: 'OGV' },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      // 从后端获取真实文件夹列表
      const folders = await apiClient.getRealFolders();
      setRealFolders(folders);
      
      // 获取回收站保留天数配置
      try {
        const retentionConfig = await apiClient.getRecycleBinRetentionDays();
        setRecycleBinRetentionDays(retentionConfig.days);
      } catch (e) {
        console.error('Failed to fetch retention days:', e);
      }

      // 获取缩略图配置
      try {
        const thumbConfig = await apiClient.getThumbnailSettings();
        setThumbnailConfig(thumbConfig);
      } catch (e) {
        console.error('Failed to fetch thumbnail settings:', e);
      }

      // 🔑 获取并行上传配置（从后端）
      try {
        const uploadConfig = await apiClient.getUploadSettings();
        setMaxConcurrentUploads(uploadConfig.maxConcurrentUploads);
      } catch (e) {
        console.error('Failed to fetch upload config:', e);
      }

      // 获取图片压缩配置（从后端）
      try {
        const compressConfig = await apiClient.getCompressionSettings();
        setCompressionConfig({
          enabled: true,
          quality: compressConfig.quality,
          maxWidth: compressConfig.maxWidth,
          maxHeight: compressConfig.maxHeight,
          threshold: compressConfig.threshold,
        });
      } catch (e) {
        console.error('Failed to fetch compression config:', e);
      }
      
      // 获取编辑器图片配置
      try {
        const imgConfig = await apiClient.getEditorImageSettings();
        setEditorImageConfig(imgConfig);
      } catch (e) {
        console.error('Failed to fetch editor image config:', e);
      }

      // 获取编辑器视频配置
      try {
        const vidConfig = await apiClient.getEditorVideoSettings();
        setEditorVideoConfig(vidConfig);
      } catch (e) {
        console.error('Failed to fetch editor video config:', e);
      }

      // 获取编辑器文件夹配置
      try {
        const folderConfig = await apiClient.getEditorFolderSettings();
        setEditorFolderConfig(folderConfig);
      } catch (e) {
        console.error('Failed to fetch editor folder config:', e);
      }

      // 从后端获取RustFS配置
      try {
        const rustfs = await apiClient.getRustFSConfig();
        setRustfsConfig({
          endpoint: rustfs.endpoint,
          bucket: rustfs.bucketName,
          accessKey: rustfs.accessKey,
          secretKey: rustfs.secretKey,
          region: rustfs.region || 'us-east-1',
        });
      } catch (e) {
        console.error('Failed to fetch RustFS config:', e);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRetentionDays = async () => {
    try {
      setSavingRetentionDays(true);
      await apiClient.updateRecycleBinRetentionDays(recycleBinRetentionDays);
      alert('保存成功！');
    } catch (error) {
      console.error('Failed to save retention days:', error);
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSavingRetentionDays(false);
    }
  };

  // 🔑 保存并行上传配置（到后端）
  const handleSaveUploadConfig = async () => {
    try {
      setSavingUploadConfig(true);
      await apiClient.saveUploadSettings({ maxConcurrentUploads });
      alert('保存成功！并行上传数量已设置为 ' + maxConcurrentUploads);
    } catch (error) {
      console.error('Failed to save upload config:', error);
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSavingUploadConfig(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const result = await apiClient.testRustFSConnection();
      if (result.success) {
        alert('连接成功！' + (result.message || ''));
      } else {
        alert('连接失败：' + (result.message || '未知错误'));
      }
    } catch (error) {
      alert('连接失败：' + (error as Error).message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveRustFSConfig = async () => {
    try {
      setSaving(true);
      await apiClient.saveRustFSConfig({
        endpoint: rustfsConfig.endpoint,
        bucketName: rustfsConfig.bucket,
        accessKey: rustfsConfig.accessKey,
        secretKey: rustfsConfig.secretKey,
        region: rustfsConfig.region,
      });
      alert('保存成功！');
    } catch (error) {
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompressionConfig = async () => {
    try {
      setSaving(true);
      await apiClient.saveCompressionSettings({
        quality: compressionConfig.quality,
        maxWidth: compressionConfig.maxWidth,
        maxHeight: compressionConfig.maxHeight,
        threshold: compressionConfig.threshold,
      });
      alert('图片压缩配置保存成功！');
    } catch (error) {
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThumbnailConfig = async () => {
    try {
      setSavingThumbnailConfig(true);
      await apiClient.saveThumbnailSettings(thumbnailConfig);
      alert('缩略图配置保存成功！');
    } catch (error) {
      console.error('Failed to save thumbnail settings:', error);
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSavingThumbnailConfig(false);
    }
  };

  // 保存编辑器图片配置
  const handleSaveEditorImageConfig = async () => {
    try {
      setSavingEditorImageConfig(true);
      await apiClient.saveEditorImageSettings(editorImageConfig);
      alert('编辑器图片配置保存成功！');
    } catch (error) {
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSavingEditorImageConfig(false);
    }
  };

  // 保存编辑器视频配置
  const handleSaveEditorVideoConfig = async () => {
    try {
      setSavingEditorVideoConfig(true);
      await apiClient.saveEditorVideoSettings(editorVideoConfig);
      alert('编辑器视频配置保存成功！');
    } catch (error) {
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSavingEditorVideoConfig(false);
    }
  };

  // 保存编辑器文件夹配置
  const handleSaveEditorFolderConfig = async () => {
    try {
      setSavingEditorFolderConfig(true);
      await apiClient.saveEditorFolderSettings(editorFolderConfig);
      alert('编辑器文件夹配置保存成功！');
    } catch (error) {
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSavingEditorFolderConfig(false);
    }
  };

  // 图片格式复选框切换
  const toggleImageFormat = (format: string) => {
    setEditorImageConfig(prev => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter(f => f !== format)
        : [...prev.formats, format],
    }));
  };

  // 视频格式复选框切换
  const toggleVideoFormat = (format: string) => {
    setEditorVideoConfig(prev => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter(f => f !== format)
        : [...prev.formats, format],
    }));
  };

  const handleAddFolder = () => {
    setEditingFolder(null);
    setNewFolder({
      pathName: '',
      displayName: '',
      description: '',
      sortOrder: 0,
    });
    setFolderDialogOpen(true);
  };

  const handleEditFolder = (folder: RealFolder) => {
    setEditingFolder(folder);
    setNewFolder({
      pathName: folder.pathName,
      displayName: folder.displayName,
      description: folder.description || '',
      sortOrder: folder.sortOrder,
    });
    setFolderDialogOpen(true);
  };

  const handleSaveFolder = async () => {
    try {
      setSaving(true);
      if (editingFolder) {
        await apiClient.updateRealFolder(editingFolder.id, {
          displayName: newFolder.displayName,
          description: newFolder.description,
          sortOrder: newFolder.sortOrder,
        });
      } else {
        await apiClient.createRealFolder({
          pathName: newFolder.pathName,
          displayName: newFolder.displayName,
          description: newFolder.description,
          sortOrder: newFolder.sortOrder,
        });
      }
      setFolderDialogOpen(false);
      await fetchSettings();
    } catch (error) {
      alert('保存失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async (folder: RealFolder) => {
    if (folder.isSystem) {
      alert('系统目录不允许删除');
      return;
    }
    if (!confirm(`确定要删除文件夹 "${folder.displayName}" 吗？`)) return;
    try {
      await apiClient.deleteRealFolder(folder.id);
      // 重新加载列表
      await fetchSettings();
    } catch (error) {
      alert('删除失败：' + (error as Error).message);
    }
  };

  const formatFileSize = (bytes: number | string): string => {
    const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (numBytes === 0 || isNaN(numBytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">文件管理配置</h1>
        <p className="text-muted-foreground">管理存储服务配置和真实文件夹</p>
      </div>

      {/* RustFS 存储配置 */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">RustFS 存储配置</CardTitle>
              <CardDescription>配置对象存储服务连接参数</CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testingConnection}
          >
            {testingConnection ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4 mr-2" />
            )}
            测试连接
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>服务器地址 *</Label>
              <Input
                placeholder="http://s3.example.com:9000"
                value={rustfsConfig.endpoint}
                onChange={(e) => setRustfsConfig({ ...rustfsConfig, endpoint: e.target.value })}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>存储桶名称 *</Label>
              <Input
                placeholder="bnoa-files"
                value={rustfsConfig.bucket}
                onChange={(e) => setRustfsConfig({ ...rustfsConfig, bucket: e.target.value })}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Access Key *</Label>
              <Input
                placeholder="minioadmin"
                value={rustfsConfig.accessKey}
                onChange={(e) => setRustfsConfig({ ...rustfsConfig, accessKey: e.target.value })}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Key *</Label>
              <div className="relative">
                <Input
                  type={showSecretKey ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={rustfsConfig.secretKey}
                  onChange={(e) => setRustfsConfig({ ...rustfsConfig, secretKey: e.target.value })}
                  className="bg-background border-input pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Input
                placeholder="us-east-1"
                value={rustfsConfig.region}
                onChange={(e) => setRustfsConfig({ ...rustfsConfig, region: e.target.value })}
                className="bg-background border-input"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveRustFSConfig} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 本地存储配置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">本地存储配置</CardTitle>
              <CardDescription>本地文件存储路径（只读）</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>上传根目录</Label>
            <div className="relative">
              <Input
                value={localUploadRoot}
                readOnly
                className="bg-muted border-input pr-10"
              />
              <HardDrive className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Info className="w-4 h-4" />
              本地存储根目录通过环境变量 LOCAL_UPLOAD_ROOT 配置，修改后需重启服务生效
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 回收站配置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">回收站配置</CardTitle>
              <CardDescription>设置已删除文件的自动清除时间</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>文件保留天数</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={365}
                value={recycleBinRetentionDays}
                onChange={(e) => setRecycleBinRetentionDays(parseInt(e.target.value) || 30)}
                className="bg-background border-input w-24"
              />
              <span className="text-muted-foreground">天</span>
              <Slider
                value={[recycleBinRetentionDays]}
                onValueChange={(value) => setRecycleBinRetentionDays(value[0])}
                min={1}
                max={365}
                step={1}
                className="flex-1"
              />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Info className="w-4 h-4" />
              已删除的文件将在 {recycleBinRetentionDays} 天后自动从回收站中永久删除
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveRetentionDays} disabled={savingRetentionDays}>
              {savingRetentionDays ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 图片压缩配置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">图片压缩参数</CardTitle>
              <CardDescription>配置图片压缩的默认参数（是否启用压缩请在上传面板中设置）</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>压缩质量</Label>
              <span className="text-sm text-primary font-medium">{compressionConfig.quality}%</span>
            </div>
            <Slider
              value={[compressionConfig.quality]}
              onValueChange={(values: number[]) => setCompressionConfig({ ...compressionConfig, quality: values[0] })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">较低的值会减小文件大小，但会降低图片质量</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>最大宽度 (px)</Label>
              <Input
                type="number"
                value={compressionConfig.maxWidth}
                onChange={(e) => setCompressionConfig({ ...compressionConfig, maxWidth: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>最大高度 (px)</Label>
              <Input
                type="number"
                value={compressionConfig.maxHeight}
                onChange={(e) => setCompressionConfig({ ...compressionConfig, maxHeight: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">超过此尺寸的图片会被等比例缩小</p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>压缩阈值</Label>
              <span className="text-sm text-primary font-medium">{compressionConfig.threshold} MB</span>
            </div>
            <Slider
              value={[compressionConfig.threshold]}
              onValueChange={(values: number[]) => setCompressionConfig({ ...compressionConfig, threshold: values[0] })}
              min={0}
              max={500}
              step={0.5}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">只有大于此大小的图片才会被压缩，设为0表示压缩所有图片</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveCompressionConfig} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 🔑 并行上传设置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">上传设置</CardTitle>
              <CardDescription>配置文件上传的并发参数</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>并行上传数量</Label>
              <span className="text-sm text-primary font-medium">{maxConcurrentUploads} 个文件</span>
            </div>
            <Slider
              value={[maxConcurrentUploads]}
              onValueChange={(values: number[]) => setMaxConcurrentUploads(values[0])}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              同时上传的文件数量。较高的值可以加快多文件上传速度，但会占用更多带宽和系统资源。建议设置为 2-5 个。
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveUploadConfig} disabled={savingUploadConfig}>
              <Save className="w-4 h-4 mr-2" />
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 缩略图设置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">缩略图设置</CardTitle>
              <CardDescription>配置图片和视频缩略图的生成参数（等比例缩放，不裁剪）</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>缩略图宽度 (px)</Label>
              <Input
                type="number"
                value={thumbnailConfig.width}
                onChange={(e) => setThumbnailConfig({ ...thumbnailConfig, width: parseInt(e.target.value) || 200 })}
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">横向图片/视频将以此宽度为基准等比例缩放</p>
            </div>
            <div className="space-y-2">
              <Label>缩略图高度 (px)</Label>
              <Input
                type="number"
                value={thumbnailConfig.height}
                onChange={(e) => setThumbnailConfig({ ...thumbnailConfig, height: parseInt(e.target.value) || 200 })}
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">纵向图片/视频将以此高度为基准等比例缩放</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>缩略图质量</Label>
              <span className="text-sm text-primary font-medium">{thumbnailConfig.quality}%</span>
            </div>
            <Slider
              value={[thumbnailConfig.quality]}
              onValueChange={(values: number[]) => setThumbnailConfig({ ...thumbnailConfig, quality: values[0] })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">较低的值会减小文件大小，但会降低缩略图质量</p>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="w-4 h-4" />
              缩略图生成规则：
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>横向图片/视频（宽≥高）：宽度固定为{thumbnailConfig.width}px，高度按原比例缩放</li>
              <li>纵向图片/视频（高&gt;宽）：高度固定为{thumbnailConfig.height}px，宽度按原比例缩放</li>
              <li>例如：1920×1080的图片 → {thumbnailConfig.width}×{Math.round(1080/1920*thumbnailConfig.width)}px</li>
              <li>例如：1080×1920的图片 → {Math.round(1080/1920*thumbnailConfig.height)}×{thumbnailConfig.height}px</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveThumbnailConfig} disabled={savingThumbnailConfig}>
              {savingThumbnailConfig ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 编辑器图片上传配置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <PenTool className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">编辑器图片上传配置</CardTitle>
              <CardDescription>配置富文本编辑器中图片上传的限制参数</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>最大宽度 (px)</Label>
              <Input
                type="number"
                value={editorImageConfig.maxWidth}
                onChange={(e) => setEditorImageConfig({ ...editorImageConfig, maxWidth: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>最大高度 (px)</Label>
              <Input
                type="number"
                value={editorImageConfig.maxHeight}
                onChange={(e) => setEditorImageConfig({ ...editorImageConfig, maxHeight: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>最大大小 (MB)</Label>
            <Input
              type="number"
              value={editorImageConfig.maxSize}
              onChange={(e) => setEditorImageConfig({ ...editorImageConfig, maxSize: parseInt(e.target.value) || 0 })}
              className="bg-background border-input w-32"
            />
            <p className="text-sm text-muted-foreground">超过此大小的图片将无法上传</p>
          </div>

          <div className="space-y-2">
            <Label>支持的图片格式</Label>
            <div className="flex flex-wrap gap-4">
              {IMAGE_FORMAT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editorImageConfig.formats.includes(opt.value)}
                    onCheckedChange={() => toggleImageFormat(opt.value)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>缩略图宽度 (px)</Label>
              <Input
                type="number"
                value={editorImageConfig.thumbnailWidth}
                onChange={(e) => setEditorImageConfig({ ...editorImageConfig, thumbnailWidth: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>缩略图高度 (px)</Label>
              <Input
                type="number"
                value={editorImageConfig.thumbnailHeight}
                onChange={(e) => setEditorImageConfig({ ...editorImageConfig, thumbnailHeight: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveEditorImageConfig} disabled={savingEditorImageConfig}>
              {savingEditorImageConfig ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 编辑器视频上传配置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">编辑器视频上传配置</CardTitle>
              <CardDescription>配置富文本编辑器中视频上传的限制参数</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>最大大小 (MB)</Label>
            <Input
              type="number"
              value={editorVideoConfig.maxSize}
              onChange={(e) => setEditorVideoConfig({ ...editorVideoConfig, maxSize: parseInt(e.target.value) || 0 })}
              className="bg-background border-input w-32"
            />
            <p className="text-sm text-muted-foreground">超过此大小的视频将无法上传</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>支持的视频格式</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setEditorVideoConfig(prev => ({ ...prev, formats: VIDEO_FORMAT_OPTIONS.map(o => o.value) }))}
                >
                  全选
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setEditorVideoConfig(prev => ({ ...prev, formats: [] }))}
                >
                  清空
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              {VIDEO_FORMAT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editorVideoConfig.formats.includes(opt.value)}
                    onCheckedChange={() => toggleVideoFormat(opt.value)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveEditorVideoConfig} disabled={savingEditorVideoConfig}>
              {savingEditorVideoConfig ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 编辑器上传文件夹配置 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">编辑器上传文件夹配置</CardTitle>
              <CardDescription>配置编辑器中图片和视频的存储目录</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>编辑器图片存储位置</Label>
            <Select
              value={editorFolderConfig.imageFolderId || 'none'}
              onValueChange={(val) => setEditorFolderConfig({ ...editorFolderConfig, imageFolderId: val === 'none' ? '' : val })}
            >
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder="选择图片存储文件夹" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未设置（使用默认位置）</SelectItem>
                {realFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      {folder.displayName}
                      <span className="text-muted-foreground text-xs">({folder.pathName})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">编辑器中上传的图片将存储到此文件夹</p>
          </div>

          <div className="space-y-2">
            <Label>编辑器视频存储位置</Label>
            <Select
              value={editorFolderConfig.videoFolderId || 'none'}
              onValueChange={(val) => setEditorFolderConfig({ ...editorFolderConfig, videoFolderId: val === 'none' ? '' : val })}
            >
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder="选择视频存储文件夹" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未设置（使用默认位置）</SelectItem>
                {realFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      {folder.displayName}
                      <span className="text-muted-foreground text-xs">({folder.pathName})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">编辑器中上传的视频将存储到此文件夹</p>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="w-4 h-4" />
              说明：
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>存储位置从上方「真实文件夹管理」中创建的目录读取</li>
              <li>选择文件夹后，编辑器中上传的文件将自动存储到对应目录</li>
              <li>未设置时，文件将上传到系统默认存储位置</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveEditorFolderConfig} disabled={savingEditorFolderConfig}>
              {savingEditorFolderConfig ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 真实文件夹管理 */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-foreground">真实文件夹管理</CardTitle>
              <CardDescription>管理存储系统中的物理目录</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={handleAddFolder}>
            <Plus className="w-4 h-4 mr-2" />
            新增目录
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>路径名称</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead>引用数</TableHead>
                <TableHead>文件数</TableHead>
                <TableHead>总大小</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realFolders.map((folder) => (
                <TableRow key={folder.id} className="border-border">
                  <TableCell className="font-mono text-sm">{folder.pathName}</TableCell>
                  <TableCell>{folder.displayName}</TableCell>
                  <TableCell>{folder.folderCount ?? 0}</TableCell>
                  <TableCell>{folder.fileCount}</TableCell>
                  <TableCell>{formatFileSize(folder.totalSize)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditFolder(folder)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteFolder(folder)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="w-4 h-4" />
              说明：
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>真实文件夹会同时在 RustFS 和本地存储中创建</li>
              <li>支持多级目录，如 resources/covers（每级目录名仅支持英文、数字、下划线、短横线）</li>
              <li>虚拟文件夹已提供多层嵌套能力，真实文件夹仅作物理隔离用途</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 新增/编辑文件夹对话框 */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingFolder ? '编辑文件夹' : '新增文件夹'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>路径名称 *</Label>
              <Input
                placeholder="articles/gallery"
                value={newFolder.pathName}
                onChange={(e) => setNewFolder({ ...newFolder, pathName: e.target.value })}
                className="bg-background border-input"
                disabled={!!editingFolder}
              />
              <p className="text-xs text-muted-foreground">支持多级目录，如 resources/covers（每级仅支持英文、数字、下划线、短横线）</p>
            </div>
            <div className="space-y-2">
              <Label>显示名称 *</Label>
              <Input
                placeholder="文章相册"
                value={newFolder.displayName}
                onChange={(e) => setNewFolder({ ...newFolder, displayName: e.target.value })}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>排序权重</Label>
              <Input
                type="number"
                placeholder="0"
                value={newFolder.sortOrder}
                onChange={(e) => setNewFolder({ ...newFolder, sortOrder: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">数值越小排序越靠前</p>
            </div>
            <div className="space-y-2">
              <Label>备注说明</Label>
              <textarea
                placeholder="用于存放文章频道文章相册图片"
                value={newFolder.description}
                onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })}
                className="w-full min-h-[80px] px-3 py-2 text-sm bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSaveFolder} disabled={saving || !newFolder.pathName || !newFolder.displayName}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
