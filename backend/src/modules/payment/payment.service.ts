import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as ExcelJS from 'exceljs';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  PaymentQueryDto,
  PaymentQueryResult,
} from './dto/payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 生成系统流水号：PAY-YYYYMMDD-序号（当天递增，唯一兜底靠唯一约束 + 重试简化） */
  private async genRecordNo(): Promise<string> {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}`;
    const prefix = `PAY-${ymd}-`;
    const count = await this.prisma.paymentRecord.count({
      where: { recordNo: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  /** 依据 receiverType 计算收款方名称 */
  private async resolveReceiverName(dto: CreatePaymentDto | UpdatePaymentDto): Promise<string> {
    const type = dto.receiverType;
    if (type === 'SUPPLIER') {
      if (!dto.supplierId) throw new BadRequestException('收款方类型为供应商时必须选择供应商');
      const s = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!s) throw new BadRequestException('供应商不存在');
      return s.name;
    }
    if (type === 'CONSUMABLE_SUPPLIER') {
      if (!dto.consumableSupplierId)
        throw new BadRequestException('收款方类型为耗材供应商时必须选择耗材供应商');
      const s = await this.prisma.consumableSupplier.findUnique({
        where: { id: dto.consumableSupplierId },
      });
      if (!s) throw new BadRequestException('耗材供应商不存在');
      return s.name;
    }
    if (type === 'CUSTOM') {
      if (!dto.customReceiverName) throw new BadRequestException('收款方类型为自定义时必须填写名称');
      return dto.customReceiverName;
    }
    throw new BadRequestException('收款方类型非法');
  }

  /** 校验记录是否处于终态（作废不可再改） */
  private assertNotCancelled(existing: { status: string }) {
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('该记录已作废，不可修改');
    }
  }

  async create(dto: CreatePaymentDto, userId: string): Promise<PaymentQueryResult> {
    const recordNo = await this.genRecordNo();
    const receiverName = await this.resolveReceiverName(dto);
    const payerId = dto.payerId || userId;

    const result = await this.prisma.paymentRecord.create({
      data: {
        recordNo,
        title: dto.title,
        amount: dto.amount,
        currency: dto.currency ?? 'CNY',
        paymentTime: new Date(dto.paymentTime),
        paymentType: dto.paymentType,
        receiverType: dto.receiverType,
        receiverName,
        supplierId: dto.receiverType === 'SUPPLIER' ? dto.supplierId : null,
        consumableSupplierId:
          dto.receiverType === 'CONSUMABLE_SUPPLIER' ? dto.consumableSupplierId : null,
        customReceiverName: dto.receiverType === 'CUSTOM' ? dto.customReceiverName : null,
        payMethod: dto.payMethod,
        fromAccount: dto.fromAccount,
        invoiceStatus: dto.invoiceStatus,
        status: dto.status ?? 'DRAFT',
        payerId,
        remark: dto.remark,
        createdBy: userId,
        updatedBy: userId,
        bills: dto.bills?.length
          ? {
              create: dto.bills.map((b) => ({
                billNumber: b.billNumber,
                billDate: b.billDate ? new Date(b.billDate) : null,
                billAmount: b.billAmount,
                billFileId: b.billFileId,
              })),
            }
          : undefined,
        attachments: dto.attachments?.length
          ? {
              create: dto.attachments.map((a) => ({
                type: a.type,
                fileId: a.fileId,
                remark: a.remark,
              })),
            }
          : undefined,
        purchaseReceiptLinks: dto.purchaseReceiptIds?.length
          ? {
              create: dto.purchaseReceiptIds.map((rid) => ({
                purchaseReceiptId: rid,
                createdBy: userId,
              })),
            }
          : undefined,
      },
      include: {
        payer: { select: { name: true } },
        _count: { select: { bills: true, attachments: true } },
      },
    });

    return this.toListItem(result);
  }

  async findAll(query: PaymentQueryDto): Promise<{ items: PaymentQueryResult[]; total: number }> {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { deletedAt: null };

    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { receiverName: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }
    if (query.paymentType) where.paymentType = query.paymentType;
    if (query.receiverType) where.receiverType = query.receiverType;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.consumableSupplierId) where.consumableSupplierId = query.consumableSupplierId;
    if (query.payerId) where.payerId = query.payerId;
    if (query.status) where.status = query.status;
    if (query.invoiceStatus) where.invoiceStatus = query.invoiceStatus;
    if (query.startDate || query.endDate) {
      where.paymentTime = {};
      if (query.startDate) where.paymentTime.gte = new Date(query.startDate);
      if (query.endDate) where.paymentTime.lte = new Date(query.endDate);
    }

    const [rows, total] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { paymentTime: 'desc' },
        include: {
          payer: { select: { name: true } },
          _count: { select: { bills: true, attachments: true } },
        },
      }),
      this.prisma.paymentRecord.count({ where }),
    ]);

    return { items: rows.map((r) => this.toListItem(r)), total };
  }

  async findOne(id: string): Promise<any> {
    const rec = await this.prisma.paymentRecord.findUnique({
      where: { id },
      include: {
        payer: { select: { name: true } },
        bills: { include: { billFile: { select: { id: true, name: true } } } },
        attachments: { include: { file: { select: { id: true, name: true } } } },
        purchaseReceiptLinks: {
          include: {
            purchaseReceipt: {
              select: {
                id: true,
                receiptNo: true,
                receiptTime: true,
                billNo: true,
                billAmount: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
    if (!rec) throw new NotFoundException('付款记录不存在');
    return {
      ...rec,
      payerName: rec.payer?.name ?? null,
      amount: Number(rec.amount),
      bills: (rec.bills || []).map((b: any) => ({
        id: b.id,
        billNumber: b.billNumber,
        billDate: b.billDate,
        billAmount: Number(b.billAmount),
        billFileId: b.billFileId,
        billFile: b.billFile,
      })),
      attachments: (rec.attachments || []).map((a: any) => ({
        id: a.id,
        type: a.type,
        fileId: a.fileId,
        remark: a.remark,
        file: a.file,
      })),
      purchaseReceipts: ((rec as any).purchaseReceiptLinks || [])
        .map((l: any) => l.purchaseReceipt)
        .filter((r: any) => r && !r.deletedAt)
        .map((r: any) => ({
          id: r.id,
          receiptNo: r.receiptNo,
          receiptTime: r.receiptTime,
          billNo: r.billNo,
          billAmount: r.billAmount === null ? null : Number(r.billAmount),
        })),
    };
  }

  async update(id: string, dto: UpdatePaymentDto, userId: string): Promise<any> {
    const existing = await this.prisma.paymentRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('付款记录不存在');
    this.assertNotCancelled(existing);

    let receiverName: string | undefined;
    if (dto.receiverType || dto.supplierId || dto.consumableSupplierId || dto.customReceiverName) {
      // 用合并后的 receiverType 计算，若未传 receiverType 则沿用已有
      const merged = {
        receiverType: ((dto.receiverType as any) || existing.receiverType) as CreatePaymentDto['receiverType'],
        supplierId: (dto.supplierId as any) ?? existing.supplierId,
        consumableSupplierId: (dto.consumableSupplierId as any) ?? existing.consumableSupplierId,
        customReceiverName: (dto.customReceiverName as any) ?? existing.customReceiverName,
      } as CreatePaymentDto & { receiverType: CreatePaymentDto['receiverType'] };
      receiverName = await this.resolveReceiverName(merged);
    }

    // 若整体替换子表，先删 + 主表更新（含子表 create）合并为单事务，避免失败丢子记录
    return this.prisma.$transaction(async (tx) => {
      if (dto.bills) {
        await tx.paymentBill.deleteMany({ where: { paymentRecordId: id } });
      }
      if (dto.attachments) {
        await tx.paymentAttachment.deleteMany({ where: { paymentRecordId: id } });
      }
      if (dto.purchaseReceiptIds) {
        await tx.paymentRecordPurchaseReceipt.deleteMany({
          where: { paymentRecordId: id },
        });
      }

      return tx.paymentRecord.update({
        where: { id },
        data: {
          title: dto.title,
          amount: dto.amount,
          currency: dto.currency,
          paymentTime: dto.paymentTime ? new Date(dto.paymentTime) : undefined,
          paymentType: dto.paymentType,
          receiverType: dto.receiverType,
          receiverName,
          supplierId: dto.receiverType
            ? dto.receiverType === 'SUPPLIER'
              ? dto.supplierId
              : null
            : undefined,
          consumableSupplierId: dto.receiverType
            ? dto.receiverType === 'CONSUMABLE_SUPPLIER'
              ? dto.consumableSupplierId
              : null
            : undefined,
          customReceiverName: dto.receiverType
            ? dto.receiverType === 'CUSTOM'
              ? dto.customReceiverName
              : null
            : undefined,
          payMethod: dto.payMethod,
          fromAccount: dto.fromAccount,
          invoiceStatus: dto.invoiceStatus,
          status: dto.status,
          payerId: dto.payerId,
          remark: dto.remark,
          updatedBy: userId,
          bills: dto.bills
            ? {
                create: dto.bills.map((b) => ({
                  billNumber: b.billNumber,
                  billDate: b.billDate ? new Date(b.billDate) : null,
                  billAmount: b.billAmount,
                  billFileId: b.billFileId,
                })),
              }
            : undefined,
          attachments: dto.attachments
            ? {
                create: dto.attachments.map((a) => ({
                  type: a.type,
                  fileId: a.fileId,
                  remark: a.remark,
                })),
              }
            : undefined,
          purchaseReceiptLinks: dto.purchaseReceiptIds
            ? {
                create: dto.purchaseReceiptIds.map((rid) => ({
                  purchaseReceiptId: rid,
                  createdBy: userId,
                })),
              }
            : undefined,
        },
        include: {
          payer: { select: { name: true } },
          bills: { include: { billFile: { select: { id: true, name: true } } } },
          attachments: { include: { file: { select: { id: true, name: true } } } },
        },
      });
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.paymentRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('付款记录不存在');
    await this.prisma.paymentRecord.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** 金额汇总：按类型 & 按收款方 */
  async summary(query: PaymentQueryDto): Promise<any> {
    const where = this.buildWhere(query);
    const [byType, byReceiver, totalAgg] = await Promise.all([
      this.prisma.paymentRecord.groupBy({
        by: ['paymentType'],
        where,
        _sum: { amount: true },
      }),
      this.prisma.paymentRecord.groupBy({
        by: ['receiverName'],
        where,
        _sum: { amount: true },
      }),
      this.prisma.paymentRecord.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      totalAmount: totalAgg?._sum?.amount ?? 0,
      byType: byType.map((r) => ({ paymentType: r.paymentType, amount: r._sum.amount ?? 0 })),
      byReceiver: byReceiver.map((r) => ({
        receiverName: r.receiverName ?? '',
        amount: r._sum.amount ?? 0,
      })),
    };
  }

  /** 导出 Excel */
  async export(query: PaymentQueryDto): Promise<StreamableFile> {
    const where = this.buildWhere(query);
    const rows = await this.prisma.paymentRecord.findMany({
      where,
      orderBy: { paymentTime: 'desc' },
      include: { payer: { select: { name: true } } },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('付款记录');
    sheet.columns = [
      { header: '系统流水号', key: 'recordNo', width: 25 },
      { header: '款项名称', key: 'title', width: 30 },
      { header: '打款类型', key: 'paymentType', width: 12 },
      { header: '打款时间', key: 'paymentTime', width: 20 },
      { header: '打款金额', key: 'amount', width: 15 },
      { header: '币种', key: 'currency', width: 8 },
      { header: '收款方', key: 'receiverName', width: 25 },
      { header: '打款方式', key: 'payMethod', width: 15 },
      { header: '付款账户', key: 'fromAccount', width: 25 },
      { header: '发票状态', key: 'invoiceStatus', width: 12 },
      { header: '记录状态', key: 'status', width: 12 },
      { header: '打款人', key: 'payerName', width: 12 },
      { header: '备注', key: 'remark', width: 25 },
    ];
    rows.forEach((r) => {
      sheet.addRow({
        recordNo: r.recordNo,
        title: r.title,
        paymentType: r.paymentType,
        paymentTime: r.paymentTime.toISOString(),
        amount: Number(r.amount),
        currency: r.currency,
        receiverName: r.receiverName,
        payMethod: r.payMethod,
        fromAccount: r.fromAccount,
        invoiceStatus: r.invoiceStatus,
        status: r.status,
        payerName: (r as any).payer?.name,
        remark: r.remark,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new StreamableFile(Buffer.from(buffer));
  }

  private buildWhere(query: PaymentQueryDto): any {
    const where: any = { deletedAt: null };
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { receiverName: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }
    if (query.paymentType) where.paymentType = query.paymentType;
    if (query.receiverType) where.receiverType = query.receiverType;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.consumableSupplierId) where.consumableSupplierId = query.consumableSupplierId;
    if (query.payerId) where.payerId = query.payerId;
    if (query.status) where.status = query.status;
    if (query.invoiceStatus) where.invoiceStatus = query.invoiceStatus;
    if (query.startDate || query.endDate) {
      where.paymentTime = {};
      if (query.startDate) where.paymentTime.gte = new Date(query.startDate);
      if (query.endDate) where.paymentTime.lte = new Date(query.endDate);
    }
    return where;
  }

  private toListItem(r: any): PaymentQueryResult {
    return {
      id: r.id,
      recordNo: r.recordNo,
      title: r.title,
      amount: Number(r.amount),
      currency: r.currency,
      paymentTime: r.paymentTime,
      paymentType: r.paymentType,
      receiverType: r.receiverType,
      receiverName: r.receiverName,
      supplierId: r.supplierId,
      consumableSupplierId: r.consumableSupplierId,
      customReceiverName: r.customReceiverName,
      payMethod: r.payMethod,
      fromAccount: r.fromAccount,
      invoiceStatus: r.invoiceStatus,
      status: r.status,
      payerId: r.payerId,
      payerName: r.payer?.name,
      remark: r.remark,
      billCount: r._count?.bills,
      attachmentCount: r._count?.attachments,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
