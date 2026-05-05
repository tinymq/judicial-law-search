import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Look at items around #1293 to see the true structure
const items = await prisma.enforcementItem.findMany({
  where: { id: { gte: 1293, lte: 1310 } },
  select: { id: true, name: true, lawId: true, legalBasisText: true, sequenceNumber: true },
  orderBy: { sequenceNumber: "asc" },
});

for (const i of items) {
  const basis = (i.legalBasisText || "").substring(0, 40);
  const isCandidate = !i.lawId && (!i.legalBasisText || i.legalBasisText === "");
  console.log(`#${i.id} seq=${i.sequenceNumber} lawId=${i.lawId || "NULL"} ${isCandidate ? "[CANDIDATE]" : ""} | ${i.name.substring(0, 55)}`);
  if (basis) console.log(`     依据: ${basis}`);
}

// Also check: what law is lawId=6994 (the first child of #1116)?
const law6994 = await prisma.law.findUnique({ where: { id: 6994 }, select: { title: true } });
const law11641 = await prisma.law.findUnique({ where: { id: 11641 }, select: { title: true } });
const law6958 = await prisma.law.findUnique({ where: { id: 6958 }, select: { title: true } });
console.log(`\nlawId=11641: ${law11641?.title}`);
console.log(`lawId=6958: ${law6958?.title}`);
console.log(`lawId=6994: ${law6994?.title}`);

await prisma.$disconnect();
