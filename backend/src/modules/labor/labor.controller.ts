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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LaborService } from './labor.service';
import {
    QueryLaborTypeDto,
    CreateLaborTypeDto,
    UpdateLaborTypeDto,
    CreateLaborRateDto,
    UpdateLaborRateDto,
} from './dto/labor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
    CurrentUser,
    UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
    FieldKeyMapping,
    FieldPermissionService,
    FieldPermissionState,
} from '../role/field-permission.service';

/**
 * 工费字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 费率：列表返回里挂在 `laborRates` 数组上；费率接口返回的数组项各自带 `unitPrice` / `unit`。
 *    因此 `unitPrice` / `unit` / `remark`（费率备注）的映射是「元素级」的：
 *    整条费率不可见时由 `laborRates` 映射整组删除，其余情况由 stripLaborDeep 逐条脱敏。
 */
const LABOR_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'code', key: 'code' },
    { field: 'billingType', key: 'billingType' },
    { field: 'status', key: 'status' },
    // 只隐藏数组元素里的费率（key 用元素字段名 unitPrice）；
    // 不要用 key:'laborRates' —— 那会把整个费率列表删掉
    { field: 'rate.unitPrice', key: 'unitPrice' },
    { field: 'rate.unit', key: 'unit' },
    { field: 'rate.remark', key: 'remark' },
];

@ApiTags('工费管理')
@Controller('business/labor/types')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class LaborController {
    constructor(
        private readonly laborService: LaborService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'labor',
            user.roles ?? [],
        );
    }

    /**
     * 工种（含 laborRates 费率数组）的读脱敏
     * 费率数组元素本身就是一条费率记录，字段名是 unitPrice / unit / remark，
     * 必须逐条套用映射，否则费率备注等字段的隐藏配置不生效。
     */
    private stripLaborDeep(node: any, state: FieldPermissionState): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        LABOR_FIELD_MAP,
        state,
      );
    }

    // ========== 工种管理 ==========

    @Get()
    @Permissions('labor:view')
    async findAll(
        @Query() query: QueryLaborTypeDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.laborService.findAllTypes(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: (result.list as any[]).map((item: any) =>
                this.stripLaborDeep(item, state),
            ),
        };
    }

    @Get(':id')
    @Permissions('labor:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const item = await this.laborService.findTypeById(id);
        const state = await this.resolveFields(user);
        return this.stripLaborDeep(item as any, state);
    }

    @Post()
    @Permissions('labor:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateLaborTypeDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            LABOR_FIELD_MAP,
            state,
        );
        // 创建工种的必填字段：名称 / 计费方式
        if (!safe.name || !safe.billingType) {
            throw new ForbiddenException('创建工种所需的必填字段没有编辑权限');
        }
        return this.laborService.createType(safe as CreateLaborTypeDto, user.sub);
    }

    @Patch(':id')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateLaborTypeDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            LABOR_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有工费字段的编辑权限');
        }
        return this.laborService.updateType(
            id, safe as UpdateLaborTypeDto, user.sub,
        );
    }

    @Delete(':id')
    @Permissions('labor:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        await this.laborService.deleteType(id, user.sub);
    }

    // ========== 工费标准 ==========

    @Get(':id/rates')
    @Permissions('labor:view')
    async findRates(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const rates = await this.laborService.findRatesByTypeId(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            rates as any[],
            LABOR_FIELD_MAP,
            state,
        );
    }

    @Post(':id/rates')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async createRate(
        @Param('id') id: string,
        @Body() dto: CreateLaborRateDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('rate.unitPrice')) {
            throw new ForbiddenException('没有「工费标准」的编辑权限');
        }
        // 「费率备注」被配成只读时新增也不写入（update 路径已由 stripUneditableFields 覆盖）
        const safe = { ...(dto as any) };
        if (!state.canEdit.has('rate.remark')) {
            delete safe.remark;
        }
        return this.laborService.createRate(
            id, safe as CreateLaborRateDto, user.sub,
        );
    }

    @Patch(':id/rates/:rateId/set-current')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async setCurrentRate(
        @Param('id') id: string,
        @Param('rateId') rateId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('rate.unitPrice')) {
            throw new ForbiddenException('没有「工费标准」的编辑权限');
        }
        return this.laborService.setCurrentRate(
            id, rateId, user.sub,
        );
    }

    @Patch(':id/rates/:rateId')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async updateRate(
        @Param('id') id: string,
        @Param('rateId') rateId: string,
        @Body() dto: UpdateLaborRateDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            LABOR_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有「工费标准」的编辑权限');
        }
        return this.laborService.updateRate(
            id, rateId, safe as UpdateLaborRateDto, user.sub,
        );
    }

    @Delete(':id/rates/:rateId')
    @Permissions('labor:delete')
    @HttpCode(HttpStatus.OK)
    async deleteRate(
        @Param('id') id: string,
        @Param('rateId') rateId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('rate.unitPrice')) {
            throw new ForbiddenException('没有「工费标准」的编辑权限');
        }
        await this.laborService.deleteRate(
            id, rateId, user.sub,
        );
    }

    @Put('reorder')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async reorder(@Body() body: { ids: string[] }) {
        return this.laborService.reorderLaborTypes(body.ids);
    }
}
