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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import {
    CreatePlatformDto,
    UpdatePlatformDto,
    QueryPlatformDto,
} from './dto/platform.dto';

@ApiTags('平台管理')
@Controller('business/platforms')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PlatformController {
    constructor(
        private readonly platformService: PlatformService,
    ) {}

    @Get()
    @Permissions('platform:view')
    async findAll(@Query() query: QueryPlatformDto) {
        return this.platformService.findAll(query);
    }

    @Get('active')
    @Permissions('platform:view')
    async findActive() {
        return this.platformService.findActive();
    }

    @Get(':id')
    @Permissions('platform:view')
    async findById(@Param('id') id: string) {
        return this.platformService.findById(id);
    }

    @Post()
    @Permissions('platform:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreatePlatformDto,
        @CurrentUser('userId') userId: string,
    ) {
        return await this.platformService.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('platform:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePlatformDto,
        @CurrentUser('userId') userId: string,
    ) {
        return await this.platformService.update(id, dto, userId);
    }

    @Delete(':id')
    @Permissions('platform:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.platformService.delete(id, userId);
    }

    @Put('reorder')
    @Permissions('platform:update')
    @HttpCode(HttpStatus.OK)
    async reorder(@Body() body: { ids: string[] }) {
        return this.platformService.reorderPlatforms(body.ids);
    }
}
