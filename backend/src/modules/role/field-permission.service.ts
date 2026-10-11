import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PERMISSION_DEFINITIONS } from '../../config/permission-definitions';
import {
  DATA_SCOPE_MODULES,
  FIELD_GROUP_REQUIREMENTS,
  FIELD_PERMISSION_REGISTRY,
  FieldPermissionDefinition,
  getFieldDefinitions,
  getFieldGroups,
  getRegisteredModules,
} from '../../config/field-permission-registry';

/** 数据范围：决定角色能看到「哪些条」数据 */
export enum DataScope {
  /** 全部数据 */
  ALL = 'ALL',
  /** 仅自己负责的店铺（按归属人字段） */
  OWN_SHOP = 'OWN_SHOP',
  /** 仅自己创建/提交的 */
  OWN_CREATED = 'OWN_CREATED',
}

export const DATA_SCOPE_LABELS: Record<string, string> = {
  ALL: '全部',
  OWN_SHOP: '只看自己负责的店铺',
  OWN_CREATED: '只看自己提交的',
};

/** 某用户在某模块的最终字段权限 */
export interface FieldPermissionState {
  /** 可见字段集合 */
  canView: Set<string>;
  /** 可编辑字段集合（必然包含于 canView） */
  canEdit: Set<string>;
  /** 是否超级管理员（全通） */
  isSuperAdmin: boolean;
}

/** 保存时提交的单个字段配置 */
export interface RoleFieldConfigItem {
  field: string;
  canView: boolean;
  canEdit: boolean;
}

/** 字段 → 数据对象属性 的映射（用于脱敏/写入过滤） */
export interface FieldKeyMapping {
  /** 注册表中的字段标识，如 phone、product.supplyPrice */
  field: string;
  /** 数据对象上的属性名，如 phone、supplyPrice */
  key: string;
}

/**
 * 字段级权限服务
 *
 * 与 `config/field-permission-registry.ts`（字段注册表）配套：
 *   - 角色未配置 → 取注册表 defaultVisible（可见），编辑权沿用模块级动作权限；
 *   - 角色已配置 → 以配置为准（多角色取宽松并集）；
 *   - 超级管理员 → 全部可见可编辑。
 *
 * 联动铁律（与配置界面一致）：能改必能看、不能看必不能改。
 */
