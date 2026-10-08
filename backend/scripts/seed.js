const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// 使用环境变量中的数据库连接
const prisma = new PrismaClient({});

async function main() {
  console.log('开始初始化数据库...');

  try {
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
    // 已存在 admin 的环境（生产库 / 已初始化库）无需该变量——下方 upsert 的 create 分支不会执行，
    // 这样既避免明文口令进入版本库，又不会让重跑 seed 或容器启动因缺变量而失败。
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' },
    });
    let hashedPassword;
    if (!existingAdmin) {
      const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
      if (!seedAdminPassword) {
        throw new Error(
          '缺少 SEED_ADMIN_PASSWORD 环境变量：初始化全新数据库需要管理员初始口令（不再使用代码内置默认值）。' +
            '示例：SEED_ADMIN_PASSWORD=<强口令> node scripts/seed.js',
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
        password: hashedPassword,
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

    // 创建基础权限
    const permissions = [
      { name: '用户管理', code: 'user:manage', type: 'MENU', description: '用户管理权限' },
      { name: '角色管理', code: 'role:manage', type: 'MENU', description: '角色管理权限' },
      { name: '权限管理', code: 'permission:manage', type: 'MENU', description: '权限管理权限' },
      { name: '文件管理', code: 'file:manage', type: 'MENU', description: '文件管理权限' },
      { name: '系统配置', code: 'system:config', type: 'MENU', description: '系统配置权限' },
      { name: '审计日志', code: 'audit:view', type: 'MENU', description: '审计日志查看权限' },
      { name: '管理员访问', code: 'admin:access', type: 'API', description: '管理员访问权限' },
    ];

    for (const perm of permissions) {
      await prisma.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: perm,
      });
    }
    console.log('✅ 基础权限已创建');

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

    console.log('\n🎉 数据库初始化完成！');
    console.log('默认管理员账号: admin（初始口令为 SEED_ADMIN_PASSWORD 环境变量所设值）');
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
