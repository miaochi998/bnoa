#!/usr/bin/env node
/**
 * 权限覆盖体检（三方比对）
 *
 * 目的：找出「在权限配置界面上能勾选、但实际不生效」的僵尸权限码，
 *       以及「代码要校验、但库里/定义里没有」的缺失码。
 *       这类问题会严重误导管理员（以为收回了权限，实际没有）。
 *
 * 比对三方：
 *   ① 后端实际校验：`@Permissions('x')`（控制器装饰器）
 *   ② 前端实际使用：PermissionGate / hasPermission / permission= / permission: / code:
 *   ③ 数据库 permissions 表（需 DATABASE_URL，可缺省）
 *   另与 ④ 定义文件 permission-definitions.ts 对照（权限码的"源"）。
 *
 * 判定：
 *   - 僵尸码   = 在 ③ 里存在，但 ① 和 ② 都不使用  → 勾了没用（可清理；清理后若哪天
 *                重新使用，定义文件里声明后由 POST /permissions/sync 自动重建）
 *   - 缺失码   = ① 里使用，但 ③ 或 ④ 里没有       → 会导致该接口对所有人 403
 *   - 未登记码 = ① 里使用，但 ④ 定义文件里没有
 *
 * 用法：
 *   node scripts/audit-permission-coverage.js            # 只做代码层比对（不连库）
 *   DATABASE_URL=postgresql://... node scripts/…         # 追加数据库比对（推荐）
 *
 * 退出码：发现「缺失码」返回 1（可用于发版前卡口），否则 0。
 */
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const REPO = path.join(BACKEND, '..');
const SRC = path.join(BACKEND, 'src');
const FE = path.join(REPO, 'frontend', 'my-app');
const SKIP = ['node_modules', '.next', 'dist', '.git', 'coverage'];

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

function collect(files, patterns) {
  const set = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const re of patterns) {
      for (const m of src.matchAll(re)) set.add(m[1]);
    }
  }
  return set;
}

async function main() {
  // ① 后端 @Permissions
  const backendFiles = walk(SRC, ['.ts']);
  const usedBackend = collect(backendFiles, [/@Permissions\(\s*'([^']+)'/g]);

  // ④ 定义文件
  const defPath = path.join(SRC, 'config', 'permission-definitions.ts');
  const defined = new Set();
  if (fs.existsSync(defPath)) {
    for (const m of fs.readFileSync(defPath, 'utf8').matchAll(/code:\s*'([^']+)'/g)) {
      defined.add(m[1]);
    }
  }

  // ② 前端使用
  const feFiles = walk(FE, ['.ts', '.tsx', '.js', '.jsx']);
  const usedFe = collect(feFiles, [
    /permission="([^"]+)"/g,
    /permission:\s*'([^']+)'/g,
    /hasPermission\(\s*'([^']+)'/g,
    /hasAnyPermission\([^)]*?'([^']+)'/g,
    /permissions?\.includes\(\s*'([^']+)'/g,
    /code:\s*'([a-z][a-z0-9-]*:[a-zA-Z0-9-]+)'/g,
  ]);

  // ③ 数据库（可选）
  // 优先使用 PERMISSION_CODES_FILE：测试机/生产的库不对外暴露，可先导出再传入——
  //   ssh root@<host> "docker exec -i <pg> psql -U postgres -d bnoa -A -t -c 'SELECT code FROM permissions'"
  let dbSet = null;
  const codesFile = process.env.PERMISSION_CODES_FILE;
  if (codesFile && fs.existsSync(codesFile)) {
    dbSet = new Set(
      fs
        .readFileSync(codesFile, 'utf8')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    console.log(`ℹ️  权限码清单来源：${codesFile}（${dbSet.size} 条）`);
  } else if (process.env.DATABASE_URL) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const rows = await prisma.permission.findMany({ select: { code: true } });
      dbSet = new Set(rows.map((r) => r.code));
      await prisma.$disconnect();
    } catch (e) {
      console.warn(`⚠️  连库失败，跳过数据库比对：${e.message}`);
    }
  }

  const usedAnywhere = new Set([...usedBackend, ...usedFe]);
  const fmt = (s) => [...s].sort().join('\n   ');

  console.log('=== 权限覆盖体检 ===');
  console.log(`  后端 @Permissions 使用 : ${usedBackend.size}`);
  console.log(`  前端使用              : ${usedFe.size}`);
  console.log(`  定义文件声明          : ${defined.size}`);
  console.log(`  数据库 permissions    : ${dbSet ? dbSet.size : '（未连库，跳过）'}`);

  let fail = false;

  // 缺失码：后端要用，但定义/库里没有 → 该接口必然 403
  const missingInDef = [...usedBackend].filter((c) => !defined.has(c));
  if (missingInDef.length) {
    console.log(`\n❌ ③ 后端使用但【定义文件未登记】(${missingInDef.length}) —— 该接口会对所有人 403：`);
    console.log('   ' + fmt(missingInDef));
    fail = true;
  }

  if (dbSet) {
    const missingInDb = [...usedBackend].filter((c) => !dbSet.has(c));
    if (missingInDb.length) {
      console.log(`\n❌ ④ 后端使用但【数据库没有】(${missingInDb.length}) —— 需 POST /permissions/sync 后才会生效：`);
      console.log('   ' + fmt(missingInDb));
      fail = true;
    }

    const zombies = [...dbSet].filter((c) => !usedAnywhere.has(c));
    console.log(`\n⚠️  ⑤ 僵尸码【库里有、前后端都不使用】(${zombies.length}) —— 界面上勾了没用：`);
    console.log('   ' + fmt(zombies));
    if (zombies.length) {
      console.log('\n   提示：清理前务必确认它们不是「已被接口启用但尚未释放」的码；');
      console.log('         清理方式见 prisma/migrations 中 remove_zombie_permissions 迁移。');
    }

    const dbOnly = [...dbSet].filter((c) => !defined.has(c));
    console.log(`\nℹ️  ⑥ 库里有、定义文件已删（冗余残留）(${dbOnly.length})`);
  }

  if (!dbSet) {
    console.log('\nℹ️  未提供 DATABASE_URL，已跳过数据库比对（僵尸码检测需要连库）。');
  }

  console.log(`\n结论：${fail ? '❌ 存在会导致 403 的缺失码，请先修复' : '✅ 未发现会导致接口失效的缺失码'}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('体检脚本异常：', e);
  process.exit(2);
});
