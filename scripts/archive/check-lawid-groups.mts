import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// For each parent, check if first child lawId matches all children
const parents = await prisma.enforcementItem.findMany({
  where: { children: { some: {} } },
  select: { 
    id: true, name: true,
    children: { select: { id: true, lawId: true, sequenceNumber: true }, orderBy: { sequenceNumber: "asc" } }
  },
  orderBy: { id: "asc" },
});

console.log("Parent | Total Children | First lawId group | Remaining (other lawIds)");
console.log("---");
for (const p of parents) {
  const firstLawId = p.children[0]?.lawId;
  let sameCount = 0;
  for (const c of p.children) {
    if (c.lawId === firstLawId) sameCount++;
    else break;
  }
  const rest = p.children.length - sameCount;
  console.log(`#${p.id} | ${p.children.length} children | first group: ${sameCount} (lawId=${firstLawId}) | remaining: ${rest} | ${p.name.substring(0, 45)}`);
}
await prisma.$disconnect();
