'use client';

import { useState, useEffect } from 'react';
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
import { DictSelect } from '@/components/shared/DictSelect';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Shop {
    id: string;
    name: string;
    platform: { id: string; name: string };
}

interface ProductLinkFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editData?: any;
    onSuccess: () => void;
}

const defaultForm = {
    name: '',
    shopId: '',
    platformUrl: '',
    platformItemId: '',
    status: 'DRAFT',
    remark: '',
};

export function ProductLinkForm({
    open,
    onOpenChange,
    editData,
    onSuccess,
}: ProductLinkFormProps) {
    const [form, setForm] = useState(defaultForm);
    const [shops, setShops] = useState<Shop[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            fetchShops();
            if (editData) {
                setForm({
                    name: editData.name || '',
                    shopId: editData.shopId || '',
                    platformUrl:
                        editData.platformUrl || '',
                    platformItemId:
                        editData.platformItemId || '',
                    status: editData.status || 'DRAFT',
                    remark: editData.remark || '',
                });
            } else {
                setForm(defaultForm);
            }
        }
    }, [open, editData]);

    const fetchShops = async () => {
        try {
            const data =
                await apiClient.getPLShopsForSelect();
            setShops(data || []);
        } catch {
            setShops([]);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            alert('请输入链接名称');
            return;
        }
        if (!form.shopId) {
            alert('请选择所属店铺');
            return;
        }
        try {
            setSaving(true);
            const payload: any = { ...form };
            if (!payload.platformUrl)
                delete payload.platformUrl;
            if (!payload.platformItemId)
                delete payload.platformItemId;
            if (!payload.remark)
                delete payload.remark;

            if (editData) {
                await apiClient.updateProductLink(
                    editData.id, payload,
                );
            } else {
                await apiClient.createProductLink(
                    payload,
                );
            }
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            alert(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>
                        {editData
                            ? '编辑链接'
                            : '新建链接'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>
                            链接名称/商品标题 *
                        </Label>
                        <Input
                            value={form.name}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    name: e.target.value,
                                })
                            }
                            placeholder="如：爆款保温杯500ml"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>所属店铺 *</Label>
                            <Select
                                value={form.shopId}
                                onValueChange={(v) =>
                                    setForm({
                                        ...form,
                                        shopId: v,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder="选择店铺"
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {shops.map((s) => (
                                        <SelectItem
                                            key={s.id}
                                            value={s.id}
                                        >
                                            {s.platform
                                                ?.name +
                                                ' - ' +
                                                s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>链接状态</Label>
                            <DictSelect
                                typeCode="product_link_status"
                                value={form.status}
                                onChange={(v) =>
                                    setForm({
                                        ...form,
                                        status: v,
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>平台商品ID</Label>
                            <Input
                                value={
                                    form.platformItemId
                                }
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        platformItemId:
                                            e.target
                                                .value,
                                    })
                                }
                                placeholder="平台商品编号"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>平台链接URL</Label>
                            <Input
                                value={form.platformUrl}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        platformUrl:
                                            e.target
                                                .value,
                                    })
                                }
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>备注</Label>
                        <Input
                            value={form.remark}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    remark: e.target
                                        .value,
                                })
                            }
                            placeholder="其他说明"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() =>
                            onOpenChange(false)
                        }
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving && (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        )}
                        保存
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
