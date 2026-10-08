/**
 * UploadRecoveryPrompt - 上传恢复提示组件
 * 当检测到未完成的上传时，显示恢复提示
 * 
 * 功能点：
 * - F026: 崩溃恢复 - 页面重载后提示用户恢复未完成上传
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  X, 
  Clock,
  FileIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatFileSize } from '@/lib/utils/upload';
import { type RecoverableUpload } from '@/lib/services/upload/CacheService';

export interface UploadRecoveryPromptProps {
  /** 可恢复的上传列表 */
  recoverableUploads: RecoverableUpload[];
  /** 恢复单个上传 */
  onRecover?: (sessionId: string) => void;
  /** 恢复所有上传 */
  onRecoverAll?: () => void;
  /** 忽略单个上传 */
  onDismiss?: (sessionId: string) => void;
  /** 忽略所有上传 */
  onDismissAll?: () => void;
  /** 关闭提示 */
  onClose?: () => void;
  /** 是否显示详细列表 */
  showDetails?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 格式化剩余时间
 */
function formatRemainingTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

/**
 * 上传恢复提示组件
 */
export function UploadRecoveryPrompt({
  recoverableUploads,
  onRecover,
  onRecoverAll,
  onDismiss,
  onDismissAll,
  onClose,
  showDetails = true,
  className = '',
}: UploadRecoveryPromptProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // 如果没有可恢复的上传，不显示
  if (recoverableUploads.length === 0 || !isVisible) {
    return null;
  }

  const totalFiles = recoverableUploads.length;
  const totalSize = recoverableUploads.reduce(
    (sum, u) => sum + u.session.fileSize,
    0
  );

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const handleRecoverAll = () => {
    onRecoverAll?.();
    handleClose();
  };

  const handleDismissAll = () => {
    onDismissAll?.();
    handleClose();
  };

  return (
    <Alert 
      className={`relative border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 ${className}`}
    >
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center justify-between">
        <span>检测到未完成的上传</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-amber-200/50"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">
          发现 <strong>{totalFiles}</strong> 个未完成的上传任务，
          共 <strong>{formatFileSize(totalSize)}</strong>。
          是否要恢复这些上传？
        </p>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            size="sm"
            onClick={handleRecoverAll}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            全部恢复
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismissAll}
            className="border-amber-500 text-amber-700 hover:bg-amber-100"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            全部忽略
          </Button>
        </div>

        {/* 详细列表 */}
        {showDetails && totalFiles > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-amber-700 hover:bg-amber-100 p-2"
              >
                <span>查看详情</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {recoverableUploads.map((upload) => (
                  <RecoverableUploadItem
                    key={upload.session.sessionId}
                    upload={upload}
                    onRecover={() => onRecover?.(upload.session.sessionId)}
                    onDismiss={() => onDismiss?.(upload.session.sessionId)}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * 单个可恢复上传项
 */
interface RecoverableUploadItemProps {
  upload: RecoverableUpload;
  onRecover?: () => void;
  onDismiss?: () => void;
}

function RecoverableUploadItem({
  upload,
  onRecover,
  onDismiss,
}: RecoverableUploadItemProps) {
  const { session, remainingTime, completedPercentage } = upload;

  return (
    <div className="flex items-center gap-3 p-2 bg-white/50 dark:bg-black/20 rounded-lg">
      <FileIcon className="h-8 w-8 text-amber-600 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-amber-900 dark:text-amber-100">
          {session.fileName}
        </p>
        <div className="flex items-center gap-2 text-xs text-amber-600">
          <span>{formatFileSize(session.fileSize)}</span>
          <span>•</span>
          <span>{completedPercentage}% 已完成</span>
          <span>•</span>
          <Clock className="h-3 w-3" />
          <span>剩余 {formatRemainingTime(remainingTime)}</span>
        </div>
        <Progress 
          value={completedPercentage} 
          className="h-1 mt-1 bg-amber-200"
        />
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onRecover}
          className="h-7 px-2 text-amber-700 hover:bg-amber-200"
          title="恢复此上传"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 px-2 text-amber-700 hover:bg-amber-200"
          title="忽略此上传"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default UploadRecoveryPrompt;
