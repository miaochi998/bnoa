'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Settings, Loader2, Save } from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';

interface RealFolder {
  id: string;
  displayName: string;
  pathName: string;
}

export default function NumberCheckSettingsPage() {
  const [maxSize, setMaxSize] = useState<string>('50');
  const [realFolderId, setRealFolderId] = useState<string>('none');
  const [storageMode, setStorageMode] = useState<string>('local');
  const [realFolders, setRealFolders] = useState<RealFolder[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, folders] = await Promise.all([
          apiClient.numberCheckGetConfig(),
          apiClient.getRealFolders(),
        ]);
        setMaxSize(String(cfg?.maxSize ?? 50));
        setRealFolderId(cfg?.realFolderId || 'none');
        setStorageMode(cfg?.storageMode || 'local');
        setRealFolders(folders || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.numberCheckUpdateConfig({
        maxSize: Number(maxSize) || undefined,
        realFolderId: realFolderId === 'none' ? undefined : realFolderId,
        storageMode: storageMode as 'local' | 'rustfs',
      });
      toast.success('设置已保存');
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">编号查重设置</h1>
          <p className="text-sm text-muted-foreground">配置上传大小限制与存储位置</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">上传配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>上传文件大小限制（MB）</Label>
              <Input
                type="number"
                min={1}
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-1">
              <Label>上传存储模式</Label>
              <Select value={storageMode} onValueChange={setStorageMode}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">本地存储</SelectItem>
                  <SelectItem value="rustfs">RUSTFS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>上传存储位置</Label>
              <Select value={realFolderId} onValueChange={setRealFolderId}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="使用系统默认存储位置" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">使用系统默认</SelectItem>
                  {realFolders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.displayName}（{f.pathName}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PermissionGate permission="number-check:config">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                保存设置
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
