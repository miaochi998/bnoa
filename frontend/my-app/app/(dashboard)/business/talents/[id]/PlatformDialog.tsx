'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface PlatformDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    talentId: string;
    platform: any | null;
    onSuccess: () => void;
}

export function PlatformDialog({
    open,
    onOpenChange,
    talentId,
    platform,
    onSuccess,
}: PlatformDialogProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        platform: platform?.platform || '',
        nickname: platform?.nickname || '',
        accountId: platform?.accountId || '',
        homeUrl: platform?.homeUrl || '',
        categories:
            platform?.categories?.join(', ') || '',
        contentForms:
            platform?.contentForms?.join(', ') || '',
    });

    const handleChange = (
        key: string,
        value: string,
    ) => {
        setForm((f) => ({ ...f, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!form.platform.trim()) {
            alert('请输入平台名称');
            return;
        }
        setLoading(true);
        try {
            const data: any = {
                platform: form.platform.trim(),
            };
            if (form.nickname.trim()) {
                data.nickname = form.nickname.trim();
            }
            if (form.accountId.trim()) {
                data.accountId = form.accountId.trim();
            }
            if (form.homeUrl.trim()) {
                data.homeUrl = form.homeUrl.trim();
            }
            if (form.categories.trim()) {
                data.categories = form.categories
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean);
            }
            if (form.contentForms.trim()) {
                data.contentForms = form.contentForms
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean);
            }

            if (platform) {
                await apiClient.updateTalentPlatform(
                    platform.id,
                    data,
                );
            } else {
                await apiClient.createTalentPlatform(
                    talentId,
                    data,
                );
            }
            onSuccess();
        } catch (error: any) {
            alert('操作失败: ' + (error.message || ''));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#2e2e2e] border-[#1e1e1e] text-white max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {platform
                            ? '编辑平台账号'
                            : '添加平台账号'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label className="text-[#8e8e8e]">
                            平台名称 *
                        </Label>
                        <Input
                            value={form.platform}
                            onChange={(e) =>
                                handleChange(
                                    'platform',
                                    e.target.value,
                                )
                            }
                            placeholder="如：抖音、快手、小红书"
                            className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-[#8e8e8e]">
                                昵称
                            </Label>
                            <Input
                                value={form.nickname}
                                onChange={(e) =>
                                    handleChange(
                                        'nickname',
                                        e.target.value,
                                    )
                                }
                                className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                            />
                        </div>
                        <div>
                            <Label className="text-[#8e8e8e]">
                                账号ID/UID
                            </Label>
                            <Input
                                value={form.accountId}
                                onChange={(e) =>
                                    handleChange(
                                        'accountId',
                                        e.target.value,
                                    )
                                }
                                className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <Label className="text-[#8e8e8e]">
                            主页链接
                        </Label>
                        <Input
                            value={form.homeUrl}
                            onChange={(e) =>
                                handleChange(
                                    'homeUrl',
                                    e.target.value,
                                )
                            }
                            className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                        />
                    </div>
                    <div>
                        <Label className="text-[#8e8e8e]">
                            经营类目（逗号分隔）
                        </Label>
                        <Input
                            value={form.categories}
                            onChange={(e) =>
                                handleChange(
                                    'categories',
                                    e.target.value,
                                )
                            }
                            placeholder="如：美妆, 服饰"
                            className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                        />
                    </div>
                    <div>
                        <Label className="text-[#8e8e8e]">
                            内容形式（逗号分隔）
                        </Label>
                        <Input
                            value={form.contentForms}
                            onChange={(e) =>
                                handleChange(
                                    'contentForms',
                                    e.target.value,
                                )
                            }
                            placeholder="如：短视频, 直播"
                            className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() =>
                                onOpenChange(false)
                            }
                            className="bg-[#1e1e1e] border-[#3e3e3e] text-white hover:bg-[#2e2e2e]"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-[#409fff] hover:bg-[#3090ee] text-white"
                        >
                            {loading
                                ? '提交中...'
                                : '确定'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
