// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // 允许使用 any 类型（ NestJS 和 Prisma 开发中常见需求）
      '@typescript-eslint/no-explicit-any': 'off',
      // 允许对 any 类型进行赋值操作
      '@typescript-eslint/no-unsafe-assignment': 'off',
      // 允许对 any 类型进行成员访问
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // 允许调用 any 类型的函数
      '@typescript-eslint/no-unsafe-call': 'off',
      // 允许返回 any 类型
      '@typescript-eslint/no-unsafe-return': 'off',
      // 允许将 any 类型作为参数传递
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // 允许枚举与字符串比较
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      // 未处理的 Promise 警告
      '@typescript-eslint/no-floating-promises': 'warn',
      // Prettier 配置
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // 测试文件特殊配置
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      // 测试文件中允许未绑定的方法调用（Jest mock 函数常见）
      '@typescript-eslint/unbound-method': 'off',
      // 测试文件中允许 async 函数没有 await
      '@typescript-eslint/require-await': 'off',
    },
  },
);
