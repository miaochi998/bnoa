'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Save, RotateCcw } from 'lucide-react';

interface Zone {
  id: string;
  name: string;
  sortOrder: number;
  provinces: string[];
}

interface ZoneConfigPanelProps {
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

export function ZoneConfigPanel({ companyId }: ZoneConfigPanelProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);

  // 加载区域配置
  useEffect(() => {
    loadZones();
  }, [companyId]);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getExpressZones(companyId);
      setZones(data);
      if (data.length > 0 && !selectedZone) {
        setSelectedZone(data[0]);
        setSelectedProvinces(data[0].provinces);
      }
    } catch (error: any) {
      alert('加载区域配置失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 计算已被其他区域占用的省份
  const occupiedProvinces = useMemo(() => {
    const map = new Map<string, string>();
    zones.forEach((zone) => {
      if (zone.id !== selectedZone?.id) {
        zone.provinces.forEach((p) => map.set(p, zone.name));
      }
    });
    return map;
  }, [zones, selectedZone]);

  // 选择区域
  const handleSelectZone = (zone: Zone) => {
    setSelectedZone(zone);
    setSelectedProvinces(zone.provinces);
  };

  // 切换省份选择
  const handleToggleProvince = (province: string) => {
    setSelectedProvinces(prev => {
      if (prev.includes(province)) {
        return prev.filter(p => p !== province);
      }
      return [...prev, province];
    });
  };

  // 保存区域配置
  const handleSave = async () => {
    if (!selectedZone) return;

    setSaving(true);
    try {
      await apiClient.updateExpressZone(selectedZone.id, {
        provinces: selectedProvinces,
      });
      alert('保存成功');
      loadZones();
    } catch (error: any) {
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 重置
  const handleReset = () => {
    if (selectedZone) {
      setSelectedProvinces(selectedZone.provinces);
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
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            区域配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* 区域列表 */}
            <div className="w-48 space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">选择区域</h4>
              {zones.map((zone) => (
                <Button
                  key={zone.id}
                  variant={selectedZone?.id === zone.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleSelectZone(zone)}
                >
                  <span className="flex-1 text-left">{zone.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {zone.provinces.length}
                  </Badge>
                </Button>
              ))}
            </div>

            {/* 省份选择 */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {selectedZone ? `${selectedZone.name} - 包含省份` : '选择省份'}
                </h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={!selectedZone}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    重置
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!selectedZone || saving}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedZone}
                  onClick={() => {
                    const available = ALL_PROVINCES.filter(p => !occupiedProvinces.has(p));
                    setSelectedProvinces(available);
                  }}
                >
                  全选
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedZone}
                  onClick={() => {
                    const available = ALL_PROVINCES.filter(p => !occupiedProvinces.has(p));
                    setSelectedProvinces(prev => {
                      const newSelection: string[] = [];
                      available.forEach(p => {
                        if (!prev.includes(p)) {
                          newSelection.push(p);
                        }
                      });
                      return newSelection;
                    });
                  }}
                >
                  反选
                </Button>
              </div>

              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="grid grid-cols-4 gap-3">
                  {ALL_PROVINCES.map((province) => (
                    <div key={province} className="flex items-center space-x-2">
                      <Checkbox
                        id={`province-${province}`}
                        checked={selectedProvinces.includes(province)}
                        onCheckedChange={() => handleToggleProvince(province)}
                        disabled={!selectedZone || occupiedProvinces.has(province)}
                      />
                      <label
                        htmlFor={`province-${province}`}
                        className={`text-sm ${occupiedProvinces.has(province) ? 'text-muted-foreground/50 line-through cursor-not-allowed' : 'cursor-pointer'}`}
                        title={occupiedProvinces.has(province) ? `已被「${occupiedProvinces.get(province)}」占用` : undefined}
                      >
                        {province}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-4 text-sm text-muted-foreground">
                已选择 {selectedProvinces.length} 个省份
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
