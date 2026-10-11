#!/usr/bin/env node
/**
 * 权限审计 v2：稳健解析控制器（装饰器可写在 HTTP 方法装饰器之前或之后，可跨行、可带注释）
 * 只读脚本。输出：
 *   - 每个路由：HTTP 方法 / 路径 / 权限码 / 守卫覆盖 / Public / SuperAdminOnly
 *   - 问题：无守卫、有守卫但无权限码、写操作复用读权限码、权限码未在定义中登记
 */
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const SRC = path.join(BACKEND, 'src');
const HTTP_METHODS = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All'];

/** 把注释替换成等长空白（保持索引不变），避免注释里的 @xxx 被误当成装饰器 */
function maskComments(src) {
  const out = src.split('');
  let i = 0;
  let state = 'normal';
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (state === 'normal') {
      if (c === '/' && n === '/') { state = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === '/' && n === '*') { state = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { state = 'str'; quote = c; i++; continue; }
      i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'normal'; i++; continue; }
      out[i] = ' '; i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && n === '/') { out[i] = ' '; out[i + 1] = ' '; state = 'normal'; i += 2; continue; }
      if (c !== '\n') out[i] = ' ';
      i++; continue;
    }
    if (state === 'str') {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) state = 'normal';
      i++; continue;
    }
  }
  return out.join('');
}

/** 去掉文本中的注释，用于判断两个 token 之间是否只剩空白 */
function stripCommentsAndSpace(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, '');
}

/** 装饰器与方法之间允许出现「成员修饰符」，如 async / public */
const MODIFIERS = /^(?:public|private|protected|static|readonly|override|abstract|declare|async|get|set)+$/;
function isContinuous(between) {
  const s = stripCommentsAndSpace(between);
  return s === '' || MODIFIERS.test(s);
}

/** 扫描所有 @Decorator(...) 与无参 @Decorator */
function scanDecorators(src) {
  const out = [];
  const re = /@([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    let i = m.index + m[0].length;
    // 跳过空白
    while (i < src.length && /\s/.test(src[i])) i++;
    let args = '';
    let end = i;
    if (src[i] === '(') {
      let depth = 0;
      let j = i;
      let inStr = null;
      for (; j < src.length; j++) {
        const ch = src[j];
        if (inStr) {
          if (ch === '\\') { j++; continue; }
          if (ch === inStr) inStr = null;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { j++; break; } }
      }
      args = src.slice(i + 1, j - 1);
      end = j;
    }
    out.push({ name, args, start: m.index, end });
    re.lastIndex = end;
  }
  return out;
}

/** 扫描方法/成员定义：name(  位置（排除装饰器内部） */
function scanMembers(src, decorators) {
  const inDec = (idx) => decorators.some((d) => idx >= d.start && idx < d.end);
  const out = [];
  const re = /(?:^|[\n;}{])\s*(?:(?:public|private|protected|static|readonly|async|override|abstract|declare)\s+)*([A-Za-z_$][\w$]*)\s*\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const nameIdx = m.index + m[0].indexOf(m[1]);
    if (inDec(nameIdx)) continue;
    out.push({ name: m[1], start: nameIdx, end: m.index + m[0].length });
  }
  return out;
}

function groupTokens(decorators, members) {
  const tokens = [
    ...decorators.map((d) => ({ type: 'decorator', ...d })),
    ...members.map((d) => ({ type: 'member', ...d })),
  ].sort((a, b) => a.start - b.start);

  const groups = [];
  let pending = [];
  let lastEnd = -1;
  for (const t of tokens) {
    if (lastEnd >= 0) {
      const between = src.slice(lastEnd, t.start);
      if (!isContinuous(between)) {
        if (pending.length) groups.push({ decorators: pending, member: null });
        pending = [];
      }
    }
    if (t.type === 'decorator') {
      pending.push(t);
    } else {
      groups.push({ decorators: pending, member: t });
      pending = [];
    }
    lastEnd = t.end;
  }
  if (pending.length) groups.push({ decorators: pending, member: null });
  return groups;
}

let src = '';
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.controller.ts')) acc.push(p);
  }
  return acc;
};

