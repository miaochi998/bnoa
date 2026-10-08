import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExportService } from './export.service';
import { ExportTaskService } from './export-task.service';
import {
    ImportPreviewResult,
    ImportRowValidation,
    ImportConfirmResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class ImportService {
    private readonly logger =
        new Logger(ImportService.name);

    constructor(
        private readonly exportService: ExportService,
        private readonly taskService: ExportTaskService,
    ) {}

    /** 导入预览（解析文件 + 校验） */
    async preview(
        moduleName: string,
        buffer: Buffer,
        originalName: string,
    ): Promise<ImportPreviewResult> {
        const adapter =
            this.exportService.getAdapter(moduleName);
        if (!adapter.supportsImport) {
            throw new BadRequestException(
                `模块 ${moduleName} 不支持导入`,
            );
        }
        if (!adapter.validateRow) {
            throw new BadRequestException(
                `模块 ${moduleName} 未实现导入校验`,
            );
        }

        const ext = originalName
            .split('.').pop()?.toLowerCase();
        let rawRows: Record<string, any>[];

        if (ext === 'xlsx' || ext === 'xls') {
            rawRows = await this.parseExcel(buffer);
        } else if (ext === 'json') {
            rawRows = this.parseJson(buffer);
        } else {
            throw new BadRequestException(
                `不支持的文件格式: ${ext}`,
            );
        }

        if (rawRows.length === 0) {
            throw new BadRequestException(
                '文件中没有数据',
            );
        }

        // 取前 100 行预览
        const previewRows = rawRows.slice(0, 100);
        const rows: ImportRowValidation[] = [];
        let validCount = 0;
        let invalidCount = 0;

        for (let i = 0; i < previewRows.length; i++) {
            const row = previewRows[i];
            const error =
                await adapter.validateRow(row);
            const valid = error === null;
            if (valid) validCount++;
            else invalidCount++;
            rows.push({
                rowIndex: i + 1,
                valid,
                errors: error ? [error] : [],
                data: row,
            });
        }

        const headers = rawRows.length > 0
            ? Object.keys(rawRows[0])
            : [];

        return {
            totalRows: rawRows.length,
            validRows: validCount,
            invalidRows: invalidCount,
            headers,
            rows,
        };
    }

    /** 确认导入 */
    async confirm(
        moduleName: string,
        buffer: Buffer,
        originalName: string,
        userId: string,
    ): Promise<ImportConfirmResult> {
        const adapter =
            this.exportService.getAdapter(moduleName);
        if (
            !adapter.supportsImport ||
            !adapter.importRow ||
            !adapter.validateRow
        ) {
            throw new BadRequestException(
                `模块 ${moduleName} 不支持导入`,
            );
        }

        const ext = originalName
            .split('.').pop()?.toLowerCase();
        let rawRows: Record<string, any>[];

        if (ext === 'xlsx' || ext === 'xls') {
            rawRows = await this.parseExcel(buffer);
        } else if (ext === 'json') {
            rawRows = this.parseJson(buffer);
        } else {
            throw new BadRequestException(
                `不支持的文件格式: ${ext}`,
            );
        }

        // 创建导入任务
        const task = await this.taskService.createTask({
            module: moduleName,
            type: 'import',
            format: ext || 'xlsx',
            userId,
            totalRows: rawRows.length,
        });

        await this.taskService.updateTask(
            task.id, { status: 'processing' },
        );

        let success = 0;
        let failed = 0;
        let skipped = 0;
        const errors: {
            row: number;
            message: string;
        }[] = [];

        for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            try {
                const error =
                    await adapter.validateRow(row);
                if (error) {
                    skipped++;
                    errors.push({
                        row: i + 1,
                        message: error,
                    });
                    continue;
                }
                await adapter.importRow(row, userId);
                success++;
            } catch (err) {
                failed++;
                errors.push({
                    row: i + 1,
                    message: (err as Error).message,
                });
            }

            // 更新进度
            if ((i + 1) % 50 === 0) {
                await this.taskService.updateTask(
                    task.id,
                    { processedRows: i + 1 },
                );
            }
        }

        await this.taskService.updateTask(task.id, {
            status: failed > 0 && success === 0
                ? 'failed' : 'completed',
            processedRows: rawRows.length,
            errorMessage: errors.length > 0
                ? `成功:${success} 失败:${failed} 跳过:${skipped}`
                : undefined,
        });

        this.logger.log(
            `导入完成 [${moduleName}]: ` +
            `成功=${success} 失败=${failed} 跳过=${skipped}`,
        );

        return {
            total: rawRows.length,
            success,
            failed,
            skipped,
            errors: errors.slice(0, 50),
        };
    }

    /** 解析 Excel 文件 */
    private async parseExcel(
        buffer: Buffer,
    ): Promise<Record<string, any>[]> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) return [];

        const headers: string[] = [];
        const rows: Record<string, any>[] = [];

        sheet.eachRow((row, rowNum) => {
            if (rowNum === 1) {
                row.eachCell((cell) => {
                    headers.push(
                        String(cell.value || ''),
                    );
                });
                return;
            }
            const obj: Record<string, any> = {};
            headers.forEach((h, i) => {
                const cell = row.getCell(i + 1);
                obj[h] = cell.value ?? '';
            });
            rows.push(obj);
        });

        return rows;
    }

    /** 解析 JSON 文件 */
    private parseJson(
        buffer: Buffer,
    ): Record<string, any>[] {
        try {
            const data = JSON.parse(
                buffer.toString('utf-8'),
            );
            if (Array.isArray(data)) return data;
            throw new BadRequestException(
                'JSON 文件格式不正确，需要数组格式',
            );
        } catch (err) {
            if (
                err instanceof BadRequestException
            ) throw err;
            throw new BadRequestException(
                'JSON 解析失败',
            );
        }
    }
}
