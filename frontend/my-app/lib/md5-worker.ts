/**
 * MD5计算工具
 * 使用spark-md5库计算文件MD5
 */

import SparkMD5 from 'spark-md5';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per chunk for MD5 calculation

/**
 * 计算文件MD5
 */
export async function calculateFileMd5(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer();
    const reader = new FileReader();
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    let currentChunk = 0;

    const loadNext = () => {
      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      reader.readAsArrayBuffer(file.slice(start, end));
    };

    reader.onload = (e) => {
      if (e.target?.result) {
        spark.append(e.target.result as ArrayBuffer);
      }
      currentChunk++;

      if (onProgress) {
        onProgress((currentChunk / chunks) * 100);
      }

      if (currentChunk < chunks) {
        loadNext();
      } else {
        const md5 = spark.end();
        resolve(md5);
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    loadNext();
  });
}

/**
 * 计算Blob的MD5
 */
export async function calculateBlobMd5(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(e.target.result as ArrayBuffer);
        resolve(spark.end());
      } else {
        reject(new Error('读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('读取失败'));
    reader.readAsArrayBuffer(blob);
  });
}
