import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 标准省份列表
const ALL_PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
  '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省',
  '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区',
  '海南省', '重庆市', '四川省', '贵州省', '云南省',
  '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区',
  '新疆维吾尔自治区'
];

// 默认区域配置（以浙江为例）
const DEFAULT_ZONE_CONFIG = {
  '浙江省': ['省内'],
  '江苏省': ['二区'],
  '上海市': ['二区'],
  '安徽省': ['二区'],
  '江西省': ['二区'],
  '福建省': ['二区'],
  '山东省': ['二区'],
  '河南省': ['二区'],
  '湖北省': ['二区'],
  '湖南省': ['二区'],
  '河北省': ['三区'],
  '山西省': ['三区'],
  '内蒙古自治区': ['三区'],
  '辽宁省': ['三区'],
  '吉林省': ['三区'],
  '黑龙江省': ['三区'],
  '广东省': ['三区'],
  '广西壮族自治区': ['三区'],
  '海南省': ['三区'],
  '北京市': ['三区'],
  '天津市': ['三区'],
  '重庆市': ['三区'],
  '四川省': ['三区'],
  '贵州省': ['三区'],
  '云南省': ['三区'],
  '陕西省': ['三区'],
  '甘肃省': ['三区'],
  '青海省': ['三区'],
  '宁夏回族自治区': ['三区'],
  '西藏自治区': ['超远'],
  '新疆维吾尔自治区': ['超远'],
};

// 默认重量段配置
const DEFAULT_WEIGHT_RANGES = [
  { label: '0-0.5KG', minWeight: 0, maxWeight: 0.5, sortOrder: 1 },
  { label: '0.51-1KG', minWeight: 0.51, maxWeight: 1, sortOrder: 2 },
  { label: '1.01-2KG', minWeight: 1.01, maxWeight: 2, sortOrder: 3 },
  { label: '2.01-3KG', minWeight: 2.01, maxWeight: 3, sortOrder: 4 },
  { label: '3KG以上', minWeight: 3.01, maxWeight: 9999, sortOrder: 5 },
];

// 默认价格矩阵（示例价格）
const DEFAULT_PRICES = {
  '省内': [2.50, 2.80, 3.00, 3.50, 4.50],
  '二区': [2.80, 3.00, 3.20, 4.00, 5.50],
  '三区': [3.00, 3.20, 3.50, 5.00, 7.00],
  '四区': [3.50, 3.80, 4.50, 6.50, 9.50],
  '偏远': [5.00, 6.00, 8.00, 12.00, 18.00],
  '超远': [8.00, 10.00, 12.00, 18.00, 25.00],
};

async function main() {
  console.log('开始初始化快递价格模块数据...');

  // 1. 创建示例快递公司（圆通快递）
  console.log('创建示例快递公司...');
  const company = await prisma.expressCompany.upsert({
    where: { code: 'YTO' },
    update: {},
    create: {
      name: '圆通快递',
      code: 'YTO',
      status: 'ACTIVE',
      remark: '示例快递公司，用于测试快递价格模块',
    },
  });
  console.log('✅ 快递公司已创建:', company.name);

  // 2. 创建区域配置
  console.log('创建区域配置...');
  const zoneNames = ['省内', '二区', '三区', '四区', '偏远', '超远'];
  const zones = [];

  for (let i = 0; i < zoneNames.length; i++) {
    const zoneName = zoneNames[i];
    // 根据默认配置找到属于该区域的省份
    const provinces = ALL_PROVINCES.filter(
      province => DEFAULT_ZONE_CONFIG[province as keyof typeof DEFAULT_ZONE_CONFIG]?.includes(zoneName)
    );

    const zone = await prisma.expressZone.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: zoneName,
        },
      },
      update: {
        provinces: provinces.length > 0 ? provinces : [],
        sortOrder: i + 1,
      },
      create: {
        companyId: company.id,
        name: zoneName,
        provinces: provinces.length > 0 ? provinces : [],
        sortOrder: i + 1,
      },
    });
    zones.push(zone);
    console.log(`  ✅ ${zoneName}: ${provinces.length}个省份`);
  }

  // 3. 创建重量段配置
  console.log('创建重量段配置...');
  const weightRanges = [];
  for (const wr of DEFAULT_WEIGHT_RANGES) {
    const weightRange = await prisma.expressWeightRange.upsert({
      where: {
        companyId_label: {
          companyId: company.id,
          label: wr.label,
        },
      },
      update: {
        minWeight: wr.minWeight,
        maxWeight: wr.maxWeight,
        sortOrder: wr.sortOrder,
      },
      create: {
        companyId: company.id,
        label: wr.label,
        minWeight: wr.minWeight,
        maxWeight: wr.maxWeight,
        sortOrder: wr.sortOrder,
      },
    });
    weightRanges.push(weightRange);
    console.log(`  ✅ ${wr.label}: ${wr.minWeight}-${wr.maxWeight}kg`);
  }

  // 4. 创建价格矩阵
  console.log('创建价格矩阵...');
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    const zoneName = zoneNames[i];
    const prices = DEFAULT_PRICES[zoneName as keyof typeof DEFAULT_PRICES] || DEFAULT_PRICES['三区'];

    for (let j = 0; j < weightRanges.length; j++) {
      const weightRange = weightRanges[j];
      const price = prices[j] || 0;

      await prisma.expressPrice.upsert({
        where: {
          companyId_zoneId_weightRangeId: {
            companyId: company.id,
            zoneId: zone.id,
            weightRangeId: weightRange.id,
          },
        },
        update: {
          price: price,
        },
        create: {
          companyId: company.id,
          zoneId: zone.id,
          weightRangeId: weightRange.id,
          price: price,
        },
      });
    }
    console.log(`  ✅ ${zoneName}: ${prices.join(', ')}元`);
  }

  // 5. 创建示例附加费规则
  console.log('创建附加费规则...');
  const surchargeRules = [
    {
      name: '西藏偏远地区附加费',
      provinces: ['西藏自治区'],
      weightFrom: null,
      weightTo: null,
      amount: 5.00,
    },
    {
      name: '新疆偏远地区附加费',
      provinces: ['新疆维吾尔自治区'],
      weightFrom: null,
      weightTo: null,
      amount: 5.00,
    },
    {
      name: '内蒙古偏远地区附加费',
      provinces: ['内蒙古自治区'],
      weightFrom: null,
      weightTo: null,
      amount: 2.00,
    },
  ];

  for (const rule of surchargeRules) {
    // 检查是否已存在
    const existing = await prisma.expressSurcharge.findFirst({
      where: {
        companyId: company.id,
        name: rule.name,
      },
    });

    if (!existing) {
      await prisma.expressSurcharge.create({
        data: {
          companyId: company.id,
          name: rule.name,
          provinces: rule.provinces,
          weightFrom: rule.weightFrom,
          weightTo: rule.weightTo,
          amount: rule.amount,
        },
      });
      console.log(`  ✅ ${rule.name}: +${rule.amount}元`);
    } else {
      console.log(`  ⏭️ ${rule.name}: 已存在`);
    }
  }

  console.log('\n🎉 快递价格模块数据初始化完成！');
  console.log(`快递公司: ${company.name} (${company.code})`);
  console.log(`区域配置: ${zones.length}个区域`);
  console.log(`重量段: ${weightRanges.length}个重量段`);
  console.log(`价格矩阵: ${zones.length * weightRanges.length}个价格`);
  console.log(`附加费规则: ${surchargeRules.length}条`);
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
