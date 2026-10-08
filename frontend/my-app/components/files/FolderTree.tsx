'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { Folder, FolderTreeNode, RealFolder, FolderTreeNodeWithShare, SharePermission, CreateSystemSharedFolderRequest, FOLDER_SCOPE_IDS } from '@/types/file';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  FolderPlus,
  Home,
  Link2,
  PartyPopper,
  Palette,
  Image,
  Video,
  FileText,
  Briefcase,
  Tag,
  Star,
  Share2,
  Users,
  Building2,
  Eye,
  Download,
  Upload,
  Pencil,
} from 'lucide-react';

interface FolderTreeProps {
  selectedFolderId?: string;
  onSelectFolder: (folderId: string | undefined, permissions?: SharePermission[], folderName?: string, isSystemShared?: boolean) => void;
  onRefresh?: () => void;
  onShareFolder?: (folder: FolderTreeNodeWithShare) => void;
  isAdmin?: boolean;
  refreshKey?: number;
}

interface TreeNodeProps {
  folder: FolderTreeNodeWithShare;
  level: number;
  selectedFolderId?: string;
  onSelectFolder: (folderId: string | undefined, permissions?: SharePermission[], folderName?: string, isSystemShared?: boolean) => void;
  onCreateSubfolder: (parentId: string) => void;
  onRename: (folder: Folder) => void;
  onUpdateMapping: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onShareFolder?: (folder: FolderTreeNodeWithShare) => void;
  isShared?: boolean;
  shareType?: 'user' | 'system';
  isAdmin?: boolean;
}

// 权限图标映射
const PERMISSION_ICONS: Record<SharePermission, React.FC<{ className?: string }>> = {
  VIEW: Eye,
  DOWNLOAD: Download,
  UPLOAD: Upload,
  EDIT: Pencil,
  DELETE: Trash2,
};

// 权限名称映射
const PERMISSION_LABELS: Record<SharePermission, string> = {
  VIEW: '查看',
  DOWNLOAD: '下载',
  UPLOAD: '上传',
  EDIT: '编辑',
  DELETE: '删除',
};

