import { PrismaClient } from './prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    include: { studentProfile: true, teacherProfile: true }
  });
  console.log('--- USERS IN DATABASE ---');
  users.forEach(u => {
    console.log(`ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`);
  });
  console.log('-------------------------');
}

main().catch(console.error).finally(() => prisma.$disconnect());
