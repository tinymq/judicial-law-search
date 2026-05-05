import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const items = await prisma.enforcementItem.findMany({
  where: { OR: [{ id: 1293 }, { parentId: 1293 }] },
  select: { id: true, name: true, parentId: true, lawId: true, sequenceNumber: true, enforcementDomain: true, category: true },
  orderBy: { sequenceNumber: "asc" },
});
for (const i of items) {
  console.log(`${i.id} | seq=${i.sequenceNumber} | ${i.parentId ? "child" : "PARENT"} | lawId=${i.lawId} | ${(i.name || "").substring(0, 50)}`);
}
console.log(`Total children: ${items.filter(i => i.parentId === 1293).length}`);
await prisma.$disconnect();
