import * as bcrypt from 'bcrypt';
import { EnrollmentStatus, Role } from "../src/prisma/client/enums";
import { PrismaClient } from "../src/prisma/client/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
     adapter : new PrismaPg(pool)
});
async function main() {
  console.log('⏳ Starting seeding...');

  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const teacherUser = await prisma.user.create({
    data: {
      name: 'المهندس نذير',
      email: 'natheer@example.com',
      password: hashedPassword,
      role: Role.ADMIN,
      teacherProfile: {
        create: {
          specialization: 'الرياضيات المتقدمة',
          bio: 'خبير في تدريس مناهج الثانوية والجامعة لأكثر من 10 سنوات.',
          experience: 10,
        },
      },
    },
    include: { teacherProfile: true },
  });

  // 3. إنشاء مستخدم STUDENT
  const studentUser = await prisma.user.create({
    data: {
      name: 'بشار الحيمري',
      email: 'bashar@example.com',
      password: hashedPassword,
      role: Role.STUDENT,
      studentProfile: {
        create: {
          academicId: 'STU-2026-001',
          grade: 'الثالث الثانوي',
          address: 'اليمن، تعز، شارع جمال',
        },
      },
    },
    include: { studentProfile: true },
  });

  // 4. إنشاء كورسات تجريبية مرتبطة بالمعلم
  const course1 = await prisma.course.create({
    data: {
      title: 'كورس التفاضل والتكامل - الوحدة الأولى',
      description: 'شرح مفصل للاشتقاق وتطبيقاته مع حل نماذج امتحانات سابقة.',
      thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd482180c',
      instructorId: teacherUser.teacherProfile!.id,
    },
  });

  const course2 = await prisma.course.create({
    data: {
      title: 'جبر المجموعات والمنطق الرياضي',
      description: 'دورة مبسطة لطلاب السنة التحضيرية في الهندسة.',
      thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb',
      instructorId: teacherUser.teacherProfile!.id,
    },
  });

  // 5. تسجيل الطالب في أحد الكورسات (Enrollment)
  await prisma.enrollment.create({
    data: {
      studentId: studentUser.studentProfile!.id,
      courseId: course1.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  console.log({
    message: '✅ Seeding complete!',
    adminAccount: 'ayman@example.com',
    studentAccount: 'bashar@example.com',
    password: 'Password123!',
  });
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });