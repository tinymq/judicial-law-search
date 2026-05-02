import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DATA_FILE = path.join(__dirname, 'data', 'missing-laws.json');

function buildLawBaseTitle(title: string): string {
  const VERSION_RE = /[(\[（【]\s*\d{4}\s*(?:年)?(?:[^)\]）】]{0,20})[)\]）】]\s*$/g;
  const TRAILING_RE = /(修订|修正|修改|公布|发布|施行|实施|暂行|试行)\s*$/g;
  let normalized = title
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/【/g, '[').replace(/】/g, ']')
    .replace(/　/g, ' ')
    .replace(/[《》"'""'']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  let current = normalized, previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(VERSION_RE, '').trim();
    current = current.replace(TRAILING_RE, '').trim();
  }
  return current.replace(/\s+/g, ' ').trim();
}

function generateLawGroupId(title: string): string {
  const baseTitle = buildLawBaseTitle(title);
  const hash = crypto.createHash('md5').update(baseTitle).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

function inferLevel(title: string): string {
  if (/法$/.test(title) && !title.includes('办法')) return '法律';
  if (/条例/.test(title)) return '行政法规';
  if (/规[则定]$|管理办法|实施办法|实施细则|暂行规定|暂行办法|管理规定/.test(title)) return '部门规章';
  return '部门规章';
}

function inferCategory(title: string): string {
  const keywords: Record<string, string[]> = {
    '安全生产': ['安全生产', '安全监督', '安全管理', '安全技术', '安全评价', '安全设施'],
    '危险化学品': ['危险化学品', '危险货物', '剧毒化学品', '易制毒', '易制爆'],
    '建设工程': ['建筑', '建设工程', '工程建设', '工程监理', '工程质量', '施工'],
    '道路运输': ['道路运输', '机动车', '出租汽车', '驾驶'],
    '水运交通': ['船舶', '港口', '水路', '水运', '航道', '渡口'],
    '公路管理': ['公路', '超限运输'],
    '食品安全': ['食品', '食用'],
    '医疗卫生': ['医疗', '医院', '医师', '护士', '卫生', '诊疗', '临床', '血站', '血浆'],
    '药品监管': ['药品', '兽药', '药物', '药妆'],
    '环境保护': ['环境', '环保', '污染', '排污', '排放', '废物', '尾矿'],
    '市场监管': ['市场监督', '产品质量', '计量', '标准化', '认证', '拍卖', '广告'],
    '农业农村': ['农业', '农产品', '农药', '肥料', '种子', '畜禽', '饲料', '兽医', '渔业', '蚕种'],
    '自然资源': ['矿山', '矿产', '矿业', '地质', '土地', '测绘', '地图'],
    '住房城建': ['住房', '房屋', '房地产', '城市', '城镇', '物业', '供水'],
    '消防安全': ['消防', '防火', '灭火'],
    '气象服务': ['气象', '气候', '雷电', '防雷'],
    '水利管理': ['水利', '水资源', '水行政', '河道', '取水'],
    '广播电视': ['广播', '电视', '视听', '新闻', '出版', '期刊'],
    '教育管理': ['学校', '学生', '教育', '培训'],
    '司法行政': ['律师', '公证', '司法鉴定', '法律服务'],
    '民政管理': ['社会团体', '民办', '基金会', '救灾', '养老', '殡葬'],
    '人力资源': ['劳务', '劳动', '职业', '就业', '社会保险'],
    '财政税务': ['财政', '税务', '税收', '会计', '资产评估'],
    '商务贸易': ['进出口', '外商', '境外投资', '商品', '货物'],
    '公安管理': ['公安', '治安', '娱乐场所', '保安', '枪支'],
    '交通运输': ['交通', '运输'],
    '林业草原': ['林木', '林业', '森林', '湿地'],
    '烟草管理': ['烟草', '烟花爆竹'],
    '民用爆炸': ['爆炸物品'],
    '网络信息': ['互联网', '网络', '信息安全', '区块链', '算法', '人工智能'],
    '宗教事务': ['宗教'],
  };

  for (const [category, kws] of Object.entries(keywords)) {
    if (kws.some(kw => title.includes(kw))) return category;
  }
  return '综合监管';
}

async function main() {
  console.log('='.repeat(60));
  console.log('Stub Law Import - 403 Missing Laws');
  console.log('='.repeat(60));

  const titles: string[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8').replace(/^﻿/, ''));
  console.log(`\nLoaded ${titles.length} law titles from missing-laws.json`);

  let created = 0, skipped = 0, errors = 0;
  const levelStats: Record<string, number> = {};
  const categoryStats: Record<string, number> = {};

  for (const title of titles) {
    try {
      const existing = await prisma.law.findFirst({ where: { title } });
      if (existing) {
        skipped++;
        continue;
      }

      const level = inferLevel(title);
      const category = inferCategory(title);
      const lawGroupId = generateLawGroupId(title);

      await prisma.law.create({
        data: {
          title,
          level,
          category,
          status: '现行有效',
          region: null,
          lawGroupId,
          articleFormat: 'standard',
        },
      });

      created++;
      levelStats[level] = (levelStats[level] || 0) + 1;
      categoryStats[category] = (categoryStats[category] || 0) + 1;

      if (created % 50 === 0) {
        console.log(`  Progress: ${created} created, ${skipped} skipped`);
      }
    } catch (err) {
      errors++;
      console.error(`  ERROR [${title}]: ${err}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);

  console.log('\nLevel distribution:');
  for (const [level, count] of Object.entries(levelStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${level}: ${count}`);
  }

  console.log('\nTop categories:');
  for (const [cat, count] of Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${cat}: ${count}`);
  }

  const totalLaws = await prisma.law.count();
  console.log(`\nTotal laws in database: ${totalLaws}`);

  await prisma.$disconnect();
}

main();
