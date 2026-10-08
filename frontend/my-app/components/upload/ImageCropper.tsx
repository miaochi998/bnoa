/**
 * ImageCropper - 图片裁剪组件
 * 使用react-image-crop库实现图片裁剪功能
 * 
 * @example
 * <ImageCropper
 *   image={selectedFile}
 *   open={showCropper}
 *   onClose={() => setShowCropper(false)}
 *   onCropComplete={(croppedFile) => {
 *     console.log('裁剪完成:', croppedFile);
 *   }}
 *   cropConfig={{
 *     aspect: 16 / 9,
 *     quality: 0.9,
 *     format: 'jpeg'
 *   }}
 * />
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Square,
  RectangleHorizontal,
  Smartphone,
  Monitor,
  Loader2,
} from 'lucide-react';

/**
 * 预设宽高比选项
 */
const ASPECT_PRESETS = [
  { label: '自由', value: undefined, icon: Maximize2 },
  { label: '1:1', value: 1, icon: Square },
  { label: '16:9', value: 16 / 9, icon: Monitor },
  { label: '4:3', value: 4 / 3, icon: RectangleHorizontal },
  { label: '3:4', value: 3 / 4, icon: Smartphone },
  { label: '3:2', value: 3 / 2, icon: RectangleHorizontal },
  { label: '2:3', value: 2 / 3, icon: Smartphone },
] as const;

export interface ImageCropperProps {
  /** 图片URL或File */
  image: string | File | null;
  /** 是否显示 */
  open?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 裁剪完成回调 */
  onCropComplete: (croppedFile: File) => void;
  /** 裁剪配置 */
  cropConfig?: {
    /** 宽高比 */
    aspect?: number;
    /** 最小宽度 */
    minWidth?: number;
    /** 最小高度 */
    minHeight?: number;
    /** 输出质量 0-1 */
    quality?: number;
    /** 输出格式 */
    format?: 'jpeg' | 'png' | 'webp';
    /** 最大输出宽度 */
    maxOutputWidth?: number;
    /** 最大输出高度 */
    maxOutputHeight?: number;
  };
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
}

/**
 * 创建居中的裁剪区域
 */
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

/**
 * 图片裁剪组件
 */
