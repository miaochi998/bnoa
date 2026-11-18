'use client';

/**
 * 成品成本组成明细（产品 / 耗材 / 工费）。
 * 成品组成弹窗与 SKU 成本组成弹窗共用，保证两处列口径一致。
 */

import { AlertTriangle } from 'lucide-react';
import { ImageThumb } from './ImageThumb';

export interface FpComposition {
  finishedProduct: any;
  product: any;
  supplierProduct: any;
  cut: any;
  costs: {
    materialCost: number | null;
    consumableCost: number | null;
    laborCost: number | null;
    totalCost: number | null;
  };
  consumableItems: any[];
  laborItems: any[];
}

const PRICE_UNIT_LABELS: Record<string, string> = {
  PER_PIECE: '件',
  PER_KG: 'kg',
  PER_CUBIC_METER: 'm³',
  PER_LITER: 'L',
  PER_ML: 'ml',
  PER_SQUARE_METER: '㎡',
  PER_METER: 'm',
  PER_GRAM: 'g',
  PER_BOTTLE: '瓶',
  PER_BOX: '箱',
  PER_CAN: '罐',
  PER_CASE: '箱',
};

const PRICING_MODE_LABELS: Record<string, string> = {
  UNIT: '按件',
  WEIGHT: '按重量',
  VOLUME: '按体积',
  AREA: '按面积',
  LENGTH: '按长度',
};

const BILLING_TYPE_LABELS: Record<string, string> = {
  PER_PIECE: '按件',
  PER_WEIGHT: '按重量',
  PER_PACKAGE: '按包',
};

export function money(value: number | null | undefined): string {
  if (value === null) return '***';
  if (value === undefined || Number.isNaN(Number(value))) return '-';
  return `¥${Number(value).toFixed(3)}`;
}

export function unitLabel(unit?: string | null): string {
  if (!unit) return '';
  return PRICE_UNIT_LABELS[unit] || unit;
}

function productDesc(data: FpComposition): string {
  const mode = data.product?.pricingMode;
  const label = PRICING_MODE_LABELS[mode] || '';
  const cut = data.cut || {};
  const parts: string[] = [];
  if (mode === 'WEIGHT' && cut.unitWeight != null) {
    parts.push(`单份 ${Number(cut.unitWeight)}g`);
  }
  if (
    (mode === 'VOLUME' || mode === 'AREA') &&
    cut.length != null &&
    cut.width != null
  ) {
    const dims =
      mode === 'VOLUME' && cut.height != null
        ? `${Number(cut.length)}×${Number(cut.width)}×${Number(cut.height)}cm`
        : `${Number(cut.length)}×${Number(cut.width)}cm`;
    parts.push(dims);
  }
  if (mode === 'LENGTH' && cut.length != null) {
    parts.push(`${Number(cut.length)}cm`);
  }
  if (data.finishedProduct?.packageQuantity != null) {
    parts.push(
      `每包 ${data.finishedProduct.packageQuantity}${data.finishedProduct.packageUnit || ''}`,
    );
  }
  return [label, ...parts].filter(Boolean).join(' · ');
}

interface Props {
  data: FpComposition;
  onPreview?: (fileId: string, alt?: string) => void;
}

