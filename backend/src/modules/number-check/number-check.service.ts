import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { DedupDto } from './dto/dedup.dto';
import { ParseCodesDto } from './dto/parse-codes.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { RecordFilterDto } from './dto/record-filter.dto';
import { ExportDuplicatesDto } from './dto/export-duplicates.dto';
import { NumberCheckConfigDto } from './dto/config.dto';

interface SheetData {
  name: string;
  rows: string[][];
}

@Injectable()
export class NumberCheckService {
  private readonly logger = new Logger(NumberCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly localStorageService: LocalStorageService,
  ) {}

  // ==================== 查重 ====================

  async dedup(dto: DedupDto) {
    const codes = dto.codes || [];
    const counts = new Map<string, number>();
    for (const c of codes) {
      if (c && c.trim()) counts.set(c, (counts.get(c) || 0) + 1);
    }

    let repeat = 0;
    let notRepeat = 0;
    let empty = 0;
    const results = [];

    for (const input of codes) {
      const code = (input || '').trim();
      if (!code) {
        empty++;
        results.push({
          code: input,
          result: 'empty',
          intraBatchDuplicate: false,
          matches: [],
        });
        continue;
      }

      const matches = await this.prisma.numberCheckRecord.findMany({
        where: { code, status: 'ACTIVE' },
        include: { batch: { select: { batchNo: true } } },
        orderBy: { importedAt: 'desc' },
      });

      const isRepeat = matches.length > 0;
      if (isRepeat) repeat++;
      else notRepeat++;

      results.push({
        code,
        result: isRepeat ? 'repeat' : 'not_repeat',
        intraBatchDuplicate: (counts.get(code) || 0) > 1,
        matches: matches.map((m) => ({
          id: m.id,
          code: m.code,
          batchNo: m.batch.batchNo,
          importedAt: m.importedAt,
          isSettled: m.isSettled,
          remark: m.remark,
          status: m.status,
        })),
      });
    }

    return {
      results,
      summary: { total: codes.length, repeat, notRepeat, empty },
    };
  }

  // ==================== 批量导入（预览 / 解析编号）====================

