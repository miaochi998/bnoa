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

    /**
     * 该字段是否应在本次导出中隐藏
     *
     * @param hiddenFields 本次导出「因字段级权限而不可见」的字段集合
     *   —— 由导出流程按「当前用户 + 该模块」的字段权限算好，按参数传入。
     *   ⚠️ 刻意不放在实例属性上：适配器是共享单例，存状态会在并发导出时互相覆盖。
     */
    protected isFieldHidden(
        field: string,
        hiddenFields?: Set<string>,
    ): boolean {
        return (
            this.sensitiveFields.includes(field) ||
            (hiddenFields ? hiddenFields.has(field) : false)
        );
    }

    /** 格式化一行数据用于导出 */
    formatRow(row: any, hiddenFields?: Set<string>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const col of this.columns) {
            if (this.isFieldHidden(col.field, hiddenFields)) {
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
    getHeaders(hiddenFields?: Set<string>): string[] {
        return this.columns
            .filter((c) => !this.isFieldHidden(c.field, hiddenFields))
            .map((c) => c.header);
    }

    /** 获取列宽配置 */
    getColumnWidths(hiddenFields?: Set<string>): number[] {
        return this.columns
            .filter((c) => !this.isFieldHidden(c.field, hiddenFields))
            .map((c) => c.width || 15);
    }
}
