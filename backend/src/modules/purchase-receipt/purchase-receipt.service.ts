import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import { PurchaseBillNoSource, PurchaseItemType } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AIService } from '../ai/services/ai.service';
import { Message } from '../ai/interfaces/ai-service.interface';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import {
    CheckBillNoDto,
    CreatePurchaseReceiptDto,
    ForPaymentQueryDto,
    QueryPurchaseReceiptDto,
    UpdatePurchaseReceiptDto,
} from './dto/purchase-receipt.dto';

/** 服务端解析后的明细（含名称快照） */
interface ResolvedItem {
    itemType: PurchaseItemType;
    productId: string | null;
    supplierId: string | null;
    supplierProductId: string | null;
    consumableId: string | null;
    consumableSupplierId: string | null;
    itemName: string;
    supplierName: string | null;
    specName: string | null;
    quantityText: string;
    remark: string | null;
    images: string[];
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
    SETTLED: '已结清',
    PARTIAL: '部分付款',
    UNPAID: '未付款',
    NO_AMOUNT: '未填金额',
};

const ITEM_TYPE_LABEL: Record<string, string> = {
    PRODUCT: '产品',
    CONSUMABLE: '耗材',
    OTHER: '其它',
};

@Injectable()
export class PurchaseReceiptService {
    private readonly logger = new Logger(PurchaseReceiptService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly aiService: AIService,
        private readonly storageService: StorageService,
        private readonly localStorageService: LocalStorageService,
    ) {}

    // ==================== 公共查询 ====================

