'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { 
  FolderTreeNodeWithShare, 
  SharePermission, 
  FolderShareRecord,
  ShareFolderRequest,
} from '@/types/file';
import { User } from '@/types/user';
import { Role } from '@/types/role';
import {
  Share2,
  Users,
  UserPlus,
  Trash2,
  Eye,
  Download,
  Upload,
  Pencil,
  Shield,
  Search,
  Loader2,
} from 'lucide-react';
import { Input } from '../ui/input';

interface FolderShareDialogProps {
  folder: FolderTreeNodeWithShare | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// 权限选项
const PERMISSION_OPTIONS: { value: SharePermission; label: string; description: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'VIEW', label: '查看', description: '可以查看文件列表', icon: Eye },
  { value: 'DOWNLOAD', label: '下载', description: '可以下载文件', icon: Download },
  { value: 'UPLOAD', label: '上传', description: '可以上传文件', icon: Upload },
  { value: 'EDIT', label: '编辑', description: '可以编辑文件', icon: Pencil },
  { value: 'DELETE', label: '删除', description: '可以删除文件', icon: Trash2 },
];

// 权限等级（用于展示）
const PERMISSION_LEVELS = {
  VIEW: 1,
  DOWNLOAD: 2,
  UPLOAD: 3,
  EDIT: 4,
  DELETE: 5,
};

