import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const item = await prisma.enforcementItem.findUnique({
  where: { id: 272 },
  select: { legalBasisText: true },
});
console.log("=== #272 legalBasisText ===");
console.log(JSON.stringify(item?.legalBasisText));
console.log("\n=== readable ===");
console.log(item?.legalBasisText);

const item2 = await prisma.enforcementItem.findUnique({
  where: { id: 4356 },
  select: { legalBasisText: true, name: true },
});
console.log("\n=== #4356 ===");
console.log("name:", item2?.name);
console.log(JSON.stringify(item2?.legalBasisText));
console.log("\n=== readable ===");
console.log(item2?.legalBasisText);
await prisma.$disconnect();
