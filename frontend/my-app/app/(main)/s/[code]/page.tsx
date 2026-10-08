'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
    getShareInfo,
    accessShare,
    getShareFileUrl,
    ShareInfoPublic,
    AccessShareResult,
} from '@/lib/api';
import {
    FileText,
    Image as ImageIcon,
    Film,
    Music,
    Archive,
    File,
    Lock,
    Download,
    Eye,
    AlertCircle,
    Loader2,
} from 'lucide-react';

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
        parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
        ' ' +
        sizes[i]
    );
}

function getFileIcon(mimeType: string) {
    if (mimeType.startsWith('image/'))
        return <ImageIcon className="w-8 h-8 text-primary" />;
    if (mimeType.startsWith('video/'))
        return <Film className="w-8 h-8 text-primary" />;
    if (mimeType.startsWith('audio/'))
        return <Music className="w-8 h-8 text-primary" />;
    if (
        mimeType.includes('zip') ||
        mimeType.includes('rar') ||
        mimeType.includes('tar')
    )
        return <Archive className="w-8 h-8 text-primary" />;
    if (
        mimeType.includes('pdf') ||
        mimeType.includes('document') ||
        mimeType.includes('text')
    )
        return <FileText className="w-8 h-8 text-primary" />;
    return <File className="w-8 h-8 text-primary" />;
}

function isPreviewable(mimeType: string): boolean {
    return mimeType.startsWith('image/');
}

export default function SharePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const code = params.code as string;
    const urlPwd = searchParams.get('pwd');

    const [info, setInfo] = useState<ShareInfoPublic | null>(null);
    const [fileData, setFileData] = useState<AccessShareResult | null>(
        null,
    );
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [accessing, setAccessing] = useState(false);
    const [error, setError] = useState('');
    const [pwdError, setPwdError] = useState('');

    useEffect(() => {
        if (!code) return;
        setLoading(true);
        getShareInfo(code)
            .then((data) => {
                setInfo(data);
                if (urlPwd && data.hasPassword && !data.expired) {
                    handleAccess(urlPwd);
                } else if (
                    !data.hasPassword &&
                    !data.expired
                ) {
                    handleAccess();
                }
            })
            .catch((err) => {
                setError(err.message || '分享不存在');
            })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    const handleAccess = useCallback(
        async (pwd?: string) => {
            try {
                setAccessing(true);
                setPwdError('');
                const result = await accessShare(
                    code,
                    pwd || undefined,
                );
                setFileData(result);
            } catch (err: any) {
                setPwdError(err.message || '访问失败');
            } finally {
                setAccessing(false);
            }
        },
        [code],
    );

    const handleSubmitPassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;
        handleAccess(password);
    };

    const fileProxyUrl = getShareFileUrl(code);

    const handleDownload = () => {
        if (!fileData) return;
        const a = document.createElement('a');
        a.href = `${fileProxyUrl}?download=1`;
        a.download = fileData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h1 className="text-lg font-medium text-foreground mb-2">
                        分享不可用
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    if (!info) return null;

    if (info.expired) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h1 className="text-lg font-medium text-foreground mb-2">
                        分享已过期
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        该分享链接已过期，无法访问
                    </p>
                </div>
            </div>
        );
    }

    // 需要密码且尚未验证通过
    if (info.hasPassword && !fileData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full">
                    <div className="text-center mb-6">
                        {getFileIcon(info.mimeType)}
                        <h1 className="text-lg font-medium text-foreground mt-3">
                            {info.fileName}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {formatFileSize(info.fileSize)}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                            该文件需要密码才能访问
                        </span>
                    </div>

                    <form
                        onSubmit={handleSubmitPassword}
                        className="space-y-3"
                    >
                        <input
                            type="text"
                            placeholder="请输入访问密码"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                        />
                        {pwdError && (
                            <p className="text-sm text-destructive">
                                {pwdError}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={
                                accessing || !password.trim()
                            }
                            className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {accessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    验证中...
                                </>
                            ) : (
                                '验证密码'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 文件访问成功（或无密码直接通过）
    if (fileData) {
        const canPreview = isPreviewable(fileData.mimeType);
        const canDownload = fileData.access === 'DOWNLOAD';

        return (
            <div className="min-h-screen bg-background flex flex-col items-center p-4">
                <div className="bg-card border border-border rounded-lg max-w-2xl w-full mt-8">
                    {/* 头部信息 */}
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            {getFileIcon(fileData.mimeType)}
                            <div className="min-w-0 flex-1">
                                <h1 className="text-base font-medium text-foreground truncate">
                                    {fileData.fileName}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {formatFileSize(fileData.size)}
                                </p>
                            </div>
                            {canDownload && (
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
                                >
                                    <Download className="w-4 h-4" />
                                    下载
                                </button>
                            )}
                        </div>
                        {!canDownload && (
                            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                                <Eye className="w-4 h-4" />
                                仅查看，不可下载
                            </div>
                        )}
                    </div>

                    {/* 预览区域 */}
                    <div className="p-6">
                        {canPreview ? (
                            <div className="flex justify-center">
                                <img
                                    src={fileProxyUrl}
                                    alt={fileData.fileName}
                                    className="max-w-full max-h-[600px] rounded-md object-contain"
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                {getFileIcon(fileData.mimeType)}
                                <p className="text-sm text-muted-foreground mt-4">
                                    该文件类型不支持在线预览
                                </p>
                                {canDownload && (
                                    <button
                                        onClick={handleDownload}
                                        className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        下载文件
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 加载中（无密码场景的自动 access 中间态）
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}
