/**
 * 上传Utils层单元测试
 * @module lib/utils/upload/__tests__/utils.test.ts
 * 
 * 测试覆盖：
 * - formatFileSize
 * - getFileExtension
 * - getFileIcon
 * - validateFile
 * - authUtils
 */

import {
  formatFileSize,
  formatSpeed,
  formatRemainingTime,
  parseFileSize,
  getFileExtension,
  getMimeTypeFromExtension,
  getExtensionFromMimeType,
  isImageFile,
  isVideoFile,
  isAudioFile,
  getFileIcon,
  getFileCategory,
  getFileIconColor,
  validateFile,
  filterValidFiles,
  DANGEROUS_EXTENSIONS,
  FILE_TYPE_CONFIGS,
  getAccessToken,
  getAuthHeaders,
  generateFileId,
  generateUploadId,
  UPLOAD_CONSTANTS,
  UPLOAD_STATUS,
  UPLOAD_STAGE,
} from '../index';

/**
 * 测试结果类型
 */
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

/**
 * 断言函数
 */
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

function assertContains(str: string, substr: string, message: string): void {
  if (!str.includes(substr)) {
    throw new Error(`${message}: "${str}" does not contain "${substr}"`);
  }
}

/**
 * 测试运行器
 */
function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: (error as Error).message });
  }
}

// ============ formatFileSize 测试 ============

test('formatFileSize - 0 bytes', () => {
  assertEqual(formatFileSize(0), '0 B', 'Should format 0 bytes');
});

test('formatFileSize - bytes', () => {
  assertEqual(formatFileSize(500), '500 B', 'Should format bytes');
});

test('formatFileSize - KB', () => {
  assertEqual(formatFileSize(1024), '1 KB', 'Should format KB');
  assertEqual(formatFileSize(1536), '1.5 KB', 'Should format 1.5 KB');
});

test('formatFileSize - MB', () => {
  assertEqual(formatFileSize(1024 * 1024), '1 MB', 'Should format MB');
});

test('formatFileSize - GB', () => {
  assertEqual(formatFileSize(1024 * 1024 * 1024), '1 GB', 'Should format GB');
});

test('formatSpeed - formats speed correctly', () => {
  assertContains(formatSpeed(1024), 'KB/s', 'Should format speed');
});

test('formatRemainingTime - seconds', () => {
  assertContains(formatRemainingTime(30), '秒', 'Should format seconds');
});

test('formatRemainingTime - minutes', () => {
  assertContains(formatRemainingTime(120), '分', 'Should format minutes');
});

test('parseFileSize - parses correctly', () => {
  assertEqual(parseFileSize('1 KB'), 1024, 'Should parse 1 KB');
  assertEqual(parseFileSize('1 MB'), 1024 * 1024, 'Should parse 1 MB');
});

// ============ getFileExtension 测试 ============

test('getFileExtension - simple extension', () => {
  assertEqual(getFileExtension('test.jpg'), 'jpg', 'Should get jpg extension');
  assertEqual(getFileExtension('test.PDF'), 'pdf', 'Should lowercase extension');
});

test('getFileExtension - no extension', () => {
  assertEqual(getFileExtension('noextension'), '', 'Should return empty for no extension');
});

test('getFileExtension - multiple dots', () => {
  assertEqual(getFileExtension('file.name.txt'), 'txt', 'Should get last extension');
});

test('getMimeTypeFromExtension - returns correct mime', () => {
  assertEqual(getMimeTypeFromExtension('jpg'), 'image/jpeg', 'Should return image/jpeg');
  assertEqual(getMimeTypeFromExtension('png'), 'image/png', 'Should return image/png');
  assertEqual(getMimeTypeFromExtension('pdf'), 'application/pdf', 'Should return application/pdf');
});

test('getExtensionFromMimeType - returns correct extension', () => {
  assertEqual(getExtensionFromMimeType('image/jpeg'), 'jpg', 'Should return jpg');
  assertEqual(getExtensionFromMimeType('image/png'), 'png', 'Should return png');
});

test('isImageFile - detects images', () => {
  assertEqual(isImageFile('test.jpg'), true, 'Should detect jpg');
  assertEqual(isImageFile('test.png'), true, 'Should detect png');
  assertEqual(isImageFile('test.txt'), false, 'Should not detect txt');
});

test('isVideoFile - detects videos', () => {
  assertEqual(isVideoFile('test.mp4'), true, 'Should detect mp4');
  assertEqual(isVideoFile('test.jpg'), false, 'Should not detect jpg');
});

test('isAudioFile - detects audio', () => {
  assertEqual(isAudioFile('test.mp3'), true, 'Should detect mp3');
  assertEqual(isAudioFile('test.jpg'), false, 'Should not detect jpg');
});

// ============ getFileIcon 测试 ============

test('getFileIcon - returns icon for images', () => {
  const icon = getFileIcon('test.jpg');
  assert(icon !== null && icon !== undefined, 'Should return an icon');
});

test('getFileIcon - returns icon for videos', () => {
  const icon = getFileIcon('test.mp4');
  assert(icon !== null && icon !== undefined, 'Should return an icon');
});

test('getFileIcon - returns icon for documents', () => {
  const icon = getFileIcon('test.pdf');
  assert(icon !== null && icon !== undefined, 'Should return an icon');
});

test('getFileCategory - categorizes files', () => {
  assertEqual(getFileCategory('test.jpg'), 'image', 'Should categorize as image');
  assertEqual(getFileCategory('test.mp4'), 'video', 'Should categorize as video');
  assertEqual(getFileCategory('test.mp3'), 'audio', 'Should categorize as audio');
  assertEqual(getFileCategory('test.pdf'), 'document', 'Should categorize as document');
});