export function ImageCropper({
  image,
  open = false,
  onClose,
  onCropComplete,
  cropConfig = {},
  title = '裁剪图片',
  description = '拖动选择框调整裁剪区域',
}: ImageCropperProps) {
  const {
    aspect: initialAspect,
    minWidth = 10,
    minHeight = 10,
    quality = 0.9,
    format = 'jpeg',
    maxOutputWidth,
    maxOutputHeight,
  } = cropConfig;

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [aspect, setAspect] = useState<number | undefined>(initialAspect);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 处理图片URL
  useEffect(() => {
    if (image) {
      setImageLoaded(false);
      if (typeof image === 'string') {
        setImageUrl(image);
      } else {
        const url = URL.createObjectURL(image);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
      }
    } else {
      setImageUrl('');
    }
  }, [image]);

  // 重置状态
  useEffect(() => {
    if (open) {
      setScale(1);
      setRotate(0);
      setFlipH(false);
      setFlipV(false);
      setAspect(initialAspect);
      setCrop(undefined);
      setCompletedCrop(undefined);
    }
  }, [open, initialAspect]);

  // 图片加载完成后设置初始裁剪区域
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setImageLoaded(true);
    
    if (aspect) {
      const newCrop = centerAspectCrop(width, height, aspect);
      setCrop(newCrop);
    } else {
      // 自由裁剪时，默认选择整个图片
      setCrop({
        unit: '%',
        x: 5,
        y: 5,
        width: 90,
        height: 90,
      });
    }
  }, [aspect]);

  // 切换宽高比
  const handleAspectChange = useCallback((newAspect: number | undefined) => {
    setAspect(newAspect);
    if (imgRef.current && newAspect) {
      const { width, height } = imgRef.current;
      const newCrop = centerAspectCrop(width, height, newAspect);
      setCrop(newCrop);
    }
  }, []);

  // 旋转图片
  const handleRotate = useCallback((direction: 'cw' | 'ccw') => {
    setRotate(prev => {
      const delta = direction === 'cw' ? 90 : -90;
      return (prev + delta + 360) % 360;
    });
  }, []);

  // 处理裁剪完成
  const handleCropComplete = useCallback(async () => {
    if (!completedCrop || !imgRef.current) {
      console.warn('裁剪区域未选择');
      return;
    }

    setIsProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建Canvas上下文');
      }

      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      // 计算实际裁剪尺寸
      let cropWidth = completedCrop.width * scaleX;
      let cropHeight = completedCrop.height * scaleY;

      // 应用最大输出尺寸限制
      if (maxOutputWidth && cropWidth > maxOutputWidth) {
        const ratio = maxOutputWidth / cropWidth;
        cropWidth = maxOutputWidth;
        cropHeight = cropHeight * ratio;
      }
      if (maxOutputHeight && cropHeight > maxOutputHeight) {
        const ratio = maxOutputHeight / cropHeight;
        cropHeight = maxOutputHeight;
        cropWidth = cropWidth * ratio;
      }

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // 应用变换
      ctx.save();
      
      if (flipH || flipV || rotate !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (flipH) ctx.scale(-1, 1);
        if (flipV) ctx.scale(1, -1);
        if (rotate !== 0) ctx.rotate((rotate * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      // 绘制裁剪后的图片
      ctx.drawImage(
        img,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        cropWidth,
        cropHeight
      );

      ctx.restore();

      const mimeType = `image/${format}`;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const fileName =
              typeof image === 'string'
                ? `cropped.${format}`
                : image
                ? `cropped_${image.name.replace(/\.[^/.]+$/, '')}.${format}`
                : `cropped.${format}`;

            const croppedFile = new File([blob], fileName, {
              type: mimeType,
              lastModified: Date.now(),
            });

            onCropComplete(croppedFile);
            onClose?.();
          }
          setIsProcessing(false);
        },
        mimeType,
        quality
      );
    } catch (error) {
      console.error('裁剪失败:', error);
      setIsProcessing(false);
    }
  }, [completedCrop, image, format, quality, maxOutputWidth, maxOutputHeight, flipH, flipV, rotate, onCropComplete, onClose]);

  // 重置所有变换
  const handleReset = useCallback(() => {
    setScale(1);
    setRotate(0);
    setFlipH(false);
    setFlipV(false);
    if (imgRef.current && aspect) {
      const { width, height } = imgRef.current;
      const newCrop = centerAspectCrop(width, height, aspect);
      setCrop(newCrop);
    }
  }, [aspect]);

  const imageStyle: React.CSSProperties = {
    transform: `scale(${scale}) rotate(${rotate}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
    maxWidth: '100%',
    maxHeight: '60vh',
    display: 'block',
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* 图片裁剪区域 */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/30 rounded-lg overflow-auto">
          {imageUrl ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              minWidth={minWidth}
              minHeight={minHeight}
              className="max-w-full"
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="裁剪预览"
                style={imageStyle}
                onLoad={onImageLoad}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          ) : (
            <div className="text-muted-foreground">请选择图片</div>
          )}
        </div>

        {/* 工具栏 */}
        <div className="flex-shrink-0 space-y-4 pt-4">
          {/* 缩放控制 */}
          <div className="flex items-center gap-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[scale]}
              onValueChange={([v]) => setScale(v)}
              min={0.5}
              max={3}
              step={0.1}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground w-12 text-right">
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* 宽高比和变换工具 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* 宽高比预设 */}
            <div className="flex flex-wrap gap-1">
              {ASPECT_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isActive = aspect === preset.value;
                return (
                  <Button
                    key={preset.label}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleAspectChange(preset.value)}
                    className="h-8 px-2"
                    title={preset.label}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    <span className="text-xs">{preset.label}</span>
                  </Button>
                );
              })}
            </div>

            {/* 变换工具 */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotate('ccw')}
                title="逆时针旋转90°"
                className="h-8 w-8 p-0"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotate('cw')}
                title="顺时针旋转90°"
                className="h-8 w-8 p-0"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant={flipH ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFlipH(!flipH)}
                title="水平翻转"
                className="h-8 w-8 p-0"
              >
                <FlipHorizontal className="h-4 w-4" />
              </Button>
              <Button
                variant={flipV ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFlipV(!flipV)}
                title="垂直翻转"
                className="h-8 w-8 p-0"
              >
                <FlipVertical className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                title="重置"
                className="h-8 px-2"
              >
                重置
              </Button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              取消
            </Button>
            <Button
              onClick={handleCropComplete}
              disabled={!completedCrop || !imageLoaded || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                '确认裁剪'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImageCropper;
