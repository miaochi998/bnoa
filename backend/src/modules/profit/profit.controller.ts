import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProfitService } from './profit.service';
import { ProfitImportService } from './profit-import.service';
import {
    CreateProfitReportDto,
    UpdateProfitReportDto,
    QueryProfitReportDto,
    SaveEntriesDto,
    SaveShippingCostsDto,
    SaveStoreExpensesDto,
    SaveAllocationCategoriesDto,
    SaveAllocationsDto,
    SaveCompanyExpensesDto,
    SaveNonExpensesDto,
    QueryProfitAnalysisDto,
    QueryMonthlyTrendDto,
    JsonImportProfitReportDto,
} from './dto/profit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('利润表管理')
@Controller('profit-reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ProfitController {
    constructor(
        private readonly profitService: ProfitService,
        private readonly profitImportService: ProfitImportService,
    ) {}

    @Post()
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateProfitReportDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.create(dto, user);
    }

    @Get()
    @Permissions('profit:view')
    async findAll(@Query() query: QueryProfitReportDto) {
        return this.profitService.findAll(query);
    }

    @Get('available-periods')
    @Permissions('profit:view')
    async getAvailablePeriods() {
        return this.profitService.getAvailablePeriods();
    }

    @Get('analysis')
    @Permissions('profit:analysis')
    async getAnalysis(
        @Query() query: QueryProfitAnalysisDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.getAnalysis(query, user);
    }

    @Get('analysis/monthly-trend')
    @Permissions('profit:analysis')
    async getMonthlyTrend(
        @Query() query: QueryMonthlyTrendDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.getMonthlyTrend(query, user);
    }

    // ========== Excel 导入（必须在 :id 路由之前） ==========

    @Post('import/preview')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!file.originalname.match(/\.xlsx?$/i)) {
                return cb(new BadRequestException('仅支持 .xlsx 格式文件'), false);
            }
            cb(null, true);
        },
    }))
    async importPreview(
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('请上传Excel文件');
        return this.profitImportService.preview(file.buffer);
    }

    @Post('import/confirm')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!file.originalname.match(/\.xlsx?$/i)) {
                return cb(new BadRequestException('仅支持 .xlsx 格式文件'), false);
            }
            cb(null, true);
        },
    }))
    async importConfirm(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: UserPayload,
    ) {
        if (!file) throw new BadRequestException('请上传Excel文件');
        return this.profitImportService.confirmImport(file.buffer, user);
    }

    @Post('import/json')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async importJson(
        @Body() dto: JsonImportProfitReportDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitImportService.importFromJson(dto, user);
    }

    @Get(':id')
    @Permissions('profit:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.findById(id, user);
    }

    @Patch(':id')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProfitReportDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.update(id, dto, user);
    }

    @Delete(':id')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        await this.profitService.delete(id, user);
    }

    // ========== 确认/撤销 ==========

    @Post(':id/confirm')
    @Permissions('profit:confirm')
    @HttpCode(HttpStatus.OK)
    async confirm(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.confirm(id, user);
    }

    @Post(':id/revoke')
    @Permissions('profit:confirm')
    @HttpCode(HttpStatus.OK)
    async revoke(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.revoke(id, user);
    }

    // ========== 数据保存 ==========

    @Put(':id/entries')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveEntries(
        @Param('id') id: string,
        @Body() dto: SaveEntriesDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.saveEntries(id, dto, user);
    }

    @Put(':reportId/entries/:entryId/shipping-costs')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveShippingCosts(
        @Param('reportId') reportId: string,
        @Param('entryId') entryId: string,
        @Body() dto: SaveShippingCostsDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.saveShippingCosts(
            reportId, entryId, dto, user,
        );
    }

    @Put(':reportId/entries/:entryId/store-expenses')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveStoreExpenses(
        @Param('reportId') reportId: string,
        @Param('entryId') entryId: string,
        @Body() dto: SaveStoreExpensesDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.saveStoreExpenses(
            reportId, entryId, dto, user,
        );
    }

    @Put(':id/allocation-categories')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveAllocationCategories(
        @Param('id') id: string,
        @Body() dto: SaveAllocationCategoriesDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.saveAllocationCategories(
            id, dto, user,
        );
    }

    @Put(':id/allocations')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveAllocations(
        @Param('id') id: string,
        @Body() dto: SaveAllocationsDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.saveAllocations(id, dto, user);
    }

    @Put(':id/company-expenses')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveCompanyExpenses(
        @Param('id') id: string,
        @Body() dto: SaveCompanyExpensesDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.saveCompanyExpenses(
            id, dto, user,
        );
    }

    @Put(':id/non-expenses')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveNonExpenses(
        @Param('id') id: string,
        @Body() dto: SaveNonExpensesDto,
        @CurrentUser() user: UserPayload,
    ) {
        return this.profitService.saveNonExpenses(
            id, dto, user,
        );
    }

}
