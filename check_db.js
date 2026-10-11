const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const options = await prisma.option.findMany({
    where: { isCorrect: true },
    take: 5
  });
  console.log('Options with isCorrect=true:', options.length);
  
  const questions = await prisma.question.findMany({
    take: 5
  });
  console.log('Questions points:', questions.map(q => q.points));
}
main().catch(console.error).finally(() => prisma.$disconnect());
