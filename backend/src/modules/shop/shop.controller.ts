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
import { ShopService } from './shop.service';
import { CreateShopDto, UpdateShopDto, QueryShopDto } from './dto/shop.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('店铺管理')
@Controller('business/shops')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ShopController {
    constructor(
        private readonly shopService: ShopService,
    ) {}

    @Get()
    @Permissions('shop:view')
    async findAll(@Query() query: QueryShopDto) {
        return this.shopService.findAll(query);
    }

    @Get('active')
    @Permissions('shop:view')
    async findActive() {
        return this.shopService.findActive();
    }

    @Get(':id')
    @Permissions('shop:view')
    async findById(@Param('id') id: string) {
        return this.shopService.findById(id);
    }

    @Post()
    @Permissions('shop:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateShopDto,
        @CurrentUser('userId') userId: string,
    ) {
        return await this.shopService.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateShopDto,
        @CurrentUser('userId') userId: string,
    ) {
        return await this.shopService.update(id, dto, userId);
    }

    @Delete(':id')
    @Permissions('shop:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.shopService.delete(id, userId);
    }

    @Put('reorder')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async reorder(@Body() body: { ids: string[] }) {
        return this.shopService.reorderShops(body.ids);
    }

    // ========== 别名管理 ==========

    @Get(':id/aliases')
    @Permissions('shop:view')
    async getAliases(@Param('id') id: string) {
        return this.shopService.getAliases(id);
    }

    @Post(':id/aliases')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async addAlias(
        @Param('id') id: string,
        @Body('alias') alias: string,
    ) {
        return this.shopService.addAlias(id, alias);
    }

    @Delete(':id/aliases/:aliasId')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async removeAlias(@Param('aliasId') aliasId: string) {
        await this.shopService.removeAlias(aliasId);
    }
}
