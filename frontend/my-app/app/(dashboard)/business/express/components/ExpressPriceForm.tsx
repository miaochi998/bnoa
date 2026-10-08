'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Check } from 'lucide-react';

interface ExpressPrice {
    id: string;
    companyId: string;
    firstWeight: number;
    firstWeightPrice: number;
    additionalWeight: number;
    additionalWeightPrice: number;
    volumeRatio: number;
    isActive: boolean;
    createdAt: string;
}

interface ExpressPriceFormProps {
    companyId: string;
    onSuccess: () => void;
}

export function ExpressPriceForm({ companyId, onSuccess }: ExpressPriceFormProps) {
    const [prices, setPrices] = useState<ExpressPrice[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        firstWeight: 1,
        firstWeightPrice: 8,
        additionalWeight: 1,
        additionalWeightPrice: 3,
        volumeRatio: 6000,
    });

    // 加载价格列表
    const loadPrices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient.getExpressPrices(companyId);
            setPrices(data || []);
        } catch (error: any) {
            alert('加载价格列表失败: ' + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadPrices();
    }, [loadPrices]);

    // 创建价格
    const handleCreate = async () => {
        try {
            await apiClient.createExpressPrice({
                companyId,
                firstWeight: formData.firstWeight,
                firstWeightPrice: formData.firstWeightPrice,
                additionalWeight: formData.additionalWeight,
                additionalWeightPrice: formData.additionalWeightPrice,
                volumeRatio: formData.volumeRatio,
            });
            alert('价格创建成功');
            setIsCreating(false);
            loadPrices();
            onSuccess();
        } catch (error: any) {
            alert('创建失败: ' + (error.message || '请稍后重试'));
        }
    };

    // 删除价格
    const handleDelete = async (priceId: string) => {
        if (!confirm('确定要删除这个价格配置吗？')) {
            return;
        }

        try {
            await apiClient.deleteExpressPrice(priceId);
            alert('删除成功');
            loadPrices();
            onSuccess();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || '请稍后重试'));
        }
    };

    return (
        <div className="space-y-4">
            {/* 新建价格表单 */}
            {!isCreating ? (
                <Button onClick={() => setIsCreating(true)} className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    新增价格配置
                </Button>
            ) : (
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-sm">新增价格配置</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstWeight">首重重量 (kg)</Label>
                                <Input
                                    id="firstWeight"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={formData.firstWeight}
                                    onChange={(e) => setFormData({ ...formData, firstWeight: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="firstWeightPrice">首重价格 (元)</Label>
                                <Input
                                    id="firstWeightPrice"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={formData.firstWeightPrice}
                                    onChange={(e) => setFormData({ ...formData, firstWeightPrice: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="additionalWeight">续重单位 (kg)</Label>
                                <Input
                                    id="additionalWeight"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={formData.additionalWeight}
                                    onChange={(e) => setFormData({ ...formData, additionalWeight: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="additionalWeightPrice">续重价格 (元)</Label>
                                <Input
                                    id="additionalWeightPrice"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={formData.additionalWeightPrice}
                                    onChange={(e) => setFormData({ ...formData, additionalWeightPrice: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="volumeRatio">抛比系数</Label>
                            <Input
                                id="volumeRatio"
                                type="number"
                                min="1"
                                value={formData.volumeRatio}
                                onChange={(e) => setFormData({ ...formData, volumeRatio: parseInt(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">体积重量 = 体积(长×宽×高) ÷ 抛比系数</p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                                取消
                            </Button>
                            <Button size="sm" onClick={handleCreate}>
                                保存
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 价格列表 */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-muted-foreground">首重</TableHead>
                            <TableHead className="text-muted-foreground">续重</TableHead>
                            <TableHead className="text-muted-foreground">抛比系数</TableHead>
                            <TableHead className="text-muted-foreground">状态</TableHead>
                            <TableHead className="text-muted-foreground text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                    加载中...
                                </TableCell>
                            </TableRow>
                        ) : prices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                    暂无价格配置
                                </TableCell>
                            </TableRow>
                        ) : (
                            prices.map((price) => (
                                <TableRow key={price.id} className="border-border">
                                    <TableCell>
                                        <div className="text-sm">
                                            <div>{price.firstWeight}kg</div>
                                            <div className="text-muted-foreground">{price.firstWeightPrice}元</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div>{price.additionalWeight}kg</div>
                                            <div className="text-muted-foreground">{price.additionalWeightPrice}元</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{price.volumeRatio}</TableCell>
                                    <TableCell>
                                        {price.isActive ? (
                                            <Badge variant="default" className="bg-green-500/20 text-green-400 gap-1">
                                                <Check className="h-3 w-3" />
                                                生效中
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                                                已停用
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(price.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
