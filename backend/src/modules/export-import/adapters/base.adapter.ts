import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

/**
 * 导出/导入适配器基类
 * 每个可导出模块需继承此类并实现抽象方法
 */
export abstract class BaseExportAdapter {
    /** 模块标识 */
    abstract readonly moduleName: string;
    /** 中文名 */
    abstract readonly displayName: string;
    /** 字段映射 */
    abstract readonly columns: ColumnDef[];

    /** 同步导出行数阈值（超过则走异步） */
    maxSyncRows = 5000;
    /** 支持的导出格式 */
    supportedFormats: string[] = ['xlsx', 'csv'];
    /** 是否支持导入 */
    supportsImport = false;
    /** 敏感字段（导出时自动排除） */
    sensitiveFields: string[] = [
        'password', 'token', 'refreshToken',
        'apiKey', 'secret',
    ];

    /** 分页查询数据 */
    abstract queryData(
        params: any,
        page: number,
        pageSize: number,
    ): Promise<AdapterQueryResult>;

    /** 导入行校验（可选实现） */
    validateRow?(
        row: Record<string, any>,
    ): Promise<string | null>;

    /** 导入单行数据（可选实现） */
    importRow?(
        row: Record<string, any>,
        userId: string,
    ): Promise<void>;

    /** 格式化一行数据用于导出 */
    formatRow(row: any): Record<string, any> {
        const result: Record<string, any> = {};
        for (const col of this.columns) {
            if (this.sensitiveFields.includes(col.field)) {
                continue;
            }
            const value = row[col.field];
            result[col.header] = col.formatter
                ? col.formatter(value, row)
                : value ?? '';
        }
        return result;
    }

    /** 获取导出表头 */
    getHeaders(): string[] {
        return this.columns
            .filter(
                (c) =>
                    !this.sensitiveFields.includes(
                        c.field,
                    ),
            )
            .map((c) => c.header);
    }

    /** 获取列宽配置 */
    getColumnWidths(): number[] {
        return this.columns
            .filter(
                (c) =>
                    !this.sensitiveFields.includes(
                        c.field,
                    ),
            )
            .map((c) => c.width || 15);
    }
}
