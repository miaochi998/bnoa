'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { ArrowLeft, Save } from 'lucide-react';
import { notebookAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function NewNotebookPage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState<any>(null);
    const [saving, setSaving] = useState(false);

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
            await notebookAPI.createNotebook({ title, content });
            toast.success('创建成功');
            router.push('/notebook');
        } catch (error: any) {
            toast.error(error.message || '创建失败');
        } finally {
            setSaving(false);
        }
    };

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
                    <h1 className="text-2xl font-bold">新建记事本</h1>
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
