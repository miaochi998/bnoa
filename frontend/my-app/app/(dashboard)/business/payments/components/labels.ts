// 付款记录-共享中文标签映射（前端一律用中文展示，避免英文枚举泄露给用户）
export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  GOODS: '货款',
  FREIGHT: '运费',
  CONSUMABLE: '耗材款',
  PROMOTION: '推广费',
  SERVICE: '服务费',
  REFUND: '退款',
  OTHER: '其他',
};

export const PAY_METHOD_LABEL: Record<string, string> = {
  CORPORATE_TRANSFER: '对公转账',
  PERSONAL_TRANSFER: '个人转账',
  CASH: '现金',
  ACCEPTANCE: '承兑',
  OTHER: '其他',
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDING: '待开票',
  ISSUED: '已开票',
  NOT_REQUIRED: '无需发票',
  VOID: '已作废',
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PAID: '已打款',
  FAILED: '打款失败',
  CANCELLED: '作废',
};

export const CURRENCY_LABEL: Record<string, string> = {
  CNY: '人民币',
  USD: '美元',
  EUR: '欧元',
  OTHER: '其他',
};

export const RECEIVER_TYPE_LABEL: Record<string, string> = {
  SUPPLIER: '供应商',
  CONSUMABLE_SUPPLIER: '耗材供应商',
  CUSTOM: '自定义',
};
