/**
 * 上传Service层单元测试
 * @module lib/services/upload/__tests__/services.test.ts
 * 
 * 测试覆盖：
 * - MD5Service
 * - SecureCheckService
 * - SessionService
 * - ChunkUploadService
 * - S3UploadService
 * - CompressService
 * - UploadOrchestrator
 */

import {
  md5Service,
  secureCheckService,
  sessionService,
  chunkUploadService,
  s3UploadService,
  compressService,
  uploadOrchestrator,
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

// ============ MD5Service 测试 ============

test('md5Service - exists and has methods', () => {
  assert(md5Service !== undefined, 'md5Service should exist');
  assert(typeof md5Service.calculateFileMD5 === 'function', 'Should have calculateFileMD5');
  assert(typeof md5Service.calculateBlobMD5 === 'function', 'Should have calculateBlobMD5');
  assert(typeof md5Service.calculateStringMD5 === 'function', 'Should have calculateStringMD5');
});

test('md5Service - calculateStringMD5', () => {
  const hash = md5Service.calculateStringMD5('hello');
  assert(typeof hash === 'string', 'Should return a string');
  assert(hash.length === 32, 'MD5 hash should be 32 characters');
});

// ============ SecureCheckService 测试 ============

test('secureCheckService - exists and has methods', () => {
  assert(secureCheckService !== undefined, 'secureCheckService should exist');
  assert(typeof secureCheckService.checkFileExists === 'function', 'Should have checkFileExists');
});

// ============ SessionService 测试 ============

test('sessionService - exists and has methods', () => {
  assert(sessionService !== undefined, 'sessionService should exist');
  assert(typeof sessionService.initSession === 'function', 'Should have initSession');
  assert(typeof sessionService.getSession === 'function', 'Should have getSession');
  assert(typeof sessionService.cancelSession === 'function', 'Should have cancelSession');
});

// ============ ChunkUploadService 测试 ============

test('chunkUploadService - exists and has methods', () => {
  assert(chunkUploadService !== undefined, 'chunkUploadService should exist');
  assert(typeof chunkUploadService.uploadChunk === 'function', 'Should have uploadChunk');
});

// ============ S3UploadService 测试 ============

test('s3UploadService - exists and has methods', () => {
  assert(s3UploadService !== undefined, 's3UploadService should exist');
  assert(typeof s3UploadService.uploadFile === 'function', 'Should have uploadFile');
});

// ============ CompressService 测试 ============

test('compressService - exists and has methods', () => {
  assert(compressService !== undefined, 'compressService should exist');
  assert(typeof compressService.compressImage === 'function', 'Should have compressImage');
  assert(typeof compressService.shouldCompress === 'function', 'Should have shouldCompress');
});

test('compressService - shouldCompress', () => {
  // 小图片不需要压缩
  const mockSmallFile = { name: 'small.jpg', size: 100 * 1024, type: 'image/jpeg' } as File;
  const shouldCompressSmall = compressService.shouldCompress(mockSmallFile);
  assert(typeof shouldCompressSmall === 'boolean', 'Should return boolean');

  // 大图片需要压缩
  const mockLargeFile = { name: 'large.jpg', size: 5 * 1024 * 1024, type: 'image/jpeg' } as File;
  const shouldCompressLarge = compressService.shouldCompress(mockLargeFile);
  assert(shouldCompressLarge === true, 'Large image should need compression');

  // 非图片不需要压缩
  const mockPdfFile = { name: 'doc.pdf', size: 5 * 1024 * 1024, type: 'application/pdf' } as File;
  const shouldCompressPdf = compressService.shouldCompress(mockPdfFile);
  assert(shouldCompressPdf === false, 'PDF should not need compression');
});

// ============ UploadOrchestrator 测试 ============

test('uploadOrchestrator - exists and has methods', () => {
  assert(uploadOrchestrator !== undefined, 'uploadOrchestrator should exist');
  assert(typeof uploadOrchestrator.uploadFile === 'function', 'Should have uploadFile');
});

// ============ 输出测试结果 ============

console.log('\n========== 上传Service层单元测试结果 ==========\n');

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
