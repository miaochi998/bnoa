/**
 * useUploadMode - 上传模式选择Hook
 * @module hooks/upload/useUploadMode
 * 
 * 功能：
 * - 管理上传模式（本地/RustFS）
 * - 持久化用户选择
 * - 提供模式切换方法
 * 
 * 使用场景：
 * - 上传模式选择器
 * - 存储模式配置
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * 存储模式
 */
export type StorageMode = 'rustfs' | 'local';

/**
 * 上传模式配置
 */
export interface UploadModeConfig {
  /** 默认模式 */
  defaultMode?: StorageMode;
  /** 是否持久化到localStorage */
  persist?: boolean;
  /** localStorage的key */
  storageKey?: string;
  /** 模式变更回调 */
  onChange?: (mode: StorageMode) => void;
}

/**
 * 上传模式结果
 */
export interface UploadModeResult {
  /** 当前模式 */
  mode: StorageMode;
  /** 设置模式 */
  setMode: (mode: StorageMode) => void;
  /** 切换模式 */
  toggleMode: () => void;
  /** 是否为RustFS模式 */
  isRustFS: boolean;
  /** 是否为本地模式 */
  isLocal: boolean;
  /** 模式显示名称 */
  modeName: string;
  /** 模式描述 */
  modeDescription: string;
}

/**
 * 模式信息
 */
const MODE_INFO: Record<StorageMode, { name: string; description: string }> = {
  rustfs: {
    name: 'RustFS存储',
    description: '文件存储到RustFS对象存储服务，支持大文件和高并发',
  },
  local: {
    name: '本地存储',
    description: '文件存储到本地服务器磁盘，适合小规模部署',
  },
};

/**
 * useUploadMode Hook
 * @param config - 配置选项
 * @returns 上传模式控制对象
 */
export function useUploadMode(config: UploadModeConfig = {}): UploadModeResult {
  const {
    defaultMode = 'rustfs',
    persist = true,
    storageKey = 'upload_storage_mode',
    onChange,
  } = config;

  /**
   * 从localStorage读取初始值
   */
  const getInitialMode = (): StorageMode => {
    if (typeof window === 'undefined') {
      return defaultMode;
    }

    if (persist) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored === 'rustfs' || stored === 'local') {
          return stored;
        }
      } catch {
        // localStorage不可用
      }
    }

    return defaultMode;
  };

  const [mode, setModeState] = useState<StorageMode>(getInitialMode);

  /**
   * 设置模式
   */
  const setMode = useCallback((newMode: StorageMode) => {
    setModeState(newMode);

    if (persist && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, newMode);
      } catch {
        // localStorage不可用
      }
    }

    onChange?.(newMode);
  }, [persist, storageKey, onChange]);

  /**
   * 切换模式
   */
  const toggleMode = useCallback(() => {
    const newMode = mode === 'rustfs' ? 'local' : 'rustfs';
    setMode(newMode);
  }, [mode, setMode]);

  /**
   * 初始化时从localStorage读取
   */
  useEffect(() => {
    if (typeof window !== 'undefined' && persist) {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'rustfs' || stored === 'local') {
        setModeState(stored);
      }
    }
  }, [persist, storageKey]);

  return {
    mode,
    setMode,
    toggleMode,
    isRustFS: mode === 'rustfs',
    isLocal: mode === 'local',
    modeName: MODE_INFO[mode].name,
    modeDescription: MODE_INFO[mode].description,
  };
}

/**
 * 获取模式信息
 * @param mode - 存储模式
 * @returns 模式信息
 */
export function getModeInfo(mode: StorageMode): { name: string; description: string } {
  return MODE_INFO[mode];
}

/**
 * 获取所有可用模式
 * @returns 模式列表
 */
export function getAvailableModes(): { value: StorageMode; label: string; description: string }[] {
  return [
    { value: 'rustfs', label: MODE_INFO.rustfs.name, description: MODE_INFO.rustfs.description },
    { value: 'local', label: MODE_INFO.local.name, description: MODE_INFO.local.description },
  ];
}
