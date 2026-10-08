'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { PermissionTreeNode, PermissionType } from '@/types/permission';
import { DictTag } from '@/components/shared/DictTag';
import { toast } from 'sonner';
import {
  Key,
  ChevronRight,
  ChevronDown,
  Loader2,
  Shield,
  FileText,
  RefreshCw,
} from 'lucide-react';

interface TreeNodeProps {
  node: PermissionTreeNode;
  level?: number;
}

function TreeNodeComponent({ node, level = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-3 py-2.5 px-4 rounded-md hover:bg-muted/50 transition-colors border-b border-border/50"
        style={{ paddingLeft: `${level * 24 + 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-muted rounded transition-colors"
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

        <div className="flex-1 flex items-center gap-3">
          <span className="text-foreground font-medium">{node.name}</span>
          <code className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
            {node.code}
          </code>
        </div>

        <DictTag typeCode="permission_type" value={node.type} />

        {node.description && (
          <span className="text-sm text-muted-foreground max-w-[200px] truncate">
            {node.description}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child: PermissionTreeNode) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countPermissions(nodes: PermissionTreeNode[]): number {
  let count = 0;
  nodes.forEach((node) => {
    count += 1;
    if (node.children) {
      count += countPermissions(node.children);
    }
  });
  return count;
}

export default function PermissionsPage() {
  const [permissionTree, setPermissionTree] = useState<PermissionTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const fetchPermissionTree = useCallback(async () => {
    try {
      setLoading(true);
      const tree = await apiClient.getPermissionTree();
      setPermissionTree(tree);
      setTotalCount(countPermissions(tree));
    } catch (error) {
      console.error('Failed to fetch permission tree:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissionTree();
  }, [fetchPermissionTree]);

  const handleSyncPermissions = async () => {
    try {
      setSyncing(true);
      const result = await apiClient.syncPermissions();
      toast.success(`权限已同步，当前共 ${result.total} 条（新增 ${result.added}，更新 ${result.updated}）`);
      await fetchPermissionTree();
    } catch (error: any) {
      toast.error(error?.message || '请使用超级管理员账号重试');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">权限管理</h1>
          <p className="text-muted-foreground mt-1">查看系统权限树结构</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncPermissions}
          disabled={syncing || loading}
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          同步权限
        </Button>
      </div>

      {/* Stats Card */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">权限总数</p>
              <p className="text-2xl font-semibold text-foreground">{totalCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">关于权限管理</p>
              <p className="text-sm text-muted-foreground mt-1">
                系统权限由开发人员预定义，用于控制用户对各功能模块的访问。
                权限分配请在「角色权限」页面中进行配置。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Tree */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            权限树
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : permissionTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Key className="w-16 h-16 mb-4 opacity-50" />
              <p>暂无权限数据</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 py-2.5 px-4 bg-muted/50 border-b border-border font-medium text-sm text-muted-foreground">
                <span className="w-6" />
                <span className="flex-1">权限名称 / 编码</span>
                <span className="w-16 text-center">类型</span>
                <span className="w-[200px]">描述</span>
              </div>
              {/* Tree */}
              {permissionTree.map((node) => (
                <TreeNodeComponent key={node.id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
