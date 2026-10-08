/** 列定义 */
export interface ColumnDef {
    /** 数据库字段名 */
    field: string;
    /** Excel 表头名 */
    header: string;
    /** 列宽 */
    width?: number;
    /** 格式化函数（导出时将数据库值转为显示值） */
    formatter?: (value: any, row: any) => any;
    /** 解析函数（导入时将显示值转为数据库值） */
    parser?: (value: any) => any;
}

/** 适配器查询结果 */
export interface AdapterQueryResult {
    data: any[];
    total: number;
}

/** 导入行校验结果 */
export interface ImportRowValidation {
    rowIndex: number;
    valid: boolean;
    errors: string[];
    data: Record<string, any>;
}

/** 导入预览结果 */
export interface ImportPreviewResult {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    headers: string[];
    rows: ImportRowValidation[];
}

/** 导入确认结果 */
export interface ImportConfirmResult {
    total: number;
    success: number;
    failed: number;
    skipped: number;
    errors: { row: number; message: string }[];
}

/** 导出任务创建参数 */
export interface CreateExportParams {
    module: string;
    format: string;
    params?: Record<string, any>;
    userId: string;
}

/** 导出结果 */
export interface ExportResult {
    taskId: string;
    async: boolean;
    downloadUrl?: string;
}

/** 模块信息 */
export interface ModuleInfo {
    moduleName: string;
    displayName: string;
    supportedFormats: string[];
    supportsImport: boolean;
}

/** 队列任务数据 */
export interface ExportJobData {
    taskId: string;
    module: string;
    format: string;
    params?: Record<string, any>;
    userId: string;
}
