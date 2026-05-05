import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Check a few parents to see if children always share the same lawId
const parents = await prisma.enforcementItem.findMany({
  where: { children: { some: {} } },
  select: { id: true, name: true, children: { select: { id: true, lawId: true }, orderBy: { sequenceNumber: "asc" } } },
  take: 10,
  orderBy: { id: "asc" },
});

for (const p of parents) {
  const lawIds = [...new Set(p.children.map(c => c.lawId))];
  console.log(`#${p.id} (${p.children.length}子) lawIds=[${lawIds.join(",")}] | ${p.name.substring(0, 50)}`);
}
await prisma.$disconnect();
