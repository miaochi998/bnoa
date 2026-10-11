'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  PencilOff,
  Save,
  Search,
} from 'lucide-react';

interface FieldDef {
  field: string;
  name: string;
  group: string;
  editable?: boolean;
  sensitive?: boolean;
  note?: string;
}

interface ModuleDef {
  module: string;
  /** 模块中文名（后端取自权限定义的菜单名，如 platform → 「平台管理」） */
  label?: string;
  groups: string[];
  fields: FieldDef[];
}

interface FieldState {
  canView: boolean;
  canEdit: boolean;
}

interface GroupRequirement {
  permission: string;
  label: string;
}

export interface FieldPermissionEditorHandle {
  /** 保存所有有改动的模块 */
  save: () => Promise<void>;
  /** 是否有未保存修改 */
  dirty: () => boolean;
}

interface Props {
  roleId: string;
  /** 角色是超级管理员时只读提示 */
  isSuperAdminRole?: boolean;
  /** 该角色已开启的功能权限码（用于判断分组的前置功能是否已开） */
  selectedCodes?: Set<string>;
  /** 未保存状态变化时通知父级（用于父级保存按钮的可用性） */
  onDirtyChange?: (dirty: boolean) => void;
}

export const FieldPermissionEditor = forwardRef<
  FieldPermissionEditorHandle,
  Props
