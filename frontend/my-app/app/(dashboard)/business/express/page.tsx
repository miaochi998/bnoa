'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Edit, Trash2, Package } from 'lucide-react';
import { ExpressCompanyForm } from './components/ExpressCompanyForm';
import { PriceManageDialog } from './components/PriceManageDialog';
import { PermissionGate } from '@/components/PermissionGate';
import { EditableCell } from '@/components/shared/EditableCell';
import { EditableSwitchCell } from '@/components/shared/EditableSwitchCell';
import { SortableTable } from '@/components/shared/SortableTable';
import { usePermissionStore } from '@/lib/stores/permission-store';
import { toast } from 'sonner';

interface ExpressCompany {
    id: string;
    name: string;
    code: string;
    contactName: string | null;
    contactPhone: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    remark: string | null;
    createdAt: string;
}

const GRID_COLS = 'grid grid-cols-[minmax(140px,1.4fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(140px,1.2fr)_minmax(110px,1fr)_88px] items-center gap-x-4';

export default function ExpressPage() {
    const [companies, setCompanies] = useState<ExpressCompany[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
    });

    const handlePageSizeChange = (newSize: number) => {
        setPagination(prev => ({ ...prev, pageSize: newSize, page: 1 }));
    };

    // 对话框状态
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isPriceManageOpen, setIsPriceManageOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<ExpressCompany | null>(null);
    const [sorting, setSorting] = useState(false);

    const permissionStore = usePermissionStore();
    const canUpdate = permissionStore.loaded && permissionStore.hasPermission('express:update');

    // 加载快递公司列表
    const loadCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {
                page: pagination.page,
                pageSize: pagination.pageSize,
            };
            if (searchKeyword) params.keyword = searchKeyword;
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await apiClient.getExpressCompanies(params);
            setCompanies(response.list || []);
            setPagination(prev => ({
                ...prev,
                total: response.pagination?.total || 0,
                totalPages: response.pagination?.totalPages || 0,
            }));
        } catch (error: any) {
            alert('加载快递公司列表失败: ' + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.pageSize, searchKeyword, statusFilter]);

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    // 删除快递公司
    const handleDelete = async (company: ExpressCompany) => {
        if (!confirm(`确定要删除快递公司 "${company.name}" 吗？`)) {
            return;
        }

        try {
            await apiClient.deleteExpressCompany(company.id);
            alert('删除成功');
            loadCompanies();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || '请稍后重试'));
        }
    };

    // 打开编辑对话框
    const handleEdit = (company: ExpressCompany) => {
        setSelectedCompany(company);
        setIsEditOpen(true);
    };

    // 打开价格管理对话框
    const handleManagePrices = (company: ExpressCompany) => {
        setSelectedCompany(company);
        setIsPriceManageOpen(true);
    };

    // 更新快递公司字段（联系人/联系电话）
    const handleUpdateField = async (id: string, field: 'contactName' | 'contactPhone', newValue: string) => {
        try {
            await apiClient.updateExpressCompany(id, { [field]: newValue || null });
            setCompanies(prev => prev.map(item => item.id === id ? { ...item, [field]: newValue || null } : item));
        } catch (error: any) {
            toast.error('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    // 切换快递公司状态（启用/停用）
    const handleStatusChange = async (id: string, checked: boolean) => {
        const status = checked ? 'ACTIVE' : 'INACTIVE';
        await apiClient.updateExpressCompany(id, { status });
        setCompanies(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    };

    // 拖拽排序持久化
    const handleItemsChange = async (newItems: ExpressCompany[]) => {
        setCompanies(newItems);
        if (!canUpdate) return;
        setSorting(true);
        try {
            await apiClient.reorderExpressCompanies(newItems.map(item => item.id));
        } catch (error: any) {
            toast.error('保存排序失败: ' + (error.message || '请稍后重试'));
            loadCompanies();
        } finally {
            setSorting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">快递管理</h1>
                    <p className="text-muted-foreground mt-1">管理快递公司和快递价格</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <PermissionGate permission="express:create">
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                新增快递公司
                            </Button>
                        </DialogTrigger>
                    </PermissionGate>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>新增快递公司</DialogTitle>
                        </DialogHeader>
                        <ExpressCompanyForm
                            onSuccess={() => {
                                setIsCreateOpen(false);
                                loadCompanies();
                            }}
                            onCancel={() => setIsCreateOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* 搜索和筛选 */}
            <Card className="bg-card border-border">
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索快递公司名称或编码..."
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={(value: 'all' | 'ACTIVE' | 'INACTIVE') => setStatusFilter(value)}
                        >
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="全部状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="ACTIVE">合作中</SelectItem>
                                <SelectItem value="INACTIVE">已终止</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={loadCompanies} disabled={loading}>
                            {loading ? '加载中...' : '刷新'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 快递公司列表 */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-lg">快递公司列表</CardTitle>
                </CardHeader>
                <CardContent>
                    {companies.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                            <Package className="w-8 h-8 text-muted-foreground" />
                            <p className="text-sm">暂无快递公司数据</p>
                        </div>
                    ) : (
                        <div className="border border-border rounded-md overflow-hidden">
                            {/* 表头 */}
                            <div className="flex items-center border-b border-border bg-[#1e1e1e]/40">
                                {canUpdate && <div className="w-8 shrink-0" aria-hidden />}
                                <div className={`flex-1 ${GRID_COLS} px-3 py-2 text-xs text-muted-foreground`}>
                                    <div>快递公司</div>
                                    <div>编码</div>
                                    <div>联系人</div>
                                    <div>联系电话</div>
                                    <div>状态</div>
                                    <div className="text-right">操作</div>
                                </div>
                            </div>
                            {/* 拖拽排序列表 */}
                            <SortableTable
                                items={companies}
                                getId={(company) => company.id}
                                onItemsChange={handleItemsChange}
                                disabled={!canUpdate}
                                className="divide-y divide-border"
                            >
                                {(company) => (
                                    <div className={`grid ${GRID_COLS} px-3 py-2 text-sm`}>
                                        <div className="font-medium text-white">{company.name}</div>
                                        <div className="text-muted-foreground">{company.code}</div>
                                        <div>
                                            <EditableCell
                                                value={company.contactName}
                                                onSave={(newValue) => handleUpdateField(company.id, 'contactName', newValue)}
                                                disabled={!canUpdate}
                                                placeholder="联系人"
                                                type="text"
                                                maxLength={50}
                                            />
                                        </div>
                                        <div>
                                            <EditableCell
                                                value={company.contactPhone}
                                                onSave={(newValue) => handleUpdateField(company.id, 'contactPhone', newValue)}
                                                disabled={!canUpdate}
                                                placeholder="联系电话"
                                                type="tel"
                                                maxLength={20}
                                            />
                                        </div>
                                        <div>
                                            <EditableSwitchCell
                                                checked={company.status === 'ACTIVE'}
                                                onSave={(checked) => handleStatusChange(company.id, checked)}
                                                disabled={!canUpdate}
                                                activeLabel="启用"
                                                inactiveLabel="停用"
                                            />
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <PermissionGate permission="express:price">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleManagePrices(company)}
                                                    title="价格管理"
                                                    className="h-8 w-8 text-muted-foreground hover:text-[#409fff] hover:bg-[#363636]"
                                                >
                                                    <Package className="h-4 w-4" />
                                                </Button>
                                            </PermissionGate>
                                            <PermissionGate permission="express:update">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(company)}
                                                    title="编辑"
                                                    className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-[#363636]"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </PermissionGate>
                                            <PermissionGate permission="express:delete">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(company)}
                                                    title="删除"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </PermissionGate>
                                        </div>
                                    </div>
                                )}
                            </SortableTable>
                        </div>
                    )}
                    {sorting && (
                        <div className="mt-2 text-sm text-muted-foreground">保存排序中...</div>
                    )}

                    {/* 分页 */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                            <div className="flex items-center gap-4">
                                <div className="text-sm text-muted-foreground">
                                    共 {pagination.total} 条记录，第 {pagination.page}/{pagination.totalPages} 页
                                </div>
                                <Select
                                    value={String(pagination.pageSize)}
                                    onValueChange={(v) => handlePageSizeChange(Number(v))}
                                >
                                    <SelectTrigger className="w-24 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="20">20 条/页</SelectItem>
                                        <SelectItem value="50">50 条/页</SelectItem>
                                        <SelectItem value="100">100 条/页</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                >
                                    上一页
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                >
                                    下一页
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 编辑对话框 */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>编辑快递公司</DialogTitle>
                    </DialogHeader>
                    {selectedCompany && (
                        <ExpressCompanyForm
                            company={selectedCompany}
                            onSuccess={() => {
                                setIsEditOpen(false);
                                setSelectedCompany(null);
                                loadCompanies();
                            }}
                            onCancel={() => {
                                setIsEditOpen(false);
                                setSelectedCompany(null);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* 价格管理对话框 */}
            {selectedCompany && (
                <PriceManageDialog
                    companyId={selectedCompany.id}
                    companyName={selectedCompany.name}
                    open={isPriceManageOpen}
                    onOpenChange={(open) => {
                        setIsPriceManageOpen(open);
                        if (!open) {
                            setSelectedCompany(null);
                        }
                    }}
                />
            )}
        </div>
    );
}
