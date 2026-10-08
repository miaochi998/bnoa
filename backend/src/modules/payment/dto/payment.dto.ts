import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentBillDto {
  @ApiProperty({ description: '票据编号' })
  @IsString()
  billNumber: string;

  @ApiPropertyOptional({ description: '票据日期' })
  @IsOptional()
  @IsDateString()
  billDate?: string;

  @ApiPropertyOptional({ description: '票据金额' })
  @IsOptional()
  @IsNumber()
  billAmount?: number;

  @ApiPropertyOptional({ description: '票据照片文件ID（files.id）' })
  @IsOptional()
  @IsString()
  billFileId?: string;
}

export class PaymentAttachmentDto {
  @ApiProperty({
    description: '附件类型',
    enum: ['SCREENSHOT', 'INVOICE'],
  })
  @IsIn(['SCREENSHOT', 'INVOICE'])
  type: 'SCREENSHOT' | 'INVOICE';

  @ApiProperty({ description: '文件ID（files.id）' })
  @IsString()
  fileId: string;

  @ApiPropertyOptional({ description: '附件备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreatePaymentDto {
  @ApiProperty({ description: '款项名称' })
  @IsString()
  title: string;

  @ApiProperty({ description: '打款金额' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: '币种',
    enum: ['CNY', 'USD', 'EUR', 'OTHER'],
    default: 'CNY',
  })
  @IsOptional()
  @IsIn(['CNY', 'USD', 'EUR', 'OTHER'])
  currency?: 'CNY' | 'USD' | 'EUR' | 'OTHER';

  @ApiProperty({ description: '打款时间' })
  @IsDateString()
  paymentTime: string;

  @ApiProperty({
    description: '打款类型',
    enum: ['GOODS', 'FREIGHT', 'CONSUMABLE', 'PROMOTION', 'SERVICE', 'REFUND', 'OTHER'],
  })
  @IsIn(['GOODS', 'FREIGHT', 'CONSUMABLE', 'PROMOTION', 'SERVICE', 'REFUND', 'OTHER'])
  paymentType: 'GOODS' | 'FREIGHT' | 'CONSUMABLE' | 'PROMOTION' | 'SERVICE' | 'REFUND' | 'OTHER';

  @ApiProperty({
    description: '收款方类型',
    enum: ['SUPPLIER', 'CONSUMABLE_SUPPLIER', 'CUSTOM'],
  })
  @IsIn(['SUPPLIER', 'CONSUMABLE_SUPPLIER', 'CUSTOM'])
  receiverType: 'SUPPLIER' | 'CONSUMABLE_SUPPLIER' | 'CUSTOM';

  @ApiPropertyOptional({ description: '供应商ID（receiverType=SUPPLIER 必填）' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: '耗材供应商ID（receiverType=CONSUMABLE_SUPPLIER 必填）' })
  @IsOptional()
  @IsString()
  consumableSupplierId?: string;

  @ApiPropertyOptional({ description: '自定义收款方名称（receiverType=CUSTOM 必填）' })
  @IsOptional()
  @IsString()
  customReceiverName?: string;

  @ApiProperty({
    description: '打款方式',
    enum: ['CORPORATE_TRANSFER', 'PERSONAL_TRANSFER', 'CASH', 'ACCEPTANCE', 'OTHER'],
  })
  @IsIn(['CORPORATE_TRANSFER', 'PERSONAL_TRANSFER', 'CASH', 'ACCEPTANCE', 'OTHER'])
  payMethod: 'CORPORATE_TRANSFER' | 'PERSONAL_TRANSFER' | 'CASH' | 'ACCEPTANCE' | 'OTHER';

  @ApiPropertyOptional({ description: '付款账户' })
  @IsOptional()
  @IsString()
  fromAccount?: string;

  @ApiProperty({
    description: '发票状态',
    enum: ['PENDING', 'ISSUED', 'NOT_REQUIRED', 'VOID'],
  })
  @IsIn(['PENDING', 'ISSUED', 'NOT_REQUIRED', 'VOID'])
  invoiceStatus: 'PENDING' | 'ISSUED' | 'NOT_REQUIRED' | 'VOID';

  @ApiPropertyOptional({
    description: '记录状态',
    enum: ['DRAFT', 'PAID', 'FAILED', 'CANCELLED'],
    default: 'DRAFT',
  })
  @IsOptional()
  @IsIn(['DRAFT', 'PAID', 'FAILED', 'CANCELLED'])
  status?: 'DRAFT' | 'PAID' | 'FAILED' | 'CANCELLED';

  @ApiPropertyOptional({ description: '打款人ID，默认当前用户' })
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '票据子记录（一单多票）', type: [PaymentBillDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentBillDto)
  bills?: PaymentBillDto[];

  @ApiPropertyOptional({ description: '附件（打款截图/发票）', type: [PaymentAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAttachmentDto)
  attachments?: PaymentAttachmentDto[];
}

export class UpdatePaymentDto {
  @ApiPropertyOptional({ description: '款项名称' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '打款金额' })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({
    description: '币种',
    enum: ['CNY', 'USD', 'EUR', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['CNY', 'USD', 'EUR', 'OTHER'])
  currency?: 'CNY' | 'USD' | 'EUR' | 'OTHER';

  @ApiPropertyOptional({ description: '打款时间' })
  @IsOptional()
  @IsDateString()
  paymentTime?: string;

  @ApiPropertyOptional({
    description: '打款类型',
    enum: ['GOODS', 'FREIGHT', 'CONSUMABLE', 'PROMOTION', 'SERVICE', 'REFUND', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['GOODS', 'FREIGHT', 'CONSUMABLE', 'PROMOTION', 'SERVICE', 'REFUND', 'OTHER'])
  paymentType?: 'GOODS' | 'FREIGHT' | 'CONSUMABLE' | 'PROMOTION' | 'SERVICE' | 'REFUND' | 'OTHER';

  @ApiPropertyOptional({
    description: '收款方类型',
    enum: ['SUPPLIER', 'CONSUMABLE_SUPPLIER', 'CUSTOM'],
  })
  @IsOptional()
  @IsIn(['SUPPLIER', 'CONSUMABLE_SUPPLIER', 'CUSTOM'])
  receiverType?: 'SUPPLIER' | 'CONSUMABLE_SUPPLIER' | 'CUSTOM';

  @ApiPropertyOptional({ description: '供应商ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: '耗材供应商ID' })
  @IsOptional()
  @IsString()
  consumableSupplierId?: string;

  @ApiPropertyOptional({ description: '自定义收款方名称' })
  @IsOptional()
  @IsString()
  customReceiverName?: string;

  @ApiPropertyOptional({
    description: '打款方式',
    enum: ['CORPORATE_TRANSFER', 'PERSONAL_TRANSFER', 'CASH', 'ACCEPTANCE', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['CORPORATE_TRANSFER', 'PERSONAL_TRANSFER', 'CASH', 'ACCEPTANCE', 'OTHER'])
  payMethod?: 'CORPORATE_TRANSFER' | 'PERSONAL_TRANSFER' | 'CASH' | 'ACCEPTANCE' | 'OTHER';

  @ApiPropertyOptional({ description: '付款账户' })
  @IsOptional()
  @IsString()
  fromAccount?: string;

  @ApiPropertyOptional({
    description: '发票状态',
    enum: ['PENDING', 'ISSUED', 'NOT_REQUIRED', 'VOID'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'ISSUED', 'NOT_REQUIRED', 'VOID'])
  invoiceStatus?: 'PENDING' | 'ISSUED' | 'NOT_REQUIRED' | 'VOID';

  @ApiPropertyOptional({
    description: '记录状态',
    enum: ['DRAFT', 'PAID', 'FAILED', 'CANCELLED'],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'PAID', 'FAILED', 'CANCELLED'])
  status?: 'DRAFT' | 'PAID' | 'FAILED' | 'CANCELLED';

  @ApiPropertyOptional({ description: '打款人ID' })
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '票据子记录（整体替换）', type: [PaymentBillDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentBillDto)
  bills?: PaymentBillDto[];

  @ApiPropertyOptional({ description: '附件（整体替换）', type: [PaymentAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAttachmentDto)
  attachments?: PaymentAttachmentDto[];
}

export class PaymentQueryDto {
  @ApiPropertyOptional({ description: '关键字（款项名称/收款方名称）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: '打款类型',
    enum: ['GOODS', 'FREIGHT', 'CONSUMABLE', 'PROMOTION', 'SERVICE', 'REFUND', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['GOODS', 'FREIGHT', 'CONSUMABLE', 'PROMOTION', 'SERVICE', 'REFUND', 'OTHER'])
  paymentType?: string;

  @ApiPropertyOptional({
    description: '收款方类型',
    enum: ['SUPPLIER', 'CONSUMABLE_SUPPLIER', 'CUSTOM'],
  })
  @IsOptional()
  @IsIn(['SUPPLIER', 'CONSUMABLE_SUPPLIER', 'CUSTOM'])
  receiverType?: string;

  @ApiPropertyOptional({ description: '供应商ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: '耗材供应商ID' })
  @IsOptional()
  @IsString()
  consumableSupplierId?: string;

  @ApiPropertyOptional({ description: '打款人ID' })
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional({
    description: '发票状态',
    enum: ['PENDING', 'ISSUED', 'NOT_REQUIRED', 'VOID'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'ISSUED', 'NOT_REQUIRED', 'VOID'])
  invoiceStatus?: string;

  @ApiPropertyOptional({
    description: '记录状态',
    enum: ['DRAFT', 'PAID', 'FAILED', 'CANCELLED'],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'PAID', 'FAILED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '页码' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: '每页条数' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number;
}

export interface PaymentQueryResult {
  id: string;
  recordNo: string;
  title: string;
  amount: number;
  currency: string;
  paymentTime: Date;
  paymentType: string;
  receiverType: string;
  receiverName: string | null;
  supplierId: string | null;
  consumableSupplierId: string | null;
  customReceiverName: string | null;
  payMethod: string;
  fromAccount: string | null;
  invoiceStatus: string;
  status: string;
  payerId: string;
  payerName?: string;
  remark: string | null;
  billCount?: number;
  attachmentCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
