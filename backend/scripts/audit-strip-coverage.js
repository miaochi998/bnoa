#!/usr/bin/env node
/**
 * 审计：逐个路由检查其处理器代码块是否包含脱敏/写过滤调用
 * 输入：scripts/audit-scan-result.json（路由与行号）
 * 只读。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const scan = require('./audit-scan-result.json');

const byFile = new Map();
for (const r of scan.all) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}

const results = [];
for (const [file, routes] of byFile) {
  const abs = path.join(ROOT, file);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const sorted = [...routes].sort((a, b) => a.line - b.line);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1].line : lines.length;
    const block = lines.slice(r.line - 1, end).join('\n');
    results.push({
      file,
      path: r.path,
      http: r.http,
      method: r.method,
      line: r.line,
      perms: r.perms.join(','),
      hasStrip: /\bstrip[A-Za-z]*\s*\(/.test(block),
      hasResolveFields: /resolveFields|fieldPermissionService\.resolve/.test(block),
      hasModuleFieldMap: /FIELD_MAP|FieldMap|MAPPING/.test(block),
    });
  }
}

// 已登记字段权限的模块
const regSrc = fs.readFileSync(path.join(ROOT, 'src/config/field-permission-registry.ts'), 'utf8');
const modules = [...new Set([...regSrc.matchAll(/module:\s*'([^']+)'/g)].map((m) => m[1]))];

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const moduleOfFile = (f) => {
  const m = /modules\/([^/]+)\//.exec(f);
  return m ? m[1] : null;
};

const out = { modules, totalRoutes: results.length };
fs.writeFileSync(path.join(__dirname, 'audit-strip-result.json'), JSON.stringify(results, null, 2));

// 汇总：按模块统计 无脱敏的路由
const stat = {};
for (const r of results) {
  const mod = moduleOfFile(r.file);
  if (!stat[mod]) stat[mod] = { total: 0, withStrip: 0, noStrip: [] };
  stat[mod].total++;
  if (r.hasStrip) stat[mod].withStrip++;
  else stat[mod].noStrip.push(`${r.http} ${r.path} (${r.perms || '无码'})`);
}

console.log('=== 已登记字段权限的模块 ===');
console.log(modules.join(', '));
console.log('\n=== 各模块路由脱敏覆盖（仅列有字段权限登记的模块）===');
for (const mod of modules) {
  const s = stat[mod];
  if (!s) { console.log(`\n[${mod}] 无 controller 文件匹配（模块名与目录不一致）`); continue; }
  console.log(`\n[${mod}] 路由 ${s.total} 条，含脱敏调用 ${s.withStrip} 条`);
  if (s.noStrip.length) {
    console.log('  未检出脱敏调用的路由:');
    for (const x of s.noStrip) console.log('    - ' + x);
  }
}

console.log('\n=== 其它模块（未登记字段权限）中含脱敏调用的文件 ===');
for (const [mod, s] of Object.entries(stat)) {
  if (modules.includes(mod)) continue;
  if (s.withStrip > 0) console.log(`  [${mod}] ${s.withStrip}/${s.total} 条含脱敏`);
}
