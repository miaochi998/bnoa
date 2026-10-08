export interface ExportModule {
    moduleName: string;
    displayName: string;
    supportedFormats: string[];
    supportsImport: boolean;
}

export interface ExportTask {
    id: string;
    taskNo: string;
    module: string;
    type: string;
    format: string;
    status: string;
    params: any;
    fileName: string | null;
    filePath: string | null;
    fileSize: number | null;
    totalRows: number | null;
    processedRows: number | null;
    errorMessage: string | null;
    userId: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface ExportResult {
    taskId: string;
    async: boolean;
    downloadUrl?: string;
}

export interface ImportPreviewRow {
    rowIndex: number;
    valid: boolean;
    errors: string[];
    data: Record<string, any>;
}

export interface ImportPreviewResult {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    headers: string[];
    rows: ImportPreviewRow[];
}

export interface ImportConfirmResult {
    total: number;
    success: number;
    failed: number;
    skipped: number;
    errors: { row: number; message: string }[];
}
