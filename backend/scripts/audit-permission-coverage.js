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
 *   - 分组父码 = 在 ③ 里存在、前后端都不直接用，但下面还挂着子码 → 是层级锚点，**不可删**
 *                （`permissions.parent_id` 是 ON DELETE SET NULL，删父码会让在用子码散落到顶层）
 *   - 缺失码   = ① 里使用，但 ③ 或 ④ 里没有       → 会导致该接口对所有人 403
 *   - 未登记码 = ① 里使用，但 ④ 定义文件里没有
 *   - 前端缺码 = ② 里使用，但 ③ 或 ④ 里没有       → 前端门禁会永久隐藏对应按钮/入口（"锁在门外"）
 *
 * 用法：
 *   node scripts/audit-permission-coverage.js            # 只做代码层比对（不连库）
 *   DATABASE_URL=postgresql://... node scripts/…         # 追加数据库比对（推荐）
 *
 * 退出码：发现「缺失码」（①用的码在 ③/④ 缺失）返回 1，否则 0。已接入 CI
 *         （.github/workflows/build-and-push.yml 的 "Audit permission coverage" 步骤），
 *         tag 发版时自动卡口；本地发版前也建议手动跑一次（带 DATABASE_URL 更全）。
 */
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const REPO = path.join(BACKEND, '..');
const SRC = path.join(BACKEND, 'src');
const FE = path.join(REPO, 'frontend', 'my-app');
const SKIP = ['node_modules', '.next', 'dist', '.git', 'coverage'];

/**
 * 有意保留的「分组父码」兜底清单。
 * 连库时会自动识别（凡有子码挂靠在它下面的一律不算僵尸码）；但 `PERMISSION_CODES_FILE`
 * 模式只有一列 code、没有层级信息，故用此清单兜底，避免每次跑都报固定假阳性。
 * 来源：迁移 `remove_zombie_permissions` 明确保留的 6 个父节点。
 */
const KNOWN_GROUP_PARENT_CODES = [
  'user:manage',
  'role:manage',
  'permission:manage',
  'security:manage',
  'task:manage',
  'dashboard:view',
];

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
  // 上述模式还会命中「文件夹共享权限」等非权限码字面量（VIEW / EDIT / UPLOAD / DOWNLOAD / DELETE）
  // 以及超管通配 `*`，这里统一按「module:action」格式收敛，避免后续检查误报
  const PERMISSION_CODE_RE = /^[a-z][a-z0-9-]*:[a-zA-Z0-9-]+$/;
  for (const c of [...usedFe]) {
    if (!PERMISSION_CODE_RE.test(c)) usedFe.delete(c);
  }
  // ③ 数据库（可选）
  // 优先使用 PERMISSION_CODES_FILE：测试机/生产的库不对外暴露，可先导出再传入——
  //   ssh root@<host> "docker exec -i <pg> psql -U postgres -d bnoa -A -t -c 'SELECT code FROM permissions'"
  let dbSet = null;
  /** 仍有子码挂靠的父码：它们即便不被前后端直接校验，也是层级分组的锚点，不能当僵尸码删 */
  let dbParentCodes = new Set();
  const codesFile = process.env.PERMISSION_CODES_FILE;
  if (codesFile && fs.existsSync(codesFile)) {
    dbSet = new Set(
      fs
        .readFileSync(codesFile, 'utf8')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    dbParentCodes = new Set(KNOWN_GROUP_PARENT_CODES.filter((c) => dbSet.has(c)));
    console.log(`ℹ️  权限码清单来源：${codesFile}（${dbSet.size} 条）`);
  } else if (process.env.DATABASE_URL) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const rows = await prisma.permission.findMany({
        select: { id: true, code: true, parentId: true },
      });
      dbSet = new Set(rows.map((r) => r.code));
      const idToCode = new Map(rows.map((r) => [r.id, r.code]));
      dbParentCodes = new Set(
        rows
          .filter((r) => r.parentId && idToCode.has(r.parentId))
          .map((r) => idToCode.get(r.parentId)),
      );
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

  // 前端使用但定义文件未登记 → 若角色未持有该码，按钮/入口会永久隐藏（"锁在门外"）
  const feMissingInDef = [...usedFe].filter((c) => !defined.has(c));
  if (feMissingInDef.length) {
    console.log(`\n⚠️  ②b 前端使用但【定义文件未登记】(${feMissingInDef.length}) —— 该码不会出现在权限配置界面，前后端口径可能不一致：`);
    console.log('   ' + fmt(feMissingInDef));
  }

  if (dbSet) {
    const missingInDb = [...usedBackend].filter((c) => !dbSet.has(c));
    if (missingInDb.length) {
      console.log(`\n❌ ④ 后端使用但【数据库没有】(${missingInDb.length}) —— 需 POST /permissions/sync 后才会生效：`);
      console.log('   ' + fmt(missingInDb));
      fail = true;
    }

    const feMissingInDb = [...usedFe].filter((c) => !dbSet.has(c));
    if (feMissingInDb.length) {
      console.log(`\n⚠️  ②c 前端使用但【数据库没有】(${feMissingInDb.length}) —— 前端门禁会永久隐藏对应按钮/入口：`);
      console.log('   ' + fmt(feMissingInDb));
    }

    // 僵尸码：前后端都不直接校验；但仍有子码挂靠的父码是层级锚点，不能删，单列出来
    const zombies = [...dbSet].filter((c) => !usedAnywhere.has(c) && !dbParentCodes.has(c));
    const keptParents = [...dbSet].filter((c) => !usedAnywhere.has(c) && dbParentCodes.has(c));
    if (zombies.length) {
      console.log(`\n⚠️  ⑤ 僵尸码【库里有、前后端都不使用】(${zombies.length}) —— 界面上勾了没用：`);
      console.log('   ' + fmt(zombies));
      console.log('\n   提示：清理前务必确认它们不是「已被接口启用但尚未释放」的码；');
      console.log('         清理方式见 prisma/migrations 中 remove_zombie_permissions 迁移。');
    } else {
      console.log('\n✅ ⑤ 无僵尸码（库里的码都已被前后端使用，或仍是分组父码）');
    }

    console.log(`\nℹ️  ⑤b 有意保留的分组父码【前后端不直接校验，但仍有子码挂靠】(${keptParents.length}) —— 不可删：`);
    console.log('   ' + fmt(keptParents));

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
