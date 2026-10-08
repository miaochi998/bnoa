/**
 * 上传工具函数测试验证脚本
 * 用于验证所有工具函数的正确性
 * 
 * 使用方法：在浏览器控制台中导入并运行
 * import { runAllTests } from '@/lib/utils/upload/test-utils';
 * runAllTests();
 */

import {
  formatFileSize,
  formatSpeed,
  formatRemainingTime,
  parseFileSize,
  getFileExtension,
  getExtensionFromMimeType,
  getMimeTypeFromExtension,
  getFileNameWithoutExtension,
  getFileCategory,
  getFileIconColor,
  getFileTypeEmoji,
  getFileTypeName,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isMediaFile,
  isPreviewable,
  validateFile,
  isDangerousExtension,
  DANGEROUS_EXTENSIONS,
  generateUploadId,
  generateFileId,
  isTokenExpired,
  UPLOAD_CONSTANTS,
  UPLOAD_STATUS,
  UPLOAD_STAGE,
} from './index';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function runTest(name: string, testFn: () => void): TestResult {
  try {
    testFn();
    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: (error as Error).message };
  }
}

/**
 * 运行所有测试
 */
export function runAllTests(): void {
  const results: TestResult[] = [];

  // formatFileSize 测试
  results.push(runTest('formatFileSize: 0字节', () => {
    assertEqual(formatFileSize(0), '0 B', '0字节格式化');
  }));

  results.push(runTest('formatFileSize: KB', () => {
    assertEqual(formatFileSize(1024), '1 KB', 'KB格式化');
  }));

  results.push(runTest('formatFileSize: MB', () => {
    assertEqual(formatFileSize(1024 * 1024), '1 MB', 'MB格式化');
  }));

  results.push(runTest('formatFileSize: GB', () => {
    assertEqual(formatFileSize(1024 * 1024 * 1024), '1 GB', 'GB格式化');
  }));

  results.push(runTest('formatFileSize: 负数', () => {
    assertEqual(formatFileSize(-100), '0 B', '负数处理');
  }));

  // formatSpeed 测试
  results.push(runTest('formatSpeed: 0', () => {
    assertEqual(formatSpeed(0), '0 B/s', '0速度');
  }));

  results.push(runTest('formatSpeed: KB/s', () => {
    assertEqual(formatSpeed(1024), '1 KB/s', 'KB/s格式化');
  }));

  // formatRemainingTime 测试
  results.push(runTest('formatRemainingTime: 秒', () => {
    assertEqual(formatRemainingTime(30), '30秒', '秒格式化');
  }));

  results.push(runTest('formatRemainingTime: 分钟', () => {
    assertEqual(formatRemainingTime(120), '2分钟', '分钟格式化');
  }));

  results.push(runTest('formatRemainingTime: 无效值', () => {
    assertEqual(formatRemainingTime(0), '--', '无效值处理');
  }));

  // parseFileSize 测试
  results.push(runTest('parseFileSize: KB', () => {
    assertEqual(parseFileSize('1 KB'), 1024, 'KB解析');
  }));

  results.push(runTest('parseFileSize: MB', () => {
    assertEqual(parseFileSize('1 MB'), 1024 * 1024, 'MB解析');
  }));

  // getFileExtension 测试
  results.push(runTest('getFileExtension: 正常文件', () => {
    assertEqual(getFileExtension('photo.jpg'), 'jpg', '扩展名获取');
  }));

  results.push(runTest('getFileExtension: 大写', () => {
    assertEqual(getFileExtension('document.PDF'), 'pdf', '大写处理');
  }));

  results.push(runTest('getFileExtension: 无扩展名', () => {
    assertEqual(getFileExtension('noextension'), '', '无扩展名');
  }));

  // getExtensionFromMimeType 测试
  results.push(runTest('getExtensionFromMimeType: jpeg', () => {
    assertEqual(getExtensionFromMimeType('image/jpeg'), 'jpg', 'MIME转扩展名');
  }));

  results.push(runTest('getExtensionFromMimeType: pdf', () => {
    assertEqual(getExtensionFromMimeType('application/pdf'), 'pdf', 'PDF MIME');
  }));

  // getMimeTypeFromExtension 测试
  results.push(runTest('getMimeTypeFromExtension: jpg', () => {
    assertEqual(getMimeTypeFromExtension('jpg'), 'image/jpeg', '扩展名转MIME');
  }));

  results.push(runTest('getMimeTypeFromExtension: 带点号', () => {
    assertEqual(getMimeTypeFromExtension('.png'), 'image/png', '带点号处理');
  }));

  // getFileNameWithoutExtension 测试
  results.push(runTest('getFileNameWithoutExtension', () => {
    assertEqual(getFileNameWithoutExtension('photo.jpg'), 'photo', '移除扩展名');
  }));

  // getFileCategory 测试
  results.push(runTest('getFileCategory: 图片', () => {
    assertEqual(getFileCategory('image/jpeg'), 'image', '图片分类');
  }));

  results.push(runTest('getFileCategory: 视频', () => {
    assertEqual(getFileCategory('video/mp4'), 'video', '视频分类');
  }));

  results.push(runTest('getFileCategory: 音频', () => {
    assertEqual(getFileCategory('audio/mpeg'), 'audio', '音频分类');
  }));

  // getFileIconColor 测试
  results.push(runTest('getFileIconColor: 图片', () => {
    assertEqual(getFileIconColor('image/jpeg'), 'text-green-500', '图片颜色');
  }));

  // getFileTypeEmoji 测试
  results.push(runTest('getFileTypeEmoji: 图片', () => {
    assertEqual(getFileTypeEmoji('image/jpeg'), '🖼️', '图片emoji');
  }));

  // getFileTypeName 测试
  results.push(runTest('getFileTypeName: 图片', () => {
    assertEqual(getFileTypeName('image/jpeg'), '图片', '图片名称');
  }));

  // isImageFile 测试
  results.push(runTest('isImageFile: true', () => {
    assertEqual(isImageFile('image/jpeg'), true, '是图片');
  }));

  results.push(runTest('isImageFile: false', () => {
    assertEqual(isImageFile('video/mp4'), false, '不是图片');
  }));

  // isVideoFile 测试
  results.push(runTest('isVideoFile: true', () => {
    assertEqual(isVideoFile('video/mp4'), true, '是视频');
  }));

  // isAudioFile 测试
  results.push(runTest('isAudioFile: true', () => {
    assertEqual(isAudioFile('audio/mpeg'), true, '是音频');
  }));

  // isMediaFile 测试
  results.push(runTest('isMediaFile: 图片', () => {
    assertEqual(isMediaFile('image/jpeg'), true, '图片是媒体');
  }));

  results.push(runTest('isMediaFile: PDF', () => {
    assertEqual(isMediaFile('application/pdf'), false, 'PDF不是媒体');
  }));

  // isPreviewable 测试
  results.push(runTest('isPreviewable: 图片', () => {
    assertEqual(isPreviewable('image/jpeg'), true, '图片可预览');
  }));

  // isDangerousExtension 测试
  results.push(runTest('isDangerousExtension: exe', () => {
    assertEqual(isDangerousExtension('exe'), true, 'exe危险');
  }));

  results.push(runTest('isDangerousExtension: jpg', () => {
    assertEqual(isDangerousExtension('jpg'), false, 'jpg安全');
  }));

  // DANGEROUS_EXTENSIONS 测试
  results.push(runTest('DANGEROUS_EXTENSIONS: 包含exe', () => {
    assert(DANGEROUS_EXTENSIONS.includes('exe'), '应包含exe');
  }));

  // validateFile 测试
  results.push(runTest('validateFile: 危险扩展名', () => {
    const blob = new Blob(['test'], { type: 'application/octet-stream' });
    const file = new File([blob], 'virus.exe', { type: 'application/octet-stream' });
    const result = validateFile(file);
    assertEqual(result.valid, false, '应拒绝exe');
    assertEqual(result.errorCode, 'DANGEROUS_EXTENSION', '错误码');
  }));

  results.push(runTest('validateFile: 有效文件', () => {
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    const result = validateFile(file);
    assertEqual(result.valid, true, '应接受jpg');
  }));

  // generateUploadId 测试
  results.push(runTest('generateUploadId: 唯一性', () => {
    const id1 = generateUploadId();
    const id2 = generateUploadId();
    assert(id1 !== id2, 'ID应唯一');
    assert(id1.startsWith('upload_'), 'ID应以upload_开头');
  }));

  // generateFileId 测试
  results.push(runTest('generateFileId: 唯一性', () => {
    const id1 = generateFileId();
    const id2 = generateFileId();
    assert(id1 !== id2, 'ID应唯一');
    assert(id1.startsWith('file_'), 'ID应以file_开头');
  }));

  // isTokenExpired 测试
  results.push(runTest('isTokenExpired: 空令牌', () => {
    assertEqual(isTokenExpired(''), true, '空令牌应过期');
  }));

  results.push(runTest('isTokenExpired: 无效令牌', () => {
    assertEqual(isTokenExpired('invalid'), true, '无效令牌应过期');
  }));

  // UPLOAD_CONSTANTS 测试
  results.push(runTest('UPLOAD_CONSTANTS', () => {
    assertEqual(UPLOAD_CONSTANTS.DEFAULT_CHUNK_SIZE, 5 * 1024 * 1024, '分片大小');
    assertEqual(UPLOAD_CONSTANTS.SMALL_FILE_THRESHOLD, 10 * 1024 * 1024, '小文件阈值');
  }));

  // UPLOAD_STATUS 测试
  results.push(runTest('UPLOAD_STATUS', () => {
    assertEqual(UPLOAD_STATUS.WAITING, 'waiting', '等待状态');
    assertEqual(UPLOAD_STATUS.UPLOADING, 'uploading', '上传状态');
  }));

  // UPLOAD_STAGE 测试
  results.push(runTest('UPLOAD_STAGE', () => {
    assertEqual(UPLOAD_STAGE.MD5, 'md5', 'MD5阶段');
    assertEqual(UPLOAD_STAGE.UPLOADING, 'uploading', '上传阶段');
  }));

  // 输出结果
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n========================================');
  console.log('📋 上传工具函数测试结果');
  console.log('========================================');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${results.length}`);
  console.log('========================================\n');

  if (failed > 0) {
    console.log('❌ 失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  if (failed === 0) {
    console.log('🎉 所有测试通过！');
  }
}

// 导出单个测试函数供调试使用
export { runTest, assert, assertEqual };
