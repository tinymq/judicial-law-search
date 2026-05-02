import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const falv = await prisma.law.findMany({
    where: { level: '法律' },
    select: { title: true },
    orderBy: { title: 'asc' },
  });
  const xzfg = await prisma.law.findMany({
    where: { level: '行政法规' },
    select: { title: true },
    orderBy: { title: 'asc' },
  });

  console.log(`法律: ${falv.length}`);
  console.log(`行政法规: ${xzfg.length}`);

  fs.writeFileSync(
    path.join(__dirname, 'data', 'local-falv.json'),
    JSON.stringify(falv.map(l => l.title), null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(__dirname, 'data', 'local-xzfg.json'),
    JSON.stringify(xzfg.map(l => l.title), null, 2),
    'utf-8',
  );
  console.log('exported');
  await prisma.$disconnect();
}

main();
