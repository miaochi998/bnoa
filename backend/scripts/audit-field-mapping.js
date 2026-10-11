#!/usr/bin/env node
/**
 * 审计：比对「字段权限注册表」与「控制器 FieldKeyMapping」的 field 名集合
 * 目的：发现 key/field 拼错或与注册表错位导致「配置不生效」
 * 只读脚本。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// 1. 注册表
const regSrc = fs.readFileSync(path.join(ROOT, 'src/config/field-permission-registry.ts'), 'utf8');
const regByModule = {};
for (const m of regSrc.matchAll(/\{\s*module:\s*'([^']+)',\s*field:\s*'([^']+)'/g)) {
  (regByModule[m[1]] ||= new Set()).add(m[2]);
}

// 2. 扫描 controllers
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.controller.ts')) acc.push(p);
  }
  return acc;
};

const rows = [];
for (const file of walk(path.join(ROOT, 'src/modules'))) {
  const src = fs.readFileSync(file, 'utf8');
  // 该 controller 解析哪个模块
  const mods = [...new Set([...src.matchAll(/\.resolve\(\s*[\s\S]{0,60}?'([a-z0-9-]+)'/g)].map((m) => m[1]))];
  // 所有 FieldKeyMapping 数组
  const maps = [];
  for (const m of src.matchAll(/(?:const|private readonly)\s+(\w+)\s*(?::\s*FieldKeyMapping\[\])?\s*=\s*\[([\s\S]*?)\];/g)) {
    const pairs = [...m[2].matchAll(/field:\s*'([^']+)'\s*,\s*key:\s*'([^']+)'/g)].map((x) => [x[1], x[2]]);
    if (pairs.length) maps.push({ name: m[1], pairs });
  }
  if (!maps.length) continue;
  const mod = mods[0] || null;
  for (const map of maps) {
    const mapFields = new Set(map.pairs.map((p) => p[0]));
    const regFields = mod ? regByModule[mod] : null;
    rows.push({
      file: path.relative(ROOT, file),
      module: mod,
      mapName: map.name,
      pairCount: map.pairs.length,
      mismatchFieldToKey: map.pairs.filter(([f, k]) => f !== k),
      registryHasMapMissing: regFields ? [...regFields].filter((f) => !mapFields.has(f)) : null,
      mapHasRegistryMissing: regFields ? [...mapFields].filter((f) => !regFields.has(f)) : null,
    });
  }
}

console.log('=== field != key 的映射（多数组分层映射属正常，仅供人工核对）===');
let bad = 0;
for (const r of rows) {
  for (const [f, k] of r.mismatchFieldToKey) {
    bad++;
  }
}
console.log(`  共 ${bad} 条（多为子实体分层映射，非缺陷；重点看下方聚合比对）`);

// 按控制器文件聚合所有映射的 field
const byFile = new Map();
for (const r of rows) {
  if (!byFile.has(r.file)) byFile.set(r.file, { module: r.module, fields: new Set(), maps: [] });
  const e = byFile.get(r.file);
  e.maps.push(r.mapName);
  for (const [f] of r.mismatchFieldToKey.concat([])) e.fields.add(f);
}
// 重新精确收集（mismatchFieldToKey 只含 field!=key 的，需全量）
for (const file of byFile.keys()) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const fs2 = new Set();
  for (const m of src.matchAll(/(?:const|private readonly)\s+(\w+)\s*(?::\s*FieldKeyMapping\[\])?\s*=\s*\[([\s\S]*?)\];/g)) {
    for (const x of m[2].matchAll(/field:\s*'([^']+)'/g)) fs2.add(x[1]);
  }
  byFile.get(file).fields = fs2;
}

console.log('\n=== 聚合比对：注册表字段 vs 该模块控制器全部映射的 field ===');
for (const [file, e] of byFile) {
  if (!e.module || !regByModule[e.module]) continue;
  const reg = regByModule[e.module];
  const missing = [...reg].filter((f) => !e.fields.has(f));
  const extra = [...e.fields].filter((f) => !reg.has(f));
  if (!missing.length && !extra.length) continue;
  console.log(`\n[${e.module}] ${file}`);
  if (missing.length) console.log(`  ❌ 注册表有但映射缺失（配了不生效）: ${missing.join(', ')}`);
  if (extra.length) console.log(`  ⚠️ 映射有但注册表未登记（无法配置/脏数据）: ${extra.join(', ')}`);
}

console.log('\n=== field != key 明细（人工核对用）===');
for (const r of rows) {
  for (const [f, k] of r.mismatchFieldToKey) {
    console.log(`  [${r.module || '?'}] ${r.mapName}: field='${f}' key='${k}'`);
  }
}
if (!bad) console.log('  无');


fs.writeFileSync(path.join(__dirname, 'audit-mapping-result.json'), JSON.stringify(rows, null, 2));
