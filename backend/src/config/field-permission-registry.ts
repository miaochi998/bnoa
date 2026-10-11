/**
 * 字段级权限注册表
 *
 * 用途：声明每个模块里「可以由管理员配置可见性 / 可编辑性」的字段。
 * 配套机制见 `docs/权限系统设计规范（草案）.md`：
 *   1. 新模块开发时**必须在此登记字段**，否则后台配置界面看不到它，管理员也就配不了。
 *   2. `editable: false` 表示该字段由系统生成或自动计算，只能配置"能不能看"（没有"能不能改"）。
 *   3. `defaultVisible` 表示角色**未做任何配置时**的默认可见性，用来避免改造上线后页面空白。
 *   4. `sensitive: true` 仅用于在配置界面给出提示，不参与逻辑判断。
 *
 * 数据侧：角色的显式配置存在 `role_field_permissions` 表（module + field + canView + canEdit）。
 *   - 表中**无记录** → 取 `defaultVisible`（可见），且编辑权沿用模块级动作权限；
 *   - `canView=false` → 该字段对角色完全隐藏（后端响应中会被移除）；
 *   - `canView=true, canEdit=false` → 只读；
 *   - `canView=true, canEdit=true` → 可编辑。
 */

export interface FieldPermissionDefinition {
  /** 模块标识（与业务模块一致），如 supplier */
  module: string;
  /** 字段标识，模块内唯一；子实体用 `前缀.字段`，如 product.supplyPrice */
  field: string;
  /** 中文名称（配置界面显示） */
  name: string;
  /** 信息组（配置界面按此分组，可一键全开/全关） */
  group: string;
  /** 是否可编辑；系统自动生成 / 自动计算的字段为 false */
  editable: boolean;
  /** 角色未配置时的默认可见性，缺省为 true */
  defaultVisible?: boolean;
  /** 敏感字段提示（仅界面提示用） */
  sensitive?: boolean;
  /** 备注（配置界面提示） */
  note?: string;
}

