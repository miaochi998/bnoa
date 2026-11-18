import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { FinishedProductService } from '../finished-product/finished-product.service';
import { SkuService } from '../sku/sku.service';

/**
 * 成本级联重算服务
 *
 * 触发链：
 *   耗材当前价 / 工费当前费率 / 供应商供货价 / 产品计价方式 / 成品 BOM / 快递价格
 *     → 成品成本（缓存）
 *     → 引用这些成品的 SKU 成本（缓存，含快递费）
 *
 * 设计原则：
 * - 尽力而为：单个记录失败不影响其他记录，返回 failed 列表 + 日志；
 * - 只更新实际变化的成品行；SKU 由 SkuService 统一重算；
 * - 不做大事务（数据量小，失败可手动重算兜底）；
 * - 不影响历史定价方案/利润表/采购付款等历史凭证。
 */
@Injectable()
export class CostRecalcService {
  private readonly logger = new Logger(CostRecalcService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FinishedProductService))
    private readonly finishedProductService: FinishedProductService,
    @Inject(forwardRef(() => SkuService))
    private readonly skuService: SkuService,
  ) {}

  /** 耗材当前价/默认供货商变化 */
  async recalcByConsumable(consumableId: string) {
    const fps = await this.prisma.finishedProduct.findMany({
      where: {
        deletedAt: null,
        finishedProductConsumables: {
          some: { consumableId },
        },
      },
      select: { id: true },
    });
    return this.recalcFinishedProducts(
      fps.map((f) => f.id),
      `consumable:${consumableId}`,
    );
  }

  /** 工费当前费率变化 */
  async recalcByLaborType(laborTypeId: string) {
    const fps = await this.prisma.finishedProduct.findMany({
      where: {
        deletedAt: null,
        finishedProductLabor: {
          some: { laborTypeId },
        },
      },
      select: { id: true },
    });
    return this.recalcFinishedProducts(
      fps.map((f) => f.id),
      `labor:${laborTypeId}`,
    );
  }

  /** 供应商供货价变化 */
  async recalcBySupplierProduct(
    supplierProductId: string,
  ) {
    const fps = await this.prisma.finishedProduct.findMany({
      where: {
        deletedAt: null,
        supplierProductId,
      },
      select: { id: true },
    });
    return this.recalcFinishedProducts(
      fps.map((f) => f.id),
      `supplier-product:${supplierProductId}`,
    );
  }

  /** 产品计价方式变化 */
  async recalcByProduct(productId: string) {
    const fps = await this.prisma.finishedProduct.findMany({
      where: { deletedAt: null, productId },
      select: { id: true },
    });
    return this.recalcFinishedProducts(
      fps.map((f) => f.id),
      `product:${productId}`,
    );
  }

  /** 成品 BOM/参数变化 → 重算自身并级联 SKU */
  async recalcByFinishedProduct(fpId: string) {
    return this.recalcFinishedProducts(
      [fpId],
      `finished-product:${fpId}`,
    );
  }

  /** 快递价格/区域/附加费变化 → 重算使用该快递公司的 SKU */
  async recalcByExpressCompany(companyId: string) {
    const skus = await this.prisma.sku.findMany({
      where: {
        deletedAt: null,
        defaultExpressCompanyId: companyId,
      },
      select: { id: true },
    });
    return this.recalcSkus(
      skus.map((s) => s.id),
      `express:${companyId}`,
    );
  }

  /** 批量重算成品及其关联 SKU */
  async recalcFinishedProducts(
    fpIds: string[],
    trigger: string,
  ) {
    const started = Date.now();
    const uniqueFpIds = [...new Set(fpIds)];
    const failed: string[] = [];
    let changedFinishedProducts = 0;

    for (const id of uniqueFpIds) {
      try {
        const cost =
          await this.finishedProductService.calculateCost(id);
        const current =
          await this.prisma.finishedProduct.findUnique({
            where: { id },
            select: {
              materialCost: true,
              consumableCost: true,
              laborCost: true,
              totalCost: true,
            },
          });
        if (!current) continue;
        const changed =
          this.round4(current.materialCost) !==
            this.round4(cost.materialCost) ||
          this.round4(current.consumableCost) !==
            this.round4(cost.consumableCost) ||
          this.round4(current.laborCost) !==
            this.round4(cost.laborCost) ||
          this.round4(current.totalCost) !==
            this.round4(cost.totalCost);
        if (changed) {
          await this.prisma.finishedProduct.update({
            where: { id },
            data: {
              materialCost: cost.materialCost,
              consumableCost: cost.consumableCost,
              laborCost: cost.laborCost,
              totalCost: cost.totalCost,
            },
          });
          changedFinishedProducts += 1;
        }
      } catch (error: any) {
        failed.push(id);
        this.logger.error(
          `[cost-recalc] 成品重算失败 fp=${id}: ${error?.message}`,
        );
      }
    }

    const skus = uniqueFpIds.length
      ? await this.prisma.sku.findMany({
          where: {
            deletedAt: null,
            skuFinishedProducts: {
              some: {
                finishedProductId: {
                  in: uniqueFpIds,
                },
              },
            },
          },
          select: { id: true },
        })
      : [];

    const skuResult = await this.recalcSkus(
      skus.map((s) => s.id),
      trigger,
      failed,
    );

    const result = {
      ok: failed.length === 0,
      trigger,
      affectedFinishedProducts: uniqueFpIds.length,
      changedFinishedProducts,
      affectedSkus: skuResult.affectedSkus,
      failed,
      durationMs: Date.now() - started,
    };
    this.logger.log(
      `[cost-recalc] trigger=${trigger} fp=${uniqueFpIds.length}(changed ${changedFinishedProducts}) sku=${skuResult.affectedSkus} failed=${failed.length} duration=${result.durationMs}ms`,
    );
    return result;
  }

  /** 批量重算 SKU */
  async recalcSkus(
    skuIds: string[],
    trigger: string,
    failed: string[] = [],
  ) {
    const uniqueSkuIds = [...new Set(skuIds)];
    for (const id of uniqueSkuIds) {
      try {
        await this.skuService.calculateAndUpdateCost(id);
      } catch (error: any) {
        failed.push(id);
        this.logger.error(
          `[cost-recalc] SKU 重算失败 sku=${id}: ${error?.message}`,
        );
      }
    }
    return {
      affectedSkus: uniqueSkuIds.length,
      failed,
    };
  }

  private round4(value: unknown): number {
    return Math.round(Number(value || 0) * 10000) / 10000;
  }
}
