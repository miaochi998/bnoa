/**
 * Prisma v6 的类型导出与 moduleResolution:"node" 不完全兼容，
 * 通过此声明文件将 .prisma/client 中的所有导出重新声明到 @prisma/client 模块。
 * 这样代码中 `import { XXX } from '@prisma/client'` 就能正确找到所有类型和枚举。
 */
declare module '@prisma/client' {
  export * from '.prisma/client';
  export { PrismaClient } from '.prisma/client';
}
