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
    ForbiddenException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
    CurrentUser,
    UserPayload,
} from '../../common/decorators/current-user.decorator';
import { ProductService } from './product.service';
import {
    FieldKeyMapping,
    FieldPermissionService,
} from '../role/field-permission.service';
import {
    CreateProductDto,
    UpdateProductDto,
    ProductQueryDto,
} from './dto/product.dto';

/**
 * 产品字段映射：用于「信息权限」的读取脱敏与写入过滤
 */
const PRODUCT_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'code', key: 'code' },
    { field: 'brand', key: 'brand' },
    { field: 'pricingMode', key: 'pricingMode' },
    { field: 'status', key: 'status' },
    { field: 'mainImage', key: 'mainImage' },
    { field: 'remark', key: 'remark' },
];

@ApiTags('产品管理')
@Controller('business/products')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ProductController {
    constructor(
        private readonly productService: ProductService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'product',
            user.roles ?? [],
        );
    }

    @Get()
    @Permissions('product:view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取产品列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async findAll(
        @Query() query: ProductQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.productService.findAll(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list as any[],
                PRODUCT_FIELD_MAP,
                state,
            ),
        };
    }

    @Get('brands/list')
    @Permissions('product:brands')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取品牌列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getBrands(@CurrentUser() user: UserPayload) {
        const state = await this.resolveFields(user);
        // 品牌字段不可见时不下发品牌聚合列表，避免通过筛选下拉反推品牌
        if (!state.canView.has('brand')) return [];
        return await this.productService.getBrands();
    }

    @Get('next-code')
    @Permissions('product:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取下一个产品编码（新增时默认自动填充）' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getNextCode() {
        const code = await this.productService.getNextProductCode();
        return { code };
    }

    @Get(':id')
    @Permissions('product:view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取产品详情' })
    @ApiResponse({ status: 200, description: '获取成功' })
    @ApiResponse({ status: 404, description: '产品不存在' })
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const product = await this.productService.findById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            product as any,
            PRODUCT_FIELD_MAP,
            state,
        );
    }

    @Post()
    @Permissions('product:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建产品' })
    @ApiResponse({ status: 200, description: '创建成功' })
    @ApiResponse({ status: 409, description: '产品编码已存在' })
    async create(
        @Body() dto: CreateProductDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            PRODUCT_FIELD_MAP,
            state,
        );
        // 产品名称是必填项：被配成只读/隐藏时不允许创建
        if (!safe.name) {
            throw new ForbiddenException('没有「产品名称」的编辑权限');
        }
        return await this.productService.create(safe as CreateProductDto, user.sub);
    }

    @Patch(':id')
    @Permissions('product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新产品' })
    @ApiResponse({ status: 200, description: '更新成功' })
    @ApiResponse({ status: 404, description: '产品不存在' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProductDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            PRODUCT_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有产品字段的编辑权限');
        }
        return await this.productService.update(id, safe as UpdateProductDto, user.sub);
    }

    @Delete(':id')
    @Permissions('product:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除产品' })
    @ApiResponse({ status: 200, description: '删除成功' })
    @ApiResponse({ status: 404, description: '产品不存在' })
    @ApiResponse({ status: 409, description: '存在关联数据' })
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        await this.productService.delete(id, user.sub);
    }

    @Put('reorder')
    @Permissions('product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新产品排序' })
    @ApiResponse({ status: 200, description: '排序更新成功' })
    async reorder(@Body() body: { ids: string[] }) {
        return this.productService.reorderProducts(body.ids);
    }
}
