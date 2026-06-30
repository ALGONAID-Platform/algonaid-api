import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
 
async function main() {
  const hashedPassword = await bcrypt.hash('Password123!', 10);
  
  // Upsert user to ensure we know the password
  const user = await prisma.user.upsert({
    where: { email: 'teststudent@example.com' },
    update: { password: hashedPassword, role: 'STUDENT' },
    create: {
      email: 'teststudent@example.com',
      name: 'Test Student',
      password: hashedPassword,
      role: 'STUDENT',
      studentProfile: {
        create: {
          academicId: 'STU-TEST-001'
        }
      }
    }
  });
  
  console.log('User created/updated:', user);
}

main().catch(console.error).finally(() => prisma.$disconnect());