export const FIELD_PERMISSION_REGISTRY: FieldPermissionDefinition[] = [
  // ===================== 供应商管理 =====================
  {
    module: 'supplier',
    field: 'code',
    name: '供应商编码',
    group: '基本信息',
    editable: false,
    note: '系统自动生成，创建后不可修改',
  },
  { module: 'supplier', field: 'name', name: '供应商名称', group: '基本信息', editable: true },
  { module: 'supplier', field: 'status', name: '合作状态', group: '基本信息', editable: true },
  {
    module: 'supplier',
    field: 'contact',
    name: '联系人',
    group: '联系方式',
    editable: true,
    sensitive: true,
  },
  {
    module: 'supplier',
    field: 'phone',
    name: '联系电话',
    group: '联系方式',
    editable: true,
    sensitive: true,
  },
  {
    module: 'supplier',
    field: 'address',
    name: '联系地址',
    group: '联系方式',
    editable: true,
    sensitive: true,
  },
  { module: 'supplier', field: 'remark', name: '备注', group: '备注', editable: true },

  // 关联产品（供货信息）
  {
    module: 'supplier',
    field: 'product.code',
    name: '产品编码',
    group: '关联产品',
    editable: false,
  },
  {
    module: 'supplier',
    field: 'product.name',
    name: '产品名称',
    group: '关联产品',
    editable: false,
  },
  {
    module: 'supplier',
    field: 'product.styleName',
    name: '款式名称',
    group: '关联产品',
    editable: true,
  },
  {
    module: 'supplier',
    field: 'product.supplyPrice',
    name: '供货价格',
    group: '关联产品',
    editable: true,
    sensitive: true,
    note: '运营算定价时需要看到',
  },
  {
    module: 'supplier',
    field: 'product.priceUnit',
    name: '价格单位',
    group: '关联产品',
    editable: true,
  },
  {
    module: 'supplier',
    field: 'product.priceUnitCustom',
    name: '自定义单位',
    group: '关联产品',
    editable: true,
    note: '单位选「自定义」时出现',
  },
  {
    module: 'supplier',
    field: 'product.status',
    name: '关联状态',
    group: '关联产品',
    editable: true,
  },
  {
    module: 'supplier',
    field: 'product.remark',
    name: '关联备注',
    group: '关联产品',
    editable: true,
    note: '后端已有字段，前端暂未暴露入口',
  },
  // ===================== 平台管理 =====================
  // 基本信息
  { module: 'platform', field: 'name', name: '平台名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'platform', field: 'code', name: '平台编码', group: '基本信息', editable: true, defaultVisible: true, note: '建议只有管理员可改' },
  { module: 'platform', field: 'type', name: '平台类型', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'platform', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  // 链接信息
  { module: 'platform', field: 'website', name: '官网地址', group: '链接信息', editable: true, defaultVisible: true },
  { module: 'platform', field: 'logo', name: '平台Logo', group: '链接信息', editable: true, defaultVisible: true },
  // 备注
  { module: 'platform', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // ===================== 店铺管理 =====================
  // 基本信息
  { module: 'shop', field: 'name', name: '店铺名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'shop', field: 'platformId', name: '所属平台', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'shop', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'shop', field: 'managerId', name: '店铺负责人', group: '基本信息', editable: true, defaultVisible: true, note: '决定「只看自己负责的店铺」的数据范围归属' },
  // 备注
  { module: 'shop', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // ===================== 快递管理 =====================
  // 基本信息
  { module: 'express', field: 'name', name: '快递公司名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'express', field: 'code', name: '编码', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'express', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  // 联系方式
  { module: 'express', field: 'contactName', name: '联系人', group: '联系方式', editable: true, defaultVisible: true },
  { module: 'express', field: 'contactPhone', name: '联系电话', group: '联系方式', editable: true, defaultVisible: true, sensitive: true },
  // 备注
  { module: 'express', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // 快递价格相关（嵌套在快递公司下的配置数据）
  // 区域配置
  { module: 'express', field: 'zone.name', name: '区域名称', group: '区域配置', editable: true, defaultVisible: true },
  { module: 'express', field: 'zone.provinces', name: '包含省份', group: '区域配置', editable: true, defaultVisible: true },
  // 重量区间
  { module: 'express', field: 'weightRange.label', name: '区间名称', group: '重量区间', editable: true, defaultVisible: true },
  { module: 'express', field: 'weightRange.minWeight', name: '最小重量(kg)', group: '重量区间', editable: true, defaultVisible: true },
  { module: 'express', field: 'weightRange.maxWeight', name: '最大重量(kg)', group: '重量区间', editable: true, defaultVisible: true },
  // 价格矩阵
  { module: 'express', field: 'price.price', name: '单价(元)', group: '价格矩阵', editable: true, defaultVisible: true, sensitive: true },
  // 附加费
  { module: 'express', field: 'surcharge.name', name: '附加费名称', group: '附加费', editable: true, defaultVisible: true },
  { module: 'express', field: 'surcharge.provinces', name: '适用省份', group: '附加费', editable: true, defaultVisible: true },
  { module: 'express', field: 'surcharge.weightFrom', name: '起始重量(kg)', group: '附加费', editable: true, defaultVisible: true },
  { module: 'express', field: 'surcharge.weightTo', name: '截至重量(kg)', group: '附加费', editable: true, defaultVisible: true },
  { module: 'express', field: 'surcharge.amount', name: '附加费金额(元)', group: '附加费', editable: true, defaultVisible: true, sensitive: true },

  // ===================== 产品管理 =====================
  // 基本信息
  { module: 'product', field: 'name', name: '产品名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'product', field: 'code', name: '产品编码', group: '基本信息', editable: true, defaultVisible: true, note: '创建后不可修改' },
  { module: 'product', field: 'brand', name: '品牌', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'product', field: 'pricingMode', name: '计价方式', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'product', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  // 产品图片
  { module: 'product', field: 'mainImage', name: '产品主图', group: '产品图片', editable: true, defaultVisible: true },
  // 备注
  { module: 'product', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // ===================== 链接管理 =====================
  // 基本信息
  { module: 'product-link', field: 'name', name: '链接名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'product-link', field: 'shopId', name: '所属店铺', group: '基本信息', editable: true, defaultVisible: true, note: '同时决定「只看自己负责的店铺」的数据范围归属' },
  { module: 'product-link', field: 'status', name: '链接状态', group: '基本信息', editable: true, defaultVisible: true },
  // 平台信息
  { module: 'product-link', field: 'platformUrl', name: '平台链接URL', group: '平台信息', editable: true, defaultVisible: true },
  { module: 'product-link', field: 'platformItemId', name: '平台商品ID', group: '平台信息', editable: true, defaultVisible: true },
  // 备注
  { module: 'product-link', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // ===================== SKU 管理 =====================
  // 基本信息
  { module: 'sku', field: 'name', name: 'SKU名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'sku', field: 'linkId', name: '所属链接', group: '基本信息', editable: true, defaultVisible: true, note: '同时决定「只看自己负责的店铺」的数据范围归属' },
  { module: 'sku', field: 'type', name: 'SKU类型', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'sku', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'sku', field: 'weight', name: '重量(kg)', group: '基本信息', editable: true, defaultVisible: true },
  // 关联成品
  { module: 'sku', field: 'finishedProducts', name: '关联成品', group: '关联成品', editable: true, defaultVisible: true, note: '该 SKU 由哪些成品组成及各自数量' },
  // 成本信息
  { module: 'sku', field: 'productCost', name: '成品成本', group: '成本信息', editable: true, defaultVisible: true, sensitive: true },
  { module: 'sku', field: 'expressCost', name: '快递费', group: '成本信息', editable: true, defaultVisible: true, sensitive: true },
  { module: 'sku', field: 'totalCost', name: '总成本', group: '成本信息', editable: true, defaultVisible: true, sensitive: true, note: '无编辑权时不允许「重算成本」' },
  { module: 'sku', field: 'comboPackageFee', name: '组合包装费', group: '成本信息', editable: true, defaultVisible: true, sensitive: true },
  { module: 'sku', field: 'miscFee', name: '综合费用', group: '成本信息', editable: true, defaultVisible: true, sensitive: true },
  // 其他信息
  { module: 'sku', field: 'defaultExpressCompanyId', name: '默认快递公司', group: '其他信息', editable: true, defaultVisible: true },
  { module: 'sku', field: 'remark', name: '备注', group: '其他信息', editable: true, defaultVisible: true },

  // ===================== 定价计算 =====================
  // 基本信息
  { module: 'pricing', field: 'name', name: '方案名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'pricing', field: 'linkId', name: '所属链接', group: '基本信息', editable: true, defaultVisible: true, note: '同时决定「只看自己负责的店铺」的数据范围归属' },
  // 定价参数
  { module: 'pricing', field: 'profitRates', name: '利润率(%)', group: '定价参数', editable: true, defaultVisible: true, sensitive: true },
  { module: 'pricing', field: 'commissionRate', name: '平台佣金率', group: '定价参数', editable: true, defaultVisible: true, sensitive: true },
  { module: 'pricing', field: 'taxRate', name: '税费率', group: '定价参数', editable: true, defaultVisible: true, sensitive: true },
  { module: 'pricing', field: 'talentCommissionRate', name: '达人佣金率', group: '定价参数', editable: true, defaultVisible: true, sensitive: true },
  // 方案数据
  { module: 'pricing', field: 'selectedPrices', name: '选定售价', group: '方案数据', editable: true, defaultVisible: true, sensitive: true, note: '每个 SKU 选定的利润档位' },
  { module: 'pricing', field: 'skuSummaries', name: '方案汇总明细', group: '方案数据', editable: false, defaultVisible: true, sensitive: true, note: '含各 SKU 成本/建议售价/毛利润，派生数据不可编辑' },
  // 备注
  { module: 'pricing', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // ===================== 成品管理 =====================
  // 基本信息
  { module: 'finished-product', field: 'code', name: '成品编码', group: '基本信息', editable: true, defaultVisible: true, note: '系统按规则生成' },
  { module: 'finished-product', field: 'name', name: '成品名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'productId', name: '所属产品', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'supplierProductId', name: '供应商价格', group: '基本信息', editable: true, defaultVisible: true, sensitive: true, note: '关联供应商供货价' },
  { module: 'finished-product', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  // 规格与包装
  { module: 'finished-product', field: 'cutLength', name: '切割长度(cm)', group: '规格与包装', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'cutWidth', name: '切割宽度(cm)', group: '规格与包装', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'cutHeight', name: '切割高度(cm)', group: '规格与包装', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'unitWeight', name: '单份重量(g)', group: '规格与包装', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'packageType', name: '包装类型', group: '规格与包装', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'packageQuantity', name: '每包数量', group: '规格与包装', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'packageUnit', name: '包装单位', group: '规格与包装', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'weight', name: '成品重量(kg)', group: '规格与包装', editable: true, defaultVisible: true },
  // 耗材与工费
  { module: 'finished-product', field: 'consumableItems', name: '耗材清单', group: '耗材与工费', editable: true, defaultVisible: true },
  { module: 'finished-product', field: 'laborItems', name: '工费清单', group: '耗材与工费', editable: true, defaultVisible: true },
  // 成本信息
  { module: 'finished-product', field: 'materialCost', name: '材料成本', group: '成本信息', editable: true, defaultVisible: true, sensitive: true },
  { module: 'finished-product', field: 'consumableCost', name: '耗材成本', group: '成本信息', editable: true, defaultVisible: true, sensitive: true },
  { module: 'finished-product', field: 'laborCost', name: '人工成本', group: '成本信息', editable: true, defaultVisible: true, sensitive: true },
  { module: 'finished-product', field: 'totalCost', name: '总成本', group: '成本信息', editable: true, defaultVisible: true, sensitive: true, note: '无编辑权时不允许「重算成本」' },
  // 备注
  { module: 'finished-product', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // ===================== 耗材管理 =====================
  // 基本信息
  { module: 'consumable', field: 'name', name: '耗材名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'code', name: '耗材编码', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'category', name: '耗材分类', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'specDesc', name: '规格描述', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'image', name: '耗材图片', group: '基本信息', editable: true, defaultVisible: true },
  // 价格信息
  { module: 'consumable', field: 'price.unitPrice', name: '耗材价格', group: '价格信息', editable: true, defaultVisible: true, sensitive: true, note: '含供应商采购价与历史价格；无编辑权时不允许增改价格' },
  // 耗材供应商
  { module: 'consumable', field: 'supplier.name', name: '供应商名称', group: '耗材供应商', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'supplier.code', name: '供应商编码', group: '耗材供应商', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'supplier.contact', name: '供应商联系人', group: '耗材供应商', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'supplier.phone', name: '供应商电话', group: '耗材供应商', editable: true, defaultVisible: true, sensitive: true },
  { module: 'consumable', field: 'supplier.status', name: '供应商状态', group: '耗材供应商', editable: true, defaultVisible: true },
  { module: 'consumable', field: 'supplier.remark', name: '供应商备注', group: '耗材供应商', editable: true, defaultVisible: true },
  // 备注
  { module: 'consumable', field: 'remark', name: '备注', group: '备注', editable: true, defaultVisible: true },

  // ===================== 工费管理 =====================
  // 基本信息
  { module: 'labor', field: 'name', name: '工种名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'labor', field: 'code', name: '工种编码', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'labor', field: 'billingType', name: '计费方式', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'labor', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  // 费率信息
  { module: 'labor', field: 'rate.unitPrice', name: '工费标准', group: '费率信息', editable: true, defaultVisible: true, sensitive: true, note: '含历史费率；无编辑权时不允许增改费率' },
  { module: 'labor', field: 'rate.unit', name: '计价单位', group: '费率信息', editable: true, defaultVisible: true },
  { module: 'labor', field: 'rate.remark', name: '费率备注', group: '费率信息', editable: true, defaultVisible: true },

  // ===================== 利润报表 =====================
  // 报表基本信息
  { module: 'profit', field: 'year', name: '年份', group: '报表基本信息', editable: true, defaultVisible: true },
  { module: 'profit', field: 'month', name: '月份', group: '报表基本信息', editable: true, defaultVisible: true },
  { module: 'profit', field: 'status', name: '报表状态', group: '报表基本信息', editable: true, defaultVisible: true },
  { module: 'profit', field: 'remark', name: '备注', group: '报表基本信息', editable: true, defaultVisible: true },
  // 报表汇总（列表/分析接口的派生值）
  { module: 'profit', field: 'summary.totalExpense', name: '费用合计', group: '报表汇总', editable: false, defaultVisible: true, sensitive: true, note: '列表与分析的派生汇总，不可编辑' },
  { module: 'profit', field: 'summary.totalNetProfit', name: '净利润合计', group: '报表汇总', editable: false, defaultVisible: true, sensitive: true, note: '列表与分析的派生汇总，不可编辑' },
  // 店铺明细金额
  { module: 'profit', field: 'entry.salesAmount', name: '销售额', group: '店铺明细', editable: true, defaultVisible: true, sensitive: true },
  { module: 'profit', field: 'entry.rawMaterialCost', name: '原料成本', group: '店铺明细', editable: true, defaultVisible: true, sensitive: true },
  { module: 'profit', field: 'entry.packagingCost', name: '包装成本', group: '店铺明细', editable: true, defaultVisible: true, sensitive: true },
  { module: 'profit', field: 'entry.laborCost', name: '人工成本', group: '店铺明细', editable: true, defaultVisible: true, sensitive: true },
  { module: 'profit', field: 'entry.grossProfit', name: '毛利润', group: '店铺明细', editable: true, defaultVisible: true, sensitive: true },
  { module: 'profit', field: 'entry.netProfit', name: '净利润', group: '店铺明细', editable: true, defaultVisible: true, sensitive: true },
  // 费用金额（公司费用/店铺费用/非费用/快递费/分摊项统一取 amount）
  { module: 'profit', field: 'amount', name: '费用金额', group: '费用与分摊', editable: true, defaultVisible: true, sensitive: true, note: '公司费用/店铺费用/平台非费用/快递费/分摊金额统一受此控制' },

  // ===================== 达人管理 =====================
  // 基本信息
  { module: 'talent', field: 'name', name: '达人名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'talent', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'talent', field: 'level', name: '达人等级', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'talent', field: 'managerId', name: '负责人', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'talent', field: 'remark', name: '备注', group: '基本信息', editable: true, defaultVisible: true },
  // 联系方式
  { module: 'talent', field: 'wechat', name: '微信号', group: '联系方式', editable: true, defaultVisible: true, sensitive: true },
  { module: 'talent', field: 'phone', name: '手机号', group: '联系方式', editable: true, defaultVisible: true, sensitive: true },
  // 平台账号
  { module: 'talent', field: 'platform.nickname', name: '平台昵称', group: '平台账号', editable: true, defaultVisible: true },
  { module: 'talent', field: 'platform.accountId', name: '平台账号', group: '平台账号', editable: true, defaultVisible: true, sensitive: true },
  { module: 'talent', field: 'platform.homeUrl', name: '主页链接', group: '平台账号', editable: true, defaultVisible: true },
  // 沟通记录
  { module: 'talent', field: 'contactLog.content', name: '沟通记录内容', group: '沟通记录', editable: true, defaultVisible: true, sensitive: true },

  // ===================== 用户管理 =====================
  // 基本信息
  { module: 'user', field: 'username', name: '用户名', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'user', field: 'name', name: '姓名', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'user', field: 'avatar', name: '头像', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'user', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'user', field: 'roles', name: '角色', group: '基本信息', editable: false, defaultVisible: true, note: '派生自用户角色关联，请到角色分配里修改' },
  // 联系方式
  { module: 'user', field: 'email', name: '邮箱', group: '联系方式', editable: true, defaultVisible: true, sensitive: true },
  { module: 'user', field: 'phone', name: '手机号', group: '联系方式', editable: true, defaultVisible: true, sensitive: true },
  // 登录信息
  { module: 'user', field: 'lastLoginAt', name: '最后登录时间', group: '登录信息', editable: false, defaultVisible: true, note: '系统记录，不可编辑' },

  // ===================== 进货入库 =====================
  // 基本信息
  { module: 'purchase', field: 'receiptNo', name: '入库单号', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'receiptTime', name: '入库日期', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'billNo', name: '票据号', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'billNoSource', name: '票据号来源', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'isAccurate', name: '是否准确', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'checkerId', name: '验收人', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'remark', name: '备注', group: '基本信息', editable: true, defaultVisible: true },
  // 金额
  { module: 'purchase', field: 'billAmount', name: '账单金额', group: '金额', editable: true, defaultVisible: true, sensitive: true },
  // 货物明细
  { module: 'purchase', field: 'item.itemType', name: '货物类型', group: '货物明细', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'item.itemName', name: '入库产品', group: '货物明细', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'item.supplierName', name: '供应商', group: '货物明细', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'item.specName', name: '产品规格', group: '货物明细', editable: true, defaultVisible: true },
  { module: 'purchase', field: 'item.quantityText', name: '入库数量', group: '货物明细', editable: true, defaultVisible: true },

  // ===================== 付款记录 =====================
  // 基本信息
  { module: 'payment', field: 'recordNo', name: '付款单号', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'payment', field: 'title', name: '付款事由', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'payment', field: 'paymentTime', name: '付款时间', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'payment', field: 'paymentType', name: '付款类型', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'payment', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'payment', field: 'remark', name: '备注', group: '基本信息', editable: true, defaultVisible: true },
  // 金额与账户
  { module: 'payment', field: 'amount', name: '付款金额', group: '金额与账户', editable: true, defaultVisible: true, sensitive: true, note: '汇总接口的总额、按类型/收款方金额同受此控制' },
  { module: 'payment', field: 'fromAccount', name: '付款账户', group: '金额与账户', editable: true, defaultVisible: true, sensitive: true },
  // 收款方与发票
  { module: 'payment', field: 'receiverType', name: '收款方类型', group: '收款方与发票', editable: true, defaultVisible: true },
  { module: 'payment', field: 'receiverName', name: '收款方', group: '收款方与发票', editable: true, defaultVisible: true },
  { module: 'payment', field: 'payMethod', name: '付款方式', group: '收款方与发票', editable: true, defaultVisible: true },
  { module: 'payment', field: 'invoiceStatus', name: '发票状态', group: '收款方与发票', editable: true, defaultVisible: true },

  // ===================== 记事本 =====================
  { module: 'notebook', field: 'title', name: '标题', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'notebook', field: 'content', name: '内容', group: '基本信息', editable: true, defaultVisible: true, sensitive: true },
  { module: 'notebook', field: 'userId', name: '所属用户', group: '基本信息', editable: false, defaultVisible: true, note: '笔记归属；超管可在列表中看到全部人的笔记' },

  // ===================== 通知管理 =====================
  // 说明：只作用于通知管理端（广播列表/详情、全员通知记录）；用户自己的通知不脱敏
  { module: 'notification', field: 'broadcastNo', name: '广播编号', group: '广播信息', editable: false, defaultVisible: true },
  { module: 'notification', field: 'title', name: '通知标题', group: '广播信息', editable: true, defaultVisible: true, note: '广播与通知记录共用' },
  { module: 'notification', field: 'content', name: '通知内容', group: '广播信息', editable: true, defaultVisible: true, sensitive: true, note: '广播与通知记录共用' },
  { module: 'notification', field: 'targetType', name: '发送目标', group: '广播信息', editable: true, defaultVisible: true },
  { module: 'notification', field: 'status', name: '状态', group: '广播信息', editable: false, defaultVisible: true },
  // 发送统计
  { module: 'notification', field: 'targetCount', name: '目标人数', group: '发送统计', editable: false, defaultVisible: true },
  { module: 'notification', field: 'sentCount', name: '已发送数', group: '发送统计', editable: false, defaultVisible: true },
  { module: 'notification', field: 'readCount', name: '已读数', group: '发送统计', editable: false, defaultVisible: true },
  // 通知记录
  { module: 'notification', field: 'userId', name: '接收人', group: '通知记录', editable: false, defaultVisible: true },

  // ===================== 文件中心 =====================
  // 基本信息
  { module: 'file', field: 'name', name: '文件名', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'file', field: 'originalName', name: '原始文件名', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'file', field: 'extension', name: '文件扩展名', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'file', field: 'size', name: '文件大小', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'file', field: 'category', name: '文件分类', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'file', field: 'createdAt', name: '上传时间', group: '基本信息', editable: false, defaultVisible: true },
  // 归属信息
  { module: 'file', field: 'uploadedBy', name: '上传者', group: '归属信息', editable: false, defaultVisible: true, note: '含上传者信息对象' },
  { module: 'file', field: 'folderId', name: '所属文件夹', group: '归属信息', editable: true, defaultVisible: true, note: '含文件夹信息对象' },
  // 存储与安全
  { module: 'file', field: 'url', name: '访问地址', group: '存储与安全', editable: false, defaultVisible: true, sensitive: true, note: '隐藏后前端缩略图/预览可能无法显示' },
  { module: 'file', field: 'path', name: '存储路径', group: '存储与安全', editable: false, defaultVisible: true, sensitive: true },
  { module: 'file', field: 'md5', name: 'MD5 校验值', group: '存储与安全', editable: false, defaultVisible: true, sensitive: true },
  { module: 'file', field: 'virusScanResult', name: '病毒扫描结果', group: '存储与安全', editable: false, defaultVisible: true, sensitive: true },
  { module: 'file', field: 'shareCode', name: '分享码', group: '存储与安全', editable: false, defaultVisible: true, sensitive: true },
  // 文件夹（与文件同属「文件管理」模块）
  { module: 'file', field: 'folder.name', name: '文件夹名称', group: '文件夹·基本信息', editable: true, defaultVisible: true },
  { module: 'file', field: 'folder.description', name: '文件夹描述', group: '文件夹·基本信息', editable: true, defaultVisible: true },
  { module: 'file', field: 'folder.createdAt', name: '创建时间', group: '文件夹·基本信息', editable: false, defaultVisible: true },
  { module: 'file', field: 'folder.isSystem', name: '系统文件夹', group: '文件夹·基本信息', editable: false, defaultVisible: true },
  { module: 'file', field: 'folder.parentId', name: '上级文件夹', group: '文件夹·层级与归属', editable: true, defaultVisible: true, note: '隐藏会影响文件夹树的层级展示' },
  { module: 'file', field: 'folder.createdBy', name: '创建者', group: '文件夹·层级与归属', editable: false, defaultVisible: true },
  { module: 'file', field: 'folder.access', name: '访问权限', group: '文件夹·共享与权限', editable: true, defaultVisible: true },
  { module: 'file', field: 'folder.shareType', name: '共享类型', group: '文件夹·共享与权限', editable: true, defaultVisible: true },
  { module: 'file', field: 'folder.isSystemShared', name: '系统共享文件夹', group: '文件夹·共享与权限', editable: true, defaultVisible: true },

  // ===================== 审计日志 =====================
  // 基本信息
  { module: 'audit', field: 'action', name: '操作类型', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'audit', field: 'module', name: '业务模块', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'audit', field: 'resource', name: '操作对象', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'audit', field: 'resourceId', name: '对象ID', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'audit', field: 'description', name: '操作描述', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'audit', field: 'createdAt', name: '操作时间', group: '基本信息', editable: false, defaultVisible: true },
  // 操作人
  { module: 'audit', field: 'username', name: '操作人账号', group: '操作人', editable: false, defaultVisible: true },
  { module: 'audit', field: 'realName', name: '操作人姓名', group: '操作人', editable: false, defaultVisible: true },
  // 来源信息（敏感）
  { module: 'audit', field: 'ip', name: '来源IP', group: '来源信息', editable: false, defaultVisible: true, sensitive: true },
  { module: 'audit', field: 'userAgent', name: '客户端信息', group: '来源信息', editable: false, defaultVisible: true, sensitive: true },
  { module: 'audit', field: 'requestUrl', name: '请求地址', group: '来源信息', editable: false, defaultVisible: true, sensitive: true },
  // 变更内容（敏感）
  { module: 'audit', field: 'oldValue', name: '变更前', group: '变更内容', editable: false, defaultVisible: true, sensitive: true },
  { module: 'audit', field: 'newValue', name: '变更后', group: '变更内容', editable: false, defaultVisible: true, sensitive: true },
  { module: 'audit', field: 'diff', name: '差异明细', group: '变更内容', editable: false, defaultVisible: true, sensitive: true },

  // ===================== 系统配置 =====================
  { module: 'system', field: 'key', name: '配置项', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'system', field: 'value', name: '配置值', group: '基本信息', editable: true, defaultVisible: true, sensitive: true, note: '可能包含地址、阈值等敏感内容' },
  { module: 'system', field: 'category', name: '配置分类', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'system', field: 'type', name: '值类型', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'system', field: 'isSystem', name: '系统内置项', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'system', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'system', field: 'description', name: '配置说明', group: '基本信息', editable: true, defaultVisible: true },

  // ===================== 数据字典 =====================
  { module: 'dictionary', field: 'typeCode', name: '字典类型编码', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'dictionary', field: 'typeName', name: '字典类型名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'dictionary', field: 'itemCode', name: '字典项编码', group: '字典项', editable: true, defaultVisible: true },
  { module: 'dictionary', field: 'itemName', name: '字典项名称', group: '字典项', editable: true, defaultVisible: true },
  { module: 'dictionary', field: 'itemValue', name: '字典项值', group: '字典项', editable: true, defaultVisible: true },
  { module: 'dictionary', field: 'description', name: '描述', group: '字典项', editable: true, defaultVisible: true },
  { module: 'dictionary', field: 'isDefault', name: '是否默认项', group: '字典项', editable: true, defaultVisible: true },
  { module: 'dictionary', field: 'isActive', name: '是否启用', group: '字典项', editable: true, defaultVisible: true },

  // ===================== 角色权限 =====================
  { module: 'role', field: 'name', name: '角色名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'role', field: 'code', name: '角色编码', group: '基本信息', editable: true, defaultVisible: true, note: '前端有按 code 判断内置角色的逻辑，隐藏可能影响角色识别' },
  { module: 'role', field: 'description', name: '角色描述', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'role', field: 'status', name: '状态', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'role', field: 'permissionCount', name: '权限数量', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'role', field: 'userCount', name: '关联用户数', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'role', field: 'isSystem', name: '系统内置角色', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'role', field: 'createdAt', name: '创建时间', group: '基本信息', editable: false, defaultVisible: true },

  // ===================== 任务管理 =====================
  { module: 'task', field: 'name', name: '任务名称', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'task', field: 'description', name: '任务说明', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'task', field: 'cron', name: '执行计划(cron)', group: '基本信息', editable: false, defaultVisible: true, sensitive: true },
  { module: 'task', field: 'enabled', name: '是否启用', group: '基本信息', editable: false, defaultVisible: true },
  { module: 'task', field: 'lastRunAt', name: '最后执行时间', group: '基本信息', editable: false, defaultVisible: true },

  // ===================== AI 模型管理 =====================
  { module: 'ai-model', field: 'name', name: '模型标识', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'ai-model', field: 'displayName', name: '显示名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'ai-model', field: 'provider', name: '供应商', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'ai-model', field: 'modelId', name: '模型ID', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'ai-model', field: 'apiEndpoint', name: '接口地址', group: '连接信息', editable: true, defaultVisible: true, sensitive: true, note: '通常是内网地址' },
  { module: 'ai-model', field: 'config', name: '模型配置', group: '连接信息', editable: true, defaultVisible: true, sensitive: true, note: '含 apiKey；接口已做 maskConfig 掩码' },
  { module: 'ai-model', field: 'description', name: '说明', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'ai-model', field: 'isEnabled', name: '是否启用', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'ai-model', field: 'isDefault', name: '是否默认', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'ai-model', field: 'isFree', name: '是否免费', group: '基本信息', editable: true, defaultVisible: true },

  // ===================== 邮件管理 =====================
  { module: 'email', field: 'to', name: '收件人', group: '邮件日志', editable: false, defaultVisible: true, sensitive: true },
  { module: 'email', field: 'subject', name: '邮件主题', group: '邮件日志', editable: false, defaultVisible: true },
  { module: 'email', field: 'template', name: '邮件模板', group: '邮件日志', editable: false, defaultVisible: true },
  { module: 'email', field: 'status', name: '发送状态', group: '邮件日志', editable: false, defaultVisible: true },
  { module: 'email', field: 'errorMessage', name: '失败原因', group: '邮件日志', editable: false, defaultVisible: true, sensitive: true },
  { module: 'email', field: 'category', name: '邮件分类', group: '邮件日志', editable: false, defaultVisible: true },
  { module: 'email', field: 'retryCount', name: '重试次数', group: '邮件日志', editable: false, defaultVisible: true },
  { module: 'email', field: 'sentAt', name: '发送时间', group: '邮件日志', editable: false, defaultVisible: true },

  // ===================== 安全中心 =====================
  { module: 'security', field: 'type', name: '事件类型', group: '安全事件', editable: false, defaultVisible: true },
  { module: 'security', field: 'severity', name: '严重级别', group: '安全事件', editable: false, defaultVisible: true },
  { module: 'security', field: 'status', name: '处理状态', group: '安全事件', editable: false, defaultVisible: true },
  { module: 'security', field: 'fileName', name: '涉及文件', group: '安全事件', editable: false, defaultVisible: true },
  { module: 'security', field: 'details', name: '事件详情', group: '安全事件', editable: false, defaultVisible: true, sensitive: true },
  { module: 'security', field: 'metadata', name: '附加信息', group: '安全事件', editable: false, defaultVisible: true, sensitive: true },
  { module: 'security', field: 'ipAddress', name: '来源IP', group: '安全事件', editable: false, defaultVisible: true, sensitive: true },
  { module: 'security', field: 'location', name: 'IP归属地', group: '安全事件', editable: false, defaultVisible: true, sensitive: true },
  { module: 'security', field: 'actionTaken', name: '处理动作', group: '安全事件', editable: false, defaultVisible: true },
  { module: 'security', field: 'notes', name: '处理备注', group: '安全事件', editable: false, defaultVisible: true },

  // ===================== 系统备份 =====================
  { module: 'backup', field: 'backupType', name: '备份类型', group: '备份记录', editable: false, defaultVisible: true },
  { module: 'backup', field: 'triggerType', name: '触发方式', group: '备份记录', editable: false, defaultVisible: true },
  { module: 'backup', field: 'status', name: '状态', group: '备份记录', editable: false, defaultVisible: true },
  { module: 'backup', field: 'storageType', name: '存储类型', group: '备份记录', editable: false, defaultVisible: true },
  { module: 'backup', field: 'storagePath', name: '存储路径', group: '备份记录', editable: false, defaultVisible: true, sensitive: true },
  { module: 'backup', field: 'fileSize', name: '文件大小', group: '备份记录', editable: false, defaultVisible: true },
  { module: 'backup', field: 'checksum', name: '校验和', group: '备份记录', editable: false, defaultVisible: true, sensitive: true },
  { module: 'backup', field: 'startedAt', name: '开始时间', group: '备份记录', editable: false, defaultVisible: true },
  { module: 'backup', field: 'completedAt', name: '完成时间', group: '备份记录', editable: false, defaultVisible: true },
  { module: 'backup', field: 'errorMessage', name: '失败原因', group: '备份记录', editable: false, defaultVisible: true, sensitive: true },
  { module: 'backup', field: 'operatorId', name: '操作人', group: '备份记录', editable: false, defaultVisible: true },

  // ===================== 编号查重 =====================
  { module: 'number-check', field: 'batchNo', name: '批次号', group: '查重批次', editable: false, defaultVisible: true },
  { module: 'number-check', field: 'fileId', name: '来源文件', group: '查重批次', editable: false, defaultVisible: true },
  { module: 'number-check', field: 'totalCount', name: '总条数', group: '查重批次', editable: false, defaultVisible: true },
  { module: 'number-check', field: 'code', name: '编号', group: '查重记录', editable: false, defaultVisible: true },
  { module: 'number-check', field: 'isDuplicate', name: '是否重复', group: '查重记录', editable: false, defaultVisible: true },

  // ===================== 权限管理 =====================
  { module: 'permission', field: 'name', name: '权限名称', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'permission', field: 'code', name: '权限编码', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'permission', field: 'type', name: '权限类型', group: '基本信息', editable: true, defaultVisible: true },
  { module: 'permission', field: 'description', name: '权限描述', group: '基本信息', editable: true, defaultVisible: true },

  // ========== 以下为「明细子表」字段（数据随父接口一起返回，父接口递归脱敏已覆盖） ==========
  // 付款——票据明细
  { module: 'payment', field: 'bill.billNumber', name: '票据号', group: '票据明细', editable: true, defaultVisible: true },
  { module: 'payment', field: 'bill.billDate', name: '票据日期', group: '票据明细', editable: true, defaultVisible: true },
  { module: 'payment', field: 'bill.billAmount', name: '票据金额', group: '票据明细', editable: true, defaultVisible: true, sensitive: true },
  // 店铺——别名
  { module: 'shop', field: 'alias.alias', name: '店铺别名', group: '别名', editable: true, defaultVisible: true },
  // 达人——标记
  { module: 'talent', field: 'flag.flagColor', name: '标记颜色', group: '标记', editable: true, defaultVisible: true },
  { module: 'talent', field: 'flagConfig.meaning', name: '标记含义', group: '标记', editable: true, defaultVisible: true },

  // 说明（2026-10-12）：原先登记的 `file.formatConfig.displayName` / `file.formatConfig.maxSize`
  // 已移除 —— 没有任何接口以 formatConfig 形式返回这两个字段（实际接口是安全中心的
  // `GET /upload/security/formats`，返回元素为 displayName / maxSize），属误登记，
  // 管理员配了也不会生效，故不再在「信息权限」里提供入口。
];

/**
 * 信息分组的前置功能权限
 *
 * 含义：某个信息分组里的「能看/能改」配置，必须**先开启**对应的功能权限才有意义。
 * 例：关联产品分组依赖 `supplier:product`（管理供应商产品）——功能没开，弹窗入口都没有，字段配置自然用不上。
 * 后台配置界面会据此给出提示。
 */
export const FIELD_GROUP_REQUIREMENTS: Record<
  string,
  Record<string, { permission: string; label: string }>
> = {
  supplier: {
    关联产品: { permission: 'supplier:product', label: '管理供应商产品' },
  },
};

/**
 * 支持「数据范围」配置的模块
 *
 * 数据范围 = 该角色能看到「哪些条」数据（全部 / 只看自己负责的店铺 / 只看自己提交的）。
 * 与字段权限相互独立：某个模块可以只配数据范围、还没登记字段。
 * 注意：约定的菜单权限码为 `<module>:view`，数据范围就存在这条权限上。
 */
export interface DataScopeModule {
  module: string;
  label: string;
}

export const DATA_SCOPE_MODULES: DataScopeModule[] = [
  { module: 'profit', label: '利润报表' },
  { module: 'number-check', label: '编号查重' },
  { module: 'product-link', label: '链接管理' },
  { module: 'sku', label: 'SKU管理' },
  { module: 'pricing', label: '定价计算' },
];

/** 按模块取字段定义 */
export function getFieldDefinitions(module: string): FieldPermissionDefinition[] {
  return FIELD_PERMISSION_REGISTRY.filter((f) => f.module === module);
}

/** 取某模块涉及的全部信息组（保持注册顺序） */
export function getFieldGroups(module: string): string[] {
  const groups: string[] = [];
  for (const f of getFieldDefinitions(module)) {
    if (!groups.includes(f.group)) groups.push(f.group);
  }
  return groups;
}

/** 已登记的模块列表 */
export function getRegisteredModules(): string[] {
  const modules: string[] = [];
  for (const f of FIELD_PERMISSION_REGISTRY) {
    if (!modules.includes(f.module)) modules.push(f.module);
  }
  return modules;
}
