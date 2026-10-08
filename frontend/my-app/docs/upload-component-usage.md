# 上传组件使用指南

## 概述

上传组件采用 Headless UI 设计模式，分为四层架构：

- **Utils层** - 基础工具函数
- **Service层** - 核心业务逻辑
- **Hooks层** - UI无关的交互逻辑
- **Component层** - 默认UI组件

## 快速开始

### 1. 使用完整上传器

```tsx
import { FileUploader } from '@/components/upload';

function MyPage() {
  return (
    <FileUploader
      virtualFolderId="folder-id"
      accept="image/*,video/*"
      maxFileSize={100 * 1024 * 1024} // 100MB
      onUploadComplete={(fileId, url) => {
        console.log('上传完成:', fileId, url);
      }}
      onUploadError={(fileName, error) => {
        console.error('上传失败:', fileName, error);
      }}
    />
  );
}
```

### 2. 使用文件选择按钮

```tsx
import { FileSelector, ImageSelector } from '@/components/upload';

function MyPage() {
  const handleSelect = (files: File[]) => {
    console.log('选中文件:', files);
  };

  return (
    <>
      {/* 通用文件选择 */}
      <FileSelector
        label="选择文件"
        multiple={true}
        onSelect={handleSelect}
      />

      {/* 图片选择 */}
      <ImageSelector
        label="选择图片"
        onSelect={handleSelect}
      />
    </>
  );
}
```

### 3. 使用拖拽上传区域

```tsx
import { DropZone, ImageDropZone } from '@/components/upload';

function MyPage() {
  const handleDrop = (files: File[]) => {
    console.log('拖放文件:', files);
  };

  return (
    <>
      {/* 通用拖拽区域 */}
      <DropZone
        accept={['image/*', 'video/*']}
        onDrop={handleDrop}
        hint="拖拽文件到此处上传"
      />

      {/* 图片拖拽区域 */}
      <ImageDropZone onDrop={handleDrop} />
    </>
  );
}
```

## Hooks 使用

### useFileSelector

```tsx
import { useFileSelector } from '@/hooks/upload';

function MyComponent() {
  const { openFileSelector } = useFileSelector({
    multiple: true,
    accept: 'image/*',
    onSelect: (files) => console.log(files),
    onValidationError: (file, error) => console.error(error),
  });

  return <button onClick={openFileSelector}>选择文件</button>;
}
```

### useDropZone

```tsx
import { useDropZone } from '@/hooks/upload';

function MyComponent() {
  const { isDragging, isOver, dropZoneProps } = useDropZone({
    accept: ['image/*'],
    onDrop: (files) => console.log(files),
  });

  return (
    <div
      {...dropZoneProps}
      className={isOver ? 'bg-blue-100' : 'bg-gray-100'}
    >
      {isDragging ? '松开上传' : '拖拽文件到此处'}
    </div>
  );
}
```

### useUploadQueue

```tsx
import { useUploadQueue } from '@/hooks/upload';

function MyComponent() {
  const {
    files,
    isUploading,
    totalProgress,
    addFiles,
    startUpload,
    pauseUpload,
    cancelAll,
    retryFailed,
  } = useUploadQueue({
    folderId: 'folder-id',
    storageMode: 'rustfs',
    compress: true,
    onFileComplete: (item) => console.log('完成:', item),
    onAllComplete: (items) => console.log('全部完成:', items),
  });

  return (
    <div>
      <button onClick={() => addFiles(selectedFiles)}>添加文件</button>
      <button onClick={startUpload}>开始上传</button>
      <button onClick={pauseUpload}>暂停</button>
      <button onClick={cancelAll}>取消全部</button>
      <div>进度: {totalProgress}%</div>
    </div>
  );
}
```

### useUploadMode

```tsx
import { useUploadMode } from '@/hooks/upload';

function MyComponent() {
  const { mode, setMode, isRustFS, modeName } = useUploadMode({
    defaultMode: 'rustfs',
    persist: true,
  });

  return (
    <div>
      <span>当前模式: {modeName}</span>
      <button onClick={() => setMode('local')}>切换到本地</button>
      <button onClick={() => setMode('rustfs')}>切换到RustFS</button>
    </div>
  );
}
```

## Service 使用

### MD5计算

