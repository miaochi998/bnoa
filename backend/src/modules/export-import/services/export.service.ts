import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { BaseExportAdapter } from '../adapters/base.adapter';
import { ExportTaskService } from './export-task.service';
import {
    CreateExportParams,
    ExportResult,
    ExportJobData,
    ModuleInfo,
} from '../interfaces/export-import.interfaces';

const EXPORT_DIR = path.join(
    process.cwd(), 'uploads', 'exports',
);

@Injectable()
export class ExportService {
    private readonly logger =
        new Logger(ExportService.name);
    private readonly adapters =
        new Map<string, BaseExportAdapter>();

    constructor(
        private readonly taskService: ExportTaskService,
        @InjectQueue('export')
        private readonly exportQueue: Queue,
    ) {
        if (!fs.existsSync(EXPORT_DIR)) {
            fs.mkdirSync(EXPORT_DIR, { recursive: true });
        }
    }

    /** 注册适配器 */
    registerAdapter(adapter: BaseExportAdapter) {
        this.adapters.set(
            adapter.moduleName, adapter,
        );
        this.logger.log(
            `适配器注册: ${adapter.moduleName} (${adapter.displayName})`,
        );
    }

    /** 获取适配器 */
    getAdapter(
        moduleName: string,
    ): BaseExportAdapter {
        const adapter = this.adapters.get(moduleName);
        if (!adapter) {
            throw new BadRequestException(
                `不支持的模块: ${moduleName}`,
            );
        }
        return adapter;
    }

    /** 获取所有可导出模块 */
    getModules(): ModuleInfo[] {
        return Array.from(this.adapters.values()).map(
            (a) => ({
                moduleName: a.moduleName,
                displayName: a.displayName,
                supportedFormats: a.supportedFormats,
                supportsImport: a.supportsImport,
            }),
        );
    }

    /** 创建导出 */
    async createExport(
        params: CreateExportParams,
    ): Promise<ExportResult> {
        const adapter = this.getAdapter(params.module);

        if (
            !adapter.supportedFormats.includes(
                params.format,
            )
        ) {
            throw new BadRequestException(
                `模块 ${params.module} 不支持 ${params.format} 格式`,
            );
        }

        // 查询总数
        const { total } = await adapter.queryData(
            params.params, 1, 1,
        );

        if (total === 0) {
            throw new BadRequestException(
                '没有可导出的数据',
            );
        }

        // 创建任务
        const task = await this.taskService.createTask({
            module: params.module,
            type: 'export',
            format: params.format,
            params: params.params,
            userId: params.userId,
            totalRows: total,
        });

        // 判断同步/异步
        if (total <= adapter.maxSyncRows) {
            // 同步导出
            try {
                await this.executeExport(
                    task.id,
                    adapter,
                    params.format,
                    params.params,
                );
                return {
                    taskId: task.id,
                    async: false,
                    downloadUrl:
                        `/api/v1/export-import/download/${task.id}`,
                };
            } catch (err) {
                await this.taskService.updateTask(
                    task.id, {
                        status: 'failed',
                        errorMessage: (err as Error).message,
                    },
                );
                throw err;
            }
        }

        // 异步导出
        await this.taskService.updateTask(
            task.id, { status: 'pending' },
        );
        const jobData: ExportJobData = {
            taskId: task.id,
            module: params.module,
            format: params.format,
            params: params.params,
            userId: params.userId,
        };
        await this.exportQueue.add(
            'export', jobData,
            {
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        );
        this.logger.log(
            `异步导出任务已投递: ${task.taskNo}`,
        );

        return {
            taskId: task.id,
            async: true,
        };
    }

    /** 执行导出（同步/异步均调用） */
    async executeExport(
        taskId: string,
        adapter: BaseExportAdapter,
        format: string,
        params?: any,
    ): Promise<string> {
        await this.taskService.updateTask(
            taskId, { status: 'processing' },
        );

        const pageSize = 1000;
        let page = 1;
        let allData: any[] = [];
        let processedRows = 0;

        // 分页查询所有数据
        while (true) {
            const result = await adapter.queryData(
                params, page, pageSize,
            );
            if (result.data.length === 0) break;
            allData = allData.concat(result.data);
            processedRows += result.data.length;
            await this.taskService.updateTask(
                taskId, { processedRows },
            );
            if (
                processedRows >= result.total
            ) break;
            page++;
        }

        // 生成文件
        const fileName =
            `${adapter.displayName}_${Date.now()}.${format}`;
        const filePath = path.join(
            EXPORT_DIR, fileName,
        );

        if (format === 'xlsx') {
            await this.generateExcel(
                adapter, allData, filePath,
            );
        } else if (format === 'csv') {
            await this.generateCsv(
                adapter, allData, filePath,
            );
        } else if (format === 'json') {
            await this.generateJson(
                adapter, allData, filePath,
            );
        }

        const stats = fs.statSync(filePath);

        await this.taskService.updateTask(taskId, {
            status: 'completed',
            fileName,
            filePath,
            fileSize: BigInt(stats.size),
            processedRows: allData.length,
        });

        this.logger.log(
            `导出完成: ${fileName} (${allData.length} 行)`,
        );

        return filePath;
    }

    /** 生成 Excel 文件 */
    private async generateExcel(
        adapter: BaseExportAdapter,
        data: any[],
        filePath: string,
    ) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(
            adapter.displayName,
        );

        const headers = adapter.getHeaders();
        const widths = adapter.getColumnWidths();

        // 表头
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' },
        };

        // 列宽
        headers.forEach((_, i) => {
            sheet.getColumn(i + 1).width = widths[i];
        });

        // 数据行
        for (const row of data) {
            const formatted = adapter.formatRow(row);
            sheet.addRow(
                headers.map((h) => formatted[h] ?? ''),
            );
        }

        await workbook.xlsx.writeFile(filePath);
    }

    /** 生成 CSV 文件 */
    private async generateCsv(
        adapter: BaseExportAdapter,
        data: any[],
        filePath: string,
    ) {
        const headers = adapter.getHeaders();
        const lines: string[] = [];

        // BOM + 表头
        lines.push(headers.map(
            (h) => `"${h}"`,
        ).join(','));

        // 数据行
        for (const row of data) {
            const formatted = adapter.formatRow(row);
            lines.push(
                headers.map((h) => {
                    const v = String(
                        formatted[h] ?? '',
                    ).replace(/"/g, '""');
                    return `"${v}"`;
                }).join(','),
            );
        }

        fs.writeFileSync(
            filePath,
            '\uFEFF' + lines.join('\n'),
            'utf-8',
        );
    }

    /** 生成 JSON 文件 */
    private async generateJson(
        adapter: BaseExportAdapter,
        data: any[],
        filePath: string,
    ) {
        const formatted = data.map(
            (row) => adapter.formatRow(row),
        );
        fs.writeFileSync(
            filePath,
            JSON.stringify(formatted, null, 2),
            'utf-8',
        );
    }

    /** 获取导出文件路径 */
    getExportDir(): string {
        return EXPORT_DIR;
    }
}