export function CompositionDetail({ data, onPreview }: Props) {
  const product = data.product;
  const sp = data.supplierProduct;
  const supplyPrice =
    sp?.supplyPrice == null ? null : Number(sp.supplyPrice);
  const unit = sp?.priceUnit === 'PER_CUSTOM'
    ? sp?.priceUnitCustom
    : unitLabel(sp?.priceUnit);

  return (
    <div className="space-y-4">
      {/* 产品（原料） */}
      <div className="border border-[#3e3e3e] rounded-lg overflow-hidden">
        <div className="bg-[#202020] px-3 py-2 text-sm font-medium text-white">
          产品（原料）
        </div>
        <div className="p-3 flex items-center gap-3">
          <ImageThumb
            fileId={product?.mainImage}
            alt={product?.name || '产品图片'}
            onPreview={onPreview}
          />
          <div className="min-w-0 flex-1">
            <div className="text-white truncate">
              {product?.name || '-'}
              {product?.code && (
                <span className="ml-2 text-xs text-[#8e8e8e]">
                  {product.code}
                </span>
              )}
            </div>
            <div className="text-xs text-[#8e8e8e] mt-1">
              {sp?.supplier?.name ? `${sp.supplier.name} · ` : ''}
              {productDesc(data) || '—'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-[#8e8e8e]">单价</div>
            <div className="text-white">
              {supplyPrice == null ? '***' : money(supplyPrice)}
              {unit ? ` / ${unit}` : ''}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-[#8e8e8e]">材料成本</div>
            <div className="text-[#409fff] font-medium">
              {money(data.costs?.materialCost)}
            </div>
          </div>
        </div>
      </div>

      {/* 耗材 */}
      <div className="border border-[#3e3e3e] rounded-lg overflow-hidden">
        <div className="bg-[#202020] px-3 py-2 text-sm font-medium text-white flex items-center justify-between">
          <span>耗材</span>
          <span className="text-xs text-[#8e8e8e]">
            合计 {money(data.costs?.consumableCost)}
          </span>
        </div>
        {data.consumableItems.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[#8e8e8e]">
            未配置耗材
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#8e8e8e] border-b border-[#3e3e3e]">
                <th className="text-left font-normal px-3 py-2 w-12">图片</th>
                <th className="text-left font-normal px-2 py-2">耗材</th>
                <th className="text-right font-normal px-2 py-2">数量</th>
                <th className="text-right font-normal px-2 py-2">单价</th>
                <th className="text-right font-normal px-3 py-2">小计</th>
              </tr>
            </thead>
            <tbody>
              {data.consumableItems.map((item) => (
                <tr key={item.id} className="border-b border-[#3e3e3e]/60 last:border-b-0">
                  <td className="px-3 py-2">
                    <ImageThumb
                      fileId={item.image}
                      alt={item.name || '耗材图片'}
                      size={32}
                      onPreview={onPreview}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="text-white">
                      {item.name}
                      <span className="ml-2 text-[#8e8e8e]">
                        {item.code}
                      </span>
                    </div>
                    <div className="text-[#8e8e8e] mt-0.5">
                      {item.supplierName || '未指定供货商'}
                      {item.supplierCount > 1
                        ? ` · ${item.supplierCount} 家供货`
                        : ''}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-white">
                    {item.quantity}
                  </td>
                  <td className="px-2 py-2 text-right text-white">
                    {item.unitPrice == null ? '***' : money(item.unitPrice)}
                    {!item.hasCurrentPrice && (
                      <span className="ml-1 inline-flex items-center gap-1 text-[#f59e0b]">
                        <AlertTriangle className="w-3 h-3" />
                        未设价
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-[#409fff]">
                    {item.amount == null ? '***' : money(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 工费 */}
      <div className="border border-[#3e3e3e] rounded-lg overflow-hidden">
        <div className="bg-[#202020] px-3 py-2 text-sm font-medium text-white flex items-center justify-between">
          <span>工费</span>
          <span className="text-xs text-[#8e8e8e]">
            合计 {money(data.costs?.laborCost)}
          </span>
        </div>
        {data.laborItems.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[#8e8e8e]">
            未配置工费
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#8e8e8e] border-b border-[#3e3e3e]">
                <th className="text-left font-normal px-3 py-2 w-12">图片</th>
                <th className="text-left font-normal px-2 py-2">工种</th>
                <th className="text-right font-normal px-2 py-2">次数</th>
                <th className="text-right font-normal px-2 py-2">单价</th>
                <th className="text-right font-normal px-3 py-2">小计</th>
              </tr>
            </thead>
            <tbody>
              {data.laborItems.map((item) => (
                <tr key={item.id} className="border-b border-[#3e3e3e]/60 last:border-b-0">
                  <td className="px-3 py-2">
                    <ImageThumb
                      fileId={item.image}
                      alt={item.name || '工费图片'}
                      size={32}
                      onPreview={onPreview}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="text-white">
                      {item.name}
                      <span className="ml-2 text-[#8e8e8e]">
                        {item.code}
                      </span>
                    </div>
                    <div className="text-[#8e8e8e] mt-0.5">
                      {BILLING_TYPE_LABELS[item.billingType] || ''}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-white">
                    {item.quantity}
                  </td>
                  <td className="px-2 py-2 text-right text-white">
                    {item.unitPrice == null ? '***' : money(item.unitPrice)}
                    {!item.hasCurrentRate && (
                      <span className="ml-1 inline-flex items-center gap-1 text-[#f59e0b]">
                        <AlertTriangle className="w-3 h-3" />
                        未设价
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-[#409fff]">
                    {item.amount == null ? '***' : money(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 合计 */}
      <div className="flex items-center justify-end gap-4 text-sm pt-1">
        <span className="text-[#8e8e8e]">
          材料 {money(data.costs?.materialCost)}
        </span>
        <span className="text-[#8e8e8e]">
          + 耗材 {money(data.costs?.consumableCost)}
        </span>
        <span className="text-[#8e8e8e]">
          + 工费 {money(data.costs?.laborCost)}
        </span>
        <span className="text-[#8e8e8e]">=</span>
        <span className="text-lg font-semibold text-[#409fff]">
          {money(data.costs?.totalCost)}
        </span>
      </div>
    </div>
  );
}
