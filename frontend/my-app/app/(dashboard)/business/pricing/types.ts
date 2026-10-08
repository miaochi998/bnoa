export interface PriceCell {
    profitRate: number;
    sellingPrice: number;
    grossProfit: number;
    netProfitRate: number;
}

export interface SkuRow {
    skuId: string;
    skuName: string;
    skuType: string;
    skuCost: number;
    prices: PriceCell[];
}

export interface MatrixResult {
    link: {
        id: string;
        name: string;
        shop?: {
            id: string;
            name: string;
            platform?: { id: string; name: string };
        };
    } | null;
    skus: SkuRow[];
}

export type TentativeMap = Record<string, number>;

export interface PlanData {
    id: string;
    linkId: string;
    name: string;
    profitRates: number[];
    commissionRate: number;
    taxRate: number;
    selectedPrices?: TentativeMap;
    talentCommissionRate?: number;
    link?: {
        id: string;
        name: string;
        shop?: {
            name: string;
            platform?: { name: string };
        };
    };
    createdAt: string;
}

export const fmt = (v: number): string =>
    `¥${v.toFixed(3)}`;

export const pct = (v: number): string =>
    `${(v * 100).toFixed(3)}%`;

// 反向计算：从目标售价推导利润率
export function calculateProfitRateFromPrice(
    targetPrice: number,
    cost: number,
    commissionRate: number,
    taxRate: number
): PriceCell | null {
    if (targetPrice <= 0 || cost <= 0) return null;

    const divisor = 1 - commissionRate - taxRate;
    if (divisor <= 0) return null;

    // 反向推导利润率
    // targetPrice = cost × (1 + profitRate) / divisor
    // profitRate = (targetPrice × divisor / cost) - 1
    const profitRate = (targetPrice * divisor / cost) - 1;

    // 计算毛利润
    const grossProfit = targetPrice * divisor - cost;

    // 计算净利润率
    const netProfitRate = grossProfit / targetPrice;

    return {
        profitRate: Math.round(profitRate * 10000) / 10000,
        sellingPrice: Math.round(targetPrice * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfitRate: Math.round(netProfitRate * 10000) / 10000,
    };
}
