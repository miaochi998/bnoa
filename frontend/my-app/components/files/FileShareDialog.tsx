'use client';

import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';
import { FileItem, ShareLink } from '@/types/file';
import {
    Copy,
    Check,
    Link,
    Lock,
    Eye,
    Download,
    Loader2,
    LinkIcon,
} from 'lucide-react';

interface FileShareDialogProps {
    file: FileItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FileShareDialog(
    { file, open, onOpenChange }: FileShareDialogProps,
) {
    const [access, setAccess] = useState<'VIEW' | 'DOWNLOAD'>('DOWNLOAD');
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    const [expireDays, setExpireDays] = useState<string>('7');
    const [shareLink, setShareLink] = useState<ShareLink | null>(null);
    const [autoPassword, setAutoPassword] = useState(false);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getShareUrl = (code: string, pwd?: string) => {
        const base = `${window.location.origin}/s/${code}`;
        if (pwd && autoPassword) {
            return `${base}?pwd=${encodeURIComponent(pwd)}`;
        }
        return base;
    };

    const handleCreateShare = async () => {
        if (!file) return;

        try {
            setLoading(true);
            setError('');
            const result = await apiClient.createShare({
                fileId: file.id,
                access,
                password: usePassword ? password : undefined,
                expireDays: expireDays === '0'
                    ? undefined
                    : parseInt(expireDays),
            });
            setShareLink(result);
        } catch (err: any) {
            setError(err.message || '创建分享链接失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareLink?.code) return;

        try {
            const url = getShareUrl(
                shareLink.code,
                shareLink.password,
            );
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // ignore
        }
    };

    const handleClose = () => {
        setShareLink(null);
        setAccess('VIEW');
        setUsePassword(false);
        setPassword('');
        setExpireDays('7');
        setAutoPassword(false);
        setError('');
        onOpenChange(false);
    };

    if (!file) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="text-foreground flex items-center gap-2">
                        <Link className="w-5 h-5 text-primary" />
                        分享文件
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium text-foreground truncate">
                            {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {file.extension.toUpperCase()} ·
                            {formatFileSize(file.size)}
                        </p>
                    </div>

                    {!shareLink ? (
                        <>
                            <div className="space-y-2">
                                <Label className="text-foreground">
                                    访问权限
                                </Label>
                                <Select
                                    value={access}
                                    onValueChange={(v) =>
                                        setAccess(
                                            v as 'VIEW' | 'DOWNLOAD',
                                        )
                                    }
                                >
                                    <SelectTrigger className="bg-background border-input">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VIEW">
                                            <div className="flex items-center gap-2">
                                                <Eye className="w-4 h-4" />
                                                仅查看
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="DOWNLOAD">
                                            <div className="flex items-center gap-2">
                                                <Download className="w-4 h-4" />
                                                允许下载
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-foreground flex items-center gap-2">
                                        <Lock className="w-4 h-4" />
                                        密码保护
                                    </Label>
                                    <Switch
                                        checked={usePassword}
                                        onCheckedChange={setUsePassword}
                                    />
                                </div>
                                {usePassword && (
                                    <Input
                                        type="text"
                                        placeholder="设置访问密码"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        className="bg-background border-input"
                                    />
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">
                                    有效期
                                </Label>
                                <Select
                                    value={expireDays}
                                    onValueChange={setExpireDays}
                                >
                                    <SelectTrigger className="bg-background border-input">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">
                                            1 天
                                        </SelectItem>
                                        <SelectItem value="7">
                                            7 天
                                        </SelectItem>
                                        <SelectItem value="30">
                                            30 天
                                        </SelectItem>
                                        <SelectItem value="0">
                                            永久有效
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {error && (
                                <p className="text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <Label className="text-foreground">
                                    分享链接
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={getShareUrl(
                                            shareLink.code,
                                            shareLink.password,
                                        )}
                                        readOnly
                                        className="bg-background border-input"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={handleCopyLink}
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {shareLink.password && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-foreground">
                                            访问密码
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={
                                                    shareLink.password
                                                }
                                                readOnly
                                                className="bg-background border-input"
                                            />
                                            <Button
                                                variant="outline"
                                                onClick={async () => {
                                                    await navigator.clipboard.writeText(
                                                        shareLink.password!,
                                                    );
                                                }}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Label className="text-foreground flex items-center gap-2">
                                            <LinkIcon className="w-4 h-4" />
                                            链接免密码
                                        </Label>
                                        <Switch
                                            checked={autoPassword}
                                            onCheckedChange={
                                                setAutoPassword
                                            }
                                        />
                                    </div>
                                    {autoPassword && (
                                        <p className="text-xs text-muted-foreground">
                                            开启后密码将附在链接中，打开链接无需输入密码
                                        </p>
                                    )}
                                </>
                            )}

                            <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                                <p className="text-sm text-muted-foreground">
                                    访问权限：
                                    {shareLink.access === 'VIEW'
                                        ? '仅查看'
                                        : '允许下载'}
                                </p>
                                {shareLink.expireAt && (
                                    <p className="text-sm text-muted-foreground">
                                        有效期至：
                                        {new Date(
                                            shareLink.expireAt,
                                        ).toLocaleString('zh-CN')}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        {shareLink ? '完成' : '取消'}
                    </Button>
                    {!shareLink && (
                        <Button
                            onClick={handleCreateShare}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    创建中...
                                </>
                            ) : (
                                '创建分享链接'
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
