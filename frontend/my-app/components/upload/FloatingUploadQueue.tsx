'use client';

/**
 * FloatingUploadQueue - 浮动上传队列面板
 * 
 * 功能：
 * - 固定定位在页面右下角
 * - 显示上传队列状态
 * - 集成图片裁剪功能
 * - 由 UploadQueueContext 自动渲染
 */

import React, { useState } from 'react';
import { useUploadQueueContextSafe } from '@/contexts/UploadQueueContext';
import { UploadQueue } from './UploadQueue';
import { ImageCropper } from './ImageCropper';
import { UPLOAD_STATUS } from '@/lib/utils/upload';

interface CropperState {
  open: boolean;
  image: File | null;
  itemId: string | null;
}

/**
 * 浮动上传队列面板组件
 * 在 UploadQueueProvider 中自动渲染
 */
export function FloatingUploadQueue() {
  const uploadQueue = useUploadQueueContextSafe();
  
  // 图片裁剪状态
  const [cropperState, setCropperState] = useState<CropperState>({
    open: false,
    image: null,
    itemId: null,
  });

  // 如果不在 Context 内或无文件，不渲染
  if (!uploadQueue || uploadQueue.files.length === 0) {
    return null;
  }

  /**
   * 处理裁剪按钮点击
   * 只有等待中的图片文件才能裁剪
   */
  const handleCrop = (id: string) => {
    const item = uploadQueue.files.find(f => f.id === id);
    if (
      item?.file && 
      item.file.type.startsWith('image/') && 
      item.status === UPLOAD_STATUS.WAITING
    ) {
      setCropperState({ 
        open: true, 
        image: item.file, 
        itemId: id,
      });
    }
  };

  /**
   * 处理裁剪完成
   */
  const handleCropComplete = (croppedFile: File) => {
    if (cropperState.itemId) {
      uploadQueue.replaceFile(cropperState.itemId, croppedFile);
    }
    setCropperState({ open: false, image: null, itemId: null });
  };

  /**
   * 处理裁剪取消
   */
  const handleCropClose = () => {
    setCropperState({ open: false, image: null, itemId: null });
  };

  return (
    <>
      <UploadQueue
        items={uploadQueue.files}
        visible={uploadQueue.files.length > 0}
        position="bottom-right"
        totalProgress={uploadQueue.totalProgress}
        totalSpeed={uploadQueue.totalSpeed}
        isUploading={uploadQueue.isUploading}
        isPaused={uploadQueue.isPaused}
        onClose={() => uploadQueue.clearAll()}
        onStartAll={uploadQueue.startUpload}
        onPauseAll={uploadQueue.pauseUpload}
        onResumeAll={uploadQueue.resumeUpload}
        onPause={uploadQueue.pauseFile}
        onResume={uploadQueue.resumeFile}
        onCancel={uploadQueue.cancelFile}
        onRetry={uploadQueue.retryFile}
        onRemove={uploadQueue.removeFile}
        onClearCompleted={uploadQueue.clearCompleted}
        onClearAll={uploadQueue.clearAll}
        onCrop={handleCrop}
        onAddFiles={uploadQueue.addFiles}
      />
      
      {/* 图片裁剪器 */}
      <ImageCropper
        image={cropperState.image}
        open={cropperState.open}
        onClose={handleCropClose}
        onCropComplete={handleCropComplete}
        cropConfig={{ 
          quality: 0.9, 
          format: 'jpeg',
        }}
      />
    </>
  );
}
