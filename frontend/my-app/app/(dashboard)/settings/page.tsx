'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { apiClient, getDefaultAvatarUrl } from '@/lib/api';
import { SystemConfig } from '@/types/config';
import { RealFolder } from '@/types/file';
import {
  Settings,
  Shield,
  HardDrive,
  Upload,
  Save,
  RotateCcw,
  Loader2,
  Globe,
  Lock,
  FileText,
  UserCircle,
  ImageIcon,
  Trash2,
} from 'lucide-react';

interface ConfigGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const CONFIG_GROUPS: ConfigGroup[] = [
  { key: 'system', label: '常规设置', icon: <Globe className="w-5 h-5" />, description: '系统基本信息配置' },
  { key: 'security', label: '安全配置', icon: <Shield className="w-5 h-5" />, description: '安全相关参数设置' },
  { key: 'avatar', label: '头像配置', icon: <UserCircle className="w-5 h-5" />, description: '用户头像上传与显示配置' },
];

interface ConfigItemProps {
  config: SystemConfig;
  value: string;
  onChange: (value: string) => void;
}

function ConfigItem({ config, value, onChange }: ConfigItemProps) {
  const isBooleanConfig = value === 'true' || value === 'false' || 
    config.key.includes('enabled') || config.key.includes('Enabled');
  
  const isNumberConfig = !isNaN(Number(value)) && value !== '' && 
    (config.key.includes('max') || config.key.includes('min') || 
     config.key.includes('size') || config.key.includes('timeout') ||
     config.key.includes('limit') || config.key.includes('days'));

  if (isBooleanConfig) {
    return (
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{config.description || config.key}</Label>
          <p className="text-xs text-muted-foreground">
            <code className="bg-muted px-1 rounded">{config.key}</code>
          </p>
        </div>
        <Switch
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          disabled={config.isSystem && config.isEncrypted}
        />
      </div>
    );
  }

  if (isNumberConfig) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{config.description || config.key}</Label>
          <code className="text-xs bg-muted px-1 rounded text-muted-foreground">{config.key}</code>
        </div>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background"
          disabled={config.isEncrypted}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{config.description || config.key}</Label>
        <code className="text-xs bg-muted px-1 rounded text-muted-foreground">{config.key}</code>
      </div>
      {config.isEncrypted ? (
        <Input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background"
          placeholder="••••••••"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background"
          placeholder={`请输入${config.description || config.key}`}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('system');
  const [hasChanges, setHasChanges] = useState(false);
  const [realFolders, setRealFolders] = useState<RealFolder[]>([]);
  const [defaultAvatarUploading, setDefaultAvatarUploading] = useState(false);
  const defaultAvatarInputRef = useRef<HTMLInputElement>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const [configResponse, folders] = await Promise.all([
        apiClient.getConfigs({}, { page: 1, pageSize: 100 }),
        apiClient.getRealFolders().catch(() => []),
      ]);
      const items = configResponse.items || [];
      setConfigs(items);
      setRealFolders(folders);
      
      const values: Record<string, string> = {};
      items.forEach((config: SystemConfig) => {
        values[config.id] = config.value;
      });
      setEditedValues(values);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleValueChange = (configId: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [configId]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const changedConfigs = configs.filter(
        config => editedValues[config.id] !== config.value
      );

      for (const config of changedConfigs) {
        await apiClient.updateConfig(config.id, {
          value: editedValues[config.id],
        });
      }

      alert(`已保存 ${changedConfigs.length} 项配置`);
      await fetchConfigs();
    } catch (error) {
      console.error('Failed to save configs:', error);
      console.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const values: Record<string, string> = {};
    configs.forEach(config => {
      values[config.id] = config.value;
    });
    setEditedValues(values);
    setHasChanges(false);
    console.log('已重置为上次保存的值');
  };

  const getConfigsByCategory = (category: string) => {
    return configs.filter(config => config.category === category);
  };

  // 根据 config key 获取 config 对象
  const getConfigByKey = (key: string) => {
    return configs.find(config => config.key === key);
  };

  // 根据 config key 获取当前编辑值
  const getValueByKey = (key: string) => {
    const config = getConfigByKey(key);
    return config ? (editedValues[config.id] ?? config.value) : '';
  };

  // 根据 config key 设置值
  const setValueByKey = (key: string, value: string) => {
    const config = getConfigByKey(key);
    if (config) {
      handleValueChange(config.id, value);
    }
  };

  // 默认头像上传
  const handleDefaultAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setDefaultAvatarUploading(true);
      const result = await apiClient.uploadDefaultAvatar(file);
      // 更新本地配置状态
      const config = getConfigByKey('avatar.defaultAvatar');
      if (config) {
        setEditedValues(prev => ({
          ...prev,
          [config.id]: result.defaultAvatar,
        }));
        config.value = result.defaultAvatar;
      }
      alert('默认头像上传成功');
      await fetchConfigs();
    } catch (err: any) {
      alert(err.message || '上传失败');
    } finally {
      setDefaultAvatarUploading(false);
      if (defaultAvatarInputRef.current) {
        defaultAvatarInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">系统配置</h1>
          <p className="text-muted-foreground mt-1">管理系统参数和配置项</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            重置
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存设置
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {CONFIG_GROUPS.map(group => {
          const count = getConfigsByCategory(group.key).length;
          return (
            <Card 
              key={group.key} 
              className={`bg-card border-border cursor-pointer transition-colors hover:bg-muted/50 ${activeTab === group.key ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setActiveTab(group.key)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  {group.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{group.label}</p>
                  <p className="text-xs text-muted-foreground">{count} 项配置</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          {CONFIG_GROUPS.map(group => (
            <TabsTrigger key={group.key} value={group.key} className="gap-2">
              {group.icon}
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CONFIG_GROUPS.map(group => {
          const groupConfigs = getConfigsByCategory(group.key);

          // 头像配置使用自定义渲染
          if (group.key === 'avatar') {
            return (
              <TabsContent key={group.key} value={group.key} className="mt-6 space-y-6">
                {/* 头像存储配置 */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <div>
                        <span>存储配置</span>
                        <p className="text-sm font-normal text-muted-foreground mt-0.5">
                          头像文件存储位置
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">存储位置</Label>
                        <Select
                          value={getValueByKey('avatar.storageType') || 'rustfs'}
                          onValueChange={(v) => setValueByKey('avatar.storageType', v)}
                        >
                          <SelectTrigger className="w-full bg-background border-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rustfs">S3 对象存储</SelectItem>
                            <SelectItem value="local">本地服务器</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          选择头像文件使用 RustFS 对象存储或本地服务器保存
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">存储文件夹</Label>
                        <Select
                          value={getValueByKey('avatar.realFolderId') || '__none__'}
                          onValueChange={(v) => setValueByKey('avatar.realFolderId', v === '__none__' ? '' : v)}
                        >
                          <SelectTrigger className="w-full bg-background border-input">
                            <SelectValue placeholder="选择存储文件夹" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              默认 (system/avatars)
                            </SelectItem>
                            {realFolders.map(folder => (
                              <SelectItem key={folder.id} value={folder.id}>
                                {folder.displayName} ({folder.pathName})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          选择头像文件的物理存储目录
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 头像限制配置 */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Settings className="w-5 h-5" />
                      </div>
                      <div>
                        <span>上传限制</span>
                        <p className="text-sm font-normal text-muted-foreground mt-0.5">
                          头像文件格式、大小和压缩设置
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupConfigs
                        .filter(c => !['avatar.realFolderId', 'avatar.defaultAvatar', 'avatar.storageType'].includes(c.key))
                        .map(config => (
                          <ConfigItem
                            key={config.id}
                            config={config}
                            value={editedValues[config.id] || ''}
                            onChange={(value) => handleValueChange(config.id, value)}
                          />
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 默认头像 */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <span>默认头像</span>
                        <p className="text-sm font-normal text-muted-foreground mt-0.5">
                          未设置头像的用户将显示此默认头像
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-6">
                      {/* 默认头像预览 */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                          {getValueByKey('avatar.defaultAvatar') ? (
                            <img
                              src={`${getDefaultAvatarUrl()}?t=${Date.now()}`}
                              alt="默认头像"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserCircle className="w-12 h-12 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => defaultAvatarInputRef.current?.click()}
                            disabled={defaultAvatarUploading}
                          >
                            {defaultAvatarUploading ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-1" />
                            )}
                            {getValueByKey('avatar.defaultAvatar') ? '更换' : '上传'}
                          </Button>
                          {getValueByKey('avatar.defaultAvatar') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setValueByKey('avatar.defaultAvatar', '')}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              移除
                            </Button>
                          )}
                        </div>
                        <input
                          ref={defaultAvatarInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          className="hidden"
                          onChange={handleDefaultAvatarUpload}
                        />
                      </div>
                      {/* 说明 */}
                      <div className="flex-1 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          当用户未上传个人头像时，将显示此处设置的默认头像。
                        </p>
                        <p className="text-sm text-muted-foreground">
                          如未设置默认头像，则显示用户名首字母。
                        </p>
                        <p className="text-xs text-muted-foreground">
                          建议上传正方形图片，支持 JPG、PNG、WebP 格式。
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          }

          return (
            <TabsContent key={group.key} value={group.key} className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      {group.icon}
                    </div>
                    <div>
                      <span>{group.label}</span>
                      <p className="text-sm font-normal text-muted-foreground mt-0.5">
                        {group.description}
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {groupConfigs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mb-3 opacity-50" />
                      <p>暂无 {group.label} 配置项</p>
                      <p className="text-sm mt-1">可通过后端添加配置</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupConfigs.map(config => (
                        <ConfigItem
                          key={config.id}
                          config={config}
                          value={editedValues[config.id] || ''}
                          onChange={(value) => handleValueChange(config.id, value)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">配置说明</p>
              <p className="text-sm text-muted-foreground mt-1">
                系统配置项由后端预定义，修改后需点击「保存设置」按钮生效。
                带有 <Lock className="w-3 h-3 inline" /> 标记的配置为系统核心配置，请谨慎修改。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