const files = walk(SRC).sort();
const controllers = [];
for (const file of files) {
  src = fs.readFileSync(file, 'utf8');
  const masked = maskComments(src);
  const decorators = scanDecorators(masked);
  const members = scanMembers(masked, decorators);
  const groups = groupTokens(decorators, members);

  // 类级：找 export class 之前的组
  const classIdx = src.search(/export\s+class\s+(\w+)/);
  const className = (/export\s+class\s+(\w+)/.exec(src) || [])[1];
  let classDecorators = [];
  for (const g of groups) {
    if (g.member && g.member.start < classIdx) continue;
    if (!g.member && g.decorators[0].start < classIdx) { classDecorators = g.decorators; }
    else if (g.member && g.member.name === className) classDecorators = g.decorators;
  }
  // 更稳：取包含 @Controller 的组
  for (const g of groups) {
    if (g.decorators.some((d) => d.name === 'Controller')) classDecorators = g.decorators;
  }

  const ctrlArg = (classDecorators.find((d) => d.name === 'Controller') || {}).args || '';
  const basePath = ctrlArg.replace(/['"`]/g, '').trim();
  const classGuards = classDecorators.filter((d) => d.name === 'UseGuards').map((d) => d.args.replace(/\s+/g, ''));
  const classPerms = classDecorators.filter((d) => d.name === 'Permissions').map((d) => d.args);
  const classSuperOnly = classDecorators.some((d) => d.name === 'SuperAdminOnly');

  const routes = [];
  for (const g of groups) {
    if (!g.member) continue;
    const httpDec = g.decorators.filter((d) => HTTP_METHODS.includes(d.name));
    if (!httpDec.length) continue;
    const perms = g.decorators.filter((d) => d.name === 'Permissions')
      .flatMap((d) => d.args.split(',').map((s) => s.trim().replace(/['"`]/g, '')).filter(Boolean));
    const guards = g.decorators.filter((d) => d.name === 'UseGuards').map((d) => d.args.replace(/\s+/g, ''));
    for (const h of httpDec) {
      routes.push({
        http: h.name.toUpperCase(),
        sub: h.args.replace(/['"`]/g, '').trim(),
        method: g.member.name,
        line: src.slice(0, g.member.start).split('\n').length,
        perms: perms.length ? perms : classPerms.flatMap((a) => a.split(',').map((s) => s.trim().replace(/['"`]/g, '')).filter(Boolean)),
        isPublic: g.decorators.some((d) => d.name === 'Public'),
        superAdminOnly: g.decorators.some((d) => d.name === 'SuperAdminOnly') || classSuperOnly,
        guards: [...classGuards, ...guards],
      });
    }
  }
  controllers.push({ file: path.relative(BACKEND, file), className, basePath, classGuards, routes });
}

// 定义中的权限码
const defSrc = fs.readFileSync(path.join(SRC, 'config', 'permission-definitions.ts'), 'utf8');
const defined = new Map();
for (const m of defSrc.matchAll(/code:\s*'([^']+)'[^}]*?type:\s*'([^']+)'/g)) {
  defined.set(m[1], m[2]);
}
const menuCodes = new Set([...defined].filter(([, t]) => t === 'MENU').map(([c]) => c));

const READ_SUFFIX = /:(view|list|detail|tree|statistics|stats|info|config|brands|analysis|dedup)$/;
const all = [];
const issues = [];
for (const c of controllers) {
  for (const r of c.routes) {
    const fullPath = `/${c.basePath}${r.sub ? '/' + r.sub : ''}`.replace(/\/+/g, '/');
    const hasJwt = r.guards.some((g) => g.includes('JwtAuthGuard'));
    const hasPermGuard = r.guards.some((g) => g.includes('PermissionGuard'));
    const rec = {
      file: c.file, path: fullPath, http: r.http, method: r.method, line: r.line,
      perms: r.perms, isPublic: r.isPublic, superAdminOnly: r.superAdminOnly, hasJwt, hasPermGuard,
    };
    all.push(rec);
    if (r.isPublic) { issues.push({ type: 'PUBLIC', ...rec }); continue; }
    if (!hasJwt) issues.push({ type: 'NO_JWT_GUARD', ...rec });
    if (!hasPermGuard) issues.push({ type: 'NO_PERMISSION_GUARD', ...rec });
    else if (!r.perms.length && !r.superAdminOnly) issues.push({ type: 'NO_PERMISSIONS_DECORATOR', ...rec });

    // 写操作复用读权限码
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.http)) {
      for (const p of r.perms) {
        if (menuCodes.has(p) || READ_SUFFIX.test(p)) {
          issues.push({ type: 'WRITE_USES_READ_CODE', ...rec, badCode: p });
        }
      }
    }
    // 未登记权限码（排除动态）
    for (const p of r.perms) {
      if (!p.includes('$') && !p.includes('{') && !defined.has(p)) {
        issues.push({ type: 'UNDEFINED_CODE', ...rec, badCode: p });
      }
    }
  }
}

const out = { controllers: controllers.length, routes: all.length, issues, all };
fs.writeFileSync(path.join(__dirname, 'audit-scan-result.json'), JSON.stringify(out, null, 2));

console.log(`控制器: ${controllers.length}   路由: ${all.length}`);
const byType = {};
for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;
console.log('问题分类:', JSON.stringify(byType));
for (const t of ['NO_PERMISSION_GUARD', 'NO_JWT_GUARD', 'NO_PERMISSIONS_DECORATOR', 'UNDEFINED_CODE', 'WRITE_USES_READ_CODE', 'PUBLIC']) {
  const list = issues.filter((i) => i.type === t);
  if (!list.length) continue;
  console.log(`\n=== ${t} (${list.length}) ===`);
  for (const i of list) console.log(`  ${i.http.padEnd(6)} ${i.path.padEnd(48)} ${i.file}:${i.line}  perms=[${i.perms}]${i.badCode ? ' bad=' + i.badCode : ''}`);
}
