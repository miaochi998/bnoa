'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
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
  FieldPermissionEditor,
  FieldPermissionEditorHandle,
} from '@/components/roles/FieldPermissionEditor';
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Shield,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Eye,
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
  const [activeTab, setActiveTab] = useState<'function' | 'field'>('function');
  const fieldEditorRef = useRef<FieldPermissionEditorHandle>(null);
  const [fieldDirty, setFieldDirty] = useState(false);
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

  /** 立即刷新服务端权限缓存（兜底：正常情况下保存后会自动生效） */
  const handleRefreshCache = async () => {
    try {
      const r = await apiClient.refreshPermissionCache();
      toast.success(`权限缓存已刷新（清理 ${r.cleared} 条记录）`);
    } catch (e: any) {
      toast.error(e?.message || '刷新失败');
    }
  };

  /** 统一保存入口：功能权限走本页逻辑，信息权限交给子组件 */
  const handleSaveUnified = async () => {
    if (activeTab === 'field') {
      await fieldEditorRef.current?.save();
    } else {
      await handleSave();
    }
  };

  /** 顶层节点下的全部后代（用于平铺展示） */
  const flattenDescendants = (node: PermissionTreeNode): PermissionTreeNode[] => {
    const out: PermissionTreeNode[] = [];
    const walk = (n: PermissionTreeNode) => {
      for (const c of n.children ?? []) {
        out.push(c);
        walk(c);
      }
    };
    walk(node);
    return out;
  };

  /** 整组勾选 / 取消 */
  const handleSelectGroup = (nodes: PermissionTreeNode[], on: boolean) => {
    const ids = nodes.map((n) => n.id);
    setSelectedPermissions((prev) =>
      on
        ? Array.from(new Set([...prev, ...ids]))
        : prev.filter((id) => !ids.includes(id)),
    );
  };

  /** 该角色已开启的功能权限码（供信息权限判断前置功能） */
  const selectedCodes = useMemo(() => {
    const idToCode = new Map<string, string>();
    const walk = (nodes: PermissionTreeNode[]) => {
      for (const n of nodes) {
        idToCode.set(n.id, n.code);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(permissionTree);
    return new Set(
      selectedPermissions
        .map((id) => idToCode.get(id))
        .filter((c): c is string => !!c),
    );
  }, [permissionTree, selectedPermissions]);

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
      {/* 顶部：标题 + 保存 */}
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
      </div>

      {/* 角色信息：一行展示 */}
      <Card className="bg-card border-border">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-foreground font-medium">{role.name}</span>
            </span>
            <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {role.code}
            </code>
            <span className="text-sm text-muted-foreground">
              {role.description || '无描述'}
            </span>
            <span className="ml-auto text-sm text-muted-foreground">
              已选功能权限{' '}
              <span className="text-primary font-semibold">{selectedPermissions.length}</span> 项
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 标签页 */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
        {[
          { key: 'function' as const, label: '功能权限配置', icon: CheckSquare },
          { key: 'field' as const, label: '信息权限配置', icon: Eye },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-md transition-colors duration-200 cursor-pointer border-b-2 -mb-px ${
                active
                  ? 'text-primary border-primary bg-primary/5'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
        </div>
        <div className="flex items-center gap-2 mb-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshCache}
          title="让权限变更立即对所有用户生效（正常情况下保存后已自动生效）"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新权限缓存
        </Button>
        <Button
          onClick={handleSaveUnified}
          disabled={saving || (activeTab === 'field' && !fieldDirty)}
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '保存配置'}
        </Button>
        </div>
      </div>

      {activeTab === 'function' ? (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">能做什么（功能与操作）</CardTitle>
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
              <div className="text-center py-8 text-muted-foreground">暂无权限数据</div>
            ) : (
              <div className="border border-border rounded-md divide-y divide-border">
                {permissionTree.map((node, idx) => {
                  const children = flattenDescendants(node);
                  const all = [node, ...children];
                  const selCount = all.filter((n) =>
                    selectedPermissions.includes(n.id),
                  ).length;
                  const curCategory = (node as any).category as string | undefined;
                  const prevCategory =
                    idx > 0
                      ? ((permissionTree[idx - 1] as any).category as string | undefined)
                      : null;
                  return (
                    <div key={node.id}>
                      {curCategory && curCategory !== prevCategory && (
                        <div className="px-3 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground">
                          {(node as any).categoryLabel || curCategory}
                        </div>
                      )}
                      <div className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedPermissions.includes(node.id)}
                          onCheckedChange={() => handlePermissionToggle(node.id)}
                        />
                        <span className="text-foreground font-medium">{node.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {selCount}/{all.length}
                        </span>
                        <div className="ml-auto flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectGroup(all, true)}
                          >
                            全选
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectGroup(all, false)}
                          >
                            清空
                          </Button>
                        </div>
                      </div>
                      {children.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 pl-7">
                          {children.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 cursor-pointer min-w-[150px]"
                            >
                              <Checkbox
                                checked={selectedPermissions.includes(c.id)}
                                onCheckedChange={() => handlePermissionToggle(c.id)}
                              />
                              <span className="text-sm text-muted-foreground">
                                {c.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" />
                {saving ? '保存中...' : '保存配置'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              能看、能改哪些信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldPermissionEditor
              ref={fieldEditorRef}
              roleId={roleId}
              isSuperAdminRole={role.code === 'super_admin'}
              selectedCodes={selectedCodes}
              onDirtyChange={setFieldDirty}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
