'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Copy, RotateCcw, DollarSign } from 'lucide-react';
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

interface Zone {
  id: string;
  name: string;
  sortOrder: number;
}

interface WeightRange {
  id: string;
  label: string;
  minWeight: number;
  maxWeight: number;
  sortOrder: number;
}

interface PriceMatrixPanelProps {
  companyId: string;
  companyName: string;
  onCopyFrom?: (sourceCompanyId: string) => void;
}

export function PriceMatrixPanel({ companyId, companyName }: PriceMatrixPanelProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [weightRanges, setWeightRanges] = useState<WeightRange[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [editedMatrix, setEditedMatrix] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedSourceCompany, setSelectedSourceCompany] = useState('');
  const [copying, setCopying] = useState(false);

  // 加载价格矩阵
  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getExpressPriceMatrix(companyId);
      setZones(data.zones);
      setWeightRanges(data.weightRanges);
      setMatrix(data.matrix);
      setEditedMatrix(JSON.parse(JSON.stringify(data.matrix)));
      setHasChanges(false);
    } catch (error: any) {
      alert('加载价格矩阵失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // 加载快递公司列表（用于复制）
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await apiClient.getExpressCompaniesForSelect();
        setCompanies(data.filter(c => c.id !== companyId));
      } catch (error) {
        console.error('加载快递公司列表失败:', error);
      }
    };
    loadCompanies();
  }, [companyId]);

  // 更新价格
  const handlePriceChange = (zoneId: string, weightRangeId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedMatrix(prev => ({
      ...prev,
      [zoneId]: {
        ...prev[zoneId],
        [weightRangeId]: numValue,
      },
    }));
    setHasChanges(true);
  };

  // 保存价格
  const handleSave = async () => {
    setSaving(true);
    try {
      const prices: { zoneId: string; weightRangeId: string; price: number }[] = [];
      
      zones.forEach(zone => {
        weightRanges.forEach(weightRange => {
          const price = editedMatrix[zone.id]?.[weightRange.id] || 0;
          prices.push({
            zoneId: zone.id,
            weightRangeId: weightRange.id,
            price,
          });
        });
      });

      await apiClient.batchUpdateExpressPrices(companyId, { prices });
      alert('保存成功');
      setMatrix(JSON.parse(JSON.stringify(editedMatrix)));
      setHasChanges(false);
    } catch (error: any) {
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 重置
  const handleReset = () => {
    setEditedMatrix(JSON.parse(JSON.stringify(matrix)));
    setHasChanges(false);
  };

  // 复制价格配置
  const handleCopy = async () => {
    if (!selectedSourceCompany) return;

    setCopying(true);
    try {
      await apiClient.copyExpressPrices(companyId, { sourceCompanyId: selectedSourceCompany });
      alert('复制成功');
      setCopyDialogOpen(false);
      loadMatrix();
    } catch (error: any) {
      alert('复制失败: ' + error.message);
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              价格矩阵
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCopyDialogOpen(true)}
              >
                <Copy className="w-4 h-4 mr-1" />
                复制配置
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                重置
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || saving}
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">区域 \ 重量</TableHead>
                  {weightRanges.map(wr => (
                    <TableHead key={wr.id} className="text-center min-w-[100px]">
                      <div className="text-xs text-muted-foreground">{wr.label}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map(zone => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    {weightRanges.map(weightRange => (
                      <TableCell key={weightRange.id} className="p-2">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={editedMatrix[zone.id]?.[weightRange.id] || 0}
                          onChange={(e) => handlePriceChange(zone.id, weightRange.id, e.target.value)}
                          className="w-24 text-center"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasChanges && (
            <div className="mt-4 text-sm text-amber-500">
              * 有未保存的更改
            </div>
          )}
        </CardContent>
      </Card>

      {/* 复制配置对话框 */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>复制价格配置</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              从其他快递公司复制价格配置到 "{companyName}"
            </p>
            <Select value={selectedSourceCompany} onValueChange={setSelectedSourceCompany}>
              <SelectTrigger>
                <SelectValue placeholder="选择源快递公司" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleCopy} 
              disabled={!selectedSourceCompany || copying}
            >
              {copying ? '复制中...' : '确认复制'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
