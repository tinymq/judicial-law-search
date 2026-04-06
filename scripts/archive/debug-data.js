const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const v = await prisma.violation.findFirst({
    include: {
      violationBasisArticle: true,
      violationBasisParagraph: true,
      violationBasisItem: true
    }
  });

  if (v) {
    console.log('违法行为:', v.description.substring(0, 30));
    console.log('条款:', v.violationBasisArticle?.title);
    console.log('款number:', v.violationBasisParagraph?.number, '类型:', typeof v.violationBasisParagraph?.number);
    console.log('项number:', v.violationBasisItem?.number);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
