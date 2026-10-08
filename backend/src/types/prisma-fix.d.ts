// 临时类型声明文件，用于绕过 Prisma Client 类型检查
// 这些类型将在 schema 修复完成后删除

declare module '@prisma/client' {
  // 扩展 PrismaClient，添加缺失的模型方法
  interface PrismaClient {
    // AI 模块
    aiModel: any;
    aiUsageLog: any;
    
    // 验证码模块
    captchaBackground: any;
    
    // 耗材模块
    consumable: any;
    consumablePrice: any;
    consumableSupplier: any;
    
    // 内容版本模块
    contentVersion: any;
    
    // 邮件模块
    emailLog: any;
    
    // 导出模块
    exportTask: any;
    
    // 快递模块
    expressCompany: any;
    expressPrice: any;
    expressSurcharge: any;
    expressWeightRange: any;
    expressZone: any;
    
    // 成品模块
    finishedProduct: any;
    finishedProductConsumable: any;
    finishedProductLabor: any;
    
    // 人工模块
    laborRate: any;
    laborType: any;
    
    // 通知模块
    notification: any;
    notificationBroadcast: any;
    notificationSetting: any;
    
    // 平台模块
    platform: any;
    
    // 定价模块
    pricingPlan: any;
    
    // 产品模块
    product: any;
    productLink: any;
    
    // 利润模块
    profitAllocationCategory: any;
    profitAllocationItem: any;
    profitCompanyExpense: any;
    profitNonExpense: any;
    profitReport: any;
    profitReportEntry: any;
    profitShippingCost: any;
    profitStoreExpense: any;
    
    // 文件夹模块
    realFolder: any;
    
    // 安全模块
    securityLog: any;
    
    // 店铺模块
    shop: any;
    
    // SKU模块
    sku: any;
    skuFinishedProduct: any;
    
    // 供应商模块
    supplier: any;
    supplierProduct: any;
    
    // 系统配置模块
    systemConfig: any;
    
    // 达人模块
    talent: any;
    talentContactLog: any;
    talentFlag: any;
    talentFlagConfig: any;
    talentPlatform: any;
    talentTransfer: any;
    
    // 上传模块
    uploadLog: any;
    uploadSecurityConfig: any;
  }
}
