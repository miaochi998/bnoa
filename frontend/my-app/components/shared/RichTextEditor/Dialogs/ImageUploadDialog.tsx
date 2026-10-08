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
import { Upload, Link, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface EditorImageConfig {
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    formats: string[];
    thumbnailWidth: number;
    thumbnailHeight: number;
}

interface ImageUploadDialogProps {
    editor: Editor;
    open: boolean;
    onClose: () => void;
    uploadScope?: 'editor' | 'notebook';
}

export function ImageUploadDialog({
    editor,
    open,
    onClose,
    uploadScope = 'editor',
}: ImageUploadDialogProps) {
    const [imageUrl, setImageUrl] = useState('');
    const [config, setConfig] = useState<EditorImageConfig | null>(null);
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
                const [imgConfig, folderConfig] = await Promise.all([
                    uploadScope === 'notebook'
                        ? apiClient.getNotebookImageSettings()
                        : apiClient.getEditorImageSettings(),
                    uploadScope === 'notebook'
                        ? apiClient.getNotebookFolderSettings()
                        : apiClient.getEditorFolderSettings(),
                ]);
                setConfig(imgConfig);
                setRealFolderId(folderConfig.imageFolderId || undefined);
            } catch (e) {
                console.warn('加载编辑器图片配置失败:', e);
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
                    true,
                    realFolderId,
                    'editor',
                );
                setUploadStatus('success');
                setProgress(100);

                const url = result?.url;
                if (url) {
                    editor.chain().focus('end').setImage({ src: url }).run();
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

    // URL 插入
    const handleUrlSubmit = () => {
        if (imageUrl) {
            editor.chain().focus('end').setImage({ src: imageUrl }).run();
            handleClose();
        }
    };

    // 关闭时清理
    const handleClose = useCallback(() => {
        setValidationError('');
        setErrorMsg('');
        setImageUrl('');
        setFileName('');
        setUploading(false);
        setUploadStatus('idle');
        setProgress(0);
        onClose();
    }, [onClose]);

    const formatHint = config
        ? config.formats.map((f) => f.toUpperCase()).join(', ')
        : 'JPG, PNG, GIF, WebP';
    const sizeHint = config ? `最大 ${config.maxSize}MB` : '';
    const acceptStr = config
        ? config.formats.map((f) => `.${f}`).join(',')
        : 'image/*';

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>插入图片</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="upload">
                    <TabsList className="w-full">
                        <TabsTrigger value="upload" className="flex-1">
                            <Upload className="h-4 w-4 mr-1" />
                            本地上传
                        </TabsTrigger>
                        <TabsTrigger value="url" className="flex-1">
                            <Link className="h-4 w-4 mr-1" />
                            URL 地址
                        </TabsTrigger>
                    </TabsList>
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
                                点击选择图片
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
                    <TabsContent value="url" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="img-url">图片 URL</Label>
                            <Input
                                id="img-url"
                                placeholder="https://..."
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                            />
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
                                onClick={handleUrlSubmit}
                                disabled={!imageUrl}
                            >
                                插入
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
