'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserFormDialog } from '@/components/users/UserFormDialog';
import { apiClient, getAvatarUrl, getDefaultAvatarUrl } from '@/lib/api';
import { User, UserStatus } from '@/types/user';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Key,
  Users,
  RotateCcw,
  Ban,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';
import { DictTag } from '@/components/shared/DictTag';
import { DictSelect } from '@/components/shared/DictSelect';

type SortOption = 'default' | 'createdAt_desc' | 'createdAt_asc' | 'lastLoginAt_desc' | 'lastLoginAt_asc';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<UserStatus | 'all'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('abc123456');
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const [sortBy, sortOrder] = sortOption && sortOption !== 'default' ? sortOption.split('_') as ['createdAt' | 'lastLoginAt', 'asc' | 'desc'] : [undefined, undefined];
      
      const response = await apiClient.getUsers(
        {
          keyword: keyword || undefined,
          status: status === 'all' ? undefined : status,
          sortBy,
          sortOrder,
        },
        {
          page: pagination.page,
          pageSize: pagination.pageSize,
        }
      );
      setUsers(response.nodes);
      setPagination(prev => ({
        ...prev,
        total: response.totalCount,
        totalPages: response.totalPages,
      }));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [keyword, status, sortOption, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, status, sortOption]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchUsers();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const handleReset = () => {
    setKeyword('');
    setStatus('all');
    setSortOption('default');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(users.map(u => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBatchSuspend = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要禁用选中的 ${selectedIds.size} 个用户吗？`)) return;
    try {
      await apiClient.batchSuspendUsers(Array.from(selectedIds));
      fetchUsers();
    } catch (error) {
      console.error('Failed to batch suspend users:', error);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个用户吗？`)) return;
    try {
      await apiClient.batchDeleteUsers(Array.from(selectedIds));
      fetchUsers();
    } catch (error) {
      console.error('Failed to batch delete users:', error);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === UserStatus.ACTIVE ? 'SUSPENDED' : 'ACTIVE';
      await apiClient.toggleUserStatus(user.id, newStatus);
      fetchUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await apiClient.deleteUser(userToDelete.id);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword || !newPassword) return;
    try {
      await apiClient.resetUserPassword(userToResetPassword.id, newPassword);
      setResetPasswordDialogOpen(false);
      setUserToResetPassword(null);
      setNewPassword('');
    } catch (error) {
      console.error('Failed to reset password:', error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const isAllSelected = users.length > 0 && selectedIds.size === users.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < users.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">用户管理</h1>
          <p className="text-muted-foreground mt-1">管理系统用户账号和权限</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              apiClient.createExport({ module: 'user', format: 'xlsx' })
                .then(res => {
                  if (res.data?.async) {
                    alert('数据量较大，导出任务已提交，完成后将通过通知提醒。');
                  } else if (res.data?.taskId) {
                    window.open(
                      apiClient.getExportDownloadUrl(res.data.taskId),
                      '_blank',
                    );
                  }
                })
                .catch(() => alert('导出失败'));
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <PermissionGate permission="user:create">
            <Button
              onClick={() => {
                setEditingUser(null);
                setDialogOpen(true);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              新增用户
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Card */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总用户数</p>
              <p className="text-2xl font-semibold text-foreground">{pagination.total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters - All in one row */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input - Real-time search without button */}
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名、姓名、邮箱..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-10 bg-background border-input"
              />
            </div>

            {/* Status Filter */}
            <DictSelect
              typeCode="user_status"
              value={status}
              onChange={(value) => setStatus(value as UserStatus | 'all')}
              showAll
              allLabel="全部"
              allValue="all"
              placeholder="账户状态"
              className="w-[120px] bg-background border-input"
            />

            {/* Sort Options */}
            <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
              <SelectTrigger className="w-[160px] bg-background border-input">
                <SelectValue placeholder="默认排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认排序</SelectItem>
                <SelectItem value="createdAt_desc">注册时间降序</SelectItem>
                <SelectItem value="createdAt_asc">注册时间升序</SelectItem>
                <SelectItem value="lastLoginAt_desc">最后登录降序</SelectItem>
                <SelectItem value="lastLoginAt_asc">最后登录升序</SelectItem>
              </SelectContent>
            </Select>

            {/* Batch Operations */}
            {selectedIds.size > 0 && (
              <>
                <PermissionGate permission="user:batch-suspend">
                  <Button variant="outline" size="sm" onClick={handleBatchSuspend}>
                    <Ban className="w-4 h-4 mr-1" />
                    批量禁用 ({selectedIds.size})
                  </Button>
                </PermissionGate>
                <PermissionGate permission="user:batch-delete">
                  <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    批量删除 ({selectedIds.size})
                  </Button>
                </PermissionGate>
              </>
            )}

            {/* Reset Button */}
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="全选"
                  />
                </TableHead>
                <TableHead className="text-muted-foreground w-16">头像</TableHead>
                <TableHead className="text-muted-foreground">用户名</TableHead>
                <TableHead className="text-muted-foreground">邮箱</TableHead>
                <TableHead className="text-muted-foreground">姓名</TableHead>
                <TableHead className="text-muted-foreground">手机</TableHead>
                <TableHead className="text-muted-foreground">角色</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground w-20">启用</TableHead>
                <TableHead className="text-muted-foreground">注册时间</TableHead>
                <TableHead className="text-muted-foreground">最后登录</TableHead>
                <TableHead className="text-muted-foreground text-right w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-16 text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="border-border">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onCheckedChange={(checked) => handleSelectOne(user.id, checked as boolean)}
                        aria-label={`选择 ${user.username}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(user.id, user.avatar) || getDefaultAvatarUrl()} alt={user.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(user.name || user.username)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {user.username}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-foreground">{user.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{user.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? user.roles.map((role, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        )) : <span className="text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DictTag typeCode="user_status" value={user.status} />
                    </TableCell>
                    <TableCell>
                      <PermissionGate permission={user.status === UserStatus.ACTIVE ? "user:suspend" : "user:activate"}>
                        <Switch
                          checked={user.status === UserStatus.ACTIVE}
                          onCheckedChange={() => handleToggleStatus(user)}
                          disabled={user.status === UserStatus.DELETED}
                        />
                      </PermissionGate>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          <DropdownMenuItem
                            onClick={() => router.push(`/users/${user.id}`)}
                            className="cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          <PermissionGate permission="user:update">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingUser(user);
                                setDialogOpen(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                          </PermissionGate>
                          <PermissionGate permission="user:reset-password">
                            <DropdownMenuItem
                              onClick={() => {
                                setUserToResetPassword(user);
                                setResetPasswordDialogOpen(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Key className="mr-2 h-4 w-4" />
                              重置密码
                            </DropdownMenuItem>
                          </PermissionGate>
                          <DropdownMenuSeparator />
                          <PermissionGate permission={user.status === UserStatus.ACTIVE ? "user:suspend" : "user:activate"}>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(user)}
                              className="cursor-pointer"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              {user.status === UserStatus.ACTIVE ? '禁用账户' : '启用账户'}
                            </DropdownMenuItem>
                          </PermissionGate>
                          <PermissionGate permission="user:delete">
                            <DropdownMenuItem
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteDialogOpen(true);
                              }}
                              className="cursor-pointer text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除用户
                            </DropdownMenuItem>
                          </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages || 1} 页
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                下一页
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Form Dialog */}
      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        onSuccess={fetchUsers}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户 "{userToDelete?.username}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={(open) => {
        setResetPasswordDialogOpen(open);
        if (!open) {
          setNewPassword('abc123456');
          setShowPassword(false);
        }
      }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>重置密码</AlertDialogTitle>
            <AlertDialogDescription>
              为用户 "{userToResetPassword?.username}" 设置新密码（默认密码：abc123456）
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-background border-input pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setNewPassword('abc123456');
              setShowPassword(false);
            }}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={!newPassword}>
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