>(function FieldPermissionEditor(
  { roleId, isSuperAdminRole, selectedCodes, onDirtyChange },
  ref,
) {
  const [modules, setModules] = useState<ModuleDef[]>([]);
  /** 每个模块各自的字段状态（不再用标签切换，所有模块平铺展示） */
  const [statesByModule, setStatesByModule] = useState<
    Record<string, Record<string, FieldState>>
  >({});
  const [dirtyModules, setDirtyModules] = useState<string[]>([]);
  /** 模块是否展开 */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** 信息组是否收起 */
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingModule, setSavingModule] = useState('');
  const [groupReqs, setGroupReqs] = useState<
    Record<string, Record<string, GroupRequirement>>
  >({});
  const [dataScopeItems, setDataScopeItems] = useState<
    { module: string; label: string; value: string }[]
  >([]);
  const [dataScopeOptions, setDataScopeOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // 加载：注册表 + 各模块当前配置
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const list: any[] =
          (await apiClient.getFieldPermissionRegistry()) || [];
        const mods: ModuleDef[] = (list || []).map((m) => ({
          module: m.module,
          label: m.label ?? m.module,
          groups: m.groups ?? [],
          fields: m.fields ?? [],
        }));
        if (!alive) return;
        setModules(mods);
        // 默认全部展开（一页排列，不再点击切换）
        setExpanded(Object.fromEntries(mods.map((m) => [m.module, true])));

        const states: Record<string, Record<string, FieldState>> = {};
        const reqs: Record<string, Record<string, GroupRequirement>> = {};
        await Promise.all(
          mods.map(async (m) => {
            try {
              const data: any = await apiClient.getRoleFieldPermissions(
                roleId,
                m.module,
              );
              const next: Record<string, FieldState> = {};
              for (const f of data?.fields ?? []) {
                next[f.field] = { canView: !!f.canView, canEdit: !!f.canEdit };
              }
              states[m.module] = next;
              reqs[m.module] = data?.groupRequirements ?? {};
            } catch {
              states[m.module] = {};
            }
          }),
        );
        if (!alive) return;
        setStatesByModule(states);
        setGroupReqs(reqs);
        setDirtyModules([]);
      } catch {
        toast.error('字段权限注册表加载失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [roleId]);

  // 数据范围（与字段权限独立：未登记字段的模块也可以配数据范围）
  useEffect(() => {
    let alive = true;
    apiClient
      .getRoleDataScopes(roleId)
      .then((d) => {
        if (!alive) return;
        setDataScopeItems(d?.items ?? []);
        setDataScopeOptions(d?.options ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [roleId]);

  /** 立即保存单个模块的数据范围 */
  const handleDataScopeChange = async (module: string, value: string) => {
    setDataScopeItems((prev) =>
      prev.map((i) => (i.module === module ? { ...i, value } : i)),
    );
    try {
      await apiClient.saveRoleDataScope(roleId, module, value);
      toast.success('数据范围已保存');
    } catch (e: any) {
      toast.error(e?.message || '数据范围保存失败');
    }
  };

  const markDirty = (module: string) => {
    setDirtyModules((prev) =>
      prev.includes(module) ? prev : [...prev, module],
    );
  };

  const setFieldState = (
    module: string,
    field: string,
    updater: (cur: FieldState) => FieldState,
  ) => {
    setStatesByModule((prev) => {
      const mod = { ...(prev[module] ?? {}) };
      mod[field] = updater(mod[field] ?? { canView: false, canEdit: false });
      return { ...prev, [module]: mod };
    });
    markDirty(module);
  };

  /** 切换「能否看到」——关闭可见时连带关闭可编辑 */
  const toggleView = (module: string, field: string) => {
    setFieldState(module, field, (cur) => {
      const canView = !cur.canView;
      return { canView, canEdit: canView ? cur.canEdit : false };
    });
  };

  /** 切换「能否编辑」——打开可编辑时连带打开可见 */
  const toggleEdit = (module: string, field: string, editable: boolean) => {
    if (!editable) return;
    setFieldState(module, field, (cur) => {
      const canEdit = !cur.canEdit;
      return { canView: canEdit ? true : cur.canView, canEdit };
    });
  };

  /** 信息组一键全开 / 全关 */
  const toggleGroup = (module: ModuleDef, group: string, on: boolean) => {
    setStatesByModule((prev) => {
      const mod = { ...(prev[module.module] ?? {}) };
      for (const f of module.fields.filter((x) => x.group === group)) {
        mod[f.field] = on
          ? { canView: true, canEdit: !!f.editable }
          : { canView: false, canEdit: false };
      }
      return { ...prev, [module.module]: mod };
    });
    markDirty(module.module);
  };

  const saveModule = async (module: ModuleDef, silent = false) => {
    setSavingModule(module.module);
    try {
      const states = statesByModule[module.module] ?? {};
      const items = module.fields.map((f) => ({
        field: f.field,
        canView: states[f.field]?.canView ?? false,
        canEdit: states[f.field]?.canEdit ?? false,
      }));
      await apiClient.saveRoleFieldPermissions(roleId, module.module, items);
      setDirtyModules((prev) => prev.filter((m) => m !== module.module));
      if (!silent) toast.success(`「${module.label}」的字段权限已保存`);
    } catch (e: any) {
      toast.error(e?.message || '保存失败');
      throw e;
    } finally {
      setSavingModule('');
    }
  };

  /** 保存所有有改动的模块（供父级保存按钮调用） */
  const saveAll = async () => {
    const targets = modules.filter((m) => dirtyModules.includes(m.module));
    if (targets.length === 0) return;
    for (const m of targets) {
      await saveModule(m, true);
    }
    toast.success(`已保存 ${targets.length} 个模块的字段权限`);
  };

  const dirty = dirtyModules.length > 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useImperativeHandle(ref, () => ({ save: saveAll, dirty: () => dirty }), [
    saveAll,
    dirty,
  ]);

  const visibleModules = useMemo(() => {
    if (!keyword) return modules;
    return modules.filter((m) =>
      m.fields.some(
        (f) => f.name.includes(keyword) || f.field.includes(keyword),
      ),
    );
  }, [modules, keyword]);

  if (loading && modules.length === 0) {
    return <div className="text-[#8e8e8e] py-8 text-center">加载中...</div>;
  }

  if (modules.length === 0) {
    return (
      <div className="text-[#8e8e8e] py-8 text-center">
        暂无已登记字段权限的模块
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isSuperAdminRole && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
          <AlertTriangle className="w-4 h-4" />
          超级管理员拥有全部字段权限，无需配置
        </div>
      )}

      {/* 一、能看到哪些数据（独立区域，放在最上方；横向排列占一行） */}
      {dataScopeItems.length > 0 && (
        <Card className="bg-[#232323] border-[#1e1e1e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white">
              能看到哪些数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {dataScopeItems.map((item) => (
                <div key={item.module} className="flex items-center gap-2">
                  <span className="text-sm text-[#d4d4d4] whitespace-nowrap">
                    {item.label}
                  </span>
                  <Select
                    value={item.value}
                    onValueChange={(v) => handleDataScopeChange(item.module, v)}
                  >
                    <SelectTrigger className="w-44 h-8 bg-[#1e1e1e] border-[#1e1e1e] text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                      {dataScopeOptions.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-white"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 二、各模块字段权限（一页平铺，可收缩；不再点击切换） */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#8e8e8e]">
          下列模块可分别配置「能看 / 能改」，各自保存
        </span>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e8e]" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索字段..."
            className="pl-9 h-8 bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
          />
        </div>
      </div>

      {visibleModules.map((module) => {
        const isOpen = expanded[module.module] ?? true;
        const states = statesByModule[module.module] ?? {};
        const hasDirty = dirtyModules.includes(module.module);
        const visibleFields = module.fields.filter(
          (f) =>
            !keyword || f.name.includes(keyword) || f.field.includes(keyword),
        );
        return (
          <Card key={module.module} className="bg-[#232323] border-[#1e1e1e]">
            {/* 模块头：点击展开 / 收起 */}
            <CardHeader
              className="py-3 cursor-pointer select-none"
              onClick={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [module.module]: !isOpen,
                }))
              }
            >
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-[#8e8e8e]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#8e8e8e]" />
                )}
                <CardTitle className="text-sm text-white">
                  {module.label}
                </CardTitle>
                <span className="text-xs text-[#8e8e8e]">
                  {module.fields.length} 项
                </span>
                {hasDirty && (
                  <span className="text-xs text-amber-400 ml-2">
                    有未保存的修改
                  </span>
                )}
                <div
                  className="ml-auto flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingModule === module.module}
                    onClick={() => saveModule(module)}
                    className="h-7 text-xs bg-[#1e1e1e] border-[#3e3e3e] text-white hover:bg-[#363636]"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {savingModule === module.module ? '保存中...' : '保存本模块'}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="pt-0 space-y-3">
                {module.groups.map((group) => {
                  const fields = visibleFields.filter((f) => f.group === group);
                  if (fields.length === 0) return null;
                  const gKey = `${module.module}::${group}`;
                  const gCollapsed = collapsedGroups[gKey];
                  const req = groupReqs[module.module]?.[group];
                  const reqMissing = req && !selectedCodes?.has(req.permission);
                  return (
                    <div
                      key={group}
                      className="border border-[#1e1e1e] rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-3 py-2 bg-[#1e1e1e]">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedGroups((prev) => ({
                              ...prev,
                              [gKey]: !prev[gKey],
                            }))
                          }
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          {gCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-[#8e8e8e]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#8e8e8e]" />
                          )}
                          <span className="text-sm font-medium text-white">
                            {group}
                          </span>
                        </button>
                        {reqMissing && (
                          <button
                            type="button"
                            title={`该分组需要先开启功能权限「${req!.label}」，否则此处的配置不会生效（弹窗入口不会出现）。`}
                            onClick={() =>
                              toast.warning(
                                `该分组需要先开启功能权限「${req!.label}」，否则此处的配置不会生效`,
                              )
                            }
                            className="p-0.5 rounded hover:bg-[#2e2e2e] transition-colors duration-200 cursor-pointer"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          </button>
                        )}
                        <span className="text-xs text-[#8e8e8e]">
                          {fields.length} 项
                        </span>
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup(module, group, true)}
                            className="text-xs text-[#8e8e8e] hover:text-white cursor-pointer transition-colors duration-200"
                          >
                            整组全开
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleGroup(module, group, false)}
                            className="text-xs text-[#8e8e8e] hover:text-white cursor-pointer transition-colors duration-200"
                          >
                            整组全关
                          </button>
                        </div>
                      </div>
                      {!gCollapsed && (
                        <div className="px-3 py-3 flex flex-wrap gap-x-8 gap-y-3">
                          {fields.map((f) => {
                            const st = states[f.field] ?? {
                              canView: false,
                              canEdit: false,
                            };
                            return (
                              <div
                                key={f.field}
                                className="flex items-center gap-2"
                                title={f.note || undefined}
                              >
                                <span className="text-sm text-[#d4d4d4]">
                                  {f.name}
                                </span>
                                {f.sensitive && (
                                  <span className="text-[10px] px-1 rounded bg-amber-500/15 text-amber-400">
                                    敏感
                                  </span>
                                )}
                                {/* 能否看 */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleView(module.module, f.field)
                                  }
                                  title={
                                    st.canView
                                      ? '可以看（点击关闭）'
                                      : '不能看（点击开启）'
                                  }
                                  className="p-0.5 rounded hover:bg-[#2e2e2e] cursor-pointer transition-colors duration-200"
                                >
                                  {st.canView ? (
                                    <Eye className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <EyeOff className="w-4 h-4 text-[#5a5a5a]" />
                                  )}
                                </button>
                                {/* 能否改 */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleEdit(
                                      module.module,
                                      f.field,
                                      !!f.editable,
                                    )
                                  }
                                  disabled={!f.editable}
                                  title={
                                    !f.editable
                                      ? '该字段不可修改'
                                      : st.canEdit
                                        ? '可以改（点击关闭）'
                                        : '不能改（点击开启）'
                                  }
                                  className={`p-0.5 rounded transition-colors duration-200 ${
                                    f.editable
                                      ? 'hover:bg-[#2e2e2e] cursor-pointer'
                                      : 'opacity-30 cursor-not-allowed'
                                  }`}
                                >
                                  {st.canEdit ? (
                                    <Pencil className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <PencilOff className="w-4 h-4 text-[#5a5a5a]" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
});
