'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';
import { notebookAPI, Notebook } from '@/lib/api';
import { usePermissionStore } from '@/lib/stores/permission-store';
import { toast } from 'sonner';

export default function NotebookListPage() {
    const router = useRouter();
    const { hasPermission } = usePermissionStore();
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 10;

    const canCreate = hasPermission('notebook:create');
    const canEdit = hasPermission('notebook:edit');
    const canDelete = hasPermission('notebook:delete');

    useEffect(() => {
        loadNotebooks();
    }, [page, keyword]);

    const loadNotebooks = async () => {
        try {
            setLoading(true);
            const res = await notebookAPI.getNotebooks({
                page,
                pageSize,
                keyword: keyword || undefined,
            });
            setNotebooks(res.list);
            setTotal(res.pagination.total);
        } catch (error: any) {
            toast.error(error.message || '加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        loadNotebooks();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这条记事本吗？')) return;

        try {
            await notebookAPI.deleteNotebook(id);
            toast.success('删除成功');
            loadNotebooks();
        } catch (error: any) {
            toast.error(error.message || '删除失败');
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('zh-CN');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">记事本</h1>
                {canCreate && (
                    <Button onClick={() => router.push('/notebook/new')}>
                        <Plus className="w-4 h-4 mr-2" />
                        新建记事本
                    </Button>
                )}
            </div>

            <div className="flex gap-2">
                <Input
                    placeholder="搜索标题..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="max-w-xs"
                />
                <Button onClick={handleSearch} variant="outline">
                    <Search className="w-4 h-4 mr-2" />
                    搜索
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                    加载中...
                </div>
            ) : notebooks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    暂无记事本
                </div>
            ) : (
                <div className="border rounded-lg">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr className="border-b">
                                <th className="px-4 py-3 text-left text-sm font-medium">
                                    标题
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium">
                                    创建时间
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium">
                                    更新时间
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-medium">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {notebooks.map((notebook) => (
                                <tr
                                    key={notebook.id}
                                    className="border-b hover:bg-muted/20"
                                >
                                    <td className="px-4 py-3">
                                        {notebook.title}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {formatDate(notebook.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {formatDate(notebook.updatedAt)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    router.push(
                                                        `/notebook/${notebook.id}/view`,
                                                    )
                                                }
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            {canEdit && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        router.push(
                                                            `/notebook/${notebook.id}`,
                                                        )
                                                    }
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        handleDelete(notebook.id)
                                                    }
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {total > pageSize && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        共 {total} 条记录
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page * pageSize >= total}
                            onClick={() => setPage(page + 1)}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
