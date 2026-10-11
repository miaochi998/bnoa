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
import { useFieldPermissions } from '@/lib/hooks/useFieldPermissions';

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
    const fp = useFieldPermissions('product-link');
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
        // 新建必须有链接名称/所属店铺的编辑权
        if (!editData && (!fp.canEdit('name') || !fp.canEdit('shopId'))) {
            alert('没有「链接名称」或「所属店铺」的编辑权限，无法新建链接');
            return;
        }
        if (fp.canEdit('name') && !form.name.trim()) {
            alert('请输入链接名称');
            return;
        }
        if (fp.canEdit('shopId') && !form.shopId) {
            alert('请选择所属店铺');
            return;
        }

        // 只提交「可编辑」字段：被配成只读/隐藏的字段不发送，避免误改或 400
        const payload: Record<string, any> = {};
        if (fp.canEdit('name')) payload.name = form.name;
        if (fp.canEdit('shopId')) payload.shopId = form.shopId;
        if (fp.canEdit('status')) payload.status = form.status;
        if (fp.canEdit('platformUrl') && form.platformUrl) payload.platformUrl = form.platformUrl;
        if (fp.canEdit('platformItemId') && form.platformItemId) payload.platformItemId = form.platformItemId;
        if (fp.canEdit('remark') && form.remark) payload.remark = form.remark;

        if (Object.keys(payload).length === 0) {
            alert('你没有链接字段的编辑权限');
            return;
        }

        try {
            setSaving(true);

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
                    {fp.canView('name') && (
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
                            disabled={!fp.canEdit('name')}
                            className="disabled:opacity-50"
                        />
                    </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        {fp.canView('shopId') && (
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
                                disabled={!fp.canEdit('shopId')}
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
                        )}
                        {fp.canView('status') && (
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
                                disabled={!fp.canEdit('status')}
                            />
                        </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {fp.canView('platformItemId') && (
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
                                disabled={!fp.canEdit('platformItemId')}
                                className="disabled:opacity-50"
                            />
                        </div>
                        )}
                        {fp.canView('platformUrl') && (
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
                                disabled={!fp.canEdit('platformUrl')}
                                className="disabled:opacity-50"
                            />
                        </div>
                        )}
                    </div>
                    {fp.canView('remark') && (
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
                            disabled={!fp.canEdit('remark')}
                            className="disabled:opacity-50"
                        />
                    </div>
                    )}
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
