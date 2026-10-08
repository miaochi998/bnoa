import {
    Controller,
    Get,
    Post,
    Patch,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TalentService } from './talent.service';
import {
    CreateTalentDto,
    UpdateTalentDto,
    TalentQueryDto,
} from './dto/talent.dto';
import {
    CreateTalentPlatformDto,
    UpdateTalentPlatformDto,
} from './dto/talent-platform.dto';
import {
    CreateTalentContactLogDto,
    TalentContactLogQueryDto,
} from './dto/talent-contact-log.dto';
import { CreateTalentTransferDto } from './dto/talent-transfer.dto';
import {
    SetTalentFlagDto,
    SaveFlagConfigsDto,
} from './dto/talent-flag.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
    CurrentUser,
    UserPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('达人管理')
@ApiBearerAuth()
@Controller('business/talents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TalentController {
    constructor(
        private readonly talentService: TalentService,
    ) {}

    // ========== 静态路由（必须在 :id 前） ==========

    @Post()
    @Permissions('talent:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateTalentDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.talentService.create(dto, userId);
    }

    @Get('select/list')
    @Permissions('talent:view')
    async findAllForSelect(
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.findAllForSelect(
            user.userId!, user.roles,
        );
    }

    @Post('transfer')
    @Permissions('talent:transfer')
    @HttpCode(HttpStatus.OK)
    async transfer(
        @Body() dto: CreateTalentTransferDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.transfer(
            dto, user.userId!, user.roles,
        );
    }

    @Get('flag-configs')
    @Permissions('talent:view')
    async getFlagConfigs(
        @CurrentUser('userId') userId: string,
    ) {
        return this.talentService.getFlagConfigs(userId);
    }

    @Put('flag-configs')
    @Permissions('talent:view')
    @HttpCode(HttpStatus.OK)
    async saveFlagConfigs(
        @Body() dto: SaveFlagConfigsDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.talentService.saveFlagConfigs(
            dto, userId,
        );
    }

    @Patch('platforms/:id')
    @Permissions('talent:update')
    @HttpCode(HttpStatus.OK)
    async updatePlatform(
        @Param('id') id: string,
        @Body() dto: UpdateTalentPlatformDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.updatePlatform(
            id, dto, user.userId!, user.roles,
        );
    }

    @Delete('platforms/:id')
    @Permissions('talent:delete')
    @HttpCode(HttpStatus.OK)
    async deletePlatform(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.deletePlatform(
            id, user.userId!, user.roles,
        );
    }

    @Get()
    @Permissions('talent:view')
    async findAll(
        @Query() query: TalentQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.findAll(
            query, user.userId!, user.roles,
        );
    }

    // ========== 参数化路由 ==========

    @Get(':id')
    @Permissions('talent:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.findById(
            id, user.userId!, user.roles,
        );
    }

    @Patch(':id')
    @Permissions('talent:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateTalentDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.update(
            id, dto, user.userId!, user.roles,
        );
    }

    @Delete(':id')
    @Permissions('talent:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.delete(
            id, user.userId!, user.roles,
        );
    }

    // ========== 平台账号子路由 ==========

    @Post(':talentId/platforms')
    @Permissions('talent:create')
    @HttpCode(HttpStatus.OK)
    async createPlatform(
        @Param('talentId') talentId: string,
        @Body() dto: CreateTalentPlatformDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.createPlatform(
            talentId, dto, user.userId!, user.roles,
        );
    }

    @Get(':talentId/platforms')
    @Permissions('talent:view')
    async findPlatformsByTalent(
        @Param('talentId') talentId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const talent = await this.talentService.findById(
            talentId, user.userId!, user.roles,
        );
        return (talent as any).platforms ?? [];
    }

    // ========== 沟通记录子路由 ==========

    @Post(':talentId/contact-logs')
    @Permissions('talent:view')
    @HttpCode(HttpStatus.OK)
    async createContactLog(
        @Param('talentId') talentId: string,
        @Body() dto: CreateTalentContactLogDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.createContactLog(
            talentId, dto, user.userId!, user.roles,
        );
    }

    @Get(':talentId/contact-logs')
    @Permissions('talent:view')
    async findContactLogs(
        @Param('talentId') talentId: string,
        @Query() query: TalentContactLogQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.findContactLogs(
            talentId, query, user.userId!, user.roles,
        );
    }

    // ========== 标旗子路由 ==========

    @Post(':id/flag')
    @Permissions('talent:view')
    @HttpCode(HttpStatus.OK)
    async setFlag(
        @Param('id') id: string,
        @Body() dto: SetTalentFlagDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.setFlag(
            id, dto, user.userId!, user.roles,
        );
    }

    @Delete(':id/flag')
    @Permissions('talent:view')
    @HttpCode(HttpStatus.OK)
    async removeFlag(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.removeFlag(
            id, user.userId!, user.roles,
        );
    }
}