test('getFileIconColor - returns colors', () => {
  const color = getFileIconColor('test.jpg');
  assert(typeof color === 'string', 'Should return a color string');
  assert(color.startsWith('#'), 'Should return hex color');
});

// ============ validateFile 测试 ============

test('validateFile - valid file', () => {
  const mockFile = { name: 'test.jpg', size: 1024, type: 'image/jpeg' } as File;
  const result = validateFile(mockFile);
  assertEqual(result.valid, true, 'Should be valid');
});

test('validateFile - file too large', () => {
  const mockFile = { name: 'test.jpg', size: 100 * 1024 * 1024, type: 'image/jpeg' } as File;
  const result = validateFile(mockFile, { maxSize: 10 * 1024 * 1024 });
  assertEqual(result.valid, false, 'Should be invalid');
  assertContains(result.error || '', '大小', 'Should mention size');
});

test('validateFile - invalid type', () => {
  const mockFile = { name: 'test.exe', size: 1024, type: 'application/x-msdownload' } as File;
  const result = validateFile(mockFile, { allowedTypes: ['image/*'] });
  assertEqual(result.valid, false, 'Should be invalid');
});

test('validateFile - dangerous extension', () => {
  const mockFile = { name: 'virus.exe', size: 1024, type: 'application/x-msdownload' } as File;
  const result = validateFile(mockFile, { checkDangerousExtensions: true });
  assertEqual(result.valid, false, 'Should be invalid');
});

test('filterValidFiles - filters correctly', () => {
  const files = [
    { name: 'good.jpg', size: 1024, type: 'image/jpeg' } as File,
    { name: 'bad.exe', size: 1024, type: 'application/x-msdownload' } as File,
  ];
  const validFiles = filterValidFiles(files, { checkDangerousExtensions: true });
  assert(Array.isArray(validFiles), 'Should return an array');
});

test('DANGEROUS_EXTENSIONS - contains exe', () => {
  assert(DANGEROUS_EXTENSIONS.includes('exe'), 'Should contain exe');
  assert(DANGEROUS_EXTENSIONS.includes('bat'), 'Should contain bat');
});

test('FILE_TYPE_CONFIGS - has image types', () => {
  assert(FILE_TYPE_CONFIGS.images !== undefined, 'Should have images types');
});

// ============ authUtils 测试 ============

test('getAccessToken - returns string or null', () => {
  const token = getAccessToken();
  assert(token === null || typeof token === 'string', 'Should return string or null');
});

test('getAuthHeaders - returns headers object', () => {
  const headers = getAuthHeaders();
  assert(typeof headers === 'object', 'Should return object');
  assert('Content-Type' in headers, 'Should have Content-Type');
});

test('generateFileId - generates unique IDs', () => {
  const id1 = generateFileId();
  const id2 = generateFileId();
  assert(id1 !== id2, 'Should generate unique IDs');
  assert(id1.startsWith('file_'), 'Should start with file_');
});

test('generateUploadId - generates unique IDs', () => {
  const id1 = generateUploadId();
  const id2 = generateUploadId();
  assert(id1 !== id2, 'Should generate unique IDs');
  assert(id1.startsWith('upload_'), 'Should start with upload_');
});

// ============ 常量测试 ============

test('UPLOAD_CONSTANTS - has required values', () => {
  assert(UPLOAD_CONSTANTS.DEFAULT_CHUNK_SIZE > 0, 'Should have DEFAULT_CHUNK_SIZE');
  assert(UPLOAD_CONSTANTS.SMALL_FILE_THRESHOLD > 0, 'Should have SMALL_FILE_THRESHOLD');
  assert(UPLOAD_CONSTANTS.MAX_CONCURRENT_UPLOADS > 0, 'Should have MAX_CONCURRENT_UPLOADS');
});

test('UPLOAD_STATUS - has all statuses', () => {
  assert(UPLOAD_STATUS.WAITING !== undefined, 'Should have WAITING');
  assert(UPLOAD_STATUS.UPLOADING !== undefined, 'Should have UPLOADING');
  assert(UPLOAD_STATUS.SUCCESS !== undefined, 'Should have SUCCESS');
  assert(UPLOAD_STATUS.ERROR !== undefined, 'Should have ERROR');
  assert(UPLOAD_STATUS.PAUSED !== undefined, 'Should have PAUSED');
  assert(UPLOAD_STATUS.CANCELLED !== undefined, 'Should have CANCELLED');
});

test('UPLOAD_STAGE - has all stages', () => {
  assert(UPLOAD_STAGE.MD5 !== undefined, 'Should have MD5');
  assert(UPLOAD_STAGE.CHECKING !== undefined, 'Should have CHECKING');
  assert(UPLOAD_STAGE.COMPRESSING !== undefined, 'Should have COMPRESSING');
  assert(UPLOAD_STAGE.UPLOADING !== undefined, 'Should have UPLOADING');
  assert(UPLOAD_STAGE.COMPLETED !== undefined, 'Should have COMPLETED');
});

// ============ 输出测试结果 ============

console.log('\n========== 上传Utils层单元测试结果 ==========\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

results.forEach(r => {
  if (r.passed) {
    console.log(`✅ ${r.name}`);
  } else {
    console.log(`❌ ${r.name}`);
    console.log(`   Error: ${r.error}`);
  }
});

console.log(`\n总计: ${results.length} 个测试`);
console.log(`通过: ${passed} 个`);
console.log(`失败: ${failed} 个`);
console.log(`通过率: ${((passed / results.length) * 100).toFixed(1)}%\n`);

if (failed > 0) {
  process.exit(1);
}
