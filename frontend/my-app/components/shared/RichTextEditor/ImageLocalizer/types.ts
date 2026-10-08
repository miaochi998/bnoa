// ImageLocalizer/types.ts

export interface LocalizeConfig {
    autoLocalize: boolean;
    convertToWebp: boolean;
    webpQuality: number;
    concurrentLimit: number;
    downloadTimeout: number;
    retryCount: number;
    storage: 'local' | 'rustfs';
    folderId?: string | null;
}

export interface LocalizeTask {
    id: string;
    originalUrl: string;
    localUrl?: string;
    status:
        | 'pending'
        | 'downloading'
        | 'uploading'
        | 'success'
        | 'error';
    progress: number;
    error?: string;
    retryCount: number;
}

export interface LocalizeResult {
    originalUrl: string;
    localUrl: string;
    success: boolean;
    error?: string;
}

export const DEFAULT_LOCALIZE_CONFIG:
    LocalizeConfig = {
    autoLocalize: false,
    convertToWebp: true,
    webpQuality: 85,
    concurrentLimit: 3,
    downloadTimeout: 30000,
    retryCount: 2,
    storage: 'rustfs',
    folderId: null,
};
