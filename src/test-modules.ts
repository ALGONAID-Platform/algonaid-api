import { PrismaClient } from './prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const modules = await prisma.module.findMany();
  console.log('--- MODULES IN DATABASE ---');
  modules.forEach(m => {
    console.log(`ID: ${m.id}, Title: ${m.title}`);
  });
  console.log('-------------------------');
}

main().catch(console.error).finally(() => prisma.$disconnect());
