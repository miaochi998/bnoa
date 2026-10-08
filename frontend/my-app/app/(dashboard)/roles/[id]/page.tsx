'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api';
import { Role } from '@/types/role';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Shield,
  Settings,
  Calendar,
  Code,
  FileText,
  Loader2,
} from 'lucide-react';

export default function RoleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        setLoading(true);
        const roleData = await apiClient.getRole(roleId);
        setRole(roleData);
        
        const permissionData = await apiClient.getRolePermissions(roleId);
        setPermissions(permissionData.map((p: any) => p.name || p.code));
      } catch (error) {
        console.error('Failed to fetch role:', error);
      } finally {
        setLoading(false);
      }
    };

    if (roleId) {
      fetchRole();
    }
  }, [roleId]);

  const handleDelete = async () => {
    if (!confirm('确定要删除此角色吗？')) return;
    try {
      await apiClient.deleteRole(roleId);
      router.push('/roles');
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <Shield className="w-16 h-16 mb-4 opacity-50" />
        <p>角色不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/roles')}>
          返回角色列表
        </Button>
      </div>
    );
  }

  const isSuperAdmin = role.code === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/roles')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{role.name}</h1>
            <p className="text-muted-foreground mt-1">角色详情</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isSuperAdmin && (
            <>
              <Button variant="outline" onClick={() => router.push(`/roles/${roleId}/permissions`)}>
                <Settings className="w-4 h-4 mr-2" />
                权限配置
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                删除
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">角色名称</p>
                <p className="text-foreground font-medium">{role.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">角色编码</p>
                <code className="px-2 py-1 bg-muted rounded text-sm text-muted-foreground">
                  {role.code}
                </code>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">角色描述</p>
              <p className="text-foreground">{role.description || '暂无描述'}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  创建时间
                </p>
                <p className="text-foreground">{formatDate(role.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  更新时间
                </p>
                <p className="text-foreground">{formatDate(role.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              已分配权限
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSuperAdmin ? (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-primary mx-auto mb-3 opacity-60" />
                <p className="text-foreground font-medium">拥有所有权限</p>
                <p className="text-sm text-muted-foreground mt-1">
                  超级管理员自动跳过所有权限检查，无需手动配置
                </p>
              </div>
            ) : permissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>暂无权限</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => router.push(`/roles/${roleId}/permissions`)}
                >
                  配置权限
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permissions.map((perm, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {perm}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