  async importPreview(file: Express.Multer.File, userId: string) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }
    const originalName = this.fixFilename(file.originalname);
    const ext = path.extname(originalName).toLowerCase().replace('.', '');

    const maxSizeRaw = await this.getConfigValue(
      'number_check.upload.maxSize',
      '',
    );
    const maxMB = maxSizeRaw ? Number(maxSizeRaw) : 50;
    if (file.size > maxMB * 1024 * 1024) {
      throw new BadRequestException(`文件大小不能超过 ${maxMB}MB`);
    }
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      throw new BadRequestException('仅支持 .xlsx/.xls/.csv 文件');
    }

    const sheets = await this.parseWorkbook(file.buffer, ext);
    const stored = await this.storeImportFile(
      file.buffer,
      originalName,
      ext,
      userId,
    );

    const sheetInfos = sheets.map((s) => {
      const totalRows = Math.max(
        0,
        s.rows.length - (this.looksLikeHeader(s.rows) ? 1 : 0),
      );
      const previewRows = s.rows.slice(0, 10);
      const { suggestedColumnIndex, suggestedHasHeader } =
        this.suggest(s.rows);
      return {
        name: s.name,
        totalRows,
        previewRows,
        suggestedColumnIndex,
        suggestedHasHeader,
      };
    });

    return {
      fileId: stored.id,
      fileName: originalName,
      sheets: sheetInfos,
    };
  }

  async parseCodes(dto: ParseCodesDto) {
    const file = await this.prisma.file.findUnique({
      where: { id: dto.fileId },
      select: { id: true, path: true, extension: true, storageType: true },
    });
    if (!file) throw new NotFoundException('文件不存在');

    const buffer = await this.downloadFileBuffer(file.storageType, file.path);
    const sheets = await this.parseWorkbook(buffer, file.extension);
    const sheet = sheets.find((s) => s.name === dto.sheet) || sheets[0];
    if (!sheet) throw new BadRequestException('Sheet 不存在');

    const start = dto.hasHeader ? 1 : 0;
    const codes: string[] = [];
    const errorRows: { row: number; reason: string }[] = [];
    let totalRows = 0;
    let emptyCount = 0;

    for (let i = start; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      totalRows++;
      const val = row[dto.columnIndex];
      if (val == null || String(val).trim() === '') {
        emptyCount++;
        continue;
      }
      codes.push(String(val).trim());
    }

    return { codes, emptyCount, totalRows, errorRows };
  }

  // ==================== 手动入库 ====================

  async createBatch(dto: CreateBatchDto, userId: string) {
    const now = new Date();
    const ymd = this.ymd(now);
    const prefix = `BATCH-${ymd}-`;

    const last = await this.prisma.numberCheckBatch.findFirst({
      where: { batchNo: { startsWith: prefix } },
      orderBy: { batchNo: 'desc' },
      select: { batchNo: true },
    });
    let seq = 1;
    if (last) {
      const n = parseInt((last.batchNo.split('-').pop() as string) || '0', 10);
      seq = (isNaN(n) ? 0 : n) + 1;
    }
    const batchNo = `${prefix}${String(seq).padStart(3, '0')}`;

    let importedAt = now;
    if (dto.importedAt) {
      importedAt = new Date(dto.importedAt);
      if (isNaN(importedAt.getTime())) {
        throw new BadRequestException('导入时间格式不正确');
      }
    }
    const isSettled = dto.isSettled ?? false;
    const remark = dto.remark ?? null;
    const onDuplicate = dto.onDuplicate || 'skip';

    const nonEmpty = (dto.codes || []).filter((c) => c && c.trim());
    if (nonEmpty.length === 0) {
      throw new BadRequestException('没有可入库的有效编号');
    }
    const emptyCount = (dto.codes || []).length - nonEmpty.length;

    let created = 0;
    let skipped = 0;
    const failedReasons: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const batch = await tx.numberCheckBatch.create({
        data: {
          batchNo,
          fileId: dto.fileId || null,
          totalCount: 0,
          createdBy: userId,
          updatedAt: now,
        },
      });

      for (const code of nonEmpty) {
        const exists = await tx.numberCheckRecord.findFirst({
          where: { code, status: 'ACTIVE' },
          select: { id: true },
        });
        if (exists) {
          if (onDuplicate === 'skip' || onDuplicate === 'onlyNew') {
            skipped++;
            continue;
          }
          // onDuplicate === 'save'：允许保存为重复记录
        }
        await tx.numberCheckRecord.create({
          data: {
            code,
            batchId: batch.id,
            isSettled,
            importedAt,
            remark,
            status: 'ACTIVE',
            createdBy: userId,
            updatedAt: now,
          },
        });
        created++;
      }

      await tx.numberCheckBatch.update({
        where: { id: batch.id },
        data: { totalCount: created },
      });
    });

    return {
      batchNo,
      created,
      skipped,
      failed: emptyCount,
      failedReasons,
      totalCount: nonEmpty.length,
    };
  }

  // ==================== 历史记录 ====================

  async listRecords(filter: RecordFilterDto) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: any = {};

    if (filter.keyword) {
      where.code = { contains: filter.keyword };
    }
    if (filter.batchNo) {
      where.batch = { batchNo: filter.batchNo };
    }
    if (filter.isSettled !== undefined && filter.isSettled !== '') {
      where.isSettled = filter.isSettled === 'true';
    }
    if (filter.status) where.status = filter.status;
    if (filter.startDate || filter.endDate) {
      where.importedAt = {};
      if (filter.startDate) where.importedAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.importedAt.lte = new Date(filter.endDate);
    }

    const allowedSort = ['importedAt', 'createdAt', 'isSettled', 'code'];
    const sortField =
      filter.sortBy && allowedSort.includes(filter.sortBy)
        ? filter.sortBy
        : 'importedAt';
    const orderBy = { [sortField]: filter.sortOrder || 'desc' } as any;

    const [rows, total] = await Promise.all([
      this.prisma.numberCheckRecord.findMany({
        where,
        include: { batch: { select: { batchNo: true, fileId: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.numberCheckRecord.count({ where }),
    ]);

    const codes = [...new Set(rows.map((r) => r.code))];
    const counts: Record<string, number> = {};
    if (codes.length) {
      const grouped = await this.prisma.numberCheckRecord.groupBy({
        by: ['code'],
        where: { code: { in: codes }, status: 'ACTIVE' },
        _count: { _all: true },
      });
      for (const g of grouped) counts[g.code] = g._count._all;
    }

    const data = rows.map((r) => ({
      id: r.id,
      code: r.code,
      batchNo: r.batch.batchNo,
      importedAt: r.importedAt,
      isSettled: r.isSettled,
      remark: r.remark,
      status: r.status,
      repeatCount: counts[r.code] || 1,
      hasFile: !!r.batch.fileId,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getRecord(id: string) {
    const r = await this.prisma.numberCheckRecord.findUnique({
      where: { id },
      include: { batch: { select: { batchNo: true, fileId: true } } },
    });
    if (!r) throw new NotFoundException('记录不存在');

    const history = await this.prisma.numberCheckRecord.findMany({
      where: { code: r.code },
      include: { batch: { select: { batchNo: true } } },
      orderBy: { importedAt: 'desc' },
    });
    const activeCount = history.filter((h) => h.status === 'ACTIVE').length;

    return {
      id: r.id,
      code: r.code,
      batchNo: r.batch.batchNo,
      importedAt: r.importedAt,
      isSettled: r.isSettled,
      remark: r.remark,
      status: r.status,
      repeatCount: activeCount,
      hasFile: !!r.batch.fileId,
      history: history.map((h) => ({
        id: h.id,
        code: h.code,
        batchNo: h.batch.batchNo,
        importedAt: h.importedAt,
        isSettled: h.isSettled,
        remark: h.remark,
        status: h.status,
      })),
    };
  }

  async updateRecord(id: string, dto: UpdateRecordDto) {
    const r = await this.prisma.numberCheckRecord.findUnique({
      where: { id },
    });
    if (!r) throw new NotFoundException('记录不存在');

    const data: any = { updatedAt: new Date() };
    if (dto.remark !== undefined) data.remark = dto.remark;
    if (dto.isSettled !== undefined) data.isSettled = dto.isSettled;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.numberCheckRecord.update({
      where: { id },
      data,
      include: { batch: { select: { batchNo: true } } },
    });

    return {
      id: updated.id,
      code: updated.code,
      batchNo: updated.batch.batchNo,
      importedAt: updated.importedAt,
      isSettled: updated.isSettled,
      remark: updated.remark,
      status: updated.status,
    };
  }

  // ==================== 导出重复清单 ====================

  async exportDuplicates(dto: ExportDuplicatesDto): Promise<StreamableFile> {
    const codes = (dto.codes || []).filter((c) => c && c.trim());
    const matches = await this.prisma.numberCheckRecord.findMany({
      where: { code: { in: codes }, status: 'ACTIVE' },
      include: { batch: { select: { batchNo: true } } },
      orderBy: { code: 'asc' },
    });

    if (!matches.length) {
      throw new BadRequestException('没有可导出的重复记录');
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('重复编号');
    ws.addRow(['编号', '来源批次', '导入时间', '是否已结算', '备注']);
    for (const m of matches) {
      ws.addRow([
        m.code,
        m.batch.batchNo,
        m.importedAt ? m.importedAt.toISOString() : '',
        m.isSettled ? '是' : '否',
        m.remark || '',
      ]);
    }
    const buf = await wb.xlsx.writeBuffer();
    return new StreamableFile(Buffer.from(buf), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="dup_${Date.now()}.xlsx"`,
    });
  }

  // ==================== 批次原始文件下载 ====================

  async downloadBatchFile(batchNo: string): Promise<StreamableFile> {
    const batch = await this.prisma.numberCheckBatch.findUnique({
      where: { batchNo },
    });
    if (!batch) throw new NotFoundException('批次不存在');
    if (!batch.fileId) throw new NotFoundException('该批次无原始文件');

    const file = await this.prisma.file.findUnique({
      where: { id: batch.fileId },
      select: { path: true, storageType: true, mimeType: true, originalName: true, name: true },
    });
    if (!file) throw new NotFoundException('原始文件不存在');

    const buffer = await this.downloadFileBuffer(file.storageType, file.path);
    const filename = encodeURIComponent(file.originalName || file.name || 'file');
    return new StreamableFile(buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  // ==================== 首页统计 ====================

  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalRecords, todayCreated, recentBatch, todayRecords] =
      await Promise.all([
        this.prisma.numberCheckRecord.count({ where: { status: 'ACTIVE' } }),
        this.prisma.numberCheckRecord.count({
          where: { createdAt: { gte: todayStart } },
        }),
        this.prisma.numberCheckBatch.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { batchNo: true },
        }),
        this.prisma.numberCheckRecord.findMany({
          where: { createdAt: { gte: todayStart } },
          select: { code: true },
        }),
      ]);

    let todayDupHits = 0;
    const codesToday = [...new Set(todayRecords.map((r) => r.code))];
    if (codesToday.length) {
      const grouped = await this.prisma.numberCheckRecord.groupBy({
        by: ['code'],
        where: { code: { in: codesToday }, status: 'ACTIVE' },
        _count: { _all: true },
      });
      for (const g of grouped) {
        if (g._count._all > 1) todayDupHits += g._count._all - 1;
      }
    }

    return {
      totalRecords,
      todayCreated,
      todayDupHits,
      recentBatchNo: recentBatch?.batchNo || null,
    };
  }

  // ==================== 模块设置 ====================

  async getConfig() {
    const maxSize = await this.getConfigValue('number_check.upload.maxSize', '');
    const realFolderId = await this.getConfigValue(
      'number_check.upload.realFolderId',
      '',
    );
    const storageMode = await this.getConfigValue(
      'number_check.upload.storageMode',
      'local',
    );
    return {
      maxSize: maxSize ? Number(maxSize) : null,
      realFolderId: realFolderId || null,
      storageMode,
      defaultMaxSize: 50,
    };
  }

  async updateConfig(dto: NumberCheckConfigDto) {
    if (dto.maxSize !== undefined) {
      await this.setConfig('number_check.upload.maxSize', String(dto.maxSize));
    }
    if (dto.realFolderId !== undefined) {
      await this.setConfig(
        'number_check.upload.realFolderId',
        dto.realFolderId || '',
      );
    }
    if (dto.storageMode !== undefined) {
      await this.setConfig('number_check.upload.storageMode', dto.storageMode);
    }
    return this.getConfig();
  }

  // ==================== 私有辅助 ====================

  private async parseWorkbook(buffer: Buffer, ext: string): Promise<SheetData[]> {
    if (ext === 'xlsx' || ext === 'xls') {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheets: SheetData[] = [];
      for (const ws of wb.worksheets) {
        const rows: string[][] = [];
        ws.eachRow((row) => {
          const vals = (row.values as any[])
            .slice(1)
            .map((v) => (v == null ? '' : String(v).trim()));
          rows.push(vals);
        });
        sheets.push({ name: ws.name, rows });
      }
      return sheets;
    }
    if (ext === 'csv') {
      const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
      const rows = this.parseCsv(text);
      return [{ name: 'Sheet1', rows }];
    }
    throw new BadRequestException('仅支持 .xlsx/.xls/.csv 文件');
  }

  private parseCsv(text: string): string[][] {
    const lines = text.split(/\r?\n/);
    return lines
      .map((line) => {
        if (line.trim() === '') return [];
        return this.csvLine(line);
      })
      .filter((r) => r.length > 0);
  }

  private csvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') {
          out.push(cur.trim());
          cur = '';
        } else cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  private looksLikeHeader(rows: string[][]): boolean {
    if (!rows.length) return false;
    const first = rows[0];
    if (!first.length) return false;
    return first.some((c) => !/^\d+$/.test((c || '').trim()));
  }

  private suggest(rows: string[][]): {
    suggestedColumnIndex: number;
    suggestedHasHeader: boolean;
  } {
    if (!rows.length) return { suggestedColumnIndex: 0, suggestedHasHeader: false };
    // 用列数最多的行作为候选行（避免首行是单格标题行导致只识别出第1列）
    const dataRow = rows.reduce((best, r) => (r.length > best.length ? r : best), rows[0]);
    let col = 0;
    const maxCols = dataRow.length;
    for (let i = 0; i < maxCols; i++) {
      const v = (dataRow[i] || '').trim();
      if (/编号|单号|订单|编码|^id$/i.test(v)) {
        col = i;
        break;
      }
    }
    const hasHeader = this.looksLikeHeader(rows);
    return { suggestedColumnIndex: col, suggestedHasHeader: hasHeader };
  }

  private async storeImportFile(
    buffer: Buffer,
    originalName: string,
    ext: string,
    userId: string,
  ) {
    const realFolderId = await this.getConfigValue(
      'number_check.upload.realFolderId',
      '',
    );
    let basePath = 'number-check';
    if (realFolderId) {
      const realFolder = await this.prisma.realFolder.findUnique({
        where: { id: realFolderId },
        select: { pathName: true },
      });
      if (realFolder) basePath = realFolder.pathName;
    }
    const fileKey = `${basePath}/${Date.now()}_${randomUUID()}.${ext}`;
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const mime =
      ext === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const storageMode = await this.getConfigValue(
      'number_check.upload.storageMode',
      'local',
    );

    let storageType: 'LOCAL' | 'RUSTFS' = 'LOCAL';
    let bucket = 'local';
    let url: string;

    if (storageMode === 'rustfs') {
      storageType = 'RUSTFS';
      bucket = this.storageService.getBucketName();
      url = await this.storageService.upload(buffer, fileKey, mime);
    } else {
      await this.localStorageService.uploadFile(buffer, fileKey);
      const serverBaseUrl = this.configService.get<string>(
        'SERVER_BASE_URL',
        'http://localhost:6520',
      );
      url = `${serverBaseUrl}/uploads/${fileKey}`;
    }

    return this.prisma.file.create({
      data: {
        name: originalName,
        originalName,
        mimeType: mime,
        extension: ext,
        size: buffer.length,
        md5,
        storageType,
        bucket,
        path: fileKey,
        url,
        access: 'PRIVATE',
        uploadedBy: userId,
      },
    });
  }

  private async downloadFileBuffer(
    storageType: string,
    key: string,
  ): Promise<Buffer> {
    if (storageType === 'LOCAL') {
      return this.localStorageService.downloadFile(key);
    }
    return this.storageService.download(key);
  }

  private fixFilename(filename: string): string {
    try {
      return Buffer.from(filename, 'latin1').toString('utf8');
    } catch {
      return filename;
    }
  }

  private ymd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  }

  private async getConfigValue(key: string, def: string): Promise<string> {
    const c = await this.prisma.config.findFirst({
      where: { key, deletedAt: null, isActive: true },
      select: { value: true },
    });
    return c?.value ?? def;
  }

  private async setConfig(key: string, value: string): Promise<void> {
    const existing = await this.prisma.config.findFirst({
      where: { key, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.config.update({
        where: { id: existing.id },
        data: { value },
      });
    } else {
      await this.prisma.config.create({
        data: {
          key,
          value,
          type: 'STRING',
          category: 'number_check',
          isSystem: false,
          isActive: true,
        },
      });
    }
  }
}
