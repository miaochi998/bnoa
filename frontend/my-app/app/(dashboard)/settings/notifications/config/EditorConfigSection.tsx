'use client';

import { useState, useEffect } from 'react';
import {
    Save, Loader2, PenTool, Video, FolderOpen, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import type { RealFolder } from '@/types/file';

const IMAGE_FORMAT_OPTIONS = [
    { value: 'jpg', label: 'JPG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
    { value: 'gif', label: 'GIF' },
    { value: 'bmp', label: 'BMP' },
    { value: 'svg', label: 'SVG' },
];

const VIDEO_FORMAT_OPTIONS = [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM' },
    { value: 'avi', label: 'AVI' },
    { value: 'mov', label: 'MOV' },
    { value: 'mkv', label: 'MKV' },
    { value: 'wmv', label: 'WMV' },
    { value: 'flv', label: 'FLV' },
    { value: 'm4v', label: 'M4V' },
];

type EditorScope = 'editor' | 'notebook';

interface EditorConfigSectionProps {
    scope?: EditorScope;
}

const SCOPE_LABELS: Record<EditorScope, string> = {
    editor: '广播通知编辑器',
    notebook: '记事本编辑器',
};

export function EditorConfigSection({ scope = 'editor' }: EditorConfigSectionProps) {
    const scopeLabel = SCOPE_LABELS[scope];

    const [imageConfig, setImageConfig] = useState({
        maxWidth: 1920, maxHeight: 1080, maxSize: 20,
        formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        thumbnailWidth: 480, thumbnailHeight: 360,
    });
    const [videoConfig, setVideoConfig] = useState({
        maxSize: 200,
        formats: ['mp4', 'webm', 'avi', 'mov', 'mkv'],
    });
    const [folderConfig, setFolderConfig] = useState({
        imageFolderId: '', videoFolderId: '',
    });
    const [realFolders, setRealFolders] = useState<RealFolder[]>([]);
    const [savingImage, setSavingImage] = useState(false);
    const [savingVideo, setSavingVideo] = useState(false);
    const [savingFolder, setSavingFolder] = useState(false);

    useEffect(() => {
        loadEditorConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope]);

    const loadEditorConfig = async () => {
        try {
            const [imgCfg, vidCfg, fldCfg, folders] =
                await Promise.all([
                    scope === 'notebook'
                        ? apiClient.getNotebookImageSettings()
                        : apiClient.getEditorImageSettings(),
                    scope === 'notebook'
                        ? apiClient.getNotebookVideoSettings()
                        : apiClient.getEditorVideoSettings(),
                    scope === 'notebook'
                        ? apiClient.getNotebookFolderSettings()
                        : apiClient.getEditorFolderSettings(),
                    apiClient.getRealFolders(),
                ]);
            setImageConfig(imgCfg);
            setVideoConfig(vidCfg);
            setFolderConfig(fldCfg);
            setRealFolders(folders);
        } catch (e) {
            console.error('Failed to load editor config:', e);
        }
    };

    const handleSaveImage = async () => {
        try {
            setSavingImage(true);
            if (scope === 'notebook') {
                await apiClient.saveNotebookImageSettings(imageConfig);
            } else {
                await apiClient.saveEditorImageSettings(imageConfig);
            }
            alert('图片配置保存成功');
        } catch (e) {
            alert('保存失败：' + (e as Error).message);
        } finally {
            setSavingImage(false);
        }
    };

    const handleSaveVideo = async () => {
        try {
            setSavingVideo(true);
            if (scope === 'notebook') {
                await apiClient.saveNotebookVideoSettings(videoConfig);
            } else {
                await apiClient.saveEditorVideoSettings(videoConfig);
            }
            alert('视频配置保存成功');
        } catch (e) {
            alert('保存失败：' + (e as Error).message);
        } finally {
            setSavingVideo(false);
        }
    };

    const handleSaveFolder = async () => {
        try {
            setSavingFolder(true);
            if (scope === 'notebook') {
                await apiClient.saveNotebookFolderSettings(folderConfig);
            } else {
                await apiClient.saveEditorFolderSettings(folderConfig);
            }
            alert('存储位置配置保存成功');
        } catch (e) {
            alert('保存失败：' + (e as Error).message);
        } finally {
            setSavingFolder(false);
        }
    };

    const toggleImageFormat = (fmt: string) => {
        setImageConfig((prev) => ({
            ...prev,
            formats: prev.formats.includes(fmt)
                ? prev.formats.filter((f) => f !== fmt)
                : [...prev.formats, fmt],
        }));
    };

    const toggleVideoFormat = (fmt: string) => {
        setVideoConfig((prev) => ({
            ...prev,
            formats: prev.formats.includes(fmt)
                ? prev.formats.filter((f) => f !== fmt)
                : [...prev.formats, fmt],
        }));
    };

    return (
        <>
            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <PenTool className="w-5 h-5 text-primary" />
                    <div>
                        <h2 className="text-base font-medium text-foreground">
                            编辑器图片上传配置
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            配置{scopeLabel}中图片上传的限制参数
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>最大宽度 (px)</Label>
                        <Input
                            type="number"
                            value={imageConfig.maxWidth}
                            onChange={(e) => setImageConfig({
                                ...imageConfig,
                                maxWidth: parseInt(e.target.value) || 0,
                            })}
                            className="bg-background border-input"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>最大高度 (px)</Label>
                        <Input
                            type="number"
                            value={imageConfig.maxHeight}
                            onChange={(e) => setImageConfig({
                                ...imageConfig,
                                maxHeight: parseInt(e.target.value) || 0,
                            })}
                            className="bg-background border-input"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>最大大小 (MB)</Label>
                    <Input
                        type="number"
                        value={imageConfig.maxSize}
                        onChange={(e) => setImageConfig({
                            ...imageConfig,
                            maxSize: parseInt(e.target.value) || 0,
                        })}
                        className="bg-background border-input w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                        超过此大小的图片将无法上传
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>支持的图片格式</Label>
                    <div className="flex flex-wrap gap-4">
                        {IMAGE_FORMAT_OPTIONS.map((opt) => (
                            <label
                                key={opt.value}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Checkbox
                                    checked={imageConfig.formats.includes(
                                        opt.value,
                                    )}
                                    onCheckedChange={() =>
                                        toggleImageFormat(opt.value)
                                    }
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
                            value={imageConfig.thumbnailWidth}
                            onChange={(e) => setImageConfig({
                                ...imageConfig,
                                thumbnailWidth:
                                    parseInt(e.target.value) || 0,
                            })}
                            className="bg-background border-input"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>缩略图高度 (px)</Label>
                        <Input
                            type="number"
                            value={imageConfig.thumbnailHeight}
                            onChange={(e) => setImageConfig({
                                ...imageConfig,
                                thumbnailHeight:
                                    parseInt(e.target.value) || 0,
                            })}
                            className="bg-background border-input"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button
                        onClick={handleSaveImage}
                        disabled={savingImage}
                    >
                        {savingImage ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        保存配置
                    </Button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-primary" />
                    <div>
                        <h2 className="text-base font-medium text-foreground">
                            编辑器视频上传配置
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            配置{scopeLabel}中视频上传的限制参数
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>最大大小 (MB)</Label>
                    <Input
                        type="number"
                        value={videoConfig.maxSize}
                        onChange={(e) => setVideoConfig({
                            ...videoConfig,
                            maxSize: parseInt(e.target.value) || 0,
                        })}
                        className="bg-background border-input w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                        超过此大小的视频将无法上传
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>支持的视频格式</Label>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost" size="sm"
                                className="text-xs h-7"
                                onClick={() => setVideoConfig((p) => ({
                                    ...p,
                                    formats: VIDEO_FORMAT_OPTIONS.map(
                                        (o) => o.value,
                                    ),
                                }))}
                            >
                                全选
                            </Button>
                            <Button
                                variant="ghost" size="sm"
                                className="text-xs h-7"
                                onClick={() => setVideoConfig((p) => ({
                                    ...p, formats: [],
                                }))}
                            >
                                清空
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {VIDEO_FORMAT_OPTIONS.map((opt) => (
                            <label
                                key={opt.value}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Checkbox
                                    checked={videoConfig.formats.includes(
                                        opt.value,
                                    )}
                                    onCheckedChange={() =>
                                        toggleVideoFormat(opt.value)
                                    }
                                />
                                <span className="text-sm">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button
                        onClick={handleSaveVideo}
                        disabled={savingVideo}
                    >
                        {savingVideo ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        保存配置
                    </Button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <div>
                        <h2 className="text-base font-medium text-foreground">
                            编辑器上传存储位置
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            配置编辑器中图片和视频的存储目录
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>编辑器图片存储位置</Label>
                    <Select
                        value={folderConfig.imageFolderId || 'none'}
                        onValueChange={(val) => setFolderConfig({
                            ...folderConfig,
                            imageFolderId: val === 'none' ? '' : val,
                        })}
                    >
                        <SelectTrigger className="bg-background border-input">
                            <SelectValue placeholder="选择图片存储文件夹" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">
                                未设置（使用默认位置）
                            </SelectItem>
                            {realFolders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                    {folder.displayName}
                                    （{folder.pathName}）
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>编辑器视频存储位置</Label>
                    <Select
                        value={folderConfig.videoFolderId || 'none'}
                        onValueChange={(val) => setFolderConfig({
                            ...folderConfig,
                            videoFolderId: val === 'none' ? '' : val,
                        })}
                    >
                        <SelectTrigger className="bg-background border-input">
                            <SelectValue placeholder="选择视频存储文件夹" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">
                                未设置（使用默认位置）
                            </SelectItem>
                            {realFolders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                    {folder.displayName}
                                    （{folder.pathName}）
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        说明：
                    </p>
                    <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                        <li>
                            存储位置从「文件存储设置 &gt;
                            真实文件夹管理」中创建的目录读取
                        </li>
                        <li>
                            选择文件夹后，编辑器中上传的文件将自动存储到对应目录
                        </li>
                        <li>
                            未设置时，文件将上传到系统默认存储位置
                        </li>
                    </ul>
                </div>

                <div className="flex justify-end">
                    <Button
                        onClick={handleSaveFolder}
                        disabled={savingFolder}
                    >
                        {savingFolder ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        保存配置
                    </Button>
                </div>
            </div>
        </>
    );
}
