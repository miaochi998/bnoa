'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DictTag } from '@/components/shared/DictTag';
import { DictSelect } from '@/components/shared/DictSelect';
import { PermissionGate } from '@/components/PermissionGate';
import {
    ArrowLeft,
    Plus,
    Edit,
    Trash2,
    Send,
} from 'lucide-react';
import { PlatformDialog } from './PlatformDialog';

const FLAG_COLORS: Record<string, string> = {
    RED: '#ef4444',
    GREEN: '#22c55e',
    BLUE: '#409fff',
    GRAY: '#8e8e8e',
    YELLOW: '#eab308',
};

export default function TalentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [talent, setTalent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);
    const [logContent, setLogContent] = useState('');
    const [platformOpen, setPlatformOpen] =
        useState(false);
    const [editingPlatform, setEditingPlatform] =
        useState<any>(null);

    const loadTalent = useCallback(async () => {
        try {
            const data = await apiClient.getTalent(id);
            setTalent(data);
        } catch (error: any) {
            alert(
                '加载详情失败: ' +
                    (error.message || ''),
            );
            router.push('/business/talents');
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    const loadLogs = useCallback(async () => {
        try {
            const data =
                await apiClient.getTalentContactLogs(
                    id,
                    { pageSize: 50 },
                );
            setLogs(data.list || []);
        } catch {}
    }, [id]);

    useEffect(() => {
        loadTalent();
        loadLogs();
    }, [loadTalent, loadLogs]);

    const handleAddLog = async () => {
        if (!logContent.trim()) return;
        try {
            await apiClient.createTalentContactLog(
                id,
                { content: logContent.trim() },
            );
            setLogContent('');
            loadLogs();
        } catch (error: any) {
            alert(
                '添加记录失败: ' +
                    (error.message || ''),
            );
        }
    };

    const handleDeletePlatform = async (
        platformId: string,
    ) => {
        if (!confirm('确定删除此平台账号？')) return;
        try {
            await apiClient.deleteTalentPlatform(
                platformId,
            );
            loadTalent();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || ''));
        }
    };

    const handleFlag = async (color: string) => {
        try {
            const cur =
                talent?.flags?.[0]?.flagColor;
            if (cur === color) {
                await apiClient.removeTalentFlag(id);
            } else {
                await apiClient.setTalentFlag(id, {
                    flagColor: color,
                });
            }
            loadTalent();
        } catch (error: any) {
            alert('标旗失败: ' + (error.message || ''));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-[#8e8e8e]">
                加载中...
            </div>
        );
    }

    if (!talent) return null;

    const flag = talent.flags?.[0];

    return (
        <div className="space-y-6">
            {/* 顶部导航 */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() =>
                        router.push('/business/talents')
                    }
                    className="p-2 rounded hover:bg-[#2e2e2e] text-[#8e8e8e] hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-semibold text-white">
                        {talent.name}
                    </h1>
                    <p className="text-[#8e8e8e] mt-1">
                        负责人: {talent.manager?.name || '-'}
                    </p>
                </div>
                {/* 标旗 */}
                <PermissionGate permission="talent:flag">
                    <div className="flex items-center gap-2">
                        {Object.entries(FLAG_COLORS).map(
                            ([c, hex]) => (
                                <div
                                    key={c}
                                    className={`w-5 h-5 rounded-full cursor-pointer hover:ring-2 ring-white/50 ${
                                        flag?.flagColor === c
                                            ? 'ring-2 ring-white'
                                            : ''
                                    }`}
                                    style={{
                                        backgroundColor: hex,
                                    }}
                                    onClick={() =>
                                        handleFlag(c)
                                    }
                                />
                            ),
                        )}
                    </div>
                </PermissionGate>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左侧：基本信息 + 平台账号 */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 基本信息 */}
                    <div className="bg-[#2e2e2e] rounded-lg border border-[#1e1e1e] p-4">
                        <h3 className="text-white font-medium mb-4">
                            基本信息
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-[#8e8e8e]">
                                    状态：
                                </span>
                                <DictTag
                                    typeCode="talent_status"
                                    value={talent.status}
                                />
                            </div>
                            <div>
                                <span className="text-[#8e8e8e]">
                                    等级：
                                </span>
                                <DictTag
                                    typeCode="talent_level"
                                    value={talent.level}
                                />
                            </div>
                            <div>
                                <span className="text-[#8e8e8e]">
                                    微信：
                                </span>
                                <span className="text-white">
                                    {talent.wechat || '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[#8e8e8e]">
                                    手机：
                                </span>
                                <span className="text-white">
                                    {talent.phone || '-'}
                                </span>
                            </div>
                            {talent.remark && (
                                <div className="col-span-2">
                                    <span className="text-[#8e8e8e]">
                                        备注：
                                    </span>
                                    <span className="text-white">
                                        {talent.remark}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 平台账号 */}
                    <div className="bg-[#2e2e2e] rounded-lg border border-[#1e1e1e]">
                        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
                            <h3 className="text-white font-medium">
                                平台账号
                            </h3>
                            <PermissionGate permission="talent:contact-add">
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setEditingPlatform(
                                            null,
                                        );
                                        setPlatformOpen(true);
                                    }}
                                    className="bg-[#1e1e1e] hover:bg-[#363636] text-white h-7 text-xs"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    添加
                                </Button>
                            </PermissionGate>
                        </div>
                        {talent.platforms?.length ===
                        0 ? (
                            <div className="px-4 py-6 text-center text-[#8e8e8e] text-sm">
                                暂无平台账号
                            </div>
                        ) : (
                            <div className="divide-y divide-[#1e1e1e]">
                                {talent.platforms?.map(
                                    (p: any) => (
                                        <div
                                            key={p.id}
                                            className="px-4 py-3 flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="text-white text-sm font-medium">
                                                    {
                                                        p.platform
                                                    }
                                                    {p.nickname &&
                                                        ` - ${p.nickname}`}
                                                </div>
                                                <div className="text-[#8e8e8e] text-xs mt-0.5">
                                                    {p.accountId &&
                                                        `ID: ${p.accountId}`}
                                                    {p.categories
                                                        ?.length >
                                                        0 &&
                                                        ` | 类目: ${p.categories.join(', ')}`}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <PermissionGate permission="talent:contact-edit">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPlatform(
                                                                p,
                                                            );
                                                            setPlatformOpen(
                                                                true,
                                                            );
                                                        }}
                                                        className="p-1 rounded hover:bg-[#1e1e1e] text-[#8e8e8e] hover:text-white"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                </PermissionGate>
                                                <PermissionGate permission="talent:contact-delete">
                                                    <button
                                                        onClick={() =>
                                                            handleDeletePlatform(
                                                                p.id,
                                                            )
                                                        }
                                                        className="p-1 rounded hover:bg-[#1e1e1e] text-[#8e8e8e] hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </PermissionGate>
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：沟通记录 */}
                <div className="bg-[#2e2e2e] rounded-lg border border-[#1e1e1e] flex flex-col max-h-[600px]">
                    <div className="px-4 py-3 border-b border-[#1e1e1e]">
                        <h3 className="text-white font-medium">
                            沟通记录
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {logs.length === 0 ? (
                            <div className="text-center text-[#8e8e8e] text-sm py-4">
                                暂无沟通记录
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="bg-[#1e1e1e] rounded p-3"
                                >
                                    <div className="text-white text-sm whitespace-pre-wrap">
                                        {log.content}
                                    </div>
                                    <div className="text-[#8e8e8e] text-xs mt-2 flex justify-between">
                                        <span>
                                            {log.creator
                                                ?.name ||
                                                ''}
                                        </span>
                                        <span>
                                            {new Date(
                                                log.createdAt,
                                            ).toLocaleString(
                                                'zh-CN',
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 border-t border-[#1e1e1e] flex gap-2">
                        <PermissionGate permission="talent:contact-add">
                            <Input
                                value={logContent}
                                onChange={(e) =>
                                    setLogContent(
                                        e.target.value,
                                    )
                                }
                                placeholder="输入沟通内容..."
                                className="bg-[#1e1e1e] border-[#3e3e3e] text-white text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter')
                                        handleAddLog();
                                }}
                            />
                        </PermissionGate>
                        <PermissionGate permission="talent:contact-add">
                            <Button
                                size="sm"
                                onClick={handleAddLog}
                                disabled={
                                    !logContent.trim()
                                }
                                className="bg-[#409fff] hover:bg-[#3090ee] text-white"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </PermissionGate>
                    </div>
                </div>
            </div>

            {/* 平台账号对话框 */}
            <PlatformDialog
                open={platformOpen}
                onOpenChange={setPlatformOpen}
                talentId={id}
                platform={editingPlatform}
                onSuccess={() => {
                    setPlatformOpen(false);
                    setEditingPlatform(null);
                    loadTalent();
                }}
            />
        </div>
    );
}
