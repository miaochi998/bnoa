import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PERMISSION_DEFINITIONS } from '../src/config/permission-definitions';

// Prisma 7.x 需要使用 @prisma/client/runtime/library 中的驱动
// 这里使用 PrismaService 的方式来初始化
const prisma = new PrismaClient({
  // @ts-expect-error Prisma 7.x 需要 adapter 或 accelerateUrl
  __internal: {
    engine: {
      dirname: process.cwd(),
    },
  },
});

async function main() {
  console.log('开始初始化数据库...');

  // 创建超级管理员角色
  const adminRole = await prisma.role.upsert({
    where: { code: 'super_admin' },
    update: {},
    create: {
      name: '超级管理员',
      code: 'super_admin',
      description: '系统超级管理员，拥有所有权限',
      isSystem: true,
      isActive: true,
    },
  });
  console.log('✅ 超级管理员角色已创建:', adminRole.id);

  // 创建普通用户角色
  const userRole = await prisma.role.upsert({
    where: { code: 'user' },
    update: {},
    create: {
      name: '普通用户',
      code: 'user',
      description: '系统普通用户',
      isSystem: true,
      isActive: true,
    },
  });
  console.log('✅ 普通用户角色已创建:', userRole.id);

  // 创建超级管理员用户
  // ⚠️ 口令不硬编码：仅在需要**新建** admin 用户时，才从 SEED_ADMIN_PASSWORD 读取。
  // 已存在 admin 的环境（生产库 / 已初始化库）无需该变量——因为下方 upsert 的 create 分支不会执行，
  // 这样既避免明文口令进入版本库，又不会让重跑 seed 或容器启动因缺变量而失败。
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
  });
  let hashedPassword: string | undefined;
  if (!existingAdmin) {
    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!seedAdminPassword) {
      throw new Error(
        '缺少 SEED_ADMIN_PASSWORD 环境变量：初始化全新数据库需要管理员初始口令（不再使用代码内置默认值）。' +
          '示例：SEED_ADMIN_PASSWORD=<强口令> npx ts-node prisma/seed.ts',
      );
    }
    hashedPassword = await bcrypt.hash(seedAdminPassword, 10);
  }

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@bnoa.com',
      // create 分支仅在 admin 不存在时执行，此时 hashedPassword 必然已赋值
      password: hashedPassword!,
      name: '系统管理员',
      status: 'ACTIVE',
      userRoles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  });
  console.log('✅ 超级管理员用户已创建:', adminUser.id);

  // 创建细粒度权限结构（与 permission-definitions 保持一致，共 232 条）
  const permissionGroups = PERMISSION_DEFINITIONS;

  // 先创建所有权限（不设置parentId）
  const permissionMap = new Map<string, string>();
  for (const perm of permissionGroups) {
    const created = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, description: perm.description, type: perm.type },
      create: { name: perm.name, code: perm.code, type: perm.type, description: perm.description },
    });
    permissionMap.set(perm.code, created.id);
  }

  // 更新父级关系
  for (const perm of permissionGroups) {
    if (perm.parentCode) {
      const parentId = permissionMap.get(perm.parentCode);
      const permId = permissionMap.get(perm.code);
      if (parentId && permId) {
        await prisma.permission.update({
          where: { id: permId },
          data: { parentId },
        });
      }
    }
  }
  console.log('✅ 细粒度权限已创建');

  // 为超级管理员角色分配所有权限
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }
  console.log('✅ 超级管理员权限已分配');

  // 创建系统配置
  const systemConfigs = [
    // 常规设置 (system)
    { key: 'site.name', value: 'BNOA办公自动化系统', category: 'system', type: 'STRING', description: '系统名称', isSystem: true },
    { key: 'site.logo', value: '/logo.png', category: 'system', type: 'STRING', description: '系统Logo', isSystem: true },
    { key: 'site.favicon', value: '/favicon.ico', category: 'system', type: 'STRING', description: '网站图标', isSystem: true },
    { key: 'site.copyright', value: '© 2026 BNOA. All rights reserved.', category: 'system', type: 'STRING', description: '版权信息', isSystem: true },
    { key: 'site.icp', value: '', category: 'system', type: 'STRING', description: 'ICP备案号', isSystem: false },
    
    // 安全配置 (security)
    { key: 'security.loginMaxAttempts', value: '5', category: 'security', type: 'NUMBER', description: '最大登录尝试次数', isSystem: true },
    { key: 'security.lockoutDuration', value: '1800', category: 'security', type: 'NUMBER', description: '账户锁定时长(秒)', isSystem: true },
    { key: 'security.sessionTimeout', value: '3600', category: 'security', type: 'NUMBER', description: '会话超时时间(秒)', isSystem: true },
    { key: 'security.passwordMinLength', value: '8', category: 'security', type: 'NUMBER', description: '密码最小长度', isSystem: true },
    { key: 'security.passwordRequireUppercase', value: 'true', category: 'security', type: 'BOOLEAN', description: '密码需要大写字母', isSystem: true },
    { key: 'security.passwordRequireNumber', value: 'true', category: 'security', type: 'BOOLEAN', description: '密码需要数字', isSystem: true },
    { key: 'security.twoFactorEnabled', value: 'false', category: 'security', type: 'BOOLEAN', description: '启用双因素认证', isSystem: true },
    
    // 邮件配置 (email)
    { key: 'email.smtpHost', value: '', category: 'email', type: 'STRING', description: 'SMTP服务器地址', isSystem: true },
    { key: 'email.smtpPort', value: '587', category: 'email', type: 'NUMBER', description: 'SMTP端口', isSystem: true },
    { key: 'email.smtpUser', value: '', category: 'email', type: 'STRING', description: 'SMTP用户名', isSystem: true },
    { key: 'email.smtpPassword', value: '', category: 'email', type: 'STRING', description: 'SMTP密码', isSystem: true },
    { key: 'email.senderName', value: 'BNOA系统', category: 'email', type: 'STRING', description: '发件人名称', isSystem: true },
    { key: 'email.senderEmail', value: '', category: 'email', type: 'STRING', description: '发件人邮箱', isSystem: true },
    { key: 'email.enabled', value: 'false', category: 'email', type: 'BOOLEAN', description: '启用邮件功能', isSystem: true },
    
    // 上传配置和存储配置已迁移到文件管理设置页面(/settings/file-storage)
    // 自动压缩开关已迁移到上传面板中

    // 通知配置 (notification)
    { key: 'notification.retention.days', value: '90', category: 'notification', type: 'NUMBER', description: '通知保留天数', isSystem: true },
    { key: 'notification.page.size', value: '20', category: 'notification', type: 'NUMBER', description: '通知每页显示数量', isSystem: true },
    { key: 'notification.email.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '高优先级通知邮件联动开关', isSystem: true },
    { key: 'notification.type.system_announce.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '系统公告通知开关', isSystem: true },
    { key: 'notification.type.system_maintenance.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '系统维护通知开关', isSystem: true },
    { key: 'notification.type.system_security.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '安全提醒通知开关', isSystem: true },
    { key: 'notification.type.approval_pending.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '待审批通知开关', isSystem: true },
    { key: 'notification.type.approval_result.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '审批结果通知开关', isSystem: true },
    { key: 'notification.type.approval_cc.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '审批抄送通知开关', isSystem: true },
    { key: 'notification.type.file_shared.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '文件共享通知开关', isSystem: true },
    { key: 'notification.type.file_comment.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '文件评论通知开关', isSystem: true },
    { key: 'notification.type.file_upload_complete.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '上传完成通知开关', isSystem: true },
    { key: 'notification.type.task_assigned.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '任务分配通知开关', isSystem: true },
    { key: 'notification.type.task_deadline.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '任务截止通知开关', isSystem: true },
    { key: 'notification.type.task_completed.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '任务完成通知开关', isSystem: true },
    { key: 'notification.type.mention.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '@提及通知开关', isSystem: true },
    { key: 'notification.type.comment_reply.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '回复通知开关', isSystem: true },
    { key: 'notification.type.like.enabled', value: 'true', category: 'notification', type: 'BOOLEAN', description: '点赞通知开关', isSystem: true },

    // 头像配置 (avatar)
    { key: 'avatar.storageType', value: 'rustfs', category: 'avatar', type: 'STRING', description: '头像存储位置(rustfs/local)', isSystem: true },
    { key: 'avatar.maxSize', value: '2', category: 'avatar', type: 'NUMBER', description: '头像最大文件大小(MB)', isSystem: true },
    { key: 'avatar.size', value: '200', category: 'avatar', type: 'NUMBER', description: '头像输出尺寸(px)', isSystem: true },
    { key: 'avatar.allowedFormats', value: 'jpg,jpeg,png,webp', category: 'avatar', type: 'STRING', description: '允许的头像格式', isSystem: true },
    { key: 'avatar.autoCompress', value: 'true', category: 'avatar', type: 'BOOLEAN', description: '自动压缩头像', isSystem: true },
    { key: 'avatar.compressQuality', value: '80', category: 'avatar', type: 'NUMBER', description: '压缩质量(0-100)', isSystem: true },
    { key: 'avatar.defaultAvatar', value: '', category: 'avatar', type: 'STRING', description: '默认头像URL', isSystem: true },
    { key: 'avatar.realFolderId', value: '', category: 'avatar', type: 'STRING', description: '头像存储文件夹ID', isSystem: true },
  ];

  for (const config of systemConfigs) {
    await prisma.config.upsert({
      where: { key: config.key },
      update: {
        description: config.description,
      },
      create: {
        key: config.key,
        value: config.value,
        type: config.type,
        category: config.category,
        description: config.description,
        isSystem: config.isSystem,
      },
    });
  }
  console.log('✅ 系统配置已创建');

  // 创建数据字典
  const dictItems = [
    // 用户状态
    { typeCode: 'user_status', typeName: '用户状态', itemCode: 'ACTIVE', itemName: '正常', itemValue: 'ACTIVE', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'user_status', typeName: '用户状态', itemCode: 'INACTIVE', itemName: '未激活', itemValue: 'INACTIVE', color: '#eab308', sortOrder: 1 },
    { typeCode: 'user_status', typeName: '用户状态', itemCode: 'SUSPENDED', itemName: '已禁用', itemValue: 'SUSPENDED', color: '#ef4444', sortOrder: 2 },
    { typeCode: 'user_status', typeName: '用户状态', itemCode: 'DELETED', itemName: '已删除', itemValue: 'DELETED', color: '#6b7280', sortOrder: 3 },
    // 权限类型
    { typeCode: 'permission_type', typeName: '权限类型', itemCode: 'MENU', itemName: '菜单', itemValue: 'MENU', color: '#409fff', sortOrder: 0 },
    { typeCode: 'permission_type', typeName: '权限类型', itemCode: 'BUTTON', itemName: '按钮', itemValue: 'BUTTON', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'permission_type', typeName: '权限类型', itemCode: 'API', itemName: '接口', itemValue: 'API', color: '#eab308', sortOrder: 2 },
    { typeCode: 'permission_type', typeName: '权限类型', itemCode: 'DATA', itemName: '数据', itemValue: 'DATA', color: '#3b82f6', sortOrder: 3 },
    // 安全事件类型
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'LOGIN_FAILED', itemName: '登录失败', itemValue: 'LOGIN_FAILED', color: '#eab308', sortOrder: 0 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'SUSPICIOUS_ACTIVITY', itemName: '可疑活动', itemValue: 'SUSPICIOUS_ACTIVITY', color: '#f97316', sortOrder: 1 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'DATA_BREACH', itemName: '数据泄露', itemValue: 'DATA_BREACH', color: '#dc2626', sortOrder: 2 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'BRUTE_FORCE', itemName: '暴力破解', itemValue: 'BRUTE_FORCE', color: '#ef4444', sortOrder: 3 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'UNAUTHORIZED_ACCESS', itemName: '未授权访问', itemValue: 'UNAUTHORIZED_ACCESS', color: '#ef4444', sortOrder: 4 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'VIRUS_DETECTED', itemName: '病毒检测', itemValue: 'VIRUS_DETECTED', color: '#dc2626', sortOrder: 5 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'FILE_QUARANTINED', itemName: '文件隔离', itemValue: 'FILE_QUARANTINED', color: '#f97316', sortOrder: 6 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'FILE_RELEASED', itemName: '文件释放', itemValue: 'FILE_RELEASED', color: '#22c55e', sortOrder: 7 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'LIMIT_EXCEEDED', itemName: '超出限制', itemValue: 'LIMIT_EXCEEDED', color: '#eab308', sortOrder: 8 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'UPLOAD_BLOCKED', itemName: '上传拦截', itemValue: 'UPLOAD_BLOCKED', color: '#f97316', sortOrder: 9 },
    { typeCode: 'security_event_type', typeName: '安全事件类型', itemCode: 'FILE_ISOLATED', itemName: '文件删除', itemValue: 'FILE_ISOLATED', color: '#ef4444', sortOrder: 10 },
    // 安全事件级别
    { typeCode: 'security_event_severity', typeName: '安全事件级别', itemCode: 'INFO', itemName: '信息', itemValue: 'INFO', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'security_event_severity', typeName: '安全事件级别', itemCode: 'LOW', itemName: '低', itemValue: 'LOW', color: '#6b7280', sortOrder: 1 },
    { typeCode: 'security_event_severity', typeName: '安全事件级别', itemCode: 'WARNING', itemName: '警告', itemValue: 'WARNING', color: '#eab308', sortOrder: 2 },
    { typeCode: 'security_event_severity', typeName: '安全事件级别', itemCode: 'MEDIUM', itemName: '中', itemValue: 'MEDIUM', color: '#eab308', sortOrder: 3 },
    { typeCode: 'security_event_severity', typeName: '安全事件级别', itemCode: 'HIGH', itemName: '高', itemValue: 'HIGH', color: '#409fff', sortOrder: 4 },
    { typeCode: 'security_event_severity', typeName: '安全事件级别', itemCode: 'CRITICAL', itemName: '严重', itemValue: 'CRITICAL', color: '#ef4444', sortOrder: 5 },
    // 安全事件状态
    { typeCode: 'security_event_status', typeName: '安全事件状态', itemCode: 'NEW', itemName: '新建', itemValue: 'NEW', color: '#ef4444', sortOrder: 0 },
    { typeCode: 'security_event_status', typeName: '安全事件状态', itemCode: 'INVESTIGATING', itemName: '处理中', itemValue: 'INVESTIGATING', color: '#409fff', sortOrder: 1 },
    { typeCode: 'security_event_status', typeName: '安全事件状态', itemCode: 'RESOLVED', itemName: '已解决', itemValue: 'RESOLVED', color: '#6b7280', sortOrder: 2 },
    { typeCode: 'security_event_status', typeName: '安全事件状态', itemCode: 'FALSE_POSITIVE', itemName: '误报', itemValue: 'FALSE_POSITIVE', color: '#6b7280', sortOrder: 3 },
    // 扫描文件状态
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'PENDING', itemName: '等待扫描', itemValue: 'PENDING', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'ACTIVE', itemName: '正常', itemValue: 'ACTIVE', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'CLEAN', itemName: '安全', itemValue: 'CLEAN', color: '#22c55e', sortOrder: 2 },
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'THREAT_DETECTED', itemName: '待审核', itemValue: 'THREAT_DETECTED', color: '#ef4444', sortOrder: 3 },
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'VERIFIED_SAFE', itemName: '已验证安全', itemValue: 'VERIFIED_SAFE', color: '#22c55e', sortOrder: 4 },
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'QUARANTINED', itemName: '已隔离', itemValue: 'QUARANTINED', color: '#f97316', sortOrder: 5 },
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'SKIPPED', itemName: '跳过', itemValue: 'SKIPPED', color: '#6b7280', sortOrder: 6 },
    { typeCode: 'scan_file_status', typeName: '扫描文件状态', itemCode: 'FAILED', itemName: '扫描失败', itemValue: 'FAILED', color: '#6b7280', sortOrder: 7 },
    // 审计模块
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'auth', itemName: '认证', itemValue: 'auth', color: '#409fff', sortOrder: 0 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'user', itemName: '用户', itemValue: 'user', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'role', itemName: '角色', itemValue: 'role', color: '#eab308', sortOrder: 2 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'permission', itemName: '权限', itemValue: 'permission', color: '#3b82f6', sortOrder: 3 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'file', itemName: '文件', itemValue: 'file', color: '#f97316', sortOrder: 4 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'folder', itemName: '文件夹', itemValue: 'folder', color: '#8b5cf6', sortOrder: 5 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'config', itemName: '配置', itemValue: 'config', color: '#6b7280', sortOrder: 6 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'system', itemName: '系统', itemValue: 'system', color: '#ef4444', sortOrder: 7 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'UPLOAD_SECURITY', itemName: '安全扫描', itemValue: 'UPLOAD_SECURITY', color: '#dc2626', sortOrder: 8 },
    { typeCode: 'audit_module', typeName: '审计模块', itemCode: 'FILE', itemName: '文件', itemValue: 'FILE', color: '#f97316', sortOrder: 9 },
    // 审计操作
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'login', itemName: '登录', itemValue: 'login', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'logout', itemName: '登出', itemValue: 'logout', color: '#6b7280', sortOrder: 1 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'create', itemName: '创建', itemValue: 'create', color: '#3b82f6', sortOrder: 2 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'update', itemName: '更新', itemValue: 'update', color: '#eab308', sortOrder: 3 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'delete', itemName: '删除', itemValue: 'delete', color: '#ef4444', sortOrder: 4 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'view', itemName: '查看', itemValue: 'view', color: '#6b7280', sortOrder: 5 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'upload', itemName: '上传', itemValue: 'upload', color: '#409fff', sortOrder: 6 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'download', itemName: '下载', itemValue: 'download', color: '#8b5cf6', sortOrder: 7 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'SECURITY_VIRUS_DETECTED', itemName: '病毒检测', itemValue: 'SECURITY_VIRUS_DETECTED', color: '#dc2626', sortOrder: 8 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'SECURITY_FILE_RELEASED', itemName: '文件释放', itemValue: 'SECURITY_FILE_RELEASED', color: '#22c55e', sortOrder: 9 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'SECURITY_FILE_QUARANTINED', itemName: '文件隔离', itemValue: 'SECURITY_FILE_QUARANTINED', color: '#f97316', sortOrder: 10 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'SECURITY_LIMIT_EXCEEDED', itemName: '超出限制', itemValue: 'SECURITY_LIMIT_EXCEEDED', color: '#eab308', sortOrder: 11 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'SECURITY_UPLOAD_BLOCKED', itemName: '上传拦截', itemValue: 'SECURITY_UPLOAD_BLOCKED', color: '#f97316', sortOrder: 12 },
    { typeCode: 'audit_action', typeName: '审计操作', itemCode: 'SECURITY_FILE_ISOLATED', itemName: '文件删除', itemValue: 'SECURITY_FILE_ISOLATED', color: '#ef4444', sortOrder: 13 },
    // 文件类别
    { typeCode: 'file_category', typeName: '文件类别', itemCode: 'IMAGE', itemName: '图片', itemValue: 'IMAGE', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'file_category', typeName: '文件类别', itemCode: 'VIDEO', itemName: '视频', itemValue: 'VIDEO', color: '#8b5cf6', sortOrder: 1 },
    { typeCode: 'file_category', typeName: '文件类别', itemCode: 'AUDIO', itemName: '音频', itemValue: 'AUDIO', color: '#ec4899', sortOrder: 2 },
    { typeCode: 'file_category', typeName: '文件类别', itemCode: 'DOCUMENT', itemName: '文档', itemValue: 'DOCUMENT', color: '#3b82f6', sortOrder: 3 },
    { typeCode: 'file_category', typeName: '文件类别', itemCode: 'ARCHIVE', itemName: '压缩包', itemValue: 'ARCHIVE', color: '#eab308', sortOrder: 4 },
    { typeCode: 'file_category', typeName: '文件类别', itemCode: 'CODE', itemName: '代码', itemValue: 'CODE', color: '#f97316', sortOrder: 5 },
    { typeCode: 'file_category', typeName: '文件类别', itemCode: 'OTHER', itemName: '其他', itemValue: 'OTHER', color: '#6b7280', sortOrder: 6 },
    // 审计状态
    { typeCode: 'audit_status', typeName: '审计状态', itemCode: 'SUCCESS', itemName: '成功', itemValue: 'SUCCESS', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'audit_status', typeName: '审计状态', itemCode: 'FAILURE', itemName: '失败', itemValue: 'FAILURE', color: '#ef4444', sortOrder: 1 },
    // 邮件日志状态
    { typeCode: 'email_log_status', typeName: '邮件日志状态', itemCode: 'PENDING', itemName: '待发送', itemValue: 'PENDING', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'email_log_status', typeName: '邮件日志状态', itemCode: 'SENDING', itemName: '发送中', itemValue: 'SENDING', color: '#409fff', sortOrder: 1 },
    { typeCode: 'email_log_status', typeName: '邮件日志状态', itemCode: 'SUCCESS', itemName: '发送成功', itemValue: 'SUCCESS', color: '#22c55e', sortOrder: 2 },
    { typeCode: 'email_log_status', typeName: '邮件日志状态', itemCode: 'FAILED', itemName: '发送失败', itemValue: 'FAILED', color: '#ef4444', sortOrder: 3 },
    // 邮件分类
    { typeCode: 'email_category', typeName: '邮件分类', itemCode: 'verification', itemName: '验证类', itemValue: 'verification', color: '#409fff', sortOrder: 0 },
    { typeCode: 'email_category', typeName: '邮件分类', itemCode: 'notification', itemName: '通知类', itemValue: 'notification', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'email_category', typeName: '邮件分类', itemCode: 'alert', itemName: '告警类', itemValue: 'alert', color: '#ef4444', sortOrder: 2 },
    { typeCode: 'email_category', typeName: '邮件分类', itemCode: 'system', itemName: '系统类', itemValue: 'system', color: '#6b7280', sortOrder: 3 },
    // 邮件模板类型
    { typeCode: 'email_template', typeName: '邮件模板', itemCode: 'verification-code', itemName: '验证码邮件', itemValue: 'verification-code', color: '#409fff', sortOrder: 0 },
    { typeCode: 'email_template', typeName: '邮件模板', itemCode: 'password-changed', itemName: '密码修改通知', itemValue: 'password-changed', color: '#eab308', sortOrder: 1 },
    { typeCode: 'email_template', typeName: '邮件模板', itemCode: 'welcome', itemName: '欢迎邮件', itemValue: 'welcome', color: '#22c55e', sortOrder: 2 },
    { typeCode: 'email_template', typeName: '邮件模板', itemCode: 'security-alert', itemName: '安全告警', itemValue: 'security-alert', color: '#ef4444', sortOrder: 3 },
    { typeCode: 'email_template', typeName: '邮件模板', itemCode: 'file-shared', itemName: '文件分享通知', itemValue: 'file-shared', color: '#8b5cf6', sortOrder: 4 },
    { typeCode: 'email_template', typeName: '邮件模板', itemCode: 'login-alert', itemName: '异地登录告警', itemValue: 'login-alert', color: '#f97316', sortOrder: 5 },
    // 验证码用途
    { typeCode: 'email_code_purpose', typeName: '验证码用途', itemCode: 'password_reset', itemName: '密码重置', itemValue: 'password_reset', color: '#409fff', sortOrder: 0 },
    { typeCode: 'email_code_purpose', typeName: '验证码用途', itemCode: 'email_verify', itemName: '邮箱验证', itemValue: 'email_verify', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'email_code_purpose', typeName: '验证码用途', itemCode: 'bind_email', itemName: '绑定邮箱', itemValue: 'bind_email', color: '#8b5cf6', sortOrder: 2 },
    // 邮件加密方式
    { typeCode: 'email_encryption', typeName: '邮件加密方式', itemCode: 'none', itemName: '无加密', itemValue: 'none', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'email_encryption', typeName: '邮件加密方式', itemCode: 'ssl', itemName: 'SSL', itemValue: 'ssl', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'email_encryption', typeName: '邮件加密方式', itemCode: 'tls', itemName: 'TLS', itemValue: 'tls', color: '#409fff', sortOrder: 2 },
    // 邮件服务商
    { typeCode: 'email_provider', typeName: '邮件服务商', itemCode: 'qq', itemName: 'QQ邮箱', itemValue: 'qq', color: '#409fff', sortOrder: 0 },
    { typeCode: 'email_provider', typeName: '邮件服务商', itemCode: '163', itemName: '网易邮箱', itemValue: '163', color: '#ef4444', sortOrder: 1 },
    { typeCode: 'email_provider', typeName: '邮件服务商', itemCode: 'outlook', itemName: 'Outlook', itemValue: 'outlook', color: '#3b82f6', sortOrder: 2 },
    { typeCode: 'email_provider', typeName: '邮件服务商', itemCode: 'custom', itemName: '自定义', itemValue: 'custom', color: '#6b7280', sortOrder: 3 },
    // 通知类型
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'system_announce', itemName: '系统公告', itemValue: 'system_announce', color: '#409fff', sortOrder: 0 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'system_maintenance', itemName: '系统维护', itemValue: 'system_maintenance', color: '#f97316', sortOrder: 1 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'system_security', itemName: '安全提醒', itemValue: 'system_security', color: '#ef4444', sortOrder: 2 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'approval_pending', itemName: '待审批', itemValue: 'approval_pending', color: '#eab308', sortOrder: 3 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'approval_result', itemName: '审批结果', itemValue: 'approval_result', color: '#22c55e', sortOrder: 4 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'approval_cc', itemName: '审批抄送', itemValue: 'approval_cc', color: '#3b82f6', sortOrder: 5 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'file_shared', itemName: '文件共享', itemValue: 'file_shared', color: '#8b5cf6', sortOrder: 6 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'file_comment', itemName: '文件评论', itemValue: 'file_comment', color: '#ec4899', sortOrder: 7 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'file_upload_complete', itemName: '上传完成', itemValue: 'file_upload_complete', color: '#22c55e', sortOrder: 8 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'task_assigned', itemName: '任务分配', itemValue: 'task_assigned', color: '#409fff', sortOrder: 9 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'task_deadline', itemName: '任务截止', itemValue: 'task_deadline', color: '#ef4444', sortOrder: 10 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'task_completed', itemName: '任务完成', itemValue: 'task_completed', color: '#22c55e', sortOrder: 11 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'mention', itemName: '@提及', itemValue: 'mention', color: '#3b82f6', sortOrder: 12 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'comment_reply', itemName: '回复通知', itemValue: 'comment_reply', color: '#8b5cf6', sortOrder: 13 },
    { typeCode: 'notification_type', typeName: '通知类型', itemCode: 'like', itemName: '点赞', itemValue: 'like', color: '#ec4899', sortOrder: 14 },
    // 通知优先级
    { typeCode: 'notification_priority', typeName: '通知优先级', itemCode: 'LOW', itemName: '低', itemValue: 'LOW', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'notification_priority', typeName: '通知优先级', itemCode: 'NORMAL', itemName: '普通', itemValue: 'NORMAL', color: '#409fff', sortOrder: 1 },
    { typeCode: 'notification_priority', typeName: '通知优先级', itemCode: 'HIGH', itemName: '重要', itemValue: 'HIGH', color: '#f97316', sortOrder: 2 },
    { typeCode: 'notification_priority', typeName: '通知优先级', itemCode: 'URGENT', itemName: '紧急', itemValue: 'URGENT', color: '#ef4444', sortOrder: 3 },
    // 通知分类
    { typeCode: 'notification_category', typeName: '通知分类', itemCode: 'system', itemName: '系统通知', itemValue: 'system', color: '#409fff', sortOrder: 0 },
    { typeCode: 'notification_category', typeName: '通知分类', itemCode: 'approval', itemName: '审批通知', itemValue: 'approval', color: '#eab308', sortOrder: 1 },
    { typeCode: 'notification_category', typeName: '通知分类', itemCode: 'file', itemName: '文件通知', itemValue: 'file', color: '#8b5cf6', sortOrder: 2 },
    { typeCode: 'notification_category', typeName: '通知分类', itemCode: 'task', itemName: '任务通知', itemValue: 'task', color: '#22c55e', sortOrder: 3 },
    { typeCode: 'notification_category', typeName: '通知分类', itemCode: 'interaction', itemName: '互动通知', itemValue: 'interaction', color: '#ec4899', sortOrder: 4 },
    // 广播状态
    { typeCode: 'broadcast_status', typeName: '广播状态', itemCode: 'PENDING', itemName: '待发送', itemValue: 'PENDING', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'broadcast_status', typeName: '广播状态', itemCode: 'SENDING', itemName: '发送中', itemValue: 'SENDING', color: '#409fff', sortOrder: 1 },
    { typeCode: 'broadcast_status', typeName: '广播状态', itemCode: 'SENT', itemName: '已发送', itemValue: 'SENT', color: '#22c55e', sortOrder: 2 },
    { typeCode: 'broadcast_status', typeName: '广播状态', itemCode: 'CANCELLED', itemName: '已取消', itemValue: 'CANCELLED', color: '#ef4444', sortOrder: 3 },
    // 导出任务状态
    { typeCode: 'export_task_status', typeName: '导出任务状态', itemCode: 'pending', itemName: '待处理', itemValue: 'pending', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'export_task_status', typeName: '导出任务状态', itemCode: 'processing', itemName: '处理中', itemValue: 'processing', color: '#409fff', sortOrder: 1 },
    { typeCode: 'export_task_status', typeName: '导出任务状态', itemCode: 'completed', itemName: '已完成', itemValue: 'completed', color: '#22c55e', sortOrder: 2 },
    { typeCode: 'export_task_status', typeName: '导出任务状态', itemCode: 'failed', itemName: '失败', itemValue: 'failed', color: '#ef4444', sortOrder: 3 },
    // 导出任务类型
    { typeCode: 'export_task_type', typeName: '导出任务类型', itemCode: 'export', itemName: '导出', itemValue: 'export', color: '#409fff', sortOrder: 0 },
    { typeCode: 'export_task_type', typeName: '导出任务类型', itemCode: 'import', itemName: '导入', itemValue: 'import', color: '#22c55e', sortOrder: 1 },
    // 导出格式
    { typeCode: 'export_format', typeName: '导出格式', itemCode: 'xlsx', itemName: 'Excel', itemValue: 'xlsx', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'export_format', typeName: '导出格式', itemCode: 'csv', itemName: 'CSV', itemValue: 'csv', color: '#409fff', sortOrder: 1 },
    { typeCode: 'export_format', typeName: '导出格式', itemCode: 'json', itemName: 'JSON', itemValue: 'json', color: '#eab308', sortOrder: 2 },
    // ==================== 业务模块字典 ====================
    // 计价方式
    { typeCode: 'pricing_mode', typeName: '计价方式', itemCode: 'UNIT', itemName: '按件', itemValue: 'UNIT', color: '#409fff', sortOrder: 0 },
    { typeCode: 'pricing_mode', typeName: '计价方式', itemCode: 'VOLUME', itemName: '按体积', itemValue: 'VOLUME', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'pricing_mode', typeName: '计价方式', itemCode: 'WEIGHT', itemName: '按重量', itemValue: 'WEIGHT', color: '#eab308', sortOrder: 2 },
    { typeCode: 'pricing_mode', typeName: '计价方式', itemCode: 'AREA', itemName: '按面积', itemValue: 'AREA', color: '#8b5cf6', sortOrder: 3 },
    { typeCode: 'pricing_mode', typeName: '计价方式', itemCode: 'LENGTH', itemName: '按长度', itemValue: 'LENGTH', color: '#f97316', sortOrder: 4 },
    // 产品状态
    { typeCode: 'product_status', typeName: '产品状态', itemCode: 'ON_SALE', itemName: '在售', itemValue: 'ON_SALE', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'product_status', typeName: '产品状态', itemCode: 'DISCONTINUED', itemName: '停售', itemValue: 'DISCONTINUED', color: '#ef4444', sortOrder: 1 },
    { typeCode: 'product_status', typeName: '产品状态', itemCode: 'DEVELOPING', itemName: '开发中', itemValue: 'DEVELOPING', color: '#eab308', sortOrder: 2 },
    // 耗材分类
    { typeCode: 'consumable_category', typeName: '耗材分类', itemCode: 'PACKAGING_BAG', itemName: '包装袋', itemValue: 'PACKAGING_BAG', color: '#409fff', sortOrder: 0 },
    { typeCode: 'consumable_category', typeName: '耗材分类', itemCode: 'EXPRESS_BAG', itemName: '快递袋', itemValue: 'EXPRESS_BAG', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'consumable_category', typeName: '耗材分类', itemCode: 'CARTON', itemName: '纸箱', itemValue: 'CARTON', color: '#eab308', sortOrder: 2 },
    { typeCode: 'consumable_category', typeName: '耗材分类', itemCode: 'TAPE', itemName: '胶带', itemValue: 'TAPE', color: '#f97316', sortOrder: 3 },
    { typeCode: 'consumable_category', typeName: '耗材分类', itemCode: 'LABEL', itemName: '标签', itemValue: 'LABEL', color: '#8b5cf6', sortOrder: 4 },
    { typeCode: 'consumable_category', typeName: '耗材分类', itemCode: 'OTHER', itemName: '其他', itemValue: 'OTHER', color: '#6b7280', sortOrder: 5 },
    // 耗材状态
    { typeCode: 'consumable_status', typeName: '耗材状态', itemCode: 'ENABLED', itemName: '启用', itemValue: 'ENABLED', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'consumable_status', typeName: '耗材状态', itemCode: 'DISABLED', itemName: '禁用', itemValue: 'DISABLED', color: '#ef4444', sortOrder: 1 },
    // 达人状态
    { typeCode: 'talent_status', typeName: '达人状态', itemCode: 'PENDING', itemName: '待沟通', itemValue: 'PENDING', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'talent_status', typeName: '达人状态', itemCode: 'COMMUNICATING', itemName: '沟通中', itemValue: 'COMMUNICATING', color: '#409fff', sortOrder: 1 },
    { typeCode: 'talent_status', typeName: '达人状态', itemCode: 'SAMPLE_SENT', itemName: '已寄样', itemValue: 'SAMPLE_SENT', color: '#eab308', sortOrder: 2 },
    { typeCode: 'talent_status', typeName: '达人状态', itemCode: 'COOPERATING', itemName: '合作中', itemValue: 'COOPERATING', color: '#22c55e', sortOrder: 3 },
    { typeCode: 'talent_status', typeName: '达人状态', itemCode: 'ORDER_PLACED', itemName: '已下单', itemValue: 'ORDER_PLACED', color: '#8b5cf6', sortOrder: 4 },
    { typeCode: 'talent_status', typeName: '达人状态', itemCode: 'REJECTED', itemName: '已拒绝', itemValue: 'REJECTED', color: '#f97316', sortOrder: 5 },
    { typeCode: 'talent_status', typeName: '达人状态', itemCode: 'BLACKLISTED', itemName: '黑名单', itemValue: 'BLACKLISTED', color: '#ef4444', sortOrder: 6 },
    // 达人等级
    { typeCode: 'talent_level', typeName: '达人等级', itemCode: 'LV1', itemName: 'LV1', itemValue: 'LV1', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'talent_level', typeName: '达人等级', itemCode: 'LV2', itemName: 'LV2', itemValue: 'LV2', color: '#409fff', sortOrder: 1 },
    { typeCode: 'talent_level', typeName: '达人等级', itemCode: 'LV3', itemName: 'LV3', itemValue: 'LV3', color: '#22c55e', sortOrder: 2 },
    { typeCode: 'talent_level', typeName: '达人等级', itemCode: 'LV4', itemName: 'LV4', itemValue: 'LV4', color: '#eab308', sortOrder: 3 },
    { typeCode: 'talent_level', typeName: '达人等级', itemCode: 'LV5', itemName: 'LV5', itemValue: 'LV5', color: '#f97316', sortOrder: 4 },
    // 工费计费方式
    { typeCode: 'labor_billing_type', typeName: '计费方式', itemCode: 'PER_PIECE', itemName: '按件', itemValue: 'PER_PIECE', color: '#409fff', sortOrder: 0 },
    { typeCode: 'labor_billing_type', typeName: '计费方式', itemCode: 'PER_WEIGHT', itemName: '按重量', itemValue: 'PER_WEIGHT', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'labor_billing_type', typeName: '计费方式', itemCode: 'PER_PACKAGE', itemName: '按包', itemValue: 'PER_PACKAGE', color: '#eab308', sortOrder: 2 },
    // 链接状态
    { typeCode: 'product_link_status', typeName: '链接状态', itemCode: 'DRAFT', itemName: '草稿', itemValue: 'DRAFT', color: '#6b7280', sortOrder: 0 },
    { typeCode: 'product_link_status', typeName: '链接状态', itemCode: 'ON_SALE', itemName: '在售', itemValue: 'ON_SALE', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'product_link_status', typeName: '链接状态', itemCode: 'OFF_SALE', itemName: '已下架', itemValue: 'OFF_SALE', color: '#ef4444', sortOrder: 2 },
    // 成品状态
    { typeCode: 'finished_product_status', typeName: '成品状态', itemCode: 'ENABLED', itemName: '启用', itemValue: 'ENABLED', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'finished_product_status', typeName: '成品状态', itemCode: 'DISABLED', itemName: '禁用', itemValue: 'DISABLED', color: '#ef4444', sortOrder: 1 },
    // 包装类型
    { typeCode: 'package_type', typeName: '包装类型', itemCode: 'BAG', itemName: '袋装', itemValue: 'BAG', color: '#409fff', sortOrder: 0 },
    { typeCode: 'package_type', typeName: '包装类型', itemCode: 'BOX', itemName: '盒装', itemValue: 'BOX', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'package_type', typeName: '包装类型', itemCode: 'INDIVIDUAL', itemName: '单件', itemValue: 'INDIVIDUAL', color: '#eab308', sortOrder: 2 },
    // SKU类型
    { typeCode: 'sku_type', typeName: 'SKU类型', itemCode: 'SINGLE', itemName: '单品', itemValue: 'SINGLE', color: '#409fff', sortOrder: 0 },
    { typeCode: 'sku_type', typeName: 'SKU类型', itemCode: 'COMBO', itemName: '组合', itemValue: 'COMBO', color: '#22c55e', sortOrder: 1 },
    // SKU状态
    { typeCode: 'sku_status', typeName: 'SKU状态', itemCode: 'ENABLED', itemName: '启用', itemValue: 'ENABLED', color: '#22c55e', sortOrder: 0 },
    { typeCode: 'sku_status', typeName: 'SKU状态', itemCode: 'DISABLED', itemName: '禁用', itemValue: 'DISABLED', color: '#ef4444', sortOrder: 1 },
    // 价格单位
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_CUBIC_METER', itemName: '每立方米', itemValue: 'PER_CUBIC_METER', color: '#409fff', sortOrder: 0 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_KG', itemName: '每千克', itemValue: 'PER_KG', color: '#22c55e', sortOrder: 1 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_PIECE', itemName: '每件', itemValue: 'PER_PIECE', color: '#eab308', sortOrder: 2 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_LITER', itemName: '每升', itemValue: 'PER_LITER', color: '#8b5cf6', sortOrder: 3 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_ML', itemName: '每毫升', itemValue: 'PER_ML', color: '#ec4899', sortOrder: 4 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_SQUARE_METER', itemName: '每平方米', itemValue: 'PER_SQUARE_METER', color: '#3b82f6', sortOrder: 5 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_METER', itemName: '每米', itemValue: 'PER_METER', color: '#f97316', sortOrder: 6 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_GRAM', itemName: '每克', itemValue: 'PER_GRAM', color: '#6b7280', sortOrder: 7 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_BOTTLE', itemName: '每瓶', itemValue: 'PER_BOTTLE', color: '#22c55e', sortOrder: 8 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_BOX', itemName: '每箱', itemValue: 'PER_BOX', color: '#409fff', sortOrder: 9 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_CAN', itemName: '每罐', itemValue: 'PER_CAN', color: '#eab308', sortOrder: 10 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_CASE', itemName: '每箱(case)', itemValue: 'PER_CASE', color: '#8b5cf6', sortOrder: 11 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_STRIP', itemName: '每条', itemValue: 'PER_STRIP', color: '#f97316', sortOrder: 12 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_SET', itemName: '每套', itemValue: 'PER_SET', color: '#3b82f6', sortOrder: 13 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_ROLL', itemName: '每卷', itemValue: 'PER_ROLL', color: '#ec4899', sortOrder: 14 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_BAG', itemName: '每袋', itemValue: 'PER_BAG', color: '#6b7280', sortOrder: 15 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_SHEET', itemName: '每张', itemValue: 'PER_SHEET', color: '#22c55e', sortOrder: 16 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_PAIR', itemName: '每对', itemValue: 'PER_PAIR', color: '#409fff', sortOrder: 17 },
    { typeCode: 'price_unit', typeName: '价格单位', itemCode: 'PER_CUSTOM', itemName: '自定义', itemValue: 'PER_CUSTOM', color: '#6b7280', sortOrder: 18 },
  ];

  for (const item of dictItems) {
    await prisma.dictionary.upsert({
      where: {
        typeCode_itemCode: {
          typeCode: item.typeCode,
          itemCode: item.itemCode,
        },
      },
      update: {
        typeName: item.typeName,
        itemName: item.itemName,
        itemValue: item.itemValue,
        color: item.color,
        sortOrder: item.sortOrder,
      },
      create: {
        typeCode: item.typeCode,
        typeName: item.typeName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemValue: item.itemValue,
        color: item.color,
        sortOrder: item.sortOrder,
      },
    });
  }
  console.log('✅ 数据字典已创建');

  console.log('\n🎉 数据库初始化完成！');
  console.log('默认管理员账号: admin（初始口令为 SEED_ADMIN_PASSWORD 环境变量所设值）');
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
