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
  constructor(private readonly numberCheckService: NumberCheckService) {}

  @Post('dedup')
  @Permissions('number-check:dedup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '编号查重' })
  async dedup(@Body() dto: DedupDto) {
    return this.numberCheckService.dedup(dto);
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
  async listRecords(@Query() filter: RecordFilterDto) {
    return this.numberCheckService.listRecords(filter);
  }

  @Get('records/:id')
  @Permissions('number-check:detail')
  @ApiOperation({ summary: '历史编号详情' })
  async getRecord(@Param('id') id: string) {
    return this.numberCheckService.getRecord(id);
  }

  @Patch('records/:id')
  @Permissions('number-check:update')
  @ApiOperation({ summary: '编辑备注/是否已结算/状态(作废/恢复)' })
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.numberCheckService.updateRecord(id, dto);
  }

  @Post('export-duplicates')
  @Permissions('number-check:export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出重复清单' })
  async exportDuplicates(@Body() dto: ExportDuplicatesDto): Promise<StreamableFile> {
    return this.numberCheckService.exportDuplicates(dto);
  }

  @Get('batches/:batchNo/file')
  @Permissions('number-check:download')
  @ApiOperation({ summary: '下载批次原始文件' })
  async downloadBatchFile(
    @Param('batchNo') batchNo: string,
  ): Promise<StreamableFile> {
    return this.numberCheckService.downloadBatchFile(batchNo);
  }

  @Get('stats')
  @Permissions('number-check:view')
  @ApiOperation({ summary: '首页统计' })
  async getStats() {
    return this.numberCheckService.getStats();
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
