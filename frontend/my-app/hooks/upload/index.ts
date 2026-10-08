/**
 * 上传Hooks统一导出
 * @module hooks/upload
 */

// 文件选择Hook
export { 
  useFileSelector, 
  useImageSelector, 
  useVideoSelector, 
  useDocumentSelector 
} from './useFileSelector';
export type { 
  FileSelectorConfig, 
  FileSelectorResult 
} from './useFileSelector';

// 拖拽上传Hook
export { 
  useDropZone, 
  useImageDropZone, 
  useMediaDropZone 
} from './useDropZone';
export type { 
  DropZoneConfig, 
  DropZoneResult 
} from './useDropZone';

// 上传队列Hook
export { useUploadQueue } from './useUploadQueue';
export type { 
  QueueItem, 
  UploadQueueConfig, 
  UploadQueueResult 
} from './useUploadQueue';

// 上传模式Hook
export { 
  useUploadMode, 
  getModeInfo, 
  getAvailableModes 
} from './useUploadMode';
export type { 
  StorageMode, 
  UploadModeConfig, 
  UploadModeResult 
} from './useUploadMode';

// 图片裁剪Hook
export { useImageCropper } from './useImageCropper';
export type {
  CropArea,
  CropOptions,
  UseImageCropperConfig,
  UseImageCropperReturn,
} from './useImageCropper';

// 上传恢复Hook（崩溃恢复/断点续传）
export { useUploadRecovery } from './useUploadRecovery';
export type {
  RecoveryCallbackParams,
  UseUploadRecoveryConfig,
  UseUploadRecoveryReturn,
} from './useUploadRecovery';
