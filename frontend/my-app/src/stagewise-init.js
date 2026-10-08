// 临时文件：Stagewise 工具栏初始化
// 这个文件仅用于开发环境，不会影响生产构建
// 支持双模式：自动检测当前端口并配置相应的stagewise设置

import { initToolbar } from '@stagewise/toolbar';

// 仅在开发环境下初始化 stagewise 工具栏
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 初始化 Stagewise 工具栏...');
  
  // 🔧 智能检测当前运行模式
  const currentPort = window.location.port;
  const isFrontendWeb = currentPort === '6521';
  const isFrontendAdmin = currentPort === '6522';
  
  console.log(`🔍 检测到当前端口: ${currentPort}`);
  console.log(`📦 运行模式: ${isFrontendWeb ? '前台模式' : isFrontendAdmin ? '后台模式' : '未知模式'}`);
  
  // 根据模式配置不同的stagewise设置
  const stagewiseConfig = {
    plugins: [], // 可以在这里添加自定义插件
    // 根据运行模式调整配置
    port: 3100, // stagewise服务端口固定
    appPort: currentPort, // 动态设置应用端口
  };
  
  try {
    initToolbar(stagewiseConfig);
    
    console.log(`✅ Stagewise 工具栏初始化成功 (${isFrontendWeb ? '前台模式' : '后台模式'})`);
    console.log(`📡 Stagewise 服务端口: 3100`);
    console.log(`🌐 应用端口: ${currentPort}`);
  } catch (error) {
    console.error('❌ Stagewise 工具栏初始化失败:', error);
    console.error('🔧 请检查 Cursor 中的 Stagewise 插件是否正确配置');
  }
}

export default function initStagewise() {
  // 导出一个空函数以便在其他地方调用
}
