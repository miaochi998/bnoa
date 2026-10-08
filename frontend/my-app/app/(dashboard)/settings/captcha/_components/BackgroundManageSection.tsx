'use client'

import { getApiBaseUrl } from '@/lib/config';

import {
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Loader2,
    Trash2,
    ImageIcon,
    RefreshCw,
    Upload,
    FolderSync,
    Folder,
    ImagePlus,
    Package,
    HardDrive,
} from 'lucide-react';
import type { CaptchaFullConfig } from '../page';

const API_BASE =
    getApiBaseUrl();

interface Background {
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    isEnabled: boolean;
    sortOrder: number;
    createdAt: string;
}

interface Stats {
    total: number;
    enabled: number;
    disabled: number;
    totalSize: number;
}

interface RealFolder {
    id: string;
    pathName: string;
    displayName: string;
    description?: string;
}

interface Props {
    config: CaptchaFullConfig;
    onUpdate: (
        updates: Partial<CaptchaFullConfig>,
    ) => void;
}

function getToken() {
    return localStorage.getItem('accessToken');
}

async function apiFetch(
    path: string,
    opts?: RequestInit,
) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
            ...(opts?.headers || {}),
        },
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json.message || '请求失败');
    }
    return json.data?.data || json.data;
}


export default function BackgroundManageSection({
    config,
    onUpdate,
}: Props) {
    const [backgrounds, setBackgrounds] = useState<
        Background[]
    >([]);
    const [stats, setStats] = useState<Stats | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<
        Set<string>
    >(new Set());
    const [folders, setFolders] = useState<
        RealFolder[]
    >([]);
    const [uploading, setUploading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const fileInputRef =
        useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [bgData, statsData] =
                await Promise.all([
                    apiFetch(
                        '/captcha-settings/backgrounds',
                    ),
                    apiFetch(
                        '/captcha-settings/backgrounds/stats',
                    ),
                ]);
            setBackgrounds(bgData?.list || []);
            setStats(statsData);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    const loadFolders = useCallback(async () => {
        try {
            const data = await apiFetch(
                '/folders/real',
            );
            if (Array.isArray(data)) {
                setFolders(data);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        load();
        loadFolders();
    }, [load, loadFolders]);

    const handleFolderChange = useCallback(
        (folderId: string) => {
            onUpdate({
                backgroundFolderId: folderId,
            });
        },
        [onUpdate],
    );

    const handleUpload = useCallback(
        async (
            e: React.ChangeEvent<HTMLInputElement>,
        ) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            setUploading(true);
            try {
                const formData = new FormData();
                for (const f of Array.from(files)) {
                    formData.append('files', f);
                }
                const token = getToken();
                const res = await fetch(
                    `${API_BASE}/captcha-settings/backgrounds/upload?storageMode=${config.storageMode || 'rustfs'}`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        body: formData,
                    },
                );
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(
                        json.message || '上传失败',
                    );
                }
                await load();
            } catch (err: any) {
                alert(err.message || '上传失败');
            } finally {
                setUploading(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        },
        [load, config.storageMode],
    );

    const handleSyncFolder =
        useCallback(async () => {
            if (!config.backgroundFolderId) return;
            setSyncing(true);
            try {
                await apiFetch(
                    '/captcha-settings/backgrounds/sync-folder',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            folderId:
                                config.backgroundFolderId,
                        }),
                    },
                );
                await load();
            } catch (err: any) {
                alert(err.message || '同步失败');
            } finally {
                setSyncing(false);
            }
        }, [config.backgroundFolderId, load]);

    const handleToggle = async (
        id: string,
        enabled: boolean,
    ) => {
        try {
            await apiFetch(
                `/captcha-settings/backgrounds/${id}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        isEnabled: enabled,
                    }),
                },
            );
            await load();
        } catch (err: any) {
            alert(err.message || '操作失败');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确认删除此背景图？')) return;
        try {
            await apiFetch(
                `/captcha-settings/backgrounds/${id}`,
                { method: 'DELETE' },
            );
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            await load();
        } catch (err: any) {
            alert(err.message || '删除失败');
        }
    };

    const handleBatchDelete = async () => {
        if (selected.size === 0) return;
        if (
            !confirm(
                `确认删除选中的 ${selected.size} 张？`,
            )
        )
            return;
        try {
            await apiFetch(
                '/captcha-settings/backgrounds/batch',
                {
                    method: 'DELETE',
                    body: JSON.stringify({
                        ids: Array.from(selected),
                    }),
                },
            );
            setSelected(new Set());
            await load();
        } catch (err: any) {
            alert(err.message || '批量删除失败');
        }
    };

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id)
                ? next.delete(id)
                : next.add(id);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 背景图要求 */}
            <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground">
                        背景图要求
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                        <span className="text-muted-foreground">尺寸</span>
                        <p className="text-foreground font-medium">320 × 160 px</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">格式</span>
                        <p className="text-foreground font-medium">JPG / PNG / WebP</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">大小</span>
                        <p className="text-foreground font-medium">≤ 200 KB</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">比例</span>
                        <p className="text-foreground font-medium">2:1（宽:高）</p>
                    </div>
                </div>
            </div>

            {/* 存储方式 + 存储位置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 存储方式 */}
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                            存储方式
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <label
                            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                                config.storageMode === 'rustfs'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground'
                            }`}
                            onClick={() => onUpdate({ storageMode: 'rustfs' })}
                        >
                            <input
                                type="radio"
                                name="storageMode"
                                checked={config.storageMode === 'rustfs'}
                                onChange={() => onUpdate({ storageMode: 'rustfs' })}
                                className="accent-[#409fff]"
                            />
                            <Package className="h-4 w-4 text-primary" />
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    RUSTFS对象存储
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    推荐使用，支持超大文件和断点续传
                                </p>
                            </div>
                        </label>
                        <label
                            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                                config.storageMode === 'local'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground'
                            }`}
                            onClick={() => onUpdate({ storageMode: 'local' })}
                        >
                            <input
                                type="radio"
                                name="storageMode"
                                checked={config.storageMode === 'local'}
                                onChange={() => onUpdate({ storageMode: 'local' })}
                                className="accent-[#409fff]"
                            />
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    本地服务器
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    适合小文件和临时存储
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 存储位置 */}
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                            存储位置
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            背景图存储文件夹
                        </span>
                        <Select
                            value={config.backgroundFolderId || '__none__'}
                            onValueChange={(v) =>
                                handleFolderChange(v === '__none__' ? '' : v)
                            }
                        >
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder="选择真实文件夹" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">
                                    不指定文件夹
                                </SelectItem>
                                {folders.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>
                                        {f.displayName}({f.pathName})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        上传的背景图将存储到指定文件夹，修改后需保存设置
                    </p>
                </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                        <Upload className="h-4 w-4 mr-1" />
                    )}
                    上传图片
                </Button>
                {config.backgroundFolderId && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncFolder}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <FolderSync className="h-4 w-4 mr-1" />
                        )}
                        同步文件夹
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={load}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    刷新
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                />
            </div>

            {/* 统计 + 批量操作 */}
            <div className="flex items-center justify-between">
                <div className="flex gap-3">
                    {stats && (
                        <>
                            <Badge variant="secondary">
                                已上传 {stats.total} 张
                            </Badge>
                            <Badge variant="secondary">
                                已启用 {stats.enabled} 张
                            </Badge>
                            <Badge variant="secondary">
                                总大小 {(stats.totalSize / 1024).toFixed(1)} KB
                            </Badge>
                        </>
                    )}
                </div>
                {selected.size > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBatchDelete}
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        删除选中 ({selected.size})
                    </Button>
                )}
            </div>

            {/* 图片列表 */}
            {backgrounds.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mb-2" />
                    <p className="text-sm">暂无背景图，请上传或同步文件夹图片</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {backgrounds.map((bg) => (
                        <div
                            key={bg.id}
                            onClick={() => toggleSelect(bg.id)}
                            className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                                selected.has(bg.id)
                                    ? 'border-primary ring-1 ring-primary'
                                    : 'border-border hover:border-muted-foreground'
                            }`}
                        >
                            <div className="aspect-[2/1] bg-muted flex items-center justify-center">
                                {bg.filePath ? (
                                    <img
                                        src={`${API_BASE}/captcha-settings/backgrounds/${bg.id}/image`}
                                        alt={bg.fileName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                )}
                            </div>
                            <div className="p-2 space-y-1">
                                <p className="text-xs text-foreground truncate">
                                    {bg.fileName}
                                </p>
                                <div className="flex items-center justify-between">
                                    <Switch
                                        checked={bg.isEnabled}
                                        onCheckedChange={(v) =>
                                            handleToggle(bg.id, v)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(bg.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