    async findAll(query: QueryPurchaseReceiptDto) {
        const page = Number(query.page) || 1;
        const pageSize = Math.min(Number(query.pageSize) || 20, 200);
        const where = this.buildWhere(query);
        const include = this.listInclude();

        // 打款状态为计算字段，需先全量计算再分页
        if (query.paymentStatus) {
            const all = await this.prisma.purchaseReceipt.findMany({
                where,
                orderBy: { receiptTime: 'desc' },
                select: {
                    id: true,
                    billNo: true,
                    billAmount: true,
                    items: {
                        select: {
                            supplierId: true,
                            consumableSupplierId: true,
                        },
                    },
                    paymentLinks: {
                        include: {
                            paymentRecord: {
                                select: {
                                    id: true,
                                    recordNo: true,
                                    title: true,
                                    amount: true,
                                    paymentTime: true,
                                    status: true,
                                    supplierId: true,
                                    consumableSupplierId: true,
                                    deletedAt: true,
                                },
                            },
                        },
                    },
                },
            });
            const decorated = await this.decoratePaymentInfo(all as any[]);
            const ids = decorated
                .filter((r) => r.payment.status === query.paymentStatus)
                .map((r) => r.id);
            const total = ids.length;
            const pageIds = ids.slice((page - 1) * pageSize, page * pageSize);
            if (!pageIds.length) return { items: [], total };

            const rows = await this.prisma.purchaseReceipt.findMany({
                where: { id: { in: pageIds } },
                include,
            });
            const ordered = pageIds
                .map((id) => rows.find((r) => r.id === id))
                .filter(Boolean) as any[];
            return { items: await this.decoratePaymentInfo(ordered), total };
        }

        const [rows, total] = await Promise.all([
            this.prisma.purchaseReceipt.findMany({
                where,
                orderBy: { receiptTime: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include,
            }),
            this.prisma.purchaseReceipt.count({ where }),
        ]);

        return { items: await this.decoratePaymentInfo(rows), total };
    }

    async findOne(id: string) {
        const receipt = await this.prisma.purchaseReceipt.findFirst({
            where: { id, deletedAt: null },
            include: this.listInclude(),
        });
        if (!receipt) throw new NotFoundException('入库记录不存在');
        const [decorated] = await this.decoratePaymentInfo([receipt as any]);
        return decorated;
    }

    /** 供付款记录「关联入库单」选择器使用 */
    async forPayment(query: ForPaymentQueryDto) {
        const limit = Math.min(Number(query.limit) || 100, 300);
        const itemWhere =
            query.supplierType === 'SUPPLIER'
                ? { supplierId: query.supplierId }
                : { consumableSupplierId: query.supplierId };

        const and: any[] = [{ items: { some: itemWhere } }];
        if (query.keyword?.trim()) {
            const kw = query.keyword.trim();
            and.push({
                OR: [
                    { receiptNo: { contains: kw, mode: 'insensitive' as const } },
                    { billNo: { contains: kw, mode: 'insensitive' as const } },
                ],
            });
        }

        const rows = await this.prisma.purchaseReceipt.findMany({
            where: { deletedAt: null, AND: and },
            orderBy: { receiptTime: 'desc' },
            take: limit,
            include: {
                items: {
                    where: itemWhere,
                    orderBy: { sortOrder: 'asc' as const },
                    select: {
                        id: true,
                        itemName: true,
                        specName: true,
                        quantityText: true,
                        supplierId: true,
                        consumableSupplierId: true,
                    },
                },
                paymentLinks: {
                    include: {
                        paymentRecord: {
                            select: {
                                id: true,
                                recordNo: true,
                                title: true,
                                amount: true,
                                paymentTime: true,
                                status: true,
                                supplierId: true,
                                consumableSupplierId: true,
                                deletedAt: true,
                            },
                        },
                    },
                },
            },
        });

        const decorated = await this.decoratePaymentInfo(rows as any[]);

        // 已结清的不再作为候选，避免财务重复关联
        return decorated
            .filter((r) => r.payment.status !== 'SETTLED')
            .map((r) => ({
                id: r.id,
                receiptNo: r.receiptNo,
                receiptTime: r.receiptTime,
                billNo: r.billNo,
                billAmount: r.billAmount,
                itemSummary: (r.items || [])
                    .map(
                        (i: any) =>
                            `${i.itemName}${i.specName ? ` / ${i.specName}` : ''} × ${i.quantityText}`,
                    )
                    .join('；'),
                payment: r.payment,
            }));
    }

    /** 生成无票编号建议 */
    async nextBillNo(): Promise<{ billNo: string }> {
        const now = new Date();
        const p = (n: number) => String(n).padStart(2, '0');
        const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
        return {
            billNo: `WP-${ymd}-${p(now.getHours())}${p(now.getMinutes())}`,
        };
    }

    /**
     * AI 识别发货单票据号（可选增强）
     * - 未配置可用模型 / API Key → 返回 available=false，前端静默降级为手填
     * - 识别异常不抛错，避免阻断入库主流程
     */
    async recognizeBill(fileId: string, userId: string) {
        const model = await this.prisma.aiModel.findFirst({
            where: {
                isEnabled: true,
                deletedAt: null,
                provider: 'deepseek',
            },
            orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
        });
        if (!model) {
            return {
                available: false,
                billNo: null,
                reason: '未配置 DeepSeek 模型（系统配置 → AI模型管理）',
            };
        }
        const config = (model.config as Record<string, any>) || {};
        if (!config.apiKey && !this.configService.get('DEEPSEEK_API_KEY')) {
            return {
                available: false,
                billNo: null,
                reason: '未配置 DeepSeek API Key',
            };
        }

        const file = await this.prisma.file.findFirst({
            where: { id: fileId, deletedAt: null },
            select: {
                id: true,
                mimeType: true,
                size: true,
                storageType: true,
                path: true,
            },
        });
        if (!file) throw new NotFoundException('文件不存在');
        if (Number(file.size) > 8 * 1024 * 1024) {
            throw new BadRequestException(
                '图片超过 8MB，无法识别，请压缩后重试',
            );
        }

        let buffer: Buffer;
        try {
            buffer = await this.downloadFileBuffer(
                file.storageType,
                file.path,
            );
        } catch (e: any) {
            this.logger.warn(`读取文件失败: ${e.message}`);
            return {
                available: true,
                billNo: null,
                reason: '读取图片失败',
            };
        }

        const prompt =
            '请识别这张发货单/送货单图片上的「票据号 / 单号 / 编号 / No.」字段。' +
            '只返回该号码本身（由数字或字母组成），不要返回任何其他文字、标点或解释。' +
            '如果图片中确实没有可识别的票据号，只返回 NONE。';

        const messages: Message[] = [
            {
                role: 'system',
                content:
                    '你是单据识别助手，只输出票据号本身，不做任何解释。',
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image',
                        mimeType: file.mimeType || 'image/jpeg',
                        data: buffer.toString('base64'),
                    },
                ],
            },
        ];

