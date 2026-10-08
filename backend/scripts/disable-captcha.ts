import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('关闭验证码...');

  // 关闭验证码
  await prisma.systemConfig.updateMany({
    where: { key: 'captcha.enabled' },
    data: { value: 'false' },
  });

  // 关闭登录验证码
  await prisma.systemConfig.updateMany({
    where: { key: 'captcha.loginRequired' },
    data: { value: 'false' },
  });

  console.log('✅ 验证码已关闭');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
