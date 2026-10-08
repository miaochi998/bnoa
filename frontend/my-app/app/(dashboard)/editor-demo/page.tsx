'use client';

import { useState } from 'react';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import type { EditorMode } from '@/components/shared/RichTextEditor';

export default function EditorDemoPage() {
    const [mode, setMode] =
        useState<EditorMode>('full');
    const [lastSaved, setLastSaved] =
        useState<string>('');

    const handleSave = async (
        content: any,
        htmlContent: string
    ) => {
        setLastSaved(
            new Date().toLocaleString('zh-CN')
        );
    };

    return (
        <div className={
            'p-6 max-w-4xl mx-auto space-y-4'
        }>
            <h1 className="text-2xl font-bold">
                富文本编辑器示例
            </h1>

            {/* 模式切换 */}
            <div className="flex gap-2">
                <Button
                    variant={
                        mode === 'full'
                            ? 'default'
                            : 'outline'
                    }
                    onClick={() => setMode('full')}
                >
                    完整版
                </Button>
                <Button
                    variant={
                        mode === 'simple'
                            ? 'default'
                            : 'outline'
                    }
                    onClick={() =>
                        setMode('simple')
                    }
                >
                    简化版
                </Button>
                <Button
                    variant={
                        mode === 'readonly'
                            ? 'default'
                            : 'outline'
                    }
                    onClick={() =>
                        setMode('readonly')
                    }
                >
                    只读
                </Button>
            </div>

            {/* 编辑器 */}
            <RichTextEditor
                key={mode}
                contentKey="editor_demo"
                mode={mode}
                enableDraft={true}
                enableVersions={mode === 'full'}
                onSave={handleSave}
            />

            {lastSaved && (
                <p className={
                    'text-sm text-muted-foreground'
                }>
                    上次保存: {lastSaved}
                </p>
            )}
        </div>
    );
}
