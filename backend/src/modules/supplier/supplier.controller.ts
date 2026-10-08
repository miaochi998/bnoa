import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Put,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import {
    CreateSupplierDto,
    UpdateSupplierDto,
    SupplierQueryDto,
} from './dto/supplier.dto';
import {
    CreateSupplierProductDto,
    UpdateSupplierProductDto,
    SupplierProductQueryDto,
} from './dto/supplier-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('供应商管理')
@ApiBearerAuth()
@Controller('business/suppliers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SupplierController {
    constructor(
        private readonly supplierService: SupplierService,
    ) {}

    @Post()
    @Permissions('supplier:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateSupplierDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('supplier:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateSupplierDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.update(id, dto, userId);
    }

    @Delete(':id')
    @Permissions('supplier:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.delete(id, userId);
    }

    @Get('select/list')
    @Permissions('supplier:view')
    async findAllForSelect() {
        return this.supplierService.findAllForSelect();
    }

    @Get()
    @Permissions('supplier:view')
    async findAll(@Query() query: SupplierQueryDto) {
        return this.supplierService.findAll(query);
    }

    // ========== 供应商-产品关联管理 ==========

    @Get('products')
    @Permissions('supplier:view')
    async findAllSupplierProducts(
        @Query() query: SupplierProductQueryDto,
    ) {
        return this.supplierService.findAllSupplierProducts(query);
    }

    @Post('products')
    @Permissions('supplier:create')
    @HttpCode(HttpStatus.OK)
    async createSupplierProduct(
        @Body() dto: CreateSupplierProductDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.createSupplierProduct(
            dto,
            userId,
        );
    }

    @Get('products/:id')
    @Permissions('supplier:view')
    async findSupplierProductById(@Param('id') id: string) {
        return this.supplierService.findSupplierProductById(id);
    }

    @Patch('products/:id')
    @Permissions('supplier:update')
    @HttpCode(HttpStatus.OK)
    async updateSupplierProduct(
        @Param('id') id: string,
        @Body() dto: UpdateSupplierProductDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.updateSupplierProduct(
            id,
            dto,
            userId,
        );
    }

    @Delete('products/:id')
    @Permissions('supplier:delete')
    @HttpCode(HttpStatus.OK)
    async deleteSupplierProduct(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.deleteSupplierProduct(
            id,
            userId,
        );
    }

    @Get('product/:productId/suppliers')
    @Permissions('supplier:view')
    async findSuppliersByProduct(
        @Param('productId') productId: string,
    ) {
        return this.supplierService.findSuppliersByProduct(
            productId,
        );
    }

    @Get(':id/products')
    @Permissions('supplier:view')
    async findProductsBySupplier(
        @Param('id') id: string,
    ) {
        return this.supplierService.findProductsBySupplier(id);
    }

    @Get(':id')
    @Permissions('supplier:view')
    async findById(@Param('id') id: string) {
        return this.supplierService.findById(id);
    }

    // ========== 排序管理 ==========

    @Put('reorder')
    @Permissions('supplier:update')
    @HttpCode(HttpStatus.OK)
    async reorderSuppliers(@Body() body: { ids: string[] }) {
        return this.supplierService.reorderSuppliers(body.ids);
    }

    @Put('products/reorder')
    @Permissions('supplier:update')
    @HttpCode(HttpStatus.OK)
    async reorderSupplierProducts(@Body() body: { ids: string[] }) {
        return this.supplierService.reorderSupplierProducts(body.ids);
    }
}
