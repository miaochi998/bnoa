/**
 * useImageCropper - 图片裁剪Hook
 * 提供无UI样式的图片裁剪逻辑
 * 
 * @example
 * // 基础使用
 * const { startCrop, getCroppedImage, cropImageSrc } = useImageCropper();
 * 
 * // 开始裁剪
 * startCrop(imageFile);
 * 
 * // 获取裁剪后的图片
 * const blob = await getCroppedImage();
 */

import { useState, useRef, useCallback } from 'react';

/**
 * 裁剪区域配置
 */
export interface CropArea {
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
}

/**
 * 裁剪选项
 */
export interface CropOptions {
  /** 输出图片质量（0-1） */
  quality?: number;
  /** 输出图片格式 */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** 最大宽度 */
  maxWidth?: number;
  /** 最大高度 */
  maxHeight?: number;
}

/**
 * useImageCropper Hook配置
 */
export interface UseImageCropperConfig {
  /** 默认输出质量 */
  defaultQuality?: number;
  /** 默认输出格式 */
  defaultFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * useImageCropper Hook返回值
 */
export interface UseImageCropperReturn {
  /** 裁剪图片源URL */
  cropImageSrc: string;
  /** 图片引用 */
  imgRef: React.RefObject<HTMLImageElement | null>;
  /** 裁剪区域 */
  cropArea: CropArea | null;
  /** 设置裁剪区域 */
  setCropArea: (area: CropArea | null) => void;
  /** 开始裁剪（加载图片） */
  startCrop: (file: File | Blob) => void;
  /** 获取裁剪后的图片（Blob） */
  getCroppedImage: (options?: CropOptions) => Promise<Blob | null>;
  /** 获取裁剪后的DataURL */
  getCroppedDataURL: (options?: CropOptions) => Promise<string | null>;
  /** 获取裁剪后的File */
  getCroppedFile: (fileName: string, options?: CropOptions) => Promise<File | null>;
  /** 重置裁剪状态 */
  reset: () => void;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 原始图片尺寸 */
  originalSize: { width: number; height: number } | null;
  /** 错误信息 */
  error: string | null;
}

/**
 * 图片裁剪Hook
 * 
 * @param config - 配置选项
 * @returns Hook返回值
 */
export function useImageCropper(config: UseImageCropperConfig = {}): UseImageCropperReturn {
  const {
    defaultQuality = 0.9,
    defaultFormat = 'image/jpeg',
  } = config;

  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  /**
   * 开始裁剪（加载图片）
   */
  const startCrop = useCallback((file: File | Blob) => {
    setIsLoading(true);
    setError(null);
    
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      setCropImageSrc(result);
      
      // 加载图片以获取原始尺寸
      const img = new Image();
      img.onload = () => {
        setOriginalSize({ width: img.width, height: img.height });
        
        // 默认裁剪区域为整个图片
        setCropArea({
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        });
        
        setIsLoading(false);
      };
      img.onerror = () => {
        setError('图片加载失败');
        setIsLoading(false);
      };
      img.src = result;
    };
    
    reader.onerror = () => {
      setError('文件读取失败');
      setIsLoading(false);
    };
    
    reader.readAsDataURL(file);
  }, []);

  /**
   * 获取裁剪后的图片（Blob）
   */
  const getCroppedImage = useCallback(async (options: CropOptions = {}): Promise<Blob | null> => {
    if (!cropArea || !imgRef.current) return null;

    const {
      quality = defaultQuality,
      format = defaultFormat,
      maxWidth,
      maxHeight,
    } = options;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // 计算缩放比例（处理图片在页面上显示的尺寸与实际尺寸不同的情况）
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // 计算实际裁剪区域
    const actualCropArea = {
      x: cropArea.x * scaleX,
      y: cropArea.y * scaleY,
      width: cropArea.width * scaleX,
      height: cropArea.height * scaleY,
    };

    // 计算输出尺寸
    let outputWidth = actualCropArea.width;
    let outputHeight = actualCropArea.height;

    if (maxWidth && outputWidth > maxWidth) {
      const ratio = maxWidth / outputWidth;
      outputWidth = maxWidth;
      outputHeight = Math.round(outputHeight * ratio);
    }

    if (maxHeight && outputHeight > maxHeight) {
      const ratio = maxHeight / outputHeight;
      outputHeight = maxHeight;
      outputWidth = Math.round(outputWidth * ratio);
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    // 绘制裁剪后的图片
    ctx.drawImage(
      image,
      actualCropArea.x,
      actualCropArea.y,
      actualCropArea.width,
      actualCropArea.height,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        format,
        quality
      );
    });
  }, [cropArea, defaultQuality, defaultFormat]);

  /**
   * 获取裁剪后的DataURL
   */
  const getCroppedDataURL = useCallback(async (options: CropOptions = {}): Promise<string | null> => {
    if (!cropArea || !imgRef.current) return null;

    const {
      quality = defaultQuality,
      format = defaultFormat,
      maxWidth,
      maxHeight,
    } = options;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // 计算缩放比例
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // 计算实际裁剪区域
    const actualCropArea = {
      x: cropArea.x * scaleX,
      y: cropArea.y * scaleY,
      width: cropArea.width * scaleX,
      height: cropArea.height * scaleY,
    };

    // 计算输出尺寸
    let outputWidth = actualCropArea.width;
    let outputHeight = actualCropArea.height;

    if (maxWidth && outputWidth > maxWidth) {
      const ratio = maxWidth / outputWidth;
      outputWidth = maxWidth;
      outputHeight = Math.round(outputHeight * ratio);
    }

    if (maxHeight && outputHeight > maxHeight) {
      const ratio = maxHeight / outputHeight;
      outputHeight = maxHeight;
      outputWidth = Math.round(outputWidth * ratio);
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    // 绘制裁剪后的图片
    ctx.drawImage(
      image,
      actualCropArea.x,
      actualCropArea.y,
      actualCropArea.width,
      actualCropArea.height,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return canvas.toDataURL(format, quality);
  }, [cropArea, defaultQuality, defaultFormat]);

  /**
   * 获取裁剪后的File
   */
  const getCroppedFile = useCallback(async (
    fileName: string,
    options: CropOptions = {}
  ): Promise<File | null> => {
    const blob = await getCroppedImage(options);
    if (!blob) return null;

    const format = options.format || defaultFormat;
    const extension = format.split('/')[1];
    const finalFileName = fileName.includes('.') ? fileName : `${fileName}.${extension}`;

    return new File([blob], finalFileName, {
      type: format,
      lastModified: Date.now(),
    });
  }, [getCroppedImage, defaultFormat]);

  /**
   * 重置裁剪状态
   */
  const reset = useCallback(() => {
    if (cropImageSrc) {
      // 如果是Blob URL，需要释放
      if (cropImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(cropImageSrc);
      }
    }
    setCropImageSrc('');
    setCropArea(null);
    setOriginalSize(null);
    setIsLoading(false);
    setError(null);
  }, [cropImageSrc]);

  return {
    cropImageSrc,
    imgRef,
    cropArea,
    setCropArea,
    startCrop,
    getCroppedImage,
    getCroppedDataURL,
    getCroppedFile,
    reset,
    isLoading,
    originalSize,
    error,
  };
}

export default useImageCropper;
