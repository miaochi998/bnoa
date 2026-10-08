'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DictSelect } from '@/components/shared/DictSelect';

interface TalentFormProps {
    talent: any | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export function TalentForm({
    talent,
    onSuccess,
    onCancel,
}: TalentFormProps) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(talent?.name || '');
    const [wechat, setWechat] = useState(
        talent?.wechat || '',
    );
    const [phone, setPhone] = useState(
        talent?.phone || '',
    );
    const [status, setStatus] = useState(
        talent?.status || 'PENDING',
    );
    const [level, setLevel] = useState(
        talent?.level || 'LV1',
    );
    const [remark, setRemark] = useState(
        talent?.remark || '',
    );

    const handleSubmit = async () => {
        if (!name.trim()) {
            alert('请输入达人名称');
            return;
        }
        setLoading(true);
        try {
            const data: any = {
                name: name.trim(),
                status,
                level,
            };
            if (wechat.trim()) data.wechat = wechat.trim();
            if (phone.trim()) data.phone = phone.trim();
            if (remark.trim()) data.remark = remark.trim();

            if (talent) {
                await apiClient.updateTalent(
                    talent.id,
                    data,
                );
            } else {
                await apiClient.createTalent(data);
            }
            onSuccess();
        } catch (error: any) {
            alert(
                (talent ? '更新' : '创建') +
                    '失败: ' +
                    (error.message || ''),
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-[#8e8e8e]">
                    达人名称 *
                </Label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入达人名称"
                    className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label className="text-[#8e8e8e]">
                        微信号
                    </Label>
                    <Input
                        value={wechat}
                        onChange={(e) =>
                            setWechat(e.target.value)
                        }
                        placeholder="请输入微信号"
                        className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                    />
                </div>
                <div>
                    <Label className="text-[#8e8e8e]">
                        手机号
                    </Label>
                    <Input
                        value={phone}
                        onChange={(e) =>
                            setPhone(e.target.value)
                        }
                        placeholder="请输入手机号"
                        className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label className="text-[#8e8e8e]">
                        状态
                    </Label>
                    <div className="mt-1">
                        <DictSelect
                            typeCode="talent_status"
                            value={status}
                            onChange={setStatus}
                            className="w-full bg-[#1e1e1e] border-[#3e3e3e] text-white"
                        />
                    </div>
                </div>
                <div>
                    <Label className="text-[#8e8e8e]">
                        等级
                    </Label>
                    <div className="mt-1">
                        <DictSelect
                            typeCode="talent_level"
                            value={level}
                            onChange={setLevel}
                            className="w-full bg-[#1e1e1e] border-[#3e3e3e] text-white"
                        />
                    </div>
                </div>
            </div>
            <div>
                <Label className="text-[#8e8e8e]">
                    备注
                </Label>
                <Textarea
                    value={remark}
                    onChange={(e) =>
                        setRemark(e.target.value)
                    }
                    placeholder="请输入备注"
                    rows={3}
                    className="mt-1 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                />
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <Button
                    variant="outline"
                    onClick={onCancel}
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
                        : talent
                          ? '保存'
                          : '创建'}
                </Button>
            </div>
        </div>
    );
}
