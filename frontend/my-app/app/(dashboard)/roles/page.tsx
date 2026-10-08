'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleFormDialog } from '@/components/roles/RoleFormDialog';
import { apiClient } from '@/lib/api';
import { Role } from '@/types/role';
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Shield,
  Settings,
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRoles(pagination.page, pagination.pageSize);
      setRoles(response.nodes);
      setPagination({
        ...pagination,
        total: response.totalCount,
        totalPages: response.totalPages,
      });
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [pagination.page, pagination.pageSize]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此角色吗？')) return;
    try {
      await apiClient.deleteRole(id);
      fetchRoles();
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">角色权限</h1>
          <p className="text-muted-foreground mt-1">管理系统角色和权限配置</p>
        </div>
        <PermissionGate permission="role:create">
          <Button
            onClick={() => {
              setEditingRole(null);
              setDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增角色
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">角色总数</p>
                <p className="text-2xl font-semibold text-foreground">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Roles Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">角色列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">角色名称</TableHead>
                <TableHead className="text-muted-foreground">角色编码</TableHead>
                <TableHead className="text-muted-foreground">描述</TableHead>
                <TableHead className="text-muted-foreground">创建时间</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : !roles || roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} className="border-border">
                    <TableCell className="font-medium text-foreground">
                      {role.name}
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm text-muted-foreground">
                        {role.code}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(role.createdAt)}
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
                            onClick={() => router.push(`/roles/${role.id}`)}
                            className="cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          {role.code !== 'super_admin' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => router.push(`/roles/${role.id}/permissions`)}
                                className="cursor-pointer"
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                权限配置
                              </DropdownMenuItem>
                              <PermissionGate permission="role:update">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingRole(role);
                                    setDialogOpen(true);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  编辑
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate permission="role:delete">
                                <DropdownMenuItem
                                  onClick={() => handleDelete(role.id)}
                                  className="cursor-pointer text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  删除
                                </DropdownMenuItem>
                              </PermissionGate>
                            </>
                          )}
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
              共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Form Dialog */}
      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
        onSuccess={fetchRoles}
      />
    </div>
  );
}
