/**
 * 文件安全验证Hook（参照7DL项目实现）
 * 提供前端预验证功能，在上传前检查文件格式和大小
 * @module hooks/upload/useFileSecurityValidation
 */

import { useState, useCallback, useEffect } from 'react';
import {
  validateFileSecurity,
  validateFilesBatch,
  getSecurityConfig,
  getFormatConfigs,
  clearConfigCache,
  isDangerousExtension,
  type FileValidationResult,
  type SecurityConfig,
  type FormatConfig,
} from '@/lib/utils/upload/validateFileSecurity';

export interface FileValidationError {
  fileName: string;
  type: 'dangerous_extension' | 'format_not_allowed' | 'file_too_large' | 'invalid_type';
  message: string;
}

export interface UseFileSecurityValidationReturn {
  /** 验证单个文件 */
  validateFile: (file: File) => Promise<FileValidationResult>;
  /** 批量验证文件 */
  validateFiles: (files: File[]) => Promise<{
    valid: File[];
    invalid: Array<{ file: File; result: FileValidationResult }>;
  }>;
  /** 当前验证错误列表 */
  validationErrors: FileValidationError[];
  /** 清除所有错误 */
  clearErrors: () => void;
  /** 清除指定文件的错误 */
  clearFileError: (fileName: string) => void;
  /** 检查扩展名是否危险 */
  isDangerousExtension: (fileName: string) => boolean;
  /** 是否有错误 */
  hasErrors: boolean;
  /** 安全配置 */
  securityConfig: SecurityConfig | null;
  /** 格式配置列表 */
  formatConfigs: FormatConfig[];
  /** 是否正在加载配置 */
  isLoading: boolean;
  /** 刷新配置 */
  refreshConfig: () => Promise<void>;
}

/**
 * 文件安全验证Hook
 * @returns 验证相关的方法和状态
 */
export function useFileSecurityValidation(): UseFileSecurityValidationReturn {
  const [validationErrors, setValidationErrors] = useState<FileValidationError[]>([]);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(null);
  const [formatConfigs, setFormatConfigs] = useState<FormatConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载配置
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const [config, formats] = await Promise.all([
        getSecurityConfig(),
        getFormatConfigs(),
      ]);
      setSecurityConfig(config);
      setFormatConfigs(formats);
    } catch (error) {
      console.error('加载安全配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化时加载配置
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 刷新配置
  const refreshConfig = useCallback(async () => {
    clearConfigCache();
    await loadConfig();
  }, [loadConfig]);

  // 验证单个文件
  const validateFile = useCallback(
    async (file: File): Promise<FileValidationResult> => {
      const result = await validateFileSecurity(file);
      
      if (!result.isValid) {
        const newErrors: FileValidationError[] = result.errors.map(error => {
          let type: FileValidationError['type'] = 'invalid_type';
          if (error.includes('安全限制')) {
            type = 'dangerous_extension';
          } else if (error.includes('不支持的文件格式')) {
            type = 'format_not_allowed';
          } else if (error.includes('超过') || error.includes('不能超过')) {
            type = 'file_too_large';
          }
          return {
            fileName: file.name,
            type,
            message: error,
          };
        });
        setValidationErrors(prev => [...prev, ...newErrors]);
      }
      
      return result;
    },
    []
  );

  // 批量验证文件
  const validateFiles = useCallback(
    async (files: File[]): Promise<{
      valid: File[];
      invalid: Array<{ file: File; result: FileValidationResult }>;
    }> => {
      const { valid, invalid } = await validateFilesBatch(files);
      
      // 收集所有错误
      const newErrors: FileValidationError[] = [];
      for (const { file, result } of invalid) {
        for (const error of result.errors) {
          let type: FileValidationError['type'] = 'invalid_type';
          if (error.includes('安全限制')) {
            type = 'dangerous_extension';
          } else if (error.includes('不支持的文件格式')) {
            type = 'format_not_allowed';
          } else if (error.includes('超过') || error.includes('不能超过')) {
            type = 'file_too_large';
          }
          newErrors.push({
            fileName: file.name,
            type,
            message: error,
          });
        }
      }
      
      if (newErrors.length > 0) {
        setValidationErrors(prev => [...prev, ...newErrors]);
      }
      
      return { valid, invalid };
    },
    []
  );

  // 清除所有错误
  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  // 清除指定文件的错误
  const clearFileError = useCallback((fileName: string) => {
    setValidationErrors(prev => prev.filter(error => error.fileName !== fileName));
  }, []);

  return {
    validateFile,
    validateFiles,
    validationErrors,
    clearErrors,
    clearFileError,
    isDangerousExtension,
    hasErrors: validationErrors.length > 0,
    securityConfig,
    formatConfigs,
    isLoading,
    refreshConfig,
  };
}

export default useFileSecurityValidation;