export function FolderShareDialog({ folder, open, onOpenChange, onSuccess }: FolderShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shares, setShares] = useState<FolderShareRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<SharePermission[]>(['VIEW', 'DOWNLOAD']);
  const [userSearchKeyword, setUserSearchKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('add');

  // 加载数据
  useEffect(() => {
    if (open && folder) {
      fetchShares();
      fetchUsers();
      fetchRoles();
    }
  }, [open, folder]);

  const fetchShares = async () => {
    if (!folder) return;
    try {
      setLoading(true);
      const data = await apiClient.getFolderShares(folder.id);
      setShares(data.items);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiClient.getUsers({}, { page: 1, pageSize: 100 });
      setUsers(data.nodes || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await apiClient.getRoles();
      setRoles(data.nodes || []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    if (!userSearchKeyword) return true;
    return user.name?.includes(userSearchKeyword) || 
           user.username?.includes(userSearchKeyword) ||
           user.email?.includes(userSearchKeyword);
  });

  // 添加共享
  const handleShare = async () => {
    if (!folder) return;
    if (selectedUsers.length === 0 && selectedRoles.length === 0) {
      alert('请选择要共享的用户或角色');
      return;
    }
    if (selectedPermissions.length === 0) {
      alert('请选择权限');
      return;
    }

    try {
      setSaving(true);
      const request: ShareFolderRequest = {
        userIds: selectedUsers.length > 0 ? selectedUsers : undefined,
        roleIds: selectedRoles.length > 0 ? selectedRoles : undefined,
        permissions: selectedPermissions,
      };
      await apiClient.shareFolder(folder.id, request);
      
      // 重置选择
      setSelectedUsers([]);
      setSelectedRoles([]);
      
      // 刷新共享列表
      await fetchShares();
      
      // 切换到管理标签
      setActiveTab('manage');
      
      onSuccess?.();
    } catch (error) {
      console.error('Failed to share folder:', error);
      alert('共享失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 删除共享
  const handleRemoveShare = async (shareId: string) => {
    if (!folder) return;
    if (!confirm('确定要取消此共享吗？')) return;

    try {
      await apiClient.removeFolderShare(folder.id, shareId);
      await fetchShares();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to remove share:', error);
      alert('取消共享失败：' + (error as Error).message);
    }
  };

  // 更新共享权限
  const handleUpdatePermissions = async (shareId: string, permissions: SharePermission[]) => {
    if (!folder) return;

    try {
      await apiClient.updateFolderShare(folder.id, shareId, { permissions });
      await fetchShares();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update share:', error);
      alert('更新权限失败：' + (error as Error).message);
    }
  };

  // 切换权限
  const togglePermission = (permission: SharePermission) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission);
      } else {
        return [...prev, permission];
      }
    });
  };

  // 切换用户选择
  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // 切换角色选择
  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  // 渲染权限徽章
  const renderPermissionBadges = (permissions: SharePermission[]) => {
    return (
      <div className="flex flex-wrap gap-1">
        {permissions.sort((a, b) => PERMISSION_LEVELS[a] - PERMISSION_LEVELS[b]).map(p => {
          const option = PERMISSION_OPTIONS.find(o => o.value === p);
          if (!option) return null;
          const Icon = option.icon;
          return (
            <Badge key={p} variant="secondary" className="text-xs">
              <Icon className="w-3 h-3 mr-1" />
              {option.label}
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="w-5 h-5" />
            共享设置 - {folder?.name}
          </DialogTitle>
          <DialogDescription>
            设置谁可以访问此文件夹及其权限
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'add' | 'manage')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">
              <UserPlus className="w-4 h-4 mr-2" />
              添加共享
            </TabsTrigger>
            <TabsTrigger value="manage">
              <Users className="w-4 h-4 mr-2" />
              管理共享 ({shares.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4 py-4">
            {/* 选择用户 */}
            <div className="space-y-2">
              <Label className="text-foreground">选择用户</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户..."
                  value={userSearchKeyword}
                  onChange={(e) => setUserSearchKeyword(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="h-32 border rounded-md p-2 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    没有找到用户
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredUsers.map(user => (
                      <div
                        key={user.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted',
                          selectedUsers.includes(user.id) && 'bg-primary/10'
                        )}
                        onClick={() => toggleUser(user.id)}
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                        />
                        <span className="text-sm">{user.name || user.username}</span>
                        <span className="text-xs text-muted-foreground">@{user.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 选择角色 */}
            <div className="space-y-2">
              <Label className="text-foreground">选择角色</Label>
              <div className="h-24 border rounded-md p-2 overflow-y-auto">
                {roles.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    没有可用角色
                  </div>
                ) : (
                  <div className="space-y-1">
                    {roles.map(role => (
                      <div
                        key={role.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted',
                          selectedRoles.includes(role.id) && 'bg-primary/10'
                        )}
                        onClick={() => toggleRole(role.id)}
                      >
                        <Checkbox
                          checked={selectedRoles.includes(role.id)}
                        />
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{role.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 选择权限 */}
            <div className="space-y-2">
              <Label className="text-foreground">设置权限</Label>
              <div className="grid grid-cols-5 gap-2">
                {PERMISSION_OPTIONS.map(option => {
                  const Icon = option.icon;
                  const isSelected = selectedPermissions.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 border rounded-md cursor-pointer transition-colors',
                        isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      )}
                      onClick={() => togglePermission(option.value)}
                      title={option.description}
                    >
                      <Icon className={cn('w-5 h-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-xs', isSelected ? 'text-primary' : 'text-muted-foreground')}>
                        {option.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                提示：权限从低到高依次为 查看 → 下载 → 上传 → 编辑 → 删除
              </p>
            </div>

            <Button
              onClick={handleShare}
              disabled={saving || (selectedUsers.length === 0 && selectedRoles.length === 0)}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  共享中...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  确认共享
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="manage" className="py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : shares.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                此文件夹尚未共享给任何人
              </div>
            ) : (
              <div className="h-64 overflow-y-auto">
                <div className="space-y-3">
                  {shares.map(share => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {share.sharedWithUser ? (
                            <>
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {share.sharedWithUser.name || share.sharedWithUser.username}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                @{share.sharedWithUser.username}
                              </span>
                            </>
                          ) : share.sharedWithRole ? (
                            <>
                              <Shield className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {share.sharedWithRole.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                角色
                              </Badge>
                            </>
                          ) : null}
                        </div>
                        <div className="pl-6">
                          {renderPermissionBadges(share.permissions)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveShare(share.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