        try {
            const res = await this.aiService.generateContent(
                model.name,
                messages,
                userId,
                // 票据号识别属于纯感知提取，不需要思维链：
                // 关闭思考模式可显著减少输出 token 与耗时（DeepSeek flash 默认开启思考）
                { temperature: 0.1, maxTokens: 500, thinking: 'disabled' },
            );
            const raw = (res.content || '').trim();
            return {
                available: true,
                billNo: this.extractBillNo(raw),
                raw: raw.slice(0, 200),
                model: res.model,
            };
        } catch (e: any) {
            this.logger.warn(`AI 识别失败: ${e.message}`);
            return {
                available: true,
                billNo: null,
                reason: `识别失败：${e.message}`,
            };
        }
    }

    /** 从模型返回文本中提取票据号（容错） */
    private extractBillNo(raw: string): string | null {
        const text = (raw || '')
            .replace(/[`"'*\s]/g, '')
            .replace(/^(票据号|单号|编号|NO\.?)[:：]?/i, '');
        if (!text) return null;
        if (/^NONE$/i.test(text)) return null;
        if (/无票据|未识别|无法识别|没有/.test(text)) return null;
        const m = text.match(/[A-Za-z0-9][A-Za-z0-9\-_/]{2,}/);
        return m ? m[0] : null;
    }

    private async downloadFileBuffer(
        storageType: string,
        key: string,
    ): Promise<Buffer> {
        if (storageType === 'LOCAL') {
            return this.localStorageService.downloadFile(key);
        }
        return this.storageService.download(key);
    }

    /** 票据号重复校验（同供应商） */
    async checkBillNo(dto: CheckBillNoDto) {
        const billNo = (dto.billNo || '').trim();
        if (!billNo) return { exists: false, records: [] };

        const itemWhere: any = {};
        if (dto.supplierId) itemWhere.supplierId = dto.supplierId;
        if (dto.consumableSupplierId)
            itemWhere.consumableSupplierId = dto.consumableSupplierId;

        const where: any = { deletedAt: null, billNo };
        if (dto.excludeId) where.id = { not: dto.excludeId };
        if (Object.keys(itemWhere).length) where.items = { some: itemWhere };

        const records = await this.prisma.purchaseReceipt.findMany({
            where,
            take: 10,
            orderBy: { receiptTime: 'desc' },
            select: {
                id: true,
                receiptNo: true,
                receiptTime: true,
                billNo: true,
            },
        });

        return { exists: records.length > 0, records };
    }

    // ==================== 写操作 ====================

    async create(dto: CreatePurchaseReceiptDto, userId: string) {
        this.validateCommon(dto);
        const receiptTime = this.parseTime(dto.receiptTime);
        const resolved = await this.resolveItems(dto.items);
        const billNo = dto.billNo?.trim() || null;
        const billNoSource = this.resolveBillNoSource(
            billNo,
            dto.billNoSource,
        );

        let lastError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            const receiptNo = await this.genReceiptNo();
            try {
                const receiptId = await this.prisma.$transaction(
                    async (tx) => {
                        const receipt = await tx.purchaseReceipt.create({
                            data: {
                                receiptNo,
                                receiptTime,
                                billNo,
                                billNoSource,
                                billAmount: dto.billAmount ?? null,
                                isAccurate: dto.isAccurate ?? true,
                                remark: dto.remark?.trim() || null,
                                checkerId: userId,
                                createdBy: userId,
                                updatedBy: userId,
                                items: {
                                    create: resolved.map((it, idx) =>
                                        this.itemCreateData(it, idx),
                                    ),
                                },
                            },
                            include: {
                                items: {
                                    orderBy: { sortOrder: 'asc' as const },
                                },
                            },
                        });

                        await this.writeImages(
                            tx,
                            receipt.id,
                            dto.billImages ?? [],
                            resolved,
                            receipt.items.map((i) => i.id),
                        );
                        return receipt.id;
                    },
                );
                return this.findOne(receiptId);
            } catch (e: any) {
                lastError = e;
                // 单号唯一冲突 → 重试
                if (e?.code === 'P2002' && attempt < 2) continue;
                throw e;
            }
        }
        throw lastError;
    }

    async update(
        id: string,
        dto: UpdatePurchaseReceiptDto,
        userId: string,
    ) {
        await this.assertWritable(id, userId);
        this.validateCommon(dto);
        const receiptTime = this.parseTime(dto.receiptTime);
        const resolved = await this.resolveItems(dto.items);
        const billNo = dto.billNo?.trim() || null;
        const billNoSource = this.resolveBillNoSource(
            billNo,
            dto.billNoSource,
        );

        await this.prisma.$transaction(async (tx) => {
            await tx.purchaseReceipt.update({
                where: { id },
                data: {
                    receiptTime,
                    billNo,
                    billNoSource,
                    billAmount: dto.billAmount ?? null,
                    isAccurate: dto.isAccurate ?? true,
                    remark: dto.remark?.trim() || null,
                    updatedBy: userId,
                },
            });

            // 明细与照片整体替换（照片行随明细级联删除）
            await tx.purchaseReceiptItem.deleteMany({
                where: { receiptId: id },
            });
            await tx.purchaseReceiptImage.deleteMany({
                where: { receiptId: id },
            });

            const items = [];
            for (const [idx, it] of resolved.entries()) {
                const created = await tx.purchaseReceiptItem.create({
                    data: { receiptId: id, ...this.itemCreateData(it, idx) },
                });
                items.push(created);
            }

            await this.writeImages(
                tx,
                id,
                dto.billImages ?? [],
                resolved,
                items.map((i) => i.id),
            );
        });

        return this.findOne(id);
    }

    async remove(id: string, userId: string): Promise<void> {
        await this.assertWritable(id, userId);
        await this.prisma.purchaseReceipt.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });
    }

    // ==================== 导出 ====================

    async export(query: QueryPurchaseReceiptDto): Promise<StreamableFile> {
        const where = this.buildWhere(query);
        const rows = await this.prisma.purchaseReceipt.findMany({
            where,
            orderBy: { receiptTime: 'desc' },
            include: this.listInclude(),
        });
        const decorated = await this.decoratePaymentInfo(rows as any[]);

        // 创建人姓名
        const creatorIds = Array.from(
            new Set(decorated.map((r) => r.createdBy).filter(Boolean)),
        ) as string[];
        const creators = creatorIds.length
            ? await this.prisma.user.findMany({
                  where: { id: { in: creatorIds } },
                  select: { id: true, name: true },
              })
            : [];
        const creatorMap = new Map(creators.map((u) => [u.id, u.name]));

        const baseUrl = (
            query.previewBaseUrl ||
            this.configService.get<string>('SERVER_BASE_URL') ||
            ''
        ).replace(/\/+$/, '');
        const fileUrl = (fileId: string) =>
            baseUrl ? `${baseUrl}/public/files/${fileId}/preview` : fileId;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('进货入库记录');
        sheet.columns = [
            { header: '入库单号', key: 'receiptNo', width: 20 },
            { header: '入库日期', key: 'receiptTime', width: 18 },
            { header: '货物类型', key: 'itemType', width: 10 },
            { header: '入库产品', key: 'itemName', width: 22 },
            { header: '供应商', key: 'supplierName', width: 24 },
            { header: '产品规格', key: 'specName', width: 18 },
            { header: '入库数量', key: 'quantityText', width: 20 },
            { header: '本次货款金额', key: 'billAmount', width: 14 },
            { header: '票据号', key: 'billNo', width: 20 },
            { header: '发货单照片', key: 'billImages', width: 40 },
            { header: '货物照片', key: 'goodsImages', width: 40 },
            { header: '核对人', key: 'checkerName', width: 12 },
            { header: '是否准确', key: 'isAccurate', width: 10 },
            { header: '打款情况', key: 'paymentStatus', width: 12 },
            { header: '已付金额', key: 'paidAmount', width: 14 },
            { header: '备注', key: 'remark', width: 28 },
            { header: '创建人', key: 'createdByName', width: 12 },
            { header: '创建时间', key: 'createdAt', width: 18 },
        ];
        sheet.getRow(1).font = { bold: true };

        for (const r of decorated) {
            const items = r.items?.length ? r.items : [null];
            items.forEach((it: any, idx: number) => {
                sheet.addRow({
                    receiptNo: r.receiptNo,
                    receiptTime: this.formatTime(r.receiptTime),
                    itemType: it ? ITEM_TYPE_LABEL[it.itemType] || '' : '',
                    itemName: it?.itemName ?? '',
                    supplierName: it?.supplierName ?? '',
                    specName: it?.specName ?? '',
                    quantityText: it?.quantityText ?? '',
                    billAmount:
                        idx === 0 ? (r.billAmount ?? '') : '',
                    billNo: r.billNo ?? '',
                    billImages:
                        idx === 0
                            ? (r.images || [])
                                  .map((i: any) => fileUrl(i.fileId))
                                  .join('\n')
                            : '',
                    goodsImages: (it?.images || [])
                        .map((i: any) => fileUrl(i.fileId))
                        .join('\n'),
                    checkerName: r.checker?.name ?? '',
                    isAccurate: r.isAccurate ? '准确' : '不准确',
                    paymentStatus:
                        PAYMENT_STATUS_LABEL[r.payment.status] || '',
                    paidAmount: r.payment.paidAmount,
                    remark: idx === 0 ? (r.remark ?? '') : '',
                    createdByName: idx === 0 ? (creatorMap.get(r.createdBy) || '') : '',
                    createdAt: idx === 0 ? this.formatTime(r.createdAt) : '',
                });
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return new StreamableFile(Buffer.from(buffer));
    }

    // ==================== 内部：校验与快照 ====================

    private validateCommon(dto: CreatePurchaseReceiptDto) {
        if (!dto.receiptTime) {
            throw new BadRequestException('请填写入库时间');
        }
        if (!dto.items?.length) {
            throw new BadRequestException('至少填写一个入库物品');
        }
        if (dto.items.length > 50) {
            throw new BadRequestException('入库明细最多 50 行');
        }
        if (dto.isAccurate === false && !dto.remark?.trim()) {
            throw new BadRequestException('请填写不准确的原因');
        }
        if ((dto.billImages?.length ?? 0) > 3) {
            throw new BadRequestException('发货单照片最多 3 张');
        }
    }

    private parseTime(v: string): Date {
        const d = new Date(v);
        if (isNaN(d.getTime())) {
            throw new BadRequestException('入库时间格式不正确');
        }
        return d;
    }

    private resolveBillNoSource(
        billNo: string | null,
        provided?: PurchaseBillNoSource,
    ): PurchaseBillNoSource {
        if (!billNo) return 'NONE';
        if (!provided || provided === 'NONE') return 'MANUAL';
        return provided;
    }

    /** 逐行校验三级关联并生成名称快照 */
    private async resolveItems(
        items: CreatePurchaseReceiptDto['items'],
    ): Promise<ResolvedItem[]> {
        const out: ResolvedItem[] = [];

        for (const [idx, raw] of items.entries()) {
            const row = idx + 1;
            const quantityText = (raw.quantityText || '').trim();
            if (!quantityText) {
                throw new BadRequestException(`第 ${row} 行：请填写入库数量`);
            }
            const images = raw.images ?? [];
            if (images.length > 10) {
                throw new BadRequestException(
                    `第 ${row} 行：货物照片最多 10 张`,
                );
            }

            if (raw.itemType === 'PRODUCT') {
                if (
                    !raw.productId ||
                    !raw.supplierId ||
                    !raw.supplierProductId
                ) {
                    throw new BadRequestException(
                        `第 ${row} 行：产品、供应商、规格必须完整选择`,
                    );
                }
                const sp = await this.prisma.supplierProduct.findFirst({
                    where: {
                        id: raw.supplierProductId,
                        supplierId: raw.supplierId,
                        productId: raw.productId,
                        deletedAt: null,
                    },
                    include: {
                        product: { select: { name: true } },
                        supplier: { select: { name: true } },
                    },
                });
                if (!sp) {
                    throw new BadRequestException(
                        `第 ${row} 行：产品与规格不匹配，请重新选择`,
                    );
                }
                out.push({
                    itemType: 'PRODUCT',
                    productId: raw.productId,
                    supplierId: raw.supplierId,
                    supplierProductId: raw.supplierProductId,
                    consumableId: null,
                    consumableSupplierId: null,
                    itemName: sp.product?.name ?? '',
                    supplierName: sp.supplier?.name ?? null,
                    specName: sp.styleName ?? null,
                    quantityText,
                    remark: raw.remark?.trim() || null,
                    images,
                });
            } else if (raw.itemType === 'CONSUMABLE') {
                if (!raw.consumableId) {
                    throw new BadRequestException(
                        `第 ${row} 行：请选择耗材`,
                    );
                }
                const consumable = await this.prisma.consumable.findFirst({
                    where: { id: raw.consumableId, deletedAt: null },
                    select: { id: true, name: true, specDesc: true },
                });
                if (!consumable) {
                    throw new BadRequestException(
                        `第 ${row} 行：耗材不存在`,
                    );
                }
                let supplierName: string | null = null;
                if (raw.consumableSupplierId) {
                    const cs =
                        await this.prisma.consumableSupplier.findFirst({
                            where: {
                                id: raw.consumableSupplierId,
                                deletedAt: null,
                            },
                            select: { name: true },
                        });
                    if (!cs) {
                        throw new BadRequestException(
                            `第 ${row} 行：耗材供应商不存在`,
                        );
                    }
                    supplierName = cs.name;
                }
                out.push({
                    itemType: 'CONSUMABLE',
                    productId: null,
                    supplierId: null,
                    supplierProductId: null,
                    consumableId: consumable.id,
                    consumableSupplierId: raw.consumableSupplierId ?? null,
                    itemName: consumable.name,
                    supplierName,
                    specName:
                        consumable.specDesc ?? raw.specName?.trim() ?? null,
                    quantityText,
                    remark: raw.remark?.trim() || null,
                    images,
                });
            } else {
                const itemName = (raw.itemName || '').trim();
                if (!itemName) {
                    throw new BadRequestException(
                        `第 ${row} 行：请填写物品名称`,
                    );
                }
                out.push({
                    itemType: 'OTHER',
                    productId: null,
                    supplierId: null,
                    supplierProductId: null,
                    consumableId: null,
                    consumableSupplierId: null,
                    itemName,
                    supplierName: raw.supplierName?.trim() || null,
                    specName: raw.specName?.trim() || null,
                    quantityText,
                    remark: raw.remark?.trim() || null,
                    images,
                });
            }
        }

        return out;
    }

    private itemCreateData(it: ResolvedItem, idx: number) {
        return {
            itemType: it.itemType,
            sortOrder: idx,
            productId: it.productId,
            supplierId: it.supplierId,
            supplierProductId: it.supplierProductId,
            consumableId: it.consumableId,
            consumableSupplierId: it.consumableSupplierId,
            itemName: it.itemName,
            supplierName: it.supplierName,
            specName: it.specName,
            quantityText: it.quantityText,
            remark: it.remark,
        };
    }

    /** 写入照片：单据级（BILL）+ 明细级（GOODS） */
    private async writeImages(
        tx: any,
        receiptId: string,
        billImages: string[],
        resolved: ResolvedItem[],
        itemIds: string[],
    ) {
        const rows: any[] = [];
        billImages.forEach((fileId, i) => {
            rows.push({
                receiptId,
                itemId: null,
                fileId,
                type: 'BILL',
                sortOrder: i,
            });
        });
        itemIds.forEach((itemId, idx) => {
            (resolved[idx]?.images ?? []).forEach((fileId, i) => {
                rows.push({
                    receiptId,
                    itemId,
                    fileId,
                    type: 'GOODS',
                    sortOrder: i,
                });
            });
        });
        if (rows.length) {
            await tx.purchaseReceiptImage.createMany({ data: rows });
        }
    }

    // ==================== 内部：单号与权限 ====================

    private async genReceiptNo(): Promise<string> {
        const now = new Date();
        const p = (n: number) => String(n).padStart(2, '0');
        const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
        const prefix = `RK${ymd}-`;
        const last = await this.prisma.purchaseReceipt.findFirst({
            where: { receiptNo: { startsWith: prefix } },
            orderBy: { receiptNo: 'desc' },
            select: { receiptNo: true },
        });
        let seq = 1;
        if (last?.receiptNo) {
            const n = parseInt(last.receiptNo.slice(prefix.length), 10);
            if (!Number.isNaN(n)) seq = n + 1;
        }
        return `${prefix}${String(seq).padStart(3, '0')}`;
    }

    private async hasPermission(
        userId: string,
        code: string,
    ): Promise<boolean> {
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: {
                    include: {
                        rolePermissions: { include: { permission: true } },
                    },
                },
            },
        });
        for (const ur of userRoles) {
            if (ur.role.code === 'super_admin') return true;
            for (const rp of ur.role.rolePermissions) {
                if (rp.permission.code === code) return true;
            }
        }
        return false;
    }

    /** 数据权限：无 purchase:manage 者只能改删自己提交的记录 */
    private async assertWritable(id: string, userId: string) {
        const receipt = await this.prisma.purchaseReceipt.findFirst({
            where: { id, deletedAt: null },
            select: { createdBy: true },
        });
        if (!receipt) throw new NotFoundException('入库记录不存在');
        const canManage = await this.hasPermission(userId, 'purchase:manage');
        if (!canManage && receipt.createdBy !== userId) {
            throw new ForbiddenException(
                '只能修改或删除自己提交的入库记录',
            );
        }
    }

    // ==================== 内部：查询构造与打款状态 ====================

    private listInclude() {
        return {
            checker: { select: { id: true, name: true } },
            items: {
                orderBy: { sortOrder: 'asc' as const },
                include: {
                    images: { orderBy: { sortOrder: 'asc' as const } },
                },
            },
            images: {
                where: { itemId: null },
                orderBy: { sortOrder: 'asc' as const },
            },
            paymentLinks: {
                include: {
                    paymentRecord: {
                        select: {
                            id: true,
                            recordNo: true,
                            title: true,
                            amount: true,
                            paymentTime: true,
                            status: true,
                            supplierId: true,
                            consumableSupplierId: true,
                            deletedAt: true,
                        },
                    },
                },
            },
        };
    }

    private buildWhere(query: QueryPurchaseReceiptDto): any {
        const and: any[] = [];

        if (query.keyword?.trim()) {
            const kw = query.keyword.trim();
            and.push({
                OR: [
                    { receiptNo: { contains: kw, mode: 'insensitive' as const } },
                    { billNo: { contains: kw, mode: 'insensitive' as const } },
                    { remark: { contains: kw, mode: 'insensitive' as const } },
                    {
                        items: {
                            some: {
                                itemName: {
                                    contains: kw,
                                    mode: 'insensitive' as const,
                                },
                            },
                        },
                    },
                    {
                        items: {
                            some: {
                                supplierName: {
                                    contains: kw,
                                    mode: 'insensitive' as const,
                                },
                            },
                        },
                    },
                ],
            });
        }

        if (query.startDate || query.endDate) {
            const range: any = {};
            if (query.startDate) {
                range.gte = new Date(`${query.startDate}T00:00:00`);
            }
            if (query.endDate) {
                range.lte = new Date(`${query.endDate}T23:59:59.999`);
            }
            and.push({ receiptTime: range });
        }

        if (query.billNo?.trim()) {
            and.push({
                billNo: {
                    contains: query.billNo.trim(),
                    mode: 'insensitive' as const,
                },
            });
        }
        if (query.checkerId) and.push({ checkerId: query.checkerId });
        if (query.isAccurate !== undefined) {
            and.push({ isAccurate: query.isAccurate });
        }

        const itemFilter: any = {};
        if (query.itemType) itemFilter.itemType = query.itemType;
        if (query.productId) itemFilter.productId = query.productId;
        if (query.consumableId) itemFilter.consumableId = query.consumableId;
        if (query.supplierId) itemFilter.supplierId = query.supplierId;
        if (query.consumableSupplierId) {
            itemFilter.consumableSupplierId = query.consumableSupplierId;
        }
        if (Object.keys(itemFilter).length) {
            and.push({ items: { some: itemFilter } });
        }

        const where: any = { deletedAt: null };
        if (and.length) where.AND = and;
        return where;
    }

    /**
     * 计算打款情况：
     * 1) 人工关联（付款记录勾选入库单）优先；
     * 2) 否则按「票据号 + 供应商」自动匹配已付款记录。
     */
    private async decoratePaymentInfo(receipts: any[]): Promise<any[]> {
        if (!receipts.length) return receipts;

        const billNos = Array.from(
            new Set(
                receipts
                    .map((r) => (r.billNo || '').trim())
                    .filter(Boolean),
            ),
        ) as string[];

        const autoMap = new Map<string, any[]>();
        if (billNos.length) {
            const bills = await this.prisma.paymentBill.findMany({
                where: {
                    billNumber: { in: billNos },
                    paymentRecord: { deletedAt: null, status: 'PAID' },
                },
                include: {
                    paymentRecord: {
                        select: {
                            id: true,
                            recordNo: true,
                            title: true,
                            amount: true,
                            paymentTime: true,
                            status: true,
                            supplierId: true,
                            consumableSupplierId: true,
                            deletedAt: true,
                        },
                    },
                },
            });
            for (const b of bills) {
                const key = (b.billNumber || '').trim();
                if (!key) continue;
                if (!autoMap.has(key)) autoMap.set(key, []);
                autoMap.get(key)!.push(b.paymentRecord);
            }
        }

        return receipts.map((r) => {
            const manual = (r.paymentLinks || [])
                .map((l: any) => l.paymentRecord)
                .filter(
                    (p: any) => p && !p.deletedAt && p.status === 'PAID',
                );

            const supplierIds = new Set<string>();
            const consumableSupplierIds = new Set<string>();
            for (const it of r.items || []) {
                if (it.supplierId) supplierIds.add(it.supplierId);
                if (it.consumableSupplierId) {
                    consumableSupplierIds.add(it.consumableSupplierId);
                }
            }

            let linkType: 'MANUAL' | 'AUTO' | 'NONE' = 'NONE';
            let records: any[] = [];

            if (manual.length) {
                linkType = 'MANUAL';
                records = manual;
            } else if (r.billNo) {
                const key = String(r.billNo).trim();
                const hasSupplierInfo =
                    supplierIds.size > 0 || consumableSupplierIds.size > 0;
                const candidates = (autoMap.get(key) || []).filter(
                    (p: any) => {
                        if (!hasSupplierInfo) return true;
                        if (p.supplierId && supplierIds.has(p.supplierId)) {
                            return true;
                        }
                        if (
                            p.consumableSupplierId &&
                            consumableSupplierIds.has(p.consumableSupplierId)
                        ) {
                            return true;
                        }
                        return false;
                    },
                );
                if (candidates.length) {
                    linkType = 'AUTO';
                    records = candidates;
                }
            }

            const paidAmount = records.reduce(
                (s, p) => s + Number(p.amount || 0),
                0,
            );
            const billAmount =
                r.billAmount === null || r.billAmount === undefined
                    ? null
                    : Number(r.billAmount);

            let status: string;
            if (billAmount === null) {
                status = 'NO_AMOUNT';
            } else if (paidAmount > 0 && paidAmount >= billAmount) {
                status = 'SETTLED';
            } else if (paidAmount > 0) {
                status = 'PARTIAL';
            } else {
                status = 'UNPAID';
            }

            return {
                ...r,
                billAmount,
                payment: {
                    status,
                    paidAmount,
                    linkedCount: records.length,
                    linkType,
                    records: records.map((p) => ({
                        id: p.id,
                        recordNo: p.recordNo,
                        title: p.title ?? null,
                        amount: Number(p.amount || 0),
                        paymentTime: p.paymentTime,
                    })),
                },
            };
        });
    }

    private formatTime(d: Date | string): string {
        const dt = new Date(d);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(
            dt.getDate(),
        )} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
    }
}
