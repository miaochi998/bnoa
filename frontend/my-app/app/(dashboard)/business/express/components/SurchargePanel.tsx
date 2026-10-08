'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Surcharge {
  id: string;
  name: string;
  provinces: string[];
  weightFrom: number | null;
  weightTo: number | null;
  amount: number;
}

interface SurchargePanelProps {
  companyId: string;
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

export function SurchargePanel({ companyId }: SurchargePanelProps) {
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSurcharge, setEditingSurcharge] = useState<Surcharge | null>(null);
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    provinces: [] as string[],
    weightFrom: '',
    weightTo: '',
    amount: '',
  });

  // 加载附加费列表
  useEffect(() => {
    loadSurcharges();
  }, [companyId]);

  const loadSurcharges = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getExpressSurcharges(companyId);
      setSurcharges(data);
    } catch (error: any) {
      alert('加载附加费列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 打开创建对话框
  const handleCreate = () => {
    setEditingSurcharge(null);
    setFormData({
      name: '',
      provinces: [],
      weightFrom: '',
      weightTo: '',
      amount: '',
    });
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (surcharge: Surcharge) => {
    setEditingSurcharge(surcharge);
    setFormData({
      name: surcharge.name,
      provinces: surcharge.provinces,
      weightFrom: surcharge.weightFrom?.toString() || '',
      weightTo: surcharge.weightTo?.toString() || '',
      amount: surcharge.amount.toString(),
    });
    setDialogOpen(true);
  };

  // 删除附加费
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此附加费规则吗？')) return;

    try {
      await apiClient.deleteExpressSurcharge(id);
      alert('删除成功');
      loadSurcharges();
    } catch (error: any) {
      alert('删除失败: ' + error.message);
    }
  };

  // 保存附加费
  const handleSave = async () => {
    if (!formData.name || formData.provinces.length === 0 || !formData.amount) {
      alert('请填写完整信息');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: formData.name,
        provinces: formData.provinces,
        weightFrom: formData.weightFrom ? parseFloat(formData.weightFrom) : undefined,
        weightTo: formData.weightTo ? parseFloat(formData.weightTo) : undefined,
        amount: parseFloat(formData.amount),
      };

      if (editingSurcharge) {
        await apiClient.updateExpressSurcharge(editingSurcharge.id, data);
      } else {
        await apiClient.createExpressSurcharge(companyId, data);
      }

      alert('保存成功');
      setDialogOpen(false);
      loadSurcharges();
    } catch (error: any) {
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 切换省份选择
  const handleToggleProvince = (province: string) => {
    setFormData(prev => ({
      ...prev,
      provinces: prev.provinces.includes(province)
        ? prev.provinces.filter(p => p !== province)
        : [...prev.provinces, province],
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              附加费管理
            </CardTitle>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              添加附加费
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {surcharges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无附加费规则
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>适用省份</TableHead>
                  <TableHead>重量范围</TableHead>
                  <TableHead>加收金额</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surcharges.map((surcharge) => (
                  <TableRow key={surcharge.id}>
                    <TableCell className="font-medium">{surcharge.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {surcharge.provinces.slice(0, 3).map(province => (
                          <Badge key={province} variant="secondary" className="text-xs">
                            {province}
                          </Badge>
                        ))}
                        {surcharge.provinces.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{surcharge.provinces.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {surcharge.weightFrom !== null || surcharge.weightTo !== null ? (
                        <span className="text-sm">
                          {surcharge.weightFrom !== null ? surcharge.weightFrom : '0'}kg
                          {' - '}
                          {surcharge.weightTo !== null ? surcharge.weightTo : '∞'}kg
                        </span>
                      ) : (
                        <span className="text-muted-foreground">全部重量</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-red-500">
                      +¥{parseFloat(surcharge.amount.toString()).toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(surcharge)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(surcharge.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSurcharge ? '编辑附加费' : '添加附加费'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>规则名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：北京上海加收"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>起始重量 (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.weightFrom}
                  onChange={(e) => setFormData({ ...formData, weightFrom: e.target.value })}
                  placeholder="不填表示无限制"
                />
              </div>
              <div className="space-y-2">
                <Label>结束重量 (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.weightTo}
                  onChange={(e) => setFormData({ ...formData, weightTo: e.target.value })}
                  placeholder="不填表示无限制"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>加收金额 (元)</Label>
              <Input
                type="number"
                  step="0.001"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.000"
              />
            </div>

            <div className="space-y-2">
              <Label>适用省份 ({formData.provinces.length} 个)</Label>
              <ScrollArea className="h-[200px] border rounded-md p-4">
                <div className="grid grid-cols-4 gap-3">
                  {ALL_PROVINCES.map((province) => (
                    <div key={province} className="flex items-center space-x-2">
                      <Checkbox
                        id={`surcharge-province-${province}`}
                        checked={formData.provinces.includes(province)}
                        onCheckedChange={() => handleToggleProvince(province)}
                      />
                      <label
                        htmlFor={`surcharge-province-${province}`}
                        className="text-sm cursor-pointer"
                      >
                        {province}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
