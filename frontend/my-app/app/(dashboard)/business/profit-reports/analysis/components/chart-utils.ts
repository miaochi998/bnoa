// 分析模块共享工具和常量

export const COLORS = {
    primary: '#409fff',
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    purple: '#a855f7',
    pink: '#ec4899',
    cyan: '#06b6d4',
    orange: '#f97316',
    lime: '#84cc16',
    indigo: '#6366f1',
};

export const YEAR_COLORS: Record<number, string> = {};
const YEAR_PALETTE = ['#409fff', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#ec4899'];
export function getYearColor(year: number, index: number): string {
    return YEAR_PALETTE[index % YEAR_PALETTE.length];
}

export const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function fmt(n: number): string {
    if (n == null || isNaN(n)) return '0';
    if (Math.abs(n) >= 10000) {
        return (n / 10000).toFixed(2) + '万';
    }
    return n.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function fmtPct(n: number): string {
    if (n == null || isNaN(n)) return '0%';
    return n.toFixed(2) + '%';
}

export const TOOLTIP_STYLE = {
    backgroundColor: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 8,
    fontSize: 12,
    color: '#e0e0e0',
};

export const GRID_STROKE = '#333';
export const AXIS_TICK = { fill: '#999', fontSize: 11 };

export interface MonthlyData {
    year: number;
    month: number;
    totalSales: number;
    totalRawMaterial: number;
    totalPackaging: number;
    totalLabor: number;
    totalShipping: number;
    totalPlatformFee: number;
    totalAllocation: number;
    totalExpense: number;
    totalGross: number;
    totalNet: number;
    grossMargin: number;
    netMargin: number;
    rawMaterialRate: number;
    shippingRate: number;
    platformFeeRate: number;
    allocationRate: number;
    totalCompanyExpense: number;
    companyExpenses: { name: string; amount: number }[];
    shippingByCompany: { name: string; amount: number }[];
    shops: ShopMonthlyData[];
}

export interface ShopMonthlyData {
    shopId: string;
    shopName: string;
    platformName: string;
    salesAmount: number;
    rawMaterialCost: number;
    packagingCost: number;
    laborCost: number;
    shippingCost: number;
    platformFee: number;
    allocationCost: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
    rawMaterialRate: number;
    shippingRate: number;
    platformFeeRate: number;
    allocationRate: number;
    shippingByCompany: { name: string; amount: number }[];
}

export interface ShopInfo {
    shopId: string;
    shopName: string;
    platformName: string;
}

export interface YearlySummary {
    year: number;
    totalSales: number;
    totalRawMaterial: number;
    totalPackaging: number;
    totalLabor: number;
    totalShipping: number;
    totalPlatformFee: number;
    totalAllocation: number;
    totalExpense: number;
    totalGross: number;
    totalNet: number;
    totalCompanyExpense: number;
    grossMargin: number;
    netMargin: number;
    monthCount: number;
}

export interface TrendData {
    years: number[];
    monthly: MonthlyData[];
    yearlySummary: YearlySummary[];
    shops: ShopInfo[];
}
