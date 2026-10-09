import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsEnum,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { PurchaseBillNoSource, PurchaseItemType } from '@prisma/client';

/** 单条入库明细 */
export class PurchaseItemDto {
    @ApiProperty({
        description: '货物类型',
        enum: PurchaseItemType,
    })
    @IsEnum(PurchaseItemType)
    itemType: PurchaseItemType;

    // ===== 产品类型 =====
    @ApiPropertyOptional({ description: '产品ID（PRODUCT）' })
    @IsOptional()
    @IsUUID()
    productId?: string;

    @ApiPropertyOptional({ description: '供应商ID（PRODUCT）' })
    @IsOptional()
    @IsUUID()
    supplierId?: string;

    @ApiPropertyOptional({
        description: '供应商产品ID（规格/款式，PRODUCT）',
    })
    @IsOptional()
    @IsUUID()
    supplierProductId?: string;

    // ===== 耗材类型 =====
    @ApiPropertyOptional({ description: '耗材ID（CONSUMABLE）' })
    @IsOptional()
    @IsUUID()
    consumableId?: string;

    @ApiPropertyOptional({
        description: '耗材供应商ID（CONSUMABLE）',
    })
    @IsOptional()
    @IsUUID()
    consumableSupplierId?: string;

    // ===== 其它类型（手填） =====
    @ApiPropertyOptional({ description: '物品名称（OTHER 手填）' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    itemName?: string;

    @ApiPropertyOptional({ description: '供应商名称（OTHER 手填）' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    supplierName?: string;

    @ApiPropertyOptional({ description: '规格（OTHER 手填）' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    specName?: string;

    @ApiProperty({ description: '入库数量（自由文本）' })
    @IsString()
    @MaxLength(200)
    quantityText: string;

    @ApiPropertyOptional({ description: '行备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({
        description: '该行货物照片 fileId 数组（最多 10 张）',
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10, { message: '每行货物照片最多 10 张' })
    @IsString({ each: true })
    images?: string[];
}

export class CreatePurchaseReceiptDto {
    @ApiProperty({ description: '入库时间（ISO 字符串，精确到分钟）' })
    @IsString()
    receiptTime: string;

    @ApiPropertyOptional({ description: '票据号（可空）' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    billNo?: string;

    @ApiPropertyOptional({
        description: '票据号来源',
        enum: PurchaseBillNoSource,
    })
    @IsOptional()
    @IsEnum(PurchaseBillNoSource)
    billNoSource?: PurchaseBillNoSource;

    @ApiPropertyOptional({ description: '本次货款金额（选填）' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    billAmount?: number;

    @ApiPropertyOptional({ description: '是否准确，默认 true' })
    @IsOptional()
    @IsBoolean()
    isAccurate?: boolean;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({
        description: '发货单/票据照片 fileId 数组（最多 3 张）',
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(3, { message: '发货单照片最多 3 张' })
    @IsString({ each: true })
    billImages?: string[];

    @ApiProperty({ description: '入库明细', type: [PurchaseItemDto] })
    @IsArray()
    @ArrayMaxSize(50, { message: '入库明细最多 50 行' })
    @ValidateNested({ each: true })
    @Type(() => PurchaseItemDto)
    items: PurchaseItemDto[];
}

/**
 * 编辑采用「全量替换」语义：前端提交完整数据，明细与单据级照片整体重建。
 */
export class UpdatePurchaseReceiptDto extends CreatePurchaseReceiptDto {}

export class QueryPurchaseReceiptDto {
    @ApiPropertyOptional({ description: '关键字（单号/票据号/物品名/供应商名/备注）' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '入库开始日期 YYYY-MM-DD' })
    @IsOptional()
    @IsString()
    startDate?: string;

    @ApiPropertyOptional({ description: '入库结束日期 YYYY-MM-DD' })
    @IsOptional()
    @IsString()
    endDate?: string;

    @ApiPropertyOptional({ description: '产品ID' })
    @IsOptional()
    @IsUUID()
    productId?: string;

    @ApiPropertyOptional({ description: '耗材ID' })
    @IsOptional()
    @IsUUID()
    consumableId?: string;

    @ApiPropertyOptional({ description: '供应商ID' })
    @IsOptional()
    @IsUUID()
    supplierId?: string;

    @ApiPropertyOptional({ description: '耗材供应商ID' })
    @IsOptional()
    @IsUUID()
    consumableSupplierId?: string;

    @ApiPropertyOptional({
        description: '货物类型',
        enum: PurchaseItemType,
    })
    @IsOptional()
    @IsEnum(PurchaseItemType)
    itemType?: PurchaseItemType;

    @ApiPropertyOptional({ description: '票据号（模糊）' })
    @IsOptional()
    @IsString()
    billNo?: string;

    @ApiPropertyOptional({ description: '核对人ID' })
    @IsOptional()
    @IsUUID()
    checkerId?: string;

    @ApiPropertyOptional({ description: '是否准确' })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        return value === true || value === 'true' || value === 1 || value === '1';
    })
    @IsBoolean()
    isAccurate?: boolean;

    @ApiPropertyOptional({
        description: '打款状态',
        enum: ['SETTLED', 'PARTIAL', 'UNPAID', 'NO_AMOUNT'],
    })
    @IsOptional()
    @IsIn(['SETTLED', 'PARTIAL', 'UNPAID', 'NO_AMOUNT'])
    paymentStatus?: string;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: '每页条数', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number;

    @ApiPropertyOptional({
        description: '导出时使用的文件预览地址前缀（由前端传入，形如 http://192.168.2.6:6520/api/v1）',
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    previewBaseUrl?: string;
}

/** 付款记录「关联入库单」选择器的查询参数 */
export class ForPaymentQueryDto {
    @ApiPropertyOptional({
        description: '供应商类型',
        enum: ['SUPPLIER', 'CONSUMABLE_SUPPLIER'],
    })
    @IsIn(['SUPPLIER', 'CONSUMABLE_SUPPLIER'])
    supplierType: 'SUPPLIER' | 'CONSUMABLE_SUPPLIER';

    @ApiProperty({ description: '供应商ID' })
    @IsUUID()
    supplierId: string;

    @ApiPropertyOptional({ description: '关键字（单号/票据号）' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '返回条数上限', default: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}

/** AI 识别发货单票据号 */
export class RecognizeBillDto {
    @ApiProperty({ description: '发货单照片文件ID（files.id）' })
    @IsUUID()
    fileId: string;
}

/** 票据号重复校验 */
export class CheckBillNoDto {
    @ApiProperty({ description: '票据号' })
    @IsString()
    @MaxLength(100)
    billNo: string;

    @ApiPropertyOptional({ description: '供应商ID' })
    @IsOptional()
    @IsUUID()
    supplierId?: string;

    @ApiPropertyOptional({ description: '耗材供应商ID' })
    @IsOptional()
    @IsUUID()
    consumableSupplierId?: string;

    @ApiPropertyOptional({ description: '排除的入库单ID（编辑时用）' })
    @IsOptional()
    @IsUUID()
    excludeId?: string;
}
