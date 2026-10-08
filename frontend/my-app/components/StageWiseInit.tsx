'use client';

import { useEffect } from 'react';

/**
 * Stagewise 工具栏初始化组件
 * 仅在开发环境下加载和初始化 Stagewise 工具栏
 * 生产环境下此组件不会执行任何操作
 */
export function StageWiseInit() {
  useEffect(() => {
    // 仅在开发环境且在浏览器中执行
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      // 动态导入 stagewise 初始化模块
      import('../src/stagewise-init.js')
        .then(() => {
          console.log('✅ Stagewise 工具栏模块已加载');
        })
        .catch((error) => {
          console.log('ℹ️ Stagewise 工具栏未安装或加载失败:', error.message);
          console.log('💡 如需使用 Stagewise，请运行: npm install --save-dev @stagewise/toolbar');
        });
    }
  }, []);

  // 此组件不渲染任何内容
  return null;
}
