'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api';
import { Role } from '@/types/role';
import { Permission, PermissionTreeNode, PermissionType } from '@/types/permission';
import { DictTag } from '@/components/shared/DictTag';
import {
  ArrowLeft,
  Save,
  Shield,
  CheckSquare,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface TreeNodeProps {
  node: PermissionTreeNode;
  selectedIds: string[];
  onToggle: (id: string) => void;
  level?: number;
}

function TreeNodeComponent({ node, selectedIds, onToggle, level = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedIds.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-muted rounded"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        )}

        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(node.id)}
        />

        <span className="flex-1 text-foreground font-medium">{node.name}</span>

        <code className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
          {node.code}
        </code>

        <DictTag typeCode="permission_type" value={node.type} />
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child: PermissionTreeNode) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getAllPermissionIds(nodes: PermissionTreeNode[]): string[] {
  const ids: string[] = [];
  nodes.forEach((node) => {
    ids.push(node.id);
    if (node.children) {
      ids.push(...getAllPermissionIds(node.children));
    }
  });
  return ids;
}

function getChildPermissionIds(node: PermissionTreeNode): string[] {
  const ids: string[] = [];
  if (node.children) {
    node.children.forEach((child) => {
      ids.push(child.id);
      ids.push(...getChildPermissionIds(child));
    });
  }
  return ids;
}

function findNodeById(nodes: PermissionTreeNode[], id: string): PermissionTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export default function RolePermissionsPage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;

  const [role, setRole] = useState<Role | null>(null);
  const [permissionTree, setPermissionTree] = useState<PermissionTreeNode[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [roleData, treeData, rolePermissions] = await Promise.all([
          apiClient.getRole(roleId),
          apiClient.getPermissionTree(),
          apiClient.getRolePermissions(roleId),
        ]);
        setRole(roleData);
        setPermissionTree(treeData);
        setSelectedPermissions(rolePermissions.map((p: Permission) => p.id));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (roleId) {
      fetchData();
    }
  }, [roleId]);

  const handlePermissionToggle = (permissionId: string) => {
    const node = findNodeById(permissionTree, permissionId);
    if (!node) return;

    const childIds = getChildPermissionIds(node);
    const allRelatedIds = [permissionId, ...childIds];

    setSelectedPermissions((prev) => {
      const isCurrentlySelected = prev.includes(permissionId);
      if (isCurrentlySelected) {
        // 取消选中：移除当前节点和所有子节点
        return prev.filter((id) => !allRelatedIds.includes(id));
      } else {
        // 选中：添加当前节点和所有子节点
        const newSet = new Set([...prev, ...allRelatedIds]);
        return Array.from(newSet);
      }
    });
  };

  const handleSelectAll = () => {
    const allIds = getAllPermissionIds(permissionTree);
    setSelectedPermissions(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedPermissions([]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.assignRolePermissions(roleId, selectedPermissions);
      alert('权限配置保存成功');
    } catch (error) {
      console.error('Failed to save permissions:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">角色不存在</p>
      </div>
    );
  }

  // 超级管理员角色保护
  if (role.code === 'super_admin') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/roles')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">权限配置</h1>
            <p className="text-muted-foreground mt-1">角色：{role.name}</p>
          </div>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Shield className="w-16 h-16 text-primary mx-auto mb-4 opacity-60" />
            <h2 className="text-xl font-semibold text-foreground mb-2">拥有所有权限</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              超级管理员角色为系统内置角色，自动拥有所有权限，无需手动配置。
              权限守卫在检测到 super_admin 角色时会自动跳过所有权限检查。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/roles')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">权限配置</h1>
            <p className="text-muted-foreground mt-1">
              为角色 <span className="text-foreground font-medium">{role.name}</span> 配置权限
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '保存配置'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Info Card */}
        <Card className="bg-card border-border lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              角色信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">角色名称</p>
              <p className="text-foreground font-medium">{role.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">角色编码</p>
              <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                {role.code}
              </code>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">描述</p>
              <p className="text-foreground">{role.description || '无'}</p>
            </div>
            <Separator className="bg-border" />
            <div>
              <p className="text-sm text-muted-foreground">已选权限</p>
              <p className="text-2xl font-semibold text-primary">{selectedPermissions.length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Tree Card */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                权限列表
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  全选
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  取消全选
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {permissionTree.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无权限数据
              </div>
            ) : (
              <div className="border border-border rounded-md">
                {permissionTree.map((node) => (
                  <TreeNodeComponent
                    key={node.id}
                    node={node}
                    selectedIds={selectedPermissions}
                    onToggle={handlePermissionToggle}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
