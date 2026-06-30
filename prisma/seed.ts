import * as bcrypt from 'bcrypt';
import { EnrollmentStatus, Role, QuestionType } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// We use the direct connection string for seeding
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
     adapter : new PrismaPg(pool)
});

async function main() {
  console.log('⏳ Starting seeding...');

  // 1. Clear existing data in correct order
  await prisma.tokenBlacklist.deleteMany();
  await prisma.userAnswer.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 2. Create Admin/Teacher
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

  // 3. Create Student
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

  // 4. Create Courses
  const course1 = await prisma.course.create({
    data: {
      title: 'كورس التفاضل والتكامل - الوحدة الأولى',
      description: 'شرح مفصل للاشتقاق وتطبيقاته مع حل نماذج امتحانات سابقة.',
      thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd482180c',
      instructorId: teacherUser.teacherProfile!.id,
    },
  });

  // 5. Create Modules
  const module1 = await prisma.module.create({
    data: {
      title: 'الوحدة الأولى: النهايات والاتصال',
      description: 'تغطي هذه الوحدة مفاهيم النهايات والاتصال وتطبيقاتها الأساسية.',
      courseId: course1.id,
    },
  });

  // 6. Create Lessons
  const lesson1 = await prisma.lesson.create({
    data: {
      title: 'مقدمة في النهايات',
      description: 'فهم مفهوم النهاية رياضياً وبصرياً',
      videoUrl: 'https://www.youtube.com/watch?v=example1',
      order: 1,
      moduleId: module1.id,
    },
  });

  await prisma.lesson.create({
    data: {
      title: 'نظريات النهايات الأساسية',
      description: 'تطبيق النظريات لحل المسائل المعقدة',
      videoUrl: 'https://www.youtube.com/watch?v=example2',
      order: 2,
      moduleId: module1.id,
    },
  });

  // 7. Create Exam for Lesson 1
  const exam1 = await prisma.exam.create({
    data: {
      title: 'اختبار مقدمة النهايات',
      description: 'اختبار تقييمي لمفاهيم النهايات الأساسية',
      passingScore: 60,
      maxAttempts: 3,
      lessonId: lesson1.id,
    },
  });

  // 8. Create Questions and Options
  const q1 = await prisma.question.create({
    data: {
      text: 'ما هي نهاية الدالة f(x) = x عندما x تقترب من 2؟',
      type: QuestionType.MULTIPLE_CHOICE,
      points: 5,
      examId: exam1.id,
    },
  });

  await prisma.option.createMany({
    data: [
      { text: '0', isCorrect: false, questionId: q1.id },
      { text: '1', isCorrect: false, questionId: q1.id },
      { text: '2', isCorrect: true, questionId: q1.id },
      { text: 'ما لا نهاية', isCorrect: false, questionId: q1.id },
    ],
  });

  const q2 = await prisma.question.create({
    data: {
      text: 'الدالة f(x) = 1/x متصلة عند x = 0.',
      type: QuestionType.TRUE_FALSE,
      points: 5,
      examId: exam1.id,
    },
  });

  await prisma.option.createMany({
    data: [
      { text: 'صح', isCorrect: false, questionId: q2.id },
      { text: 'خطأ', isCorrect: true, questionId: q2.id },
    ],
  });

  // 9. Initial Enrollment
  await prisma.enrollment.create({
    data: {
      studentId: studentUser.studentProfile!.id,
      courseId: course1.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  // 10. Initial Lesson Progress
  await prisma.lessonProgress.create({
    data: {
      studentId: studentUser.studentProfile!.id,
      lessonId: lesson1.id,
      isCompleted: true,
      completedAt: new Date(),
    },
  });

  console.log('✅ Seeding complete!');
  console.log('------------------');
  console.log('Teacher User:', teacherUser.email, ' / Password123!');
  console.log('Student User:', studentUser.email, ' / Password123!');
  console.log('Exam Created:', exam1.title);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
