'use client';

import {
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DictSelect } from '@/components/shared/DictSelect';
import { DictTag } from '@/components/shared/DictTag';
import { PermissionGate } from '@/components/PermissionGate';
import {
    Search,
    Plus,
    Edit,
    Trash2,
    Eye,
    Flag,
} from 'lucide-react';
import { TalentForm } from './components/TalentForm';

const FLAG_COLORS: Record<string, string> = {
    RED: '#ef4444',
    GREEN: '#22c55e',
    BLUE: '#409fff',
    GRAY: '#8e8e8e',
    YELLOW: '#eab308',
};

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export default function TalentsPage() {
    const router = useRouter();
    const [talents, setTalents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] =
        useState('all');
    const [levelFilter, setLevelFilter] =
        useState('all');
    const [flagFilter, setFlagFilter] = useState('all');
    const [pagination, setPagination] =
        useState<Pagination>({
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
        });

    const handlePageSizeChange = (newSize: number) => {
        setPagination((p) => ({ ...p, pageSize: newSize, page: 1 }));
    };
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTalent, setEditingTalent] =
        useState<any>(null);
    const [isFlagConfigOpen, setIsFlagConfigOpen] =
        useState(false);
    const [flagConfigs, setFlagConfigs] = useState<
        { flagColor: string; meaning: string }[]
    >([]);
    const [flagConfigLoading, setFlagConfigLoading] =
        useState(false);
    const [flagMeanings, setFlagMeanings] = useState<
        Record<string, string>
    >({});

    const loadFlagMeanings = useCallback(async () => {
        try {
            const data =
                await apiClient.getTalentFlagConfigs();
            const map: Record<string, string> = {};
            (data || []).forEach((c: any) => {
                if (c.meaning) {
                    map[c.flagColor] = c.meaning;
                }
            });
            setFlagMeanings(map);
        } catch {}
    }, []);

    useEffect(() => {
        loadFlagMeanings();
    }, [loadFlagMeanings]);

    const loadTalents = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient.getTalents({
                keyword: keyword || undefined,
                status:
                    statusFilter === 'all'
                        ? undefined
                        : statusFilter,
                level:
                    levelFilter === 'all'
                        ? undefined
                        : levelFilter,
                flagColor:
                    flagFilter === 'all'
                        ? undefined
                        : flagFilter,
                page: pagination.page,
                pageSize: pagination.pageSize,
            });
            setTalents(data.list || []);
            setPagination({
                page: data.pagination?.page || 1,
                pageSize:
                    data.pagination?.pageSize || 10,
                total: data.pagination?.total || 0,
                totalPages:
                    data.pagination?.totalPages || 0,
            });
        } catch (error: any) {
            alert(
                '加载失败: ' +
                    (error.message || '请稍后重试'),
            );
        } finally {
            setLoading(false);
        }
    }, [
        pagination.page,
        pagination.pageSize,
        keyword,
        statusFilter,
        levelFilter,
        flagFilter,
    ]);

    useEffect(() => {
        loadTalents();
    }, [loadTalents]);

    const handleDelete = async (talent: any) => {
        if (
            !confirm(
                `确定要删除达人 "${talent.name}" 吗？`,
            )
        )
            return;
        try {
            await apiClient.deleteTalent(talent.id);
            loadTalents();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || ''));
        }
    };

    const handleFlag = async (
        talent: any,
        color: string,
    ) => {
        try {
            const cur = talent.flags?.[0]?.flagColor;
            if (cur === color) {
                await apiClient.removeTalentFlag(
                    talent.id,
                );
            } else {
                await apiClient.setTalentFlag(
                    talent.id,
                    { flagColor: color },
                );
            }
            loadTalents();
        } catch (error: any) {
            alert('标旗失败: ' + (error.message || ''));
        }
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingTalent(null);
        loadTalents();
    };

    const openFlagConfig = async () => {
        setIsFlagConfigOpen(true);
        try {
            const data =
                await apiClient.getTalentFlagConfigs();
            const configs = Object.keys(
                FLAG_COLORS,
            ).map((color) => {
                const exist = (data || []).find(
                    (c: any) => c.flagColor === color,
                );
                return {
                    flagColor: color,
                    meaning: exist?.meaning || '',
                };
            });
            setFlagConfigs(configs);
        } catch {
            setFlagConfigs(
                Object.keys(FLAG_COLORS).map((c) => ({
                    flagColor: c,
                    meaning: '',
                })),
            );
        }
    };

    const saveFlagConfig = async () => {
        setFlagConfigLoading(true);
        try {
            await apiClient.saveTalentFlagConfigs({
                configs: flagConfigs.filter(
                    (c) => c.meaning.trim(),
                ),
            });
            setIsFlagConfigOpen(false);
            loadFlagMeanings();
        } catch (error: any) {
            alert(
                '保存失败: ' +
                    (error.message || ''),
            );
        } finally {
            setFlagConfigLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">
                        达人管理
                    </h1>
                    <p className="text-[#8e8e8e] mt-1">
                        管理达人信息和建联状态
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={openFlagConfig}
                        className="border-[#1e1e1e] bg-[#2e2e2e] text-[#8e8e8e] hover:bg-[#363636] hover:text-white"
                    >
                        <Flag className="w-4 h-4 mr-2" />
                        标旗设置
                    </Button>
                    <PermissionGate permission="talent:create">
                        <Button
                            onClick={() => {
                                setEditingTalent(null);
                                setIsFormOpen(true);
                            }}
                            className="bg-[#2e2e2e] hover:bg-[#363636] text-white border border-[#1e1e1e]"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            新增达人
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {/* 筛选栏 */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e8e]" />
                    <Input
                        placeholder="搜索名称/微信/手机..."
                        value={keyword}
                        onChange={(e) =>
                            setKeyword(e.target.value)
                        }
                        className="pl-10 bg-[#2e2e2e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                    />
                </div>
                <DictSelect
                    typeCode="talent_status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    showAll
                    allLabel="全部状态"
                    className="w-[140px] bg-[#2e2e2e] border-[#1e1e1e] text-white"
                />
                <DictSelect
                    typeCode="talent_level"
                    value={levelFilter}
                    onChange={setLevelFilter}
                    showAll
                    allLabel="全部等级"
                    className="w-[140px] bg-[#2e2e2e] border-[#1e1e1e] text-white"
                />
                <Select
                    value={flagFilter}
                    onValueChange={setFlagFilter}
                >
                    <SelectTrigger className="w-[160px] bg-[#2e2e2e] border-[#1e1e1e] text-white">
                        <SelectValue
                            placeholder="全部标旗"
                        />
                    </SelectTrigger>
                    <SelectContent className="bg-[#262626] border-[#3e3e3e]">
                        <SelectItem
                            value="all"
                            className="text-white"
                        >
                            全部标旗
                        </SelectItem>
                        {Object.entries(
                            FLAG_COLORS,
                        ).map(([key, hex]) => (
                            <SelectItem
                                key={key}
                                value={key}
                                className="text-white"
                            >
                                <span className="flex items-center gap-2">
                                    <span
                                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                        style={{
                                            backgroundColor:
                                                hex,
                                        }}
                                    />
                                    <span>
                                        {flagMeanings[
                                            key
                                        ] || key}
                                    </span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 表格 */}
            <div className="bg-[#2e2e2e] rounded-lg border border-[#1e1e1e] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e1e1e]">
                    <h3 className="text-white font-medium">
                        达人列表（{pagination.total}）
                    </h3>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#262626]">
                            <th className="px-3 py-3 text-left text-sm font-medium text-[#8e8e8e] w-14 whitespace-nowrap">
                                标旗
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">
                                达人
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">
                                联系方式
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">
                                平台
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">
                                状态
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">
                                等级
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">
                                负责人
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {talents.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-8 text-center text-[#8e8e8e]"
                                >
                                    暂无达人数据
                                </td>
                            </tr>
                        ) : (
                            talents.map((t) => (
                                <TalentRow
                                    key={t.id}
                                    talent={t}
                                    onEdit={() => {
                                        setEditingTalent(
                                            t,
                                        );
                                        setIsFormOpen(
                                            true,
                                        );
                                    }}
                                    onDelete={() =>
                                        handleDelete(t)
                                    }
                                    onFlag={(c) =>
                                        handleFlag(t, c)
                                    }
                                    onView={() =>
                                        router.push(
                                            `/business/talents/${t.id}`,
                                        )
                                    }
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 分页 */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-[#8e8e8e]">
                            共 {pagination.total} 条，第{' '}
                            {pagination.page} /{' '}
                            {pagination.totalPages} 页
                        </div>
                        <Select
                            value={String(pagination.pageSize)}
                            onValueChange={(v) => handlePageSizeChange(Number(v))}
                        >
                            <SelectTrigger className="w-24 h-8 bg-[#2e2e2e] border-[#1e1e1e] text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#262626] border-[#1e1e1e] text-white">
                                <SelectItem value="20">20 条/页</SelectItem>
                                <SelectItem value="50">50 条/页</SelectItem>
                                <SelectItem value="100">100 条/页</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setPagination((p) => ({
                                    ...p,
                                    page: p.page - 1,
                                }))
                            }
                            disabled={
                                pagination.page === 1
                            }
                            className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setPagination((p) => ({
                                    ...p,
                                    page: p.page + 1,
                                }))
                            }
                            disabled={
                                pagination.page ===
                                pagination.totalPages
                            }
                            className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}

            {/* 新增/编辑对话框 */}
            <Dialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
            >
                <DialogContent className="bg-[#2e2e2e] border-[#1e1e1e] text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTalent
                                ? '编辑达人'
                                : '新增达人'}
                        </DialogTitle>
                    </DialogHeader>
                    <TalentForm
                        talent={editingTalent}
                        onSuccess={handleFormSuccess}
                        onCancel={() =>
                            setIsFormOpen(false)
                        }
                    />
                </DialogContent>
            </Dialog>

            {/* 标旗含义配置对话框 */}
            <Dialog
                open={isFlagConfigOpen}
                onOpenChange={setIsFlagConfigOpen}
            >
                <DialogContent className="bg-[#2e2e2e] border-[#1e1e1e] text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            标旗含义设置
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-[#8e8e8e]">
                        为每种颜色的旗子设置含义，
                        方便团队统一标记规范
                    </p>
                    <div className="space-y-3 mt-2">
                        {flagConfigs.map((cfg, idx) => (
                            <div
                                key={cfg.flagColor}
                                className="flex items-center gap-3"
                            >
                                <div
                                    className="w-5 h-5 rounded-full flex-shrink-0"
                                    style={{
                                        backgroundColor:
                                            FLAG_COLORS[
                                                cfg.flagColor
                                            ],
                                    }}
                                />
                                <Input
                                    value={cfg.meaning}
                                    onChange={(e) => {
                                        const next = [
                                            ...flagConfigs,
                                        ];
                                        next[idx] = {
                                            ...next[idx],
                                            meaning:
                                                e.target
                                                    .value,
                                        };
                                        setFlagConfigs(
                                            next,
                                        );
                                    }}
                                    placeholder="输入此颜色的含义..."
                                    className="bg-[#1e1e1e] border-[#3e3e3e] text-white placeholder:text-[#8e8e8e]"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() =>
                                setIsFlagConfigOpen(
                                    false,
                                )
                            }
                            className="border-[#3e3e3e] bg-transparent text-[#8e8e8e] hover:bg-[#363636] hover:text-white"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={saveFlagConfig}
                            disabled={
                                flagConfigLoading
                            }
                            className="bg-[#409fff] hover:bg-[#3090ef] text-white"
                        >
                            {flagConfigLoading
                                ? '保存中...'
                                : '保存'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// 标旗选择弹出层组件
function FlagPicker({
    currentColor,
    onFlag,
}: {
    currentColor?: string;
    onFlag: (color: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLDivElement>(null);
    const popRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                !btnRef.current?.contains(
                    e.target as Node,
                ) &&
                !popRef.current?.contains(
                    e.target as Node,
                )
            ) {
                setOpen(false);
            }
        };
        document.addEventListener(
            'mousedown',
            handler,
        );
        return () =>
            document.removeEventListener(
                'mousedown',
                handler,
            );
    }, [open]);

    const rect = btnRef.current?.getBoundingClientRect();

    return (
        <>
            <div
                ref={btnRef}
                className="w-3 h-3 rounded-full cursor-pointer"
                style={{
                    backgroundColor: currentColor
                        ? FLAG_COLORS[currentColor]
                        : '#3e3e3e',
                }}
                onClick={() => setOpen(!open)}
            />
            {open && rect && (
                <div
                    ref={popRef}
                    className="fixed flex gap-1 p-1.5 bg-[#262626] rounded border border-[#3e3e3e] z-50"
                    style={{
                        top: rect.bottom + 4,
                        left: rect.left,
                    }}
                >
                    {Object.entries(
                        FLAG_COLORS,
                    ).map(([c, hex]) => (
                        <div
                            key={c}
                            className="w-4 h-4 rounded-full cursor-pointer hover:ring-2 ring-white/50"
                            style={{
                                backgroundColor: hex,
                            }}
                            onClick={() => {
                                onFlag(c);
                                setOpen(false);
                            }}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

// 表格行组件
function TalentRow({
    talent,
    onEdit,
    onDelete,
    onFlag,
    onView,
}: {
    talent: any;
    onEdit: () => void;
    onDelete: () => void;
    onFlag: (color: string) => void;
    onView: () => void;
}) {
    const flag = talent.flags?.[0];
    return (
        <tr className="border-t border-[#1e1e1e] hover:bg-[#363636]">
            <td className="px-3 py-3">
                <PermissionGate permission="talent:flag">
                    <FlagPicker
                        currentColor={flag?.flagColor}
                        onFlag={onFlag}
                    />
                </PermissionGate>
            </td>
            <td className="px-4 py-3">
                <span
                    className="text-white font-medium cursor-pointer hover:text-[#409fff]"
                    onClick={onView}
                >
                    {talent.name}
                </span>
            </td>
            <td className="px-4 py-3 text-[#8e8e8e] text-sm">
                {talent.wechat && (
                    <div>微信: {talent.wechat}</div>
                )}
                {talent.phone && (
                    <div>手机: {talent.phone}</div>
                )}
                {!talent.wechat && !talent.phone && '-'}
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                    {talent.platforms?.map((p: any) => (
                        <span
                            key={p.id}
                            className="text-xs px-2 py-0.5 rounded bg-[#1e1e1e] text-[#8e8e8e]"
                        >
                            {p.platform}
                            {p.nickname
                                ? `:${p.nickname}`
                                : ''}
                        </span>
                    ))}
                    {(!talent.platforms ||
                        talent.platforms.length ===
                            0) &&
                        '-'}
                </div>
            </td>
            <td className="px-4 py-3">
                <DictTag
                    typeCode="talent_status"
                    value={talent.status}
                />
            </td>
            <td className="px-4 py-3">
                <DictTag
                    typeCode="talent_level"
                    value={talent.level}
                />
            </td>
            <td className="px-4 py-3 text-[#8e8e8e]">
                {talent.manager?.name || '-'}
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onView}
                        className="p-1.5 rounded hover:bg-[#1e1e1e] text-[#8e8e8e] hover:text-white"
                        title="详情"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <PermissionGate permission="talent:update">
                        <button
                            onClick={onEdit}
                            className="p-1.5 rounded hover:bg-[#1e1e1e] text-[#8e8e8e] hover:text-white"
                            title="编辑"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                    </PermissionGate>
                    <PermissionGate permission="talent:delete">
                        <button
                            onClick={onDelete}
                            className="p-1.5 rounded hover:bg-[#1e1e1e] text-[#8e8e8e] hover:text-red-500"
                            title="删除"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </PermissionGate>
                </div>
            </td>
        </tr>
    );
}