function TreeNode({
  folder,
  level,
  selectedFolderId,
  onSelectFolder,
  onCreateSubfolder,
  onRename,
  onUpdateMapping,
  onDelete,
  onShareFolder,
  isShared = false,
  shareType,
  isAdmin = false,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;
  const isOwner = folder.isOwner ?? true;
  // 系统共享文件夹只有管理员能管理，普通用户不能管理
  const canManageFolder = shareType === 'system' ? isAdmin : isOwner;
  const canEdit = isOwner || folder.permissions?.includes('EDIT');
  const canDelete = isOwner || folder.permissions?.includes('DELETE');

  // 根据共享类型选择图标颜色
  const getFolderIconClass = () => {
    if (isSelected) return 'text-primary';
    if (shareType === 'system') return 'text-blue-500';
    if (shareType === 'user') return 'text-green-500';
    return 'text-muted-foreground';
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors duration-150',
              'hover:bg-muted/50',
              isSelected && 'bg-primary/10 text-primary'
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => onSelectFolder(folder.id, folder.permissions, folder.name, shareType === 'system')}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="p-0.5 hover:bg-muted rounded"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}

            {expanded && hasChildren ? (
              <FolderOpen className={cn('w-4 h-4', getFolderIconClass())} />
            ) : (
              <FolderIcon className={cn('w-4 h-4', getFolderIconClass())} />
            )}

            <span className={cn('flex-1 text-sm truncate', isSelected ? 'text-primary font-medium' : 'text-foreground')}>
              {folder.name}
              {/* 共享给我的文件夹显示共享人 */}
              {isShared && shareType === 'user' && !isOwner && folder.creator && (
                <span className="text-muted-foreground font-normal">
                  ({folder.creator.name || folder.creator.username})
                </span>
              )}
            </span>

            {/* 共享标识 */}
            {((isShared && !isOwner) || (isOwner && folder.shareType === 'USER')) && (
              <Share2 className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-card border-border">
          {canManageFolder && (
            <>
              <ContextMenuItem onClick={() => onCreateSubfolder(folder.id)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                新建子文件夹
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onRename(folder)}>
                <Edit className="w-4 h-4 mr-2" />
                重命名
              </ContextMenuItem>
              {isAdmin && shareType === 'system' && (
                <ContextMenuItem onClick={() => onUpdateMapping(folder)}>
                  <Link2 className="w-4 h-4 mr-2" />
                  修改映射
                </ContextMenuItem>
              )}
              <ContextMenuItem onClick={() => onShareFolder?.(folder)}>
                <Share2 className="w-4 h-4 mr-2" />
                共享设置
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onDelete(folder)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                删除文件夹
              </ContextMenuItem>
            </>
          )}
          {!canManageFolder && (
            <>
              {/* 共享文件夹的权限显示 */}
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                我的权限: {folder.permissions?.map(p => PERMISSION_LABELS[p]).join(', ') || '无'}
              </div>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {expanded && hasChildren && (
        <div>
          {folder.children!.map((child) => {
            const childFolder = child as FolderTreeNodeWithShare;
            // 子文件夹继承父级的权限和所有者状态
            const effectiveChild: FolderTreeNodeWithShare = {
              ...childFolder,
              permissions: childFolder.permissions ?? folder.permissions,
              isOwner: childFolder.isOwner ?? folder.isOwner,
            };
            return (
              <TreeNode
                key={effectiveChild.id}
                folder={effectiveChild}
                level={level + 1}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                onCreateSubfolder={onCreateSubfolder}
                onRename={onRename}
                onUpdateMapping={onUpdateMapping}
                onDelete={onDelete}
                onShareFolder={onShareFolder}
                isShared={isShared}
                shareType={shareType}
                isAdmin={isAdmin}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// 可选图标列表
const FOLDER_ICONS = [
  { value: 'default', label: '默认图标', icon: FolderIcon },
  { value: 'folder', label: '文件夹', icon: FolderOpen },
  { value: 'celebration', label: '庆祝', icon: PartyPopper },
  { value: 'design', label: '设计', icon: Palette },
  { value: 'photo', label: '照片', icon: Image },
  { value: 'video', label: '视频', icon: Video },
  { value: 'document', label: '文档', icon: FileText },
  { value: 'work', label: '工作', icon: Briefcase },
  { value: 'tag', label: '标签', icon: Tag },
  { value: 'favorite', label: '收藏', icon: Star },
];

export function FolderTree({ selectedFolderId, onSelectFolder, onRefresh, onShareFolder, isAdmin = false, refreshKey }: FolderTreeProps) {
  const [personalFolders, setPersonalFolders] = useState<FolderTreeNodeWithShare[]>([]);
  const [sharedWithMeFolders, setSharedWithMeFolders] = useState<FolderTreeNodeWithShare[]>([]);
  const [systemSharedFolders, setSystemSharedFolders] = useState<FolderTreeNodeWithShare[]>([]);
  const [realFolders, setRealFolders] = useState<RealFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [newMappingRealFolderId, setNewMappingRealFolderId] = useState<string>('');
  const [parentId, setParentId] = useState<string | undefined>();
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [selectedRealFolderId, setSelectedRealFolderId] = useState<string>('');
  const [selectedIcon, setSelectedIcon] = useState<string>('default');
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    sharedWithMe: true,
    systemShared: true,
  });
  // 系统共享文件夹创建相关
  const [systemSharedDialogOpen, setSystemSharedDialogOpen] = useState(false);
  const [systemSharedName, setSystemSharedName] = useState('');
  const [systemSharedDescription, setSystemSharedDescription] = useState('');
  const [systemSharedRealFolderId, setSystemSharedRealFolderId] = useState<string>('');
  const [systemSharedRoleIds, setSystemSharedRoleIds] = useState<string[]>([]);
  const [systemSharedPermissions, setSystemSharedPermissions] = useState<SharePermission[]>(['VIEW', 'DOWNLOAD']);
  const [allRoles, setAllRoles] = useState<{ id: string; name: string; code: string }[]>([]);
  // 子文件夹创建时的角色/权限相关（系统共享下）
  const [createUnderSystemShared, setCreateUnderSystemShared] = useState(false);
  const [createSubRoleIds, setCreateSubRoleIds] = useState<string[]>([]);
  const [createSubPermissions, setCreateSubPermissions] = useState<SharePermission[]>([]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMyFolders();
      setPersonalFolders(data.personal);
      setSharedWithMeFolders(data.sharedWithMe);
      setSystemSharedFolders(data.systemShared);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      // 回退到旧版本 API
      try {
        const folders = await apiClient.getFolders();
        const tree = buildTree(folders);
        setPersonalFolders(tree.map(f => ({ ...f, isOwner: true })));
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRealFolders = async () => {
    try {
      const data = await apiClient.getRealFolders();
      setRealFolders(data);
      // 默认选择第一个真实文件夹
      if (data.length > 0 && !selectedRealFolderId) {
        setSelectedRealFolderId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch real folders:', error);
    }
  };

  const buildTree = (flatFolders: Folder[]): FolderTreeNode[] => {
    const map = new Map<string, FolderTreeNode>();
    const roots: FolderTreeNode[] = [];

    flatFolders.forEach((folder) => {
      map.set(folder.id, { ...folder, children: [] });
    });

    flatFolders.forEach((folder) => {
      const node = map.get(folder.id)!;
      if (folder.parentId && map.has(folder.parentId)) {
        map.get(folder.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const fetchRoles = async () => {
    try {
      const roles = await apiClient.getAllRoles();
      setAllRoles(roles.map((r: any) => ({ id: r.id, name: r.name, code: r.code })));
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  useEffect(() => {
    fetchFolders();
    fetchRealFolders();
  }, []);

  // 外部触发刷新（如创建文件夹、上传文件完成后）
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchFolders();
    }
  }, [refreshKey]);

  useEffect(() => {
    if (isAdmin) fetchRoles();
  }, [isAdmin]);

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    // 管理员：顶级文件夹必须选择真实文件夹映射
    // 普通用户：不需要选择，后端自动映射到 user/{username}
    if (isAdmin && !parentId && !selectedRealFolderId) return;

    try {
      setSaving(true);
      const folder = await apiClient.createFolder({
        name: folderName.trim(),
        parentId: parentId,
        realFolderId: isAdmin ? (selectedRealFolderId || undefined) : undefined,
        icon: selectedIcon !== 'default' ? selectedIcon : undefined,
      });

      // 系统共享子文件夹：创建后设置角色/权限
      if (createUnderSystemShared && createSubRoleIds.length > 0 && createSubPermissions.length > 0) {
        try {
          await apiClient.shareFolder(folder.id, {
            roleIds: createSubRoleIds,
            permissions: createSubPermissions,
          });
        } catch (shareError) {
          console.error('Failed to set sub-folder permissions:', shareError);
        }
      }

      setCreateDialogOpen(false);
      setFolderName('');
      setParentId(undefined);
      setSelectedIcon('default');
      setCreateUnderSystemShared(false);
      setCreateSubRoleIds([]);
      setCreateSubPermissions([]);
      fetchFolders();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRenameFolder = async () => {
    if (!folderName.trim() || !selectedFolder) return;

    try {
      setSaving(true);
      await apiClient.updateFolder(selectedFolder.id, { 
        name: folderName.trim(),
        icon: selectedIcon === 'default' ? undefined : selectedIcon,
      });
      setRenameDialogOpen(false);
      setFolderName('');
      setSelectedFolder(null);
      fetchFolders();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to rename folder:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;

    try {
      setSaving(true);
      await apiClient.deleteFolder(selectedFolder.id, false);
      setDeleteDialogOpen(false);
      setSelectedFolder(null);
      if (selectedFolderId === selectedFolder.id) {
        onSelectFolder(undefined);
      }
      fetchFolders();
      onRefresh?.();
    } catch (error: any) {
      console.error('Failed to delete folder:', error);
      const msg = error?.message || '删除失败';
      setDeleteError(msg);
    } finally {
      setSaving(false);
    }
  };

  // 判断文件夹是否在系统共享树中
  const isInSystemSharedTree = (folderId: string): boolean => {
    const search = (folders: FolderTreeNodeWithShare[]): boolean => {
      for (const f of folders) {
        if (f.id === folderId) return true;
        if (f.children && search(f.children)) return true;
      }
      return false;
    };
    return search(systemSharedFolders);
  };

  // 查找文件夹所属的根系统共享文件夹
  const findRootSystemShared = (folderId: string): FolderTreeNodeWithShare | null => {
    for (const root of systemSharedFolders) {
      if (root.id === folderId) return root;
      const search = (folders: FolderTreeNodeWithShare[]): boolean => {
        for (const f of folders) {
          if (f.id === folderId) return true;
          if (f.children && search(f.children)) return true;
        }
        return false;
      };
      if (root.children && search(root.children)) return root;
    }
    return null;
  };

  // 子文件夹角色/权限切换
  const toggleCreateSubRole = (roleId: string) => {
    setCreateSubRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleCreateSubPermission = (perm: SharePermission) => {
    setCreateSubPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const openCreateDialog = async (parentFolderId?: string) => {
    setParentId(parentFolderId);
    setFolderName('');
    setSelectedIcon('default');
    // 默认选择第一个真实文件夹
    if (realFolders.length > 0) {
      setSelectedRealFolderId(realFolders[0].id);
    }

    // 检测是否在系统共享文件夹下创建子文件夹
    const isUnder = !!(parentFolderId && isAdmin && isInSystemSharedTree(parentFolderId));
    setCreateUnderSystemShared(isUnder);

    if (isUnder && parentFolderId) {
      const root = findRootSystemShared(parentFolderId);
      if (root) {
        try {
          const sharesData = await apiClient.getFolderShares(root.id);
          const roleIds = [...new Set(
            sharesData.items
              .filter((s: any) => s.sharedWithRole)
              .map((s: any) => s.sharedWithRole.id)
          )];
          const allPerms = new Set<SharePermission>();
          sharesData.items.forEach((s: any) =>
            s.permissions.forEach((p: SharePermission) => allPerms.add(p))
          );
          setCreateSubRoleIds(roleIds);
          setCreateSubPermissions(allPerms.size > 0 ? Array.from(allPerms) : ['VIEW', 'DOWNLOAD']);
        } catch {
          setCreateSubRoleIds([]);
          setCreateSubPermissions(['VIEW', 'DOWNLOAD']);
        }
      }
    } else {
      setCreateSubRoleIds([]);
      setCreateSubPermissions([]);
    }

    setCreateDialogOpen(true);
  };

  const openRenameDialog = (folder: Folder) => {
    setSelectedFolder(folder);
    setFolderName(folder.name);
    setSelectedIcon(folder.icon || 'default');
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (folder: Folder) => {
    setSelectedFolder(folder);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const openMappingDialog = (folder: Folder) => {
    setSelectedFolder(folder);
    setNewMappingRealFolderId(folder.realFolderId || '');
    setMappingDialogOpen(true);
  };

  const handleUpdateMapping = async () => {
    if (!selectedFolder || !newMappingRealFolderId) return;

    try {
      setSaving(true);
      await apiClient.updateFolder(selectedFolder.id, { realFolderId: newMappingRealFolderId });
      setMappingDialogOpen(false);
      setSelectedFolder(null);
      fetchFolders();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to update mapping:', error);
      alert('修改映射失败：' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSystemSharedFolder = async () => {
    if (!systemSharedName.trim() || !systemSharedRealFolderId || systemSharedRoleIds.length === 0) return;
    try {
      setSaving(true);
      await apiClient.createSystemSharedFolder({
        name: systemSharedName.trim(),
        description: systemSharedDescription.trim() || undefined,
        realFolderId: systemSharedRealFolderId,
        roleIds: systemSharedRoleIds,
        permissions: systemSharedPermissions,
      });
      setSystemSharedDialogOpen(false);
      setSystemSharedName('');
      setSystemSharedDescription('');
      setSystemSharedRealFolderId('');
      setSystemSharedRoleIds([]);
      setSystemSharedPermissions(['VIEW', 'DOWNLOAD']);
      fetchFolders();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to create system shared folder:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleSystemSharedPermission = (perm: SharePermission) => {
    setSystemSharedPermissions(prev =>
      prev.includes(perm)
        ? prev.filter(p => p !== perm)
        : [...prev, perm]
    );
  };

  const toggleSystemSharedRole = (roleId: string) => {
    setSystemSharedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const toggleSection = (section: 'personal' | 'sharedWithMe' | 'systemShared') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="flex flex-col p-4 bg-card border border-border rounded-lg mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">文件夹</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => openCreateDialog()}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground">加载中...</span>
          </div>
        ) : (
          <>
            {/* 个人文件夹 */}
            <div>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center gap-2 py-2 px-2 text-sm font-medium cursor-pointer transition-colors duration-150 border-b border-border/40',
                      'hover:bg-muted/50',
                      selectedFolderId === FOLDER_SCOPE_IDS.PERSONAL
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/80 hover:text-foreground'
                    )}
                    onClick={() => {
                      onSelectFolder(FOLDER_SCOPE_IDS.PERSONAL, undefined, '个人文件夹', false);
                      if (!expandedSections.personal) {
                        setExpandedSections(prev => ({ ...prev, personal: true }));
                      }
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection('personal');
                      }}
                      className="p-0.5 hover:bg-muted rounded"
                    >
                      {expandedSections.personal ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <Home className="w-4 h-4" />
                    <span>个人文件夹</span>
                    <Badge variant="secondary" className="ml-auto text-xs h-4 px-1">
                      {personalFolders.length}
                    </Badge>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="bg-card border-border">
                  <ContextMenuItem onClick={() => openCreateDialog()}>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    新建文件夹
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              {expandedSections.personal && (
                <div className="mt-1">
                  {personalFolders.map((folder) => (
                    <TreeNode
                      key={folder.id}
                      folder={folder}
                      level={0}
                      selectedFolderId={selectedFolderId}
                      onSelectFolder={onSelectFolder}
                      onCreateSubfolder={openCreateDialog}
                      onRename={openRenameDialog}
                      onUpdateMapping={openMappingDialog}
                      onDelete={openDeleteDialog}
                      onShareFolder={onShareFolder}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 共享给我的 */}
            {sharedWithMeFolders.length > 0 && (
              <div>
                <div
                  className={cn(
                    'flex items-center gap-2 py-2 px-2 text-sm font-medium cursor-pointer transition-colors duration-150 border-b border-border/40',
                    'hover:bg-muted/50',
                    selectedFolderId === FOLDER_SCOPE_IDS.SHARED_WITH_ME
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/80 hover:text-foreground'
                  )}
                  onClick={() => {
                    onSelectFolder(FOLDER_SCOPE_IDS.SHARED_WITH_ME, undefined, '共享给我的', false);
                    if (!expandedSections.sharedWithMe) {
                      setExpandedSections(prev => ({ ...prev, sharedWithMe: true }));
                    }
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection('sharedWithMe');
                    }}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    {expandedSections.sharedWithMe ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  <Users className="w-4 h-4 text-green-500" />
                  <span>共享给我的</span>
                  <Badge variant="secondary" className="ml-auto text-xs h-4 px-1">
                    {sharedWithMeFolders.length}
                  </Badge>
                </div>
                {expandedSections.sharedWithMe && (
                  <div className="mt-1">
                    {sharedWithMeFolders.map((folder) => (
                      <TreeNode
                        key={folder.id}
                        folder={folder}
                        level={0}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={onSelectFolder}
                        onCreateSubfolder={openCreateDialog}
                        onRename={openRenameDialog}
                        onUpdateMapping={openMappingDialog}
                        onDelete={openDeleteDialog}
                        onShareFolder={onShareFolder}
                        isShared={true}
                        shareType="user"
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 系统共享文件夹 */}
            {(systemSharedFolders.length > 0 || isAdmin) && (
              <div>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'flex items-center gap-2 py-2 px-2 text-sm font-medium cursor-pointer transition-colors duration-150 border-b border-border/40',
                        'hover:bg-muted/50',
                        selectedFolderId === FOLDER_SCOPE_IDS.SYSTEM_SHARED
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/80 hover:text-foreground'
                      )}
                      onClick={() => {
                        onSelectFolder(FOLDER_SCOPE_IDS.SYSTEM_SHARED, undefined, '系统共享', true);
                        if (!expandedSections.systemShared) {
                          setExpandedSections(prev => ({ ...prev, systemShared: true }));
                        }
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection('systemShared');
                        }}
                        className="p-0.5 hover:bg-muted rounded"
                      >
                        {expandedSections.systemShared ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <Building2 className="w-4 h-4 text-blue-500" />
                      <span>系统共享</span>
                      <Badge variant="secondary" className="ml-auto text-xs h-4 px-1">
                        {systemSharedFolders.length}
                      </Badge>
                    </div>
                  </ContextMenuTrigger>
                  {isAdmin && (
                    <ContextMenuContent className="bg-card border-border">
                      <ContextMenuItem onClick={() => setSystemSharedDialogOpen(true)}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        新建系统共享文件夹
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
                {expandedSections.systemShared && (
                  <div className="mt-1">
                    {systemSharedFolders.map((folder) => (
                      <TreeNode
                        key={folder.id}
                        folder={folder}
                        level={0}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={onSelectFolder}
                        onCreateSubfolder={openCreateDialog}
                        onRename={openRenameDialog}
                        onUpdateMapping={openMappingDialog}
                        onDelete={openDeleteDialog}
                        onShareFolder={onShareFolder}
                        isShared={true}
                        shareType="system"
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          setCreateUnderSystemShared(false);
          setCreateSubRoleIds([]);
          setCreateSubPermissions([]);
        }
      }}>
        <DialogContent className={cn('bg-card border-border', createUnderSystemShared ? 'sm:max-w-[500px]' : 'sm:max-w-[450px]')}>
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {createUnderSystemShared ? '新建系统共享子文件夹' : isAdmin ? '新建虚拟文件夹' : '新建文件夹'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 文件夹名称 */}
            <div className="space-y-2">
              <Label className="text-foreground">
                文件夹名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={isAdmin ? '双十一活动' : '例如：工作文档、项目资料'}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="bg-background border-input"
              />
            </div>

            {/* 映射到真实目录 - 仅管理员可见 */}
            {isAdmin && (
              <div className="space-y-2">
                <Label className="text-foreground">
                  映射到真实目录 {!parentId && <span className="text-destructive">*</span>}
                </Label>
                <Select value={selectedRealFolderId} onValueChange={setSelectedRealFolderId}>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="选择真实文件夹" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {realFolders.map((rf) => (
                      <SelectItem key={rf.id} value={rf.id}>
                        {rf.pathName} ({rf.displayName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {parentId ? '可选，不选择则继承父文件夹的存储目录' : '上传到此文件夹的文件将存储到该目录'}
                </p>
              </div>
            )}

            {/* 可访问角色 - 仅系统共享子文件夹可见 */}
            {isAdmin && createUnderSystemShared && (
              <div className="space-y-2">
                <Label className="text-foreground">
                  可访问角色 <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {allRoles.filter(r => r.code !== 'super_admin').map((role) => (
                    <Button
                      key={role.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-8 text-xs',
                        createSubRoleIds.includes(role.id) &&
                          'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 hover:text-primary'
                      )}
                      onClick={() => toggleCreateSubRole(role.id)}
                    >
                      {role.name}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  默认继承父文件夹的角色设置，可自定义
                </p>
              </div>
            )}

            {/* 权限设置 - 仅系统共享子文件夹可见 */}
            {isAdmin && createUnderSystemShared && (
              <div className="space-y-2">
                <Label className="text-foreground">
                  权限设置 <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PERMISSION_LABELS) as SharePermission[]).map((perm) => {
                    const IconComp = PERMISSION_ICONS[perm];
                    const isSelected = createSubPermissions.includes(perm);
                    return (
                      <Button
                        key={perm}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-8 text-xs',
                          isSelected &&
                            'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 hover:text-primary'
                        )}
                        onClick={() => toggleCreateSubPermission(perm)}
                      >
                        <IconComp className={cn('w-3 h-3 mr-1', isSelected ? 'text-primary' : '')} />
                        {PERMISSION_LABELS[perm]}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  默认继承父文件夹的权限设置，可自定义
                </p>
              </div>
            )}

            {/* 图标选择 */}
            <div className="space-y-2">
              <Label className="text-foreground">图标（可选）</Label>
              <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="选择图标" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {FOLDER_ICONS.map((iconOption) => {
                    const IconComponent = iconOption.icon;
                    return (
                      <SelectItem key={iconOption.value} value={iconOption.value}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4" />
                          <span>{iconOption.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={
                saving || !folderName.trim() ||
                (isAdmin && !parentId && !selectedRealFolderId) ||
                (createUnderSystemShared && (createSubRoleIds.length === 0 || createSubPermissions.length === 0))
              }
            >
              {saving ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">编辑文件夹</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">文件夹名称</Label>
              <Input
                placeholder="请输入名称"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">图标</Label>
              <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="选择图标" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {FOLDER_ICONS.map((iconOption) => {
                    const IconComponent = iconOption.icon;
                    return (
                      <SelectItem key={iconOption.value} value={iconOption.value}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4" />
                          <span>{iconOption.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleRenameFolder} disabled={saving || !folderName.trim()}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteError(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">删除文件夹</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              确定要删除文件夹 <span className="text-foreground font-medium">{selectedFolder?.name}</span> 吗？
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              文件夹内的文件不会被删除，将移动到根目录。
            </p>
            {deleteError && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{deleteError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolder} disabled={saving}>
              {saving ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">修改映射关系</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 当前文件夹 */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">当前文件夹</Label>
              <div className="flex items-center gap-2 text-foreground">
                <FolderIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{selectedFolder?.name}</span>
              </div>
            </div>

            {/* 当前映射 */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">当前映射</Label>
              <div className="text-foreground">
                {selectedFolder?.realFolderId ? (
                  (() => {
                    const currentRealFolder = realFolders.find(rf => rf.id === selectedFolder.realFolderId);
                    return currentRealFolder 
                      ? `${currentRealFolder.pathName} (${currentRealFolder.displayName})`
                      : '未知映射';
                  })()
                ) : (
                  <span className="text-muted-foreground">未设置映射</span>
                )}
              </div>
            </div>

            {/* 新映射目录 */}
            <div className="space-y-2">
              <Label className="text-foreground">
                新映射目录 <span className="text-destructive">*</span>
              </Label>
              <Select value={newMappingRealFolderId} onValueChange={setNewMappingRealFolderId}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="选择真实文件夹" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {realFolders.map((rf) => (
                    <SelectItem key={rf.id} value={rf.id}>
                      {rf.pathName} ({rf.displayName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 提示信息 */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <p className="text-sm text-muted-foreground">
                修改映射后，新上传的文件将存储到新目录，已有文件不受影响
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleUpdateMapping} disabled={saving || !newMappingRealFolderId}>
              {saving ? '保存中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create System Shared Folder Dialog */}
      <Dialog open={systemSharedDialogOpen} onOpenChange={setSystemSharedDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              新建系统共享文件夹
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 文件夹名称 */}
            <div className="space-y-2">
              <Label className="text-foreground">
                文件夹名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="例如：公司制度文件"
                value={systemSharedName}
                onChange={(e) => setSystemSharedName(e.target.value)}
                className="bg-background border-input"
              />
            </div>

            {/* 描述 */}
            <div className="space-y-2">
              <Label className="text-foreground">描述（可选）</Label>
              <Input
                placeholder="存放公司制度相关文件"
                value={systemSharedDescription}
                onChange={(e) => setSystemSharedDescription(e.target.value)}
                className="bg-background border-input"
              />
            </div>

            {/* 映射到真实目录 */}
            <div className="space-y-2">
              <Label className="text-foreground">
                映射到真实目录 <span className="text-destructive">*</span>
              </Label>
              <Select value={systemSharedRealFolderId} onValueChange={setSystemSharedRealFolderId}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="选择真实文件夹" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {realFolders.map((rf) => (
                    <SelectItem key={rf.id} value={rf.id}>
                      {rf.pathName} ({rf.displayName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                系统共享文件夹的文件将存储到该目录
              </p>
            </div>

            {/* 可访问角色 */}
            <div className="space-y-2">
              <Label className="text-foreground">
                可访问角色 <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {allRoles.filter(r => r.code !== 'super_admin').map((role) => (
                  <Button
                    key={role.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-8 text-xs',
                      systemSharedRoleIds.includes(role.id) &&
                        'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 hover:text-primary'
                    )}
                    onClick={() => toggleSystemSharedRole(role.id)}
                  >
                    {role.name}
                  </Button>
                ))}
              </div>
              {allRoles.filter(r => r.code !== 'super_admin').length === 0 && (
                <p className="text-xs text-muted-foreground">暂无可选角色</p>
              )}
            </div>

            {/* 权限设置 */}
            <div className="space-y-2">
              <Label className="text-foreground">
                权限设置 <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PERMISSION_LABELS) as SharePermission[]).map((perm) => {
                  const IconComp = PERMISSION_ICONS[perm];
                  const isSelected = systemSharedPermissions.includes(perm);
                  return (
                    <Button
                      key={perm}
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-8 text-xs',
                        isSelected &&
                          'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 hover:text-primary'
                      )}
                      onClick={() => toggleSystemSharedPermission(perm)}
                    >
                      <IconComp className={cn('w-3 h-3 mr-1', isSelected ? 'text-primary' : '')} />
                      {PERMISSION_LABELS[perm]}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSystemSharedDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleCreateSystemSharedFolder}
              disabled={saving || !systemSharedName.trim() || !systemSharedRealFolderId || systemSharedRoleIds.length === 0 || systemSharedPermissions.length === 0}
            >
              {saving ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
