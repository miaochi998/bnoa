'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';

interface FeeCalculatorProps {
    companyId: string;
    companyName: string;
}

interface CalculationResult {
    actualWeight: number;
    volumeWeight: number;
    chargeableWeight: number;
    volumeRatio: number;
    firstWeight: number;
    firstWeightPrice: number;
    additionalWeight: number;
    additionalWeightPrice: number;
    totalFee: number;
}

export function FeeCalculator({ companyId, companyName }: FeeCalculatorProps) {
    const [formData, setFormData] = useState({
        weight: 0.5,
        length: 30,
        width: 20,
        height: 15,
    });
    const [result, setResult] = useState<CalculationResult | null>(null);
    const [loading, setLoading] = useState(false);

    const handleCalculate = async () => {
        if (formData.weight <= 0 || formData.length <= 0 || formData.width <= 0 || formData.height <= 0) {
            alert('请输入有效的数值');
            return;
        }

        setLoading(true);
        try {
            const data = await apiClient.calculateExpressFee(companyId, {
                weight: formData.weight,
                length: formData.length,
                width: formData.width,
                height: formData.height,
            });
            setResult(data);
        } catch (error: any) {
            alert('计算失败: ' + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* 输入表单 */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        输入包裹信息
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="weight">实际重量 (kg)</Label>
                        <Input
                            id="weight"
                            type="number"
                            step="0.001"
                            min="0"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="length">长度 (cm)</Label>
                            <Input
                                id="length"
                                type="number"
                                step="0.1"
                                min="0"
                                value={formData.length}
                                onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="width">宽度 (cm)</Label>
                            <Input
                                id="width"
                                type="number"
                                step="0.1"
                                min="0"
                                value={formData.width}
                                onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="height">高度 (cm)</Label>
                            <Input
                                id="height"
                                type="number"
                                step="0.1"
                                min="0"
                                value={formData.height}
                                onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>
                    <Button onClick={handleCalculate} disabled={loading} className="w-full">
                        {loading ? '计算中...' : '计算快递费用'}
                    </Button>
                </CardContent>
            </Card>

            {/* 计算结果 */}
            {result && (
                <Card className="bg-card border-border border-l-4 border-l-primary">
                    <CardHeader>
                        <CardTitle className="text-sm">计算结果</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 重量对比 */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <div className="text-muted-foreground">实际重量</div>
                                <div className="text-lg font-medium">{result.actualWeight} kg</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-muted-foreground">体积重量</div>
                                <div className="text-lg font-medium">{result.volumeWeight} kg</div>
                                <div className="text-xs text-muted-foreground">
                                    ({formData.length}×{formData.width}×{formData.height}) ÷ {result.volumeRatio}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border pt-4">
                            <div className="flex items-center justify-between">
                                <div className="text-muted-foreground">计费重量（取大者）</div>
                                <div className="text-xl font-bold text-primary">{result.chargeableWeight} kg</div>
                            </div>
                        </div>

                        {/* 价格明细 */}
                        <div className="border-t border-border pt-4 space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">首重 {result.firstWeight}kg</span>
                                <span>{result.firstWeightPrice} 元</span>
                            </div>
                            {result.chargeableWeight > result.firstWeight && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">
                                        续重 {(result.chargeableWeight - result.firstWeight).toFixed(3)}kg
                                        <span className="text-xs ml-1">
                                            ({Math.ceil((result.chargeableWeight - result.firstWeight) / result.additionalWeight)} × {result.additionalWeight}kg)
                                        </span>
                                    </span>
                                    <span>
                                        {Math.ceil((result.chargeableWeight - result.firstWeight) / result.additionalWeight) * result.additionalWeightPrice} 元
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 总费用 */}
                        <div className="border-t border-border pt-4">
                            <div className="flex items-center justify-between">
                                <div className="text-lg font-medium">预估快递费用</div>
                                <div className="text-3xl font-bold text-primary">¥ {result.totalFee}</div>
                            </div>
                        </div>

                        {/* 计算公式说明 */}
                        <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                            <div className="font-medium text-foreground">计算说明：</div>
                            <div>1. 体积重量 = 长×宽×高 ÷ 抛比系数 = {formData.length}×{formData.width}×{formData.height} ÷ {result.volumeRatio} = {result.volumeWeight}kg</div>
                            <div>2. 计费重量 = max(实际重量, 体积重量) = max({result.actualWeight}, {result.volumeWeight}) = {result.chargeableWeight}kg</div>
                            <div>3. 快递费用 = 首重价格 + 续重费用</div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
