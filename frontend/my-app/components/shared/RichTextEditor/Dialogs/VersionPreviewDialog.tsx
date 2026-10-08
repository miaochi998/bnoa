'use client';

// Dialogs/VersionPreviewDialog.tsx
import { ContentVersion } from '../types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VersionPreviewDialogProps {
    version: ContentVersion | null;
    open: boolean;
    onClose: () => void;
    onRestore: (version: ContentVersion) => void;
}

export function VersionPreviewDialog({
    version,
    open,
    onClose,
    onRestore,
}: VersionPreviewDialogProps) {
    if (!version) return null;

    const typeLabel: Record<string, string> = {
        manual: '手动保存',
        auto: '自动保存',
        restore: '版本恢复',
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        版本预览 - v{version.versionNumber}
                        {version.versionName
                            && ` (${version.versionName})`
                        }
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <div className={
                        'flex gap-4 text-sm'
                        + ' text-muted-foreground'
                    }>
                        <span>
                            类型: {
                                typeLabel[
                                    version.versionType
                                ] || version.versionType
                            }
                        </span>
                        <span>
                            字符数: {
                                version.characterCount
                                ?? '-'
                            }
                        </span>
                        <span>
                            创建时间: {
                                new Date(
                                    version.createdAt
                                ).toLocaleString('zh-CN')
                            }
                        </span>
                    </div>
                    <ScrollArea className="h-[400px]">
                        <div
                            className={
                                'prose prose-sm'
                                + ' max-w-none p-4'
                                + ' border rounded-lg'
                            }
                            dangerouslySetInnerHTML={{
                                __html:
                                    version.htmlContent
                                    || '<p>无 HTML 预览</p>',
                            }}
                        />
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                    >
                        关闭
                    </Button>
                    <Button
                        type="button"
                        onClick={() =>
                            onRestore(version)
                        }
                    >
                        恢复此版本
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