```tsx
import { md5Service } from '@/lib/services/upload';

// 计算文件MD5
const hash = await md5Service.calculateFileMD5(file, (progress) => {
  console.log('MD5计算进度:', progress);
});

// 计算字符串MD5
const stringHash = md5Service.calculateStringMD5('hello');
```

### 图片压缩

```tsx
import { compressService } from '@/lib/services/upload';

// 检查是否需要压缩
if (compressService.shouldCompress(file)) {
  const compressedFile = await compressService.compressImage(file, {
    quality: 0.8,
    maxWidth: 1920,
    maxHeight: 1080,
  });
}
```

### 完整上传流程

```tsx
import { uploadOrchestrator } from '@/lib/services/upload';

const result = await uploadOrchestrator.uploadFile({
  file,
  folderId: 'folder-id',
  storageMode: 'rustfs',
  compress: true,
  onProgress: (progress) => {
    console.log('进度:', progress.percentage);
    console.log('阶段:', progress.stageHint);
  },
});

if (result.success) {
  console.log('上传成功:', result.fileId, result.url);
} else {
  console.error('上传失败:', result.error);
}
```

## Utils 使用

### 文件大小格式化

```tsx
import { formatFileSize, formatSpeed, parseFileSize } from '@/lib/utils/upload';

formatFileSize(1024 * 1024); // "1 MB"
formatSpeed(1024 * 1024);    // "1 MB/s"
parseFileSize('1 MB');       // 1048576
```

### 文件类型判断

```tsx
import { 
  getFileExtension, 
  isImageFile, 
  isVideoFile,
  getFileCategory,
  getFileIcon,
} from '@/lib/utils/upload';

getFileExtension('test.jpg');  // "jpg"
isImageFile('test.jpg');       // true
isVideoFile('test.mp4');       // true
getFileCategory('test.jpg');   // "image"
getFileIcon('test.jpg');       // LucideIcon
```

### 文件验证

```tsx
import { validateFile, filterValidFiles } from '@/lib/utils/upload';

const result = validateFile(file, {
  maxSize: 10 * 1024 * 1024,
  allowedTypes: ['image/*'],
  checkDangerousExtensions: true,
});

if (!result.valid) {
  console.error(result.error);
}
```

## 配置常量

```tsx
import { UPLOAD_CONSTANTS, UPLOAD_STATUS, UPLOAD_STAGE } from '@/lib/utils/upload';

// 分片大小
UPLOAD_CONSTANTS.DEFAULT_CHUNK_SIZE  // 5MB
UPLOAD_CONSTANTS.SMALL_FILE_THRESHOLD // 10MB

// 上传状态
UPLOAD_STATUS.WAITING
UPLOAD_STATUS.UPLOADING
UPLOAD_STATUS.SUCCESS
UPLOAD_STATUS.ERROR
UPLOAD_STATUS.PAUSED
UPLOAD_STATUS.CANCELLED

// 上传阶段
UPLOAD_STAGE.MD5
UPLOAD_STAGE.CHECKING
UPLOAD_STAGE.COMPRESSING
UPLOAD_STAGE.UPLOADING
UPLOAD_STAGE.COMPLETED
```

## 目录结构

```
frontend/my-app/
├── lib/
│   ├── utils/upload/           # Utils层
│   │   ├── formatFileSize.ts
│   │   ├── getFileExtension.ts
│   │   ├── getFileIcon.ts
│   │   ├── validateFile.ts
│   │   ├── authUtils.ts
│   │   └── index.ts
│   └── services/upload/        # Service层
│       ├── MD5Service.ts
│       ├── SecureCheckService.ts
│       ├── SessionService.ts
│       ├── ChunkUploadService.ts
│       ├── S3UploadService.ts
│       ├── CompressService.ts
│       ├── UploadOrchestrator.ts
│       └── index.ts
├── hooks/upload/               # Hooks层
│   ├── useFileSelector.ts
│   ├── useDropZone.ts
│   ├── useUploadQueue.ts
│   ├── useUploadMode.ts
│   └── index.ts
└── components/upload/          # Component层
    ├── FileSelector.tsx
    ├── DropZone.tsx
    ├── UploadQueue.tsx
    ├── FileUploader.tsx
    └── index.ts
```
