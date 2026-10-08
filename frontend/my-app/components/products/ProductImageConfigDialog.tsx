'use client';

/**
 * 产品图片配置弹窗
 * 配置产品图片上传的尺寸限制、格式限制、存储文件夹等
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { Loader2, Settings, Folder, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImageConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImageConfig {
  maxWidth: number;
  maxHeight: number;
  maxSize: number;
  formats: string[];
  realFolderId: string | null;
}

interface RealFolder {
  id: string;
  pathName: string;
  displayName: string;
}

const AVAILABLE_FORMATS = [
  { value: 'jpg', label: 'JPG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'gif', label: 'GIF' },
  { value: 'bmp', label: 'BMP' },
  { value: 'svg', label: 'SVG' },
];

export function ProductImageConfigDialog({
  open,
  onOpenChange,
}: ProductImageConfigDialogProps) {
  const [config, setConfig] = useState<ImageConfig>({
    maxWidth: 1920,
    maxHeight: 1080,
    maxSize: 10,
    formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    realFolderId: null,
  });
  const [folders, setFolders] = useState<RealFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取配置和文件夹列表
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [configData, foldersData] = await Promise.all([
        apiClient.getProductImageConfig(),
        apiClient.getRealFolders(),
      ]);
      
      setConfig(configData);
      setFolders(foldersData);
    } catch (err: any) {
      setError(err.message || '加载配置失败');
      console.error('加载配置失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // 保存配置
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await apiClient.saveProductImageConfig(config);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || '保存配置失败');
      console.error('保存配置失败:', err);
    } finally {
      setSaving(false);
    }
  };

  // 处理格式选择
  const handleFormatToggle = (format: string, checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      formats: checked
        ? [...prev.formats, format]
        : prev.formats.filter((f) => f !== format),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            产品图片上传配置
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* 图片尺寸限制 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                图片尺寸限制
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">最大宽度 (px)</Label>
                  <Input
                    type="number"
                    value={config.maxWidth}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        maxWidth: parseInt(e.target.value) || 1920,
                      }))
                    }
                    min={100}
                    max={10000}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">最大高度 (px)</Label>
                  <Input
                    type="number"
                    value={config.maxHeight}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        maxHeight: parseInt(e.target.value) || 1080,
                      }))
                    }
                    min={100}
                    max={10000}
                  />
                </div>
              </div>
            </div>

            {/* 文件大小限制 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                最大文件大小 (MB)
              </div>
              <Input
                type="number"
                value={config.maxSize}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxSize: parseInt(e.target.value) || 10,
                  }))
                }
                min={1}
                max={500}
              />
              <p className="text-xs text-muted-foreground">
                超过此大小的图片将无法上传
              </p>
            </div>

            {/* 图片格式 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">支持的图片格式</Label>
              <div className="flex flex-wrap gap-4">
                {AVAILABLE_FORMATS.map((format) => (
                  <div key={format.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`format-${format.value}`}
                      checked={config.formats.includes(format.value)}
                      onCheckedChange={(checked) =>
                        handleFormatToggle(format.value, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`format-${format.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {format.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 存储文件夹设置 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Folder className="w-4 h-4 text-muted-foreground" />
                存储文件夹
              </Label>
              <Select
                value={config.realFolderId || 'null'}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    realFolderId: value === 'null' ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择存储文件夹" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">默认文件夹</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.displayName} ({folder.pathName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                产品图片将存储到此文件夹中
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
