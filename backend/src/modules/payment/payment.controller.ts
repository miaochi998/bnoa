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

@ApiTags('付款记录')
@Controller('business/payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @Permissions('payment:list')
  @ApiOperation({ summary: '付款记录列表' })
  async findAll(@Query() query: PaymentQueryDto) {
    const { items, total } = await this.paymentService.findAll(query);
    return {
      data: items,
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
  async summary(@Query() query: PaymentQueryDto) {
    return this.paymentService.summary(query);
  }

  @Get('export')
  @Permissions('payment:export')
  @ApiOperation({ summary: '导出付款记录 Excel' })
  async export(
    @Query() query: PaymentQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.paymentService.export(query);
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
  async findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Post()
  @Permissions('payment:create')
  @ApiOperation({ summary: '新增付款记录' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePaymentDto, @CurrentUser('sub') userId: string) {
    return this.paymentService.create(dto, userId);
  }

  @Patch(':id')
  @Permissions('payment:update')
  @ApiOperation({ summary: '更新付款记录（含状态）' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.paymentService.update(id, dto, userId);
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
