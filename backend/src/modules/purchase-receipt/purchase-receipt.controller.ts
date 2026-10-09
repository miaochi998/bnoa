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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
    CheckBillNoDto,
    CreatePurchaseReceiptDto,
    ForPaymentQueryDto,
    QueryPurchaseReceiptDto,
    RecognizeBillDto,
    UpdatePurchaseReceiptDto,
} from './dto/purchase-receipt.dto';
import { PurchaseReceiptService } from './purchase-receipt.service';

@ApiTags('进货入库记录')
@Controller('business/purchase-receipts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PurchaseReceiptController {
    constructor(
        private readonly purchaseReceiptService: PurchaseReceiptService,
    ) {}

    @Get()
    @Permissions('purchase:list')
    @ApiOperation({ summary: '进货入库记录列表' })
    async findAll(@Query() query: QueryPurchaseReceiptDto) {
        const { items, total } =
            await this.purchaseReceiptService.findAll(query);
        const page = Number(query.page) || 1;
        const limit = Number(query.pageSize) || 20;
        return {
            data: items,
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
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const file = await this.purchaseReceiptService.export(query);
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
    async forPayment(@Query() query: ForPaymentQueryDto) {
        return this.purchaseReceiptService.forPayment(query);
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
    async findOne(@Param('id') id: string) {
        return this.purchaseReceiptService.findOne(id);
    }

    @Post()
    @Permissions('purchase:create')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '新增入库记录' })
    async create(
        @Body() dto: CreatePurchaseReceiptDto,
        @CurrentUser('sub') userId: string,
    ) {
        return this.purchaseReceiptService.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('purchase:update')
    @ApiOperation({ summary: '编辑入库记录（仅本人或管理员）' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePurchaseReceiptDto,
        @CurrentUser('sub') userId: string,
    ) {
        return this.purchaseReceiptService.update(id, dto, userId);
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
