'use client';

import { BookOpen } from 'lucide-react';
import { EditorConfigSection } from '../notifications/config/EditorConfigSection';

export default function NotebookSettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">记事本设置</h1>
                    <p className="text-sm text-muted-foreground">
                        配置记事本编辑器的图片和视频上传参数及存储位置
                    </p>
                </div>
            </div>

            <EditorConfigSection scope="notebook" />
        </div>
    );
}
