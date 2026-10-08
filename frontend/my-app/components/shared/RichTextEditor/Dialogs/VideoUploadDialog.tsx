'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { Upload, Globe, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface EditorVideoConfig {
    maxSize: number;
    formats: string[];
}

interface VideoUploadDialogProps {
    editor: Editor;
    open: boolean;
    onClose: () => void;
    uploadScope?: 'editor' | 'notebook';
}

/**
 * 将视频平台 URL 转换为嵌入 URL
 */
function convertToEmbedUrl(
    url: string,
): { src: string; platform: string } {
    const ytMatch = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
    );
    if (ytMatch) {
        return {
            src: `https://www.youtube.com/embed/${ytMatch[1]}`,
            platform: 'youtube',
        };
    }
    const biliMatch = url.match(
        /bilibili\.com\/video\/(BV[\w]+)/,
    );
    if (biliMatch) {
        return {
            src: `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}`,
            platform: 'bilibili',
        };
    }
    const iframeMatch = url.match(/src=["']([^"']+)["']/);
    if (iframeMatch) {
        return { src: iframeMatch[1], platform: 'iframe' };
    }
    return { src: url, platform: 'iframe' };
}

export function VideoUploadDialog({
    editor,
    open,
    onClose,
    uploadScope = 'editor',
}: VideoUploadDialogProps) {
    const [videoUrl, setVideoUrl] = useState('');
    const [config, setConfig] = useState<EditorVideoConfig | null>(null);
    const [realFolderId, setRealFolderId] = useState<string | undefined>();
    const [validationError, setValidationError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<
        'idle' | 'uploading' | 'success' | 'error'
    >('idle');
    const [fileName, setFileName] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 加载编辑器配置
    useEffect(() => {
        if (!open) return;
        const loadConfig = async () => {
            try {
                const [vidConfig, folderConfig] = await Promise.all([
                    uploadScope === 'notebook'
                        ? apiClient.getNotebookVideoSettings()
                        : apiClient.getEditorVideoSettings(),
                    uploadScope === 'notebook'
                        ? apiClient.getNotebookFolderSettings()
                        : apiClient.getEditorFolderSettings(),
                ]);
                setConfig(vidConfig);
                setRealFolderId(folderConfig.videoFolderId || undefined);
            } catch (e) {
                console.warn('加载编辑器视频配置失败:', e);
            }
        };
        loadConfig();
    }, [open, uploadScope]);

    // 校验文件
    const validateFile = useCallback(
        (file: File): string | null => {
            if (!config) return null;
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (
                ext &&
                config.formats.length > 0 &&
                !config.formats.includes(ext)
            ) {
                return `不支持的格式 .${ext}，允许：${config.formats.join(', ')}`;
            }
            const maxBytes = config.maxSize * 1024 * 1024;
            if (file.size > maxBytes) {
                const sizeMB = (file.size / 1024 / 1024).toFixed(1);
                return `文件大小 ${sizeMB}MB 超过限制 ${config.maxSize}MB`;
            }
            return null;
        },
        [config],
    );

    // 处理文件选择并自动上传
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = '';

            setValidationError('');
            setErrorMsg('');
            setFileName(file.name);

            const error = validateFile(file);
            if (error) {
                setValidationError(error);
                return;
            }

            setUploading(true);
            setUploadStatus('uploading');
            setProgress(0);

            try {
                const result = await apiClient.uploadFile(
                    file,
                    undefined,
                    'rustfs',
                    (p) => setProgress(p),
                    false,
                    false,
                    realFolderId,
                    'editor',
                );
                setUploadStatus('success');
                setProgress(100);

                const url = result?.url;
                if (url) {
                    editor.chain().focus('end').setVideo({ src: url }).run();
                }
                setTimeout(() => handleClose(), 500);
            } catch (err) {
                setUploadStatus('error');
                setErrorMsg((err as Error).message || '上传失败');
            } finally {
                setUploading(false);
            }
        },
        [validateFile, realFolderId, editor],
    );

    // 嵌入远程视频
    const handleEmbedSubmit = () => {
        if (!videoUrl) return;
        const { src, platform } = convertToEmbedUrl(videoUrl);
        editor.commands.setVideoEmbed({
            src,
            platform,
            width: 640,
            height: 360,
        });
        setVideoUrl('');
        handleClose();
    };

    // 关闭时清理
    const handleClose = useCallback(() => {
        setValidationError('');
        setErrorMsg('');
        setVideoUrl('');
        setFileName('');
        setUploading(false);
        setUploadStatus('idle');
        setProgress(0);
        onClose();
    }, [onClose]);

    const formatHint = config
        ? config.formats.map((f) => f.toUpperCase()).join(', ')
        : 'MP4, WebM, OGG';
    const sizeHint = config ? `最大 ${config.maxSize}MB` : '';
    const acceptStr = config
        ? config.formats.map((f) => `.${f}`).join(',')
        : 'video/*';

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>插入视频</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="embed">
                    <TabsList className="w-full">
                        <TabsTrigger value="embed" className="flex-1">
                            <Globe className="h-4 w-4 mr-1" />
                            远程嵌入
                        </TabsTrigger>
                        <TabsTrigger value="upload" className="flex-1">
                            <Upload className="h-4 w-4 mr-1" />
                            本地上传
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="embed" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="video-url">
                                视频 URL 或 iframe 代码
                            </Label>
                            <Input
                                id="video-url"
                                placeholder="YouTube / Bilibili URL 或 iframe 代码"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                支持 YouTube、Bilibili 及任意 iframe 嵌入
                            </p>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                            >
                                取消
                            </Button>
                            <Button
                                type="button"
                                onClick={handleEmbedSubmit}
                                disabled={!videoUrl}
                            >
                                嵌入
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                    <TabsContent value="upload" className="space-y-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={acceptStr}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <div
                            className={
                                'border-2 border-dashed rounded-lg p-8'
                                + ' text-center cursor-pointer'
                                + ' hover:border-primary transition-colors'
                            }
                            onClick={() => {
                                if (!uploading) fileInputRef.current?.click();
                            }}
                        >
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                点击选择视频
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                支持 {formatHint}
                                {sizeHint ? `，${sizeHint}` : ''}
                            </p>
                        </div>

                        {validationError && (
                            <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                                {validationError}
                            </div>
                        )}

                        {uploadStatus !== 'idle' && (
                            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                                {uploadStatus === 'uploading' && (
                                    <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                                )}
                                {uploadStatus === 'success' && (
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                )}
                                {uploadStatus === 'error' && (
                                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                )}
                                <span className="truncate flex-1">
                                    {fileName}
                                </span>
                                <span className="text-muted-foreground text-xs flex-shrink-0">
                                    {uploadStatus === 'uploading'
                                        ? `${progress}%`
                                        : uploadStatus === 'success'
                                          ? '已完成'
                                          : '失败'}
                                </span>
                            </div>
                        )}

                        {errorMsg && (
                            <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                                {errorMsg}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
