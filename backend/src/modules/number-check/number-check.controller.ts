import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { NumberCheckService } from './number-check.service';
import { PrismaService } from '../../config/prisma.service';
import {
  DataScope,
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';

/** 编号查重字段映射：用于「信息权限」读取脱敏 */
const NUMBER_CHECK_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'batchNo', key: 'batchNo' },
  { field: 'fileId', key: 'fileId' },
  { field: 'totalCount', key: 'totalCount' },
  { field: 'code', key: 'code' },
  { field: 'isDuplicate', key: 'isDuplicate' },
];
import { DedupDto } from './dto/dedup.dto';
import { ParseCodesDto } from './dto/parse-codes.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { RecordFilterDto } from './dto/record-filter.dto';
import { ExportDuplicatesDto } from './dto/export-duplicates.dto';
import { NumberCheckConfigDto } from './dto/config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('编号查重')
@Controller('number-check')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class NumberCheckController {
  constructor(
    private readonly numberCheckService: NumberCheckService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /**
   * 递归脱敏（编号查重结果不可编辑）
   */
  private stripNumberCheckDeep(node: any, state: any): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      NUMBER_CHECK_FIELD_MAP,
      state,
    );
  }

  /**
   * 数据范围：该用户是否只能看自己提交的编号
   * @returns 需要限定时返回 userId；不限定时返回 undefined
   */
  private async resolveOwnerFilter(user: UserPayload): Promise<string | undefined> {
    const scope = await this.fieldPermissionService.resolveDataScope(
      user.sub,
      'number-check',
      user.roles ?? [],
    );
    // 编号查重的隔离语义是"按人"，因此 OWN_SHOP 与 OWN_CREATED 都按提交人限制
    return scope === DataScope.ALL ? undefined : user.sub;
  }

  @Post('dedup')
  @Permissions('number-check:dedup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '编号查重' })
  async dedup(
    @Body() dto: DedupDto,
    @CurrentUser() user: UserPayload,
  ) {
    const onlyUserId = await this.resolveOwnerFilter(user);
    const result = await this.numberCheckService.dedup(dto, onlyUserId);
    const state = await this.fieldPermissionService.resolve(
      user.sub,
      'number-check',
      user.roles ?? [],
    );
    return this.stripNumberCheckDeep(result, state);
  }

  @Post('import/preview')
  @Permissions('number-check:import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: '上传表格并解析预览' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async importPreview(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.numberCheckService.importPreview(file, user.sub);
  }

  @Post('import/codes')
  @Permissions('number-check:import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '按指定Sheet/列/表头读取编号' })
  async parseCodes(@Body() dto: ParseCodesDto) {
    return this.numberCheckService.parseCodes(dto);
  }

  @Post('batches')
  @Permissions('number-check:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '手动入库' })
  async createBatch(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateBatchDto,
  ) {
    return this.numberCheckService.createBatch(dto, user.sub);
  }

  @Get('records')
  @Permissions('number-check:list')
  @ApiOperation({ summary: '历史编号列表' })
  async listRecords(
    @Query() filter: RecordFilterDto,
    @CurrentUser() user: UserPayload,
  ) {
    const onlyUserId = await this.resolveOwnerFilter(user);
    const result = await this.numberCheckService.listRecords(filter, onlyUserId);
    const state = await this.fieldPermissionService.resolve(
      user.sub,
      'number-check',
      user.roles ?? [],
    );
    return this.stripNumberCheckDeep(result, state);
  }

  @Get('records/:id')
  @Permissions('number-check:detail')
  @ApiOperation({ summary: '历史编号详情' })
  async getRecord(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    const onlyUserId = await this.resolveOwnerFilter(user);
    const record = await this.numberCheckService.getRecord(id, onlyUserId);
    const state = await this.fieldPermissionService.resolve(
      user.sub,
      'number-check',
      user.roles ?? [],
    );
    // 详情与列表口径一致（原先详情未脱敏，配置在此路径上失效）
    return this.stripNumberCheckDeep(record, state);
  }

  @Patch('records/:id')
  @Permissions('number-check:update')
  @ApiOperation({ summary: '编辑备注/是否已结算/状态(作废/恢复)' })
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdateRecordDto,
    @CurrentUser() user: UserPayload,
  ) {
    // 数据范围：非「全部」时只能改自己提交的记录（越权返回 404）
    const onlyUserId = await this.resolveOwnerFilter(user);
    const updated = await this.numberCheckService.updateRecord(
      id,
      dto,
      onlyUserId,
    );
    // 写响应与读接口一致地脱敏
    const state = await this.fieldPermissionService.resolve(
      user.sub,
      'number-check',
      user.roles ?? [],
    );
    return this.stripNumberCheckDeep(updated, state);
  }

  @Post('export-duplicates')
  @Permissions('number-check:export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出重复清单' })
  async exportDuplicates(
    @Body() dto: ExportDuplicatesDto,
    @CurrentUser() user: UserPayload,
  ): Promise<StreamableFile> {
    const onlyUserId = await this.resolveOwnerFilter(user);
    // 导出遵守字段级权限（去掉不可见列）
    const state = await this.fieldPermissionService.resolve(
      user.sub,
      'number-check',
      user.roles ?? [],
    );
    const hiddenFieldKeys = new Set(
      NUMBER_CHECK_FIELD_MAP.filter((m) => !state.canView.has(m.field)).map(
        (m) => m.field,
      ),
    );
    return this.numberCheckService.exportDuplicates(
      dto,
      onlyUserId,
      hiddenFieldKeys,
    );
  }

  @Get('batches/:batchNo/file')
  @Permissions('number-check:download')
  @ApiOperation({ summary: '下载批次原始文件' })
  async downloadBatchFile(
    @Param('batchNo') batchNo: string,
    @CurrentUser() user: UserPayload,
  ): Promise<StreamableFile> {
    const onlyUserId = await this.resolveOwnerFilter(user);
    return this.numberCheckService.downloadBatchFile(batchNo, onlyUserId);
  }

  @Get('stats')
  @Permissions('number-check:view')
  @ApiOperation({ summary: '首页统计' })
  async getStats(@CurrentUser() user: UserPayload) {
    const onlyUserId = await this.resolveOwnerFilter(user);
    const stats = await this.numberCheckService.getStats(onlyUserId);
    const state = await this.fieldPermissionService.resolve(
      user.sub,
      'number-check',
      user.roles ?? [],
    );
    return this.stripNumberCheckDeep(stats, state);
  }

  @Get('config')
  @Permissions('number-check:view')
  @ApiOperation({ summary: '获取模块设置' })
  async getConfig() {
    return this.numberCheckService.getConfig();
  }

  @Put('config')
  @Permissions('number-check:config')
  @ApiOperation({ summary: '更新模块设置' })
  async updateConfig(@Body() dto: NumberCheckConfigDto) {
    return this.numberCheckService.updateConfig(dto);
  }
}
