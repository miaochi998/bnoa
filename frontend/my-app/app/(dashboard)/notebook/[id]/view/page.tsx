'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { ArrowLeft, Edit } from 'lucide-react';
import { notebookAPI, Notebook } from '@/lib/api';
import { usePermissionStore } from '@/lib/stores/permission-store';
import { toast } from 'sonner';

export default function ViewNotebookPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const { hasPermission } = usePermissionStore();

    const [notebook, setNotebook] = useState<Notebook | null>(null);
    const [loading, setLoading] = useState(true);

    const canEdit = hasPermission('notebook:edit');

    useEffect(() => {
        loadNotebook();
    }, [id]);

    const loadNotebook = async () => {
        try {
            setLoading(true);
            const data = await notebookAPI.getNotebook(id);
            setNotebook(data);
        } catch (error: any) {
            toast.error(error.message || '加载失败');
            router.push('/notebook');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('zh-CN');
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="text-center py-12 text-muted-foreground">
                    加载中...
                </div>
            </div>
        );
    }

    if (!notebook) {
        return null;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回
                    </Button>
                    <h1 className="text-2xl font-bold">{notebook.title}</h1>
                    <span className="text-sm px-2 py-1 bg-muted rounded">
                        只读模式
                    </span>
                </div>
                {canEdit && (
                    <Button
                        onClick={() => router.push(`/notebook/${id}`)}
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        编辑
                    </Button>
                )}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
                <div>创建时间：{formatDate(notebook.createdAt)}</div>
                <div>更新时间：{formatDate(notebook.updatedAt)}</div>
                {notebook.user && (
                    <div>
                        创建者：{notebook.user.name} (@{notebook.user.username})
                    </div>
                )}
            </div>

            <div>
                <RichTextEditor
                    mode="readonly"
                    initialContent={notebook.content}
                />
            </div>
        </div>
    );
}
