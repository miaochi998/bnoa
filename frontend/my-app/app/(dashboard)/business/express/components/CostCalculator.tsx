'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator, Package, MapPin, Weight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Company {
  id: string;
  name: string;
  code: string;
}

interface CalculationResult {
  companyId: string;
  companyName: string;
  province: string;
  weight: number;
  zone: string;
  weightRange: string;
  basePrice: number;
  surcharges: { name: string; amount: number }[];
  totalSurcharge: number;
  totalPrice: number;
}

// 标准省份列表
const ALL_PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
  '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省',
  '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区',
  '海南省', '重庆市', '四川省', '贵州省', '云南省',
  '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区',
  '新疆维吾尔自治区'
];

export function CostCalculator() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    companyId: '',
    province: '',
    weight: '',
  });

  // 加载快递公司列表
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getExpressCompaniesForSelect();
      setCompanies(data);
    } catch (error: any) {
      console.error('加载快递公司列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算成本
  const handleCalculate = async () => {
    if (!formData.companyId || !formData.province || !formData.weight) {
      alert('请填写完整信息');
      return;
    }

    setCalculating(true);
    try {
      const data = await apiClient.calculateExpressCost({
        companyId: formData.companyId,
        province: formData.province,
        weight: parseFloat(formData.weight),
      });
      setResult(data);
    } catch (error: any) {
      alert('计算失败: ' + error.message);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          快递成本计算器
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 输入表单 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              快递公司
            </Label>
            <Select
              value={formData.companyId}
              onValueChange={(value) => setFormData({ ...formData, companyId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择快递公司" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              目的省份
            </Label>
            <Select
              value={formData.province}
              onValueChange={(value) => setFormData({ ...formData, province: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择省份" />
              </SelectTrigger>
              <SelectContent>
                {ALL_PROVINCES.map((province) => (
                  <SelectItem key={province} value={province}>
                    {province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Weight className="w-4 h-4" />
              重量 (kg)
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="3"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              placeholder="0.0"
            />
          </div>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={calculating}
          className="w-full"
        >
          <Calculator className="w-4 h-4 mr-2" />
          {calculating ? '计算中...' : '计算成本'}
        </Button>

        {/* 计算结果 */}
        {result && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-medium">计算结果</h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">快递公司</span>
                  <p className="font-medium">{result.companyName}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">目的省份</span>
                  <p className="font-medium">{result.province}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">所属区域</span>
                  <Badge variant="secondary">{result.zone}</Badge>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">重量段</span>
                  <Badge variant="outline">{result.weightRange}</Badge>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">基础价格</span>
                  <span className="font-medium">¥{result.basePrice.toFixed(3)}</span>
                </div>

                {result.surcharges.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">附加费</span>
                      {result.surcharges.map((surcharge, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span>{surcharge.name}</span>
                          <span className="text-red-500">+¥{surcharge.amount.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-medium">合计</span>
                  <span className="text-xl font-bold text-primary">
                    ¥{result.totalPrice.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
