import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Res,
    StreamableFile,
    UseGuards,
    ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
    FieldKeyMapping,
    FieldPermissionService,
    FieldPermissionState,
} from '../role/field-permission.service';
import {
    CheckBillNoDto,
    CreatePurchaseReceiptDto,
    ForPaymentQueryDto,
    QueryPurchaseReceiptDto,
    RecognizeBillDto,
    UpdatePurchaseReceiptDto,
} from './dto/purchase-receipt.dto';
import { PurchaseReceiptService } from './purchase-receipt.service';

/**
 * 进货入库字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 明细（items 数组）里有货物类型/产品/供应商/规格/数量，需要递归脱敏。
 */
const PURCHASE_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'receiptNo', key: 'receiptNo' },
    { field: 'receiptTime', key: 'receiptTime' },
    { field: 'billNo', key: 'billNo' },
    { field: 'billNoSource', key: 'billNoSource' },
    { field: 'isAccurate', key: 'isAccurate' },
    { field: 'remark', key: 'remark' },
    { field: 'checkerId', key: 'checkerId' },
    { field: 'checkerId', key: 'checker' },
    { field: 'billAmount', key: 'billAmount' },
    { field: 'item.itemType', key: 'itemType' },
    { field: 'item.itemName', key: 'itemName' },
    { field: 'item.supplierName', key: 'supplierName' },
    { field: 'item.specName', key: 'specName' },
    { field: 'item.quantityText', key: 'quantityText' },
];

/** 需要递归处理的数组字段名 */
const PURCHASE_NESTED_ARRAYS = ['items', 'data'];

@ApiTags('进货入库记录')
@Controller('business/purchase-receipts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PurchaseReceiptController {
    constructor(
        private readonly purchaseReceiptService: PurchaseReceiptService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'purchase',
            user.roles ?? [],
        );
    }

    /** 入库记录（含明细数组）的读脱敏 */
    private stripReceiptDeep(node: any, state: FieldPermissionState): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        PURCHASE_FIELD_MAP,
        state,
      );
    }

    /** 写过滤：剔除请求体里不可编辑字段（含明细数组逐项） */
    private stripUneditable(dto: any, state: FieldPermissionState): any {
        const out: any = this.fieldPermissionService.stripUneditableFields(
            dto ?? {},
            PURCHASE_FIELD_MAP,
            state,
        );
        for (const key of PURCHASE_NESTED_ARRAYS) {
            if (Array.isArray(out[key])) {
                out[key] = out[key].map((item: any) =>
                    this.fieldPermissionService.stripUneditableFields(
                        item,
                        PURCHASE_FIELD_MAP,
                        state,
                    ),
                );
            }
        }
        return out;
    }

    @Get()
    @Permissions('purchase:list')
    @ApiOperation({ summary: '进货入库记录列表' })
    async findAll(
        @Query() query: QueryPurchaseReceiptDto,
        @CurrentUser() user: UserPayload,
    ) {
        const { items, total } =
            await this.purchaseReceiptService.findAll(query);
        const page = Number(query.page) || 1;
        const limit = Number(query.pageSize) || 20;
        const state = await this.resolveFields(user);
        return {
            data: (items || []).map((r: any) =>
                this.stripReceiptDeep(r, state),
            ),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    @Get('export')
    @Permissions('purchase:export')
    @ApiOperation({ summary: '导出入库记录 Excel' })
    async export(
        @Query() query: QueryPurchaseReceiptDto,
        @CurrentUser() user: UserPayload,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        // 导出同样要遵守字段级权限：不可见字段对应的列直接从 Excel 里去掉，
        // 否则「导出」会成为绕过读脱敏的后门（把隐藏的金额/账户带走）
        const state = await this.resolveFields(user);
        const hiddenFieldKeys = new Set(
            PURCHASE_FIELD_MAP.filter((m) => !state.canView.has(m.field)).map(
                (m) => m.field,
            ),
        );
        const file = await this.purchaseReceiptService.export(
            query,
            hiddenFieldKeys,
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="purchase-receipts-${Date.now()}.xlsx"`,
        );
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        return file;
    }

    @Get('for-payment')
    @Permissions('purchase:list')
    @ApiOperation({ summary: '供付款记录选择器的入库单候选' })
    async forPayment(
        @Query() query: ForPaymentQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const list = await this.purchaseReceiptService.forPayment(query);
        const state = await this.resolveFields(user);
        if (!Array.isArray(list)) return list;
        return list.map((r: any) => this.stripReceiptDeep(r, state));
    }

    @Get('next-bill-no')
    @Permissions('purchase:create')
    @ApiOperation({ summary: '生成无票编号建议（WP-YYYYMMDD-HHmm）' })
    async nextBillNo() {
        return this.purchaseReceiptService.nextBillNo();
    }

    @Post('check-bill-no')
    @Permissions('purchase:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '票据号重复校验（同供应商）' })
    async checkBillNo(@Body() dto: CheckBillNoDto) {
        return this.purchaseReceiptService.checkBillNo(dto);
    }

    @Post('recognize-bill')
    @Permissions('purchase:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'AI 识别发货单票据号（未配置模型时返回 available=false）',
    })
    async recognizeBill(
        @Body() dto: RecognizeBillDto,
        @CurrentUser('sub') userId: string,
    ) {
        return this.purchaseReceiptService.recognizeBill(
            dto.fileId,
            userId,
        );
    }

    @Get(':id')
    @Permissions('purchase:detail')
    @ApiOperation({ summary: '入库记录详情' })
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.purchaseReceiptService.findOne(id);
        const state = await this.resolveFields(user);
        return this.stripReceiptDeep(data, state);
    }

    @Post()
    @Permissions('purchase:create')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '新增入库记录' })
    async create(
        @Body() dto: CreatePurchaseReceiptDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditable(dto, state);
        return this.purchaseReceiptService.create(
            safe as CreatePurchaseReceiptDto,
            user.sub,
        );
    }

    @Patch(':id')
    @Permissions('purchase:update')
    @ApiOperation({ summary: '编辑入库记录（仅本人或管理员）' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePurchaseReceiptDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditable(dto, state);
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有入库记录字段的编辑权限');
        }
        return this.purchaseReceiptService.update(
            id,
            safe as UpdatePurchaseReceiptDto,
            user.sub,
        );
    }

    @Delete(':id')
    @Permissions('purchase:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除入库记录（软删除，仅本人或管理员）' })
    async remove(
        @Param('id') id: string,
        @CurrentUser('sub') userId: string,
    ) {
        await this.purchaseReceiptService.remove(id, userId);
        return { success: true };
    }
}
