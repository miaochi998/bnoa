import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  PaymentQueryDto,
} from './dto/payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
  FieldKeyMapping,
  FieldPermissionService,
  FieldPermissionState,
} from '../role/field-permission.service';

/**
 * 付款记录字段映射：用于「信息权限」的读取脱敏与写入过滤
 * 说明：汇总接口的 totalAmount、按类型/收款方的 amount 都归到「付款金额」这一个字段；
 *      付款账户 fromAccount 视为敏感（可被隐藏）。
 * ⚠️ 票据明细（bill.*）挂在 `bills` 数组上，数组元素自身的属性名就是
 *    billNumber / billDate / billAmount，因此这里按「元素级」映射，
 *    再由 stripPaymentDeep 递归到 bills 的每个元素上删除（见 PAYMENT_NESTED_ARRAYS）。
 */
const PAYMENT_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'recordNo', key: 'recordNo' },
  { field: 'title', key: 'title' },
  { field: 'amount', key: 'amount' },
  { field: 'amount', key: 'totalAmount' },
  { field: 'paymentTime', key: 'paymentTime' },
  { field: 'paymentType', key: 'paymentType' },
  { field: 'receiverType', key: 'receiverType' },
  { field: 'receiverName', key: 'receiverName' },
  { field: 'payMethod', key: 'payMethod' },
  { field: 'fromAccount', key: 'fromAccount' },
  { field: 'invoiceStatus', key: 'invoiceStatus' },
  { field: 'status', key: 'status' },
  { field: 'remark', key: 'remark' },
  // 票据明细（bills[] 的每个元素）
  { field: 'bill.billNumber', key: 'billNumber' },
  { field: 'bill.billDate', key: 'billDate' },
  { field: 'bill.billAmount', key: 'billAmount' },
];

/**
 * 需要递归处理的数组字段名
 * bills：票据明细数组，元素会被逐条套用 PAYMENT_FIELD_MAP，
 *        使 bill.billNumber / bill.billDate / bill.billAmount 真正生效
 */
const PAYMENT_NESTED_ARRAYS = [
  'data',
  'items',
  'bills',
  'attachments',
  'byType',
  'byReceiver',
];

@ApiTags('付款记录')
@Controller('business/payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'payment',
      user.roles ?? [],
    );
  }

  /** 付款记录（含关联数组）的读脱敏 */
  private stripPaymentDeep(node: any, state: FieldPermissionState): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      PAYMENT_FIELD_MAP,
      state,
    );
  }

  @Get()
  @Permissions('payment:list')
  @ApiOperation({ summary: '付款记录列表' })
  async findAll(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const { items, total } = await this.paymentService.findAll(query);
    const state = await this.resolveFields(user);
    return {
      data: (items || []).map((r: any) => this.stripPaymentDeep(r, state)),
      meta: {
        total,
        page: Number(query.page) || 1,
        limit: Number(query.pageSize) || 20,
        totalPages: Math.ceil(total / (Number(query.pageSize) || 20)),
      },
    };
  }

  @Get('summary')
  @Permissions('payment:list')
  @ApiOperation({ summary: '付款记录金额汇总' })
  async summary(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.paymentService.summary(query);
    const state = await this.resolveFields(user);
    return this.stripPaymentDeep(data, state);
  }

  @Get('export')
  @Permissions('payment:export')
  @ApiOperation({ summary: '导出付款记录 Excel' })
  async export(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: UserPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // 导出遵守字段级权限：不可见字段对应的列直接从 Excel 去掉（避免导出成为读脱敏的后门）
    const state = await this.resolveFields(user);
    const hiddenFieldKeys = new Set(
      PAYMENT_FIELD_MAP.filter((m) => !state.canView.has(m.field)).map(
        (m) => m.field,
      ),
    );
    const file = await this.paymentService.export(query, hiddenFieldKeys);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payments-${Date.now()}.xlsx"`,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return file;
  }

  @Get(':id')
  @Permissions('payment:detail')
  @ApiOperation({ summary: '付款记录详情' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.paymentService.findOne(id);
    const state = await this.resolveFields(user);
    return this.stripPaymentDeep(data, state);
  }

  @Post()
  @Permissions('payment:create')
  @ApiOperation({ summary: '新增付款记录' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto as any,
      PAYMENT_FIELD_MAP,
      state,
    );
    if (!safe.title || safe.amount === undefined) {
      throw new ForbiddenException('创建付款记录所需的必填字段没有编辑权限');
    }
    return this.paymentService.create(safe as CreatePaymentDto, user.sub);
  }

  @Patch(':id')
  @Permissions('payment:update')
  @ApiOperation({ summary: '更新付款记录（含状态）' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() user: UserPayload,
  ) {
    const state = await this.resolveFields(user);
    const safe = this.fieldPermissionService.stripUneditableFields(
      dto as any,
      PAYMENT_FIELD_MAP,
      state,
    );
    if (Object.keys(safe).length === 0) {
      throw new ForbiddenException('没有付款记录字段的编辑权限');
    }
    const updated = await this.paymentService.update(
      id,
      safe as UpdatePaymentDto,
      user.sub,
    );
    // 写响应与读接口一致地脱敏
    return this.stripPaymentDeep(updated, state);
  }

  @Delete(':id')
  @Permissions('payment:delete')
  @ApiOperation({ summary: '删除付款记录（软删除）' })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.paymentService.remove(id);
    return { success: true };
  }
}