@Injectable()
export class FieldPermissionService {
  private readonly logger = new Logger(FieldPermissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 已登记的模块及其字段/信息组（供配置界面渲染） */
  getModulesWithFields() {
    return getRegisteredModules().map((module) => ({
      module,
      // 模块显示名：自动取权限定义里该模块菜单码（<module>:view）的名称，
      // 例如 platform → 「平台管理」，无需手工维护映射表
      label:
        // 优先取该模块的「菜单码」名称（<module>:view 若是 MENU，或该模块下任意 MENU 码），
        // 避免误取同名操作码（如 user:view 其实是「查看用户详情」而不是模块名）
        PERMISSION_DEFINITIONS.find(
          (p) => p.type === 'MENU' && p.code === `${module}:view`,
        )?.name ??
        PERMISSION_DEFINITIONS.find(
          (p) => p.type === 'MENU' && p.code.startsWith(`${module}:`),
        )?.name ??
        PERMISSION_DEFINITIONS.find((p) => p.code === `${module}:view`)
          ?.name ??
        module,
      groups: getFieldGroups(module),
      fields: getFieldDefinitions(module),
    }));
  }

  /** 字段注册表原始数据 */
  getRegistry(): FieldPermissionDefinition[] {
    return FIELD_PERMISSION_REGISTRY;
  }

  /**
   * 读取某角色在某模块的字段配置（含默认值回显）
   */
  async getRoleFieldConfig(roleId: string, module: string) {
    const defs = getFieldDefinitions(module);
    if (defs.length === 0) {
      throw new BadRequestException(`模块 ${module} 未登记字段权限`);
    }
    const rows = await this.prisma.roleFieldPermission.findMany({
      where: { roleId, module },
    });
    const map = new Map(rows.map((r) => [r.field, r]));
    const dataScope = await this.getRoleDataScope(roleId, module);
    return {
      module,
      groups: getFieldGroups(module),
      groupRequirements: FIELD_GROUP_REQUIREMENTS[module] ?? {},
      dataScope,
      dataScopeOptions: Object.entries(DATA_SCOPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
      fields: defs.map((d) => {
        const row = map.get(d.field);
        return {
          field: d.field,
          name: d.name,
          group: d.group,
          editable: d.editable,
          sensitive: d.sensitive ?? false,
          note: d.note ?? null,
          /** 是否已被显式配置过（false 表示当前用的是默认值） */
          configured: !!row,
          canView: row ? row.canView : d.defaultVisible !== false,
          canEdit: row ? row.canEdit && d.editable : d.editable,
        };
      }),
    };
  }

  /**
   * 保存某角色在某模块的字段配置（整模块覆盖）
   */
  async saveRoleFieldConfig(
    roleId: string,
    module: string,
    items: RoleFieldConfigItem[],
    userId: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.code === 'super_admin') {
      throw new BadRequestException('超级管理员拥有全部字段权限，无需也不允许配置');
    }

    const defs = getFieldDefinitions(module);
    if (defs.length === 0) {
      throw new BadRequestException(`模块 ${module} 未登记字段权限`);
    }
    const valid = new Map(defs.map((d) => [d.field, d]));
    const seen = new Set<string>();

    const rows = items.map((it) => {
      const def = valid.get(it.field);
      if (!def) {
        throw new BadRequestException(`字段 ${it.field} 不在 ${module} 的登记范围内`);
      }
      if (seen.has(it.field)) {
        throw new BadRequestException(`字段 ${it.field} 重复提交`);
      }
      seen.add(it.field);
      // 联动铁律：能改必能看；不能看必不能改；系统字段永远不可编辑
      const canEdit = def.editable ? !!it.canEdit : false;
      const canView = !!it.canView || canEdit;
      return {
        roleId,
        module,
        field: it.field,
        canView,
        canEdit,
        createdBy: userId,
        updatedBy: userId,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.roleFieldPermission.deleteMany({ where: { roleId, module } });
      if (rows.length > 0) {
        await tx.roleFieldPermission.createMany({ data: rows });
      }
    });

    this.logger.log(
      `保存角色字段权限: role=${role.name} module=${module} 字段数=${rows.length}`,
    );
    return { module, count: rows.length };
  }

  /**
   * 从数据库读取用户「启用且未软删」的角色编码
   *
   * ⚠️ 字段权限与数据范围**不能信任令牌里的 roles**：
   * 访问令牌最长 12 小时（configs.security.sessionTimeout=43200），
   * 用户被降权（含撤销 super_admin）后，旧令牌仍带着旧角色，
   * 会导致「功能权限已收窄、但字段全部可见可编辑 / 数据范围仍是全部」。
   */
  private async loadRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId, role: { isActive: true, deletedAt: null } },
      select: { role: { select: { code: true } } },
    });
    return rows.map((r) => r.role.code);
  }

  /**
   * 解析某用户在某模块的最终字段权限
   * @param _roleCodes 已废弃（保留参数只为兼容调用点）：角色一律以数据库为准
   */
  async resolve(
    userId: string,
    module: string,
    _roleCodes: string[] = [],
  ): Promise<FieldPermissionState> {
    const defs = getFieldDefinitions(module);
    const canView = new Set<string>();
    const canEdit = new Set<string>();

    const roleCodes = await this.loadRoleCodes(userId);

    // 超级管理员：全部可见可编辑
    if (roleCodes.includes('super_admin')) {
      for (const d of defs) {
        canView.add(d.field);
        if (d.editable) canEdit.add(d.field);
      }
      return { canView, canEdit, isSuperAdmin: true };
    }

    let roleIds: string[] = [];
    if (roleCodes.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: { code: { in: roleCodes }, deletedAt: null },
        select: { id: true },
      });
      roleIds = roles.map((r) => r.id);
    }

    const rows = roleIds.length
      ? await this.prisma.roleFieldPermission.findMany({
          where: { roleId: { in: roleIds }, module },
        })
      : [];

    const byField = new Map<string, { canView: boolean; canEdit: boolean }[]>();
    for (const r of rows) {
      const arr = byField.get(r.field) ?? [];
      arr.push({ canView: r.canView, canEdit: r.canEdit });
      byField.set(r.field, arr);
    }

    for (const d of defs) {
      const recs = byField.get(d.field);
      const visible =
        recs && recs.length > 0
          ? recs.some((r) => r.canView)
          : d.defaultVisible !== false;
      const editable =
        recs && recs.length > 0
          ? recs.some((r) => r.canEdit && r.canView)
          : d.editable;
      if (visible) {
        canView.add(d.field);
        if (editable && d.editable) canEdit.add(d.field);
      }
    }

    return { canView, canEdit, isSuperAdmin: false };
  }


  // ==================== 数据范围 ====================

  /**
   * 读取角色在某模块的数据范围
   * 存储位置：role_permissions.dataScope（挂在模块的菜单权限上）
   */
  async getRoleDataScope(roleId: string, module: string): Promise<DataScope> {
    const menuCode = `${module}:view`;
    const row = await this.prisma.rolePermission.findFirst({
      where: { roleId, permission: { code: menuCode } },
      select: { dataScope: true },
    });
    const v = row?.dataScope as DataScope | undefined;
    return v && DATA_SCOPE_LABELS[v] ? v : DataScope.ALL;
  }

  /**
   * 保存角色在某模块的数据范围
   */
  async saveRoleDataScope(
    roleId: string,
    module: string,
    scope: DataScope,
  ): Promise<void> {
    if (!DATA_SCOPE_LABELS[scope]) {
      throw new BadRequestException(`不支持的数据范围: ${scope}`);
    }
    const menuCode = `${module}:view`;
    const permission = await this.prisma.permission.findUnique({
      where: { code: menuCode },
      select: { id: true },
    });
    if (!permission) {
      throw new BadRequestException(`模块 ${module} 没有对应的菜单权限点（${menuCode}）`);
    }
    await this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId: permission.id },
      },
      update: { dataScope: scope },
      create: { roleId, permissionId: permission.id, dataScope: scope },
    });
  }

  /**
   * 解析某用户在某模块的最终数据范围
   * 多角色取「最宽松」的那个；超级管理员恒为 ALL
   *
   * @param _roleCodes 已废弃（保留参数只为兼容调用点）：角色一律以数据库为准
   */
  async resolveDataScope(
    userId: string,
    module: string,
    _roleCodes: string[] = [],
  ): Promise<DataScope> {
    const roleCodes = await this.loadRoleCodes(userId);

    if (roleCodes.includes('super_admin')) return DataScope.ALL;

    const menuCode = `${module}:view`;
    let roleIds: string[] = [];
    if (roleCodes.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: { code: { in: roleCodes }, deletedAt: null },
        select: { id: true },
      });
      roleIds = roles.map((r) => r.id);
    }
    // 用户没有任何启用角色：不该看到任何数据，取最严范围（fail-closed）
    if (roleIds.length === 0) return DataScope.OWN_CREATED;

    const rows = await this.prisma.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
        permission: { code: menuCode },
      },
      select: { dataScope: true },
    });
    const scopes = rows
      .map((r) => r.dataScope as DataScope | null)
      .filter((v): v is DataScope => !!v && !!DATA_SCOPE_LABELS[v]);
    if (scopes.length === 0) return DataScope.ALL;
    // 宽松优先：ALL > OWN_SHOP > OWN_CREATED
    const order = [DataScope.ALL, DataScope.OWN_SHOP, DataScope.OWN_CREATED];
    for (const candidate of order) {
      if (scopes.includes(candidate)) return candidate;
    }
    return DataScope.ALL;
  }


  /** 支持数据范围的模块 + 指定角色当前的取值（供配置界面渲染） */
  async getRoleDataScopes(roleId: string) {
    const items = await Promise.all(
      DATA_SCOPE_MODULES.map(async (m) => ({
        module: m.module,
        label: m.label,
        value: await this.getRoleDataScope(roleId, m.module),
      })),
    );
    return {
      items,
      options: Object.entries(DATA_SCOPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    };
  }


  /**
   * 解析用户在「按店铺隔离」模块中可见的店铺 ID 列表
   *
   * @returns undefined 表示不过滤（可见全部店铺）；数组表示只允许这些店铺
   * 适用模块：链接管理 / SKU管理 / 定价计算 / 利润报表 等（数据挂在店铺下的模块）
   */
  async resolveVisibleShopIds(
    userId: string,
    module: string,
    roleCodes: string[] = [],
  ): Promise<string[] | undefined> {
    const scope = await this.resolveDataScope(userId, module, roleCodes);
    if (scope === DataScope.ALL) return undefined;
    const shops = await this.prisma.shop.findMany({
      where: { managerId: userId, deletedAt: null },
      select: { id: true },
    });
    return shops.map((shop) => shop.id);
  }

  /**
   * 从数据对象中删除不可见字段（返回新对象，不修改原对象）
   */
  stripHiddenFields<T extends Record<string, any>>(
    row: T,
    mappings: FieldKeyMapping[],
    state: FieldPermissionState,
  ): T {
    if (!row) return row;
    const out: Record<string, any> = { ...row };
    for (const m of mappings) {
      if (state.canView.has(m.field)) continue;
      const parts = m.key.split('.');
      if (parts.length === 1) {
        delete out[parts[0]];
        continue;
      }
      // 嵌套字段：逐层拷贝，避免改动原始对象
      let src: any = row;
      let dst: any = out;
      let ok = true;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        // 注意：只有「已经不是原对象」时才认为本层已拷贝过；
        // 否则会因为 dst[k] === src[k]（浅拷贝后仍指向同一引用）而复用原对象，
        // 导致 delete 直接改掉调用方传入的对象。
        if (dst[k] && typeof dst[k] === 'object' && dst[k] !== src[k]) {
          // 本层已拷贝过
        } else if (src && src[k] && typeof src[k] === 'object') {
          dst[k] = Array.isArray(src[k]) ? [...src[k]] : { ...src[k] };
        } else {
          ok = false;
          break;
        }
        src = src?.[k];
        dst = dst[k];
      }
      if (ok && dst && typeof dst === 'object') {
        delete dst[parts[parts.length - 1]];
      }
    }
    return out as T;
  }

  /** 批量过滤（列表场景） */
  stripHiddenFieldsForList<T extends Record<string, any>>(
    rows: T[],
    mappings: FieldKeyMapping[],
    state: FieldPermissionState,
  ): T[] {
    if (!rows?.length) return rows;
    return rows.map((r) => this.stripHiddenFields(r, mappings, state));
  }

  /**
   * 递归脱敏（安全版，推荐统一使用）
   *
   * 与各 controller 里手写的 `stripXxxDeep` 的区别：
   *   1. **不会破坏 Date / Buffer / Prisma.Decimal 等非普通对象** ——
   *      原来的写法对任意 `typeof === 'object'` 递归，`{...new Date()}` 会变成 `{}`，
   *      导致列表里的「上传时间 / 操作时间 / 发送时间」全部显示为空；
   *   2. 数组逐元素处理，嵌套对象逐层处理；
   *   3. 全程返回新对象，不改动调用方传入的数据。
   */
  stripHiddenFieldsDeep<T>(
    node: T,
    mappings: FieldKeyMapping[],
    state: FieldPermissionState,
  ): T {
    if (Array.isArray(node)) {
      return node.map((item) =>
        this.stripHiddenFieldsDeep(item, mappings, state),
      ) as unknown as T;
    }
    if (!node || typeof node !== 'object') return node;
    // 只递归「普通对象」；Date / Buffer / Decimal / 类实例一律原样返回
    const proto = Object.getPrototypeOf(node);
    if (proto !== Object.prototype && proto !== null) return node;

    const out = this.stripHiddenFields(
      node as unknown as Record<string, any>,
      mappings,
      state,
    ) as unknown as Record<string, any>;
    for (const key of Object.keys(out)) {
      const value = out[key];
      if (value && typeof value === 'object') {
        out[key] = this.stripHiddenFieldsDeep(value, mappings, state);
      }
    }
    return out as unknown as T;
  }

  /** 递归脱敏（列表场景） */
  stripHiddenFieldsDeepForList<T>(
    rows: T[],
    mappings: FieldKeyMapping[],
    state: FieldPermissionState,
  ): T[] {
    if (!rows?.length) return rows;
    return rows.map((r) => this.stripHiddenFieldsDeep(r, mappings, state));
  }

  /**
   * 写入前剔除不可编辑字段（返回新对象）
   * 用于 update 场景：被配成"只读"的字段，即使直接调接口传了也不生效
   *
   * 支持两种 key：
   *   - 顶层键（`name`）
   *   - 嵌套路径（`product.code`），与 `stripHiddenFields` 的写法保持对称；
   *     原先只用 `m.key in out` 判定，含点号的 key 永远匹配不到 → 写过滤静默失效。
   */
  stripUneditableFields<T extends Record<string, any>>(
    dto: T,
    mappings: FieldKeyMapping[],
    state: FieldPermissionState,
  ): T {
    const out: Record<string, any> = { ...dto };
    for (const m of mappings) {
      if (state.canEdit.has(m.field)) continue;
      const parts = m.key.split('.');
      if (parts.length === 1) {
        if (parts[0] in out) delete out[parts[0]];
        continue;
      }
      // 嵌套路径：逐层定位后删除（路径不存在则忽略）
      let target: any = out;
      let ok = true;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (target && typeof target === 'object' && k in target) {
          target = target[k];
        } else {
          ok = false;
          break;
        }
      }
      if (ok && target && typeof target === 'object') {
        delete target[parts[parts.length - 1]];
      }
    }
    return out as T;
  }
}
