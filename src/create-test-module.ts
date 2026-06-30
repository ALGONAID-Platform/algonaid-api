import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // We need a teacher to create a course
  const teacher = await prisma.teacher.findFirst();
  let teacherId = teacher?.id;
  if (!teacherId) {
    const user = await prisma.user.create({
      data: {
        email: 'teacher@example.com',
        name: 'Teacher',
        role: 'ADMIN',
        teacherProfile: {
          create: { specialization: 'Math', experience: 5 }
        }
      },
      include: { teacherProfile: true }
    });
    teacherId = user.teacherProfile!.id;
  }

  // Create a course
  const course = await prisma.course.create({
    data: {
      title: 'Test Course',
      instructorId: teacherId
    }
  });

  // Create a module
  const module = await prisma.module.create({
    data: {
      title: 'Test Module',
      courseId: course.id
    }
  });

  console.log('Created Module ID:', module.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
