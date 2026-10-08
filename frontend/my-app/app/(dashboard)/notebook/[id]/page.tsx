'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { ArrowLeft, Save } from 'lucide-react';
import { notebookAPI, Notebook } from '@/lib/api';
import { toast } from 'sonner';

export default function EditNotebookPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [notebook, setNotebook] = useState<Notebook | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadNotebook();
    }, [id]);

    const loadNotebook = async () => {
        try {
            setLoading(true);
            const data = await notebookAPI.getNotebook(id);
            setNotebook(data);
            setTitle(data.title);
            setContent(data.content);
        } catch (error: any) {
            toast.error(error.message || '加载失败');
            router.push('/notebook');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('请输入标题');
            return;
        }

        const hasText = content?.content?.some(
            (node: any) =>
                node.content?.some(
                    (child: any) => child.text?.trim(),
                ),
        );
        if (!hasText) {
            toast.error('请输入内容');
            return;
        }

        try {
            setSaving(true);
            await notebookAPI.updateNotebook(id, { title, content });
            toast.success('保存成功');
            router.push('/notebook');
        } catch (error: any) {
            toast.error(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
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
                    <h1 className="text-2xl font-bold">编辑记事本</h1>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? '保存中...' : '保存'}
                </Button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium mb-2 block">
                        标题
                    </label>
                    <Input
                        placeholder="请输入标题"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                    />
                </div>

                <div>
                    <label className="text-sm font-medium mb-2 block">
                        内容
                    </label>
                    <RichTextEditor
                        mode="simple"
                        contentKey={`notebook_${id}`}
                        initialContent={content}
                        enableDraft={true}
                        enableVersions={false}
                        placeholder="在这里记录重要资料..."
                        onChange={setContent}
                        uploadScope="notebook"
                    />
                </div>
            </div>
        </div>
    );
}
