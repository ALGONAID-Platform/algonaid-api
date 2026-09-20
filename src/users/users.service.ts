import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserRole } from 'src/auth/enums/userRole';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, resetPasswordToken, resetPasswordExpires, verificationToken, verificationTokenExpiry, studentProfile, teacherProfile, ...userWithoutPassword } = user;
    
    return {
      ...userWithoutPassword,
      avatarUrl: userWithoutPassword.avatar,
      ...(studentProfile ? {
        academicId: studentProfile.academicId,
        grade: studentProfile.grade,
        birthDate: studentProfile.birthDate,
        address: studentProfile.address,
      } : {}),
      ...(teacherProfile ? {
        specialization: teacherProfile.specialization,
        bio: teacherProfile.bio,
        experience: teacherProfile.experience,
      } : {}),
    };
  }

  async getPublicProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, resetPasswordToken, resetPasswordExpires, verificationToken, verificationTokenExpiry, studentProfile, teacherProfile, ...userWithoutPassword } = user;
    
    let badges: any[] = [];
    let totalPoints = 0;
    
    if (studentProfile) {
      const badgesResult = await this.getBadges(user.id);
      badges = badgesResult.data;

      // حساب النقاط ديناميكياً بناءً على أعلى درجة حصل عليها الطالب في الامتحانات المجتازة
      const passedAttempts = await this.prisma.examAttempt.findMany({
        where: { studentId: studentProfile.id, status: 'PASSED' },
        select: { examId: true, score: true }
      });
      
      const maxScorePerExam = new Map<number, number>();
      for (const attempt of passedAttempts) {
        const currentMax = maxScorePerExam.get(attempt.examId) || 0;
        if (attempt.score > currentMax) {
          maxScorePerExam.set(attempt.examId, attempt.score);
        }
      }
      totalPoints = Array.from(maxScorePerExam.values()).reduce((sum, score) => sum + score, 0);
    }

    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      avatarUrl: user.avatar,
      role: user.role,
      ...(studentProfile ? {
        points: totalPoints,
        badges: badges,
      } : {}),
      ...(teacherProfile ? {
        specialization: teacherProfile.specialization,
        bio: teacherProfile.bio,
        experience: teacherProfile.experience,
      } : {}),
    };
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto, role: UserRole) {
    const { name, avatar, background, grade, birthDate, address } = updateProfileDto;
    
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true }
    }); 

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user table
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(avatar !== undefined && { avatar }),
        ...(background !== undefined && { background }),
      },
    });

    // If student specific details are provided and the user is a student
    if (role === UserRole.STUDENT || user.role === 'STUDENT') {
      if (grade || birthDate || address) {
        if (user.studentProfile) {
          await this.prisma.student.update({
            where: { userId: userId },
            data: {
              ...(grade && { grade }),
              ...(birthDate && { birthDate: new Date(birthDate) }),
              ...(address !== undefined && { address }),
            }
          });
        }
      }
    }

    // Fetch final updated data
    const finalUpdatedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, teacherProfile: true }
    });

    if (!finalUpdatedUser) {
      throw new NotFoundException('User not found after update');
    }

    const { password, resetPasswordToken, resetPasswordExpires, verificationToken, verificationTokenExpiry, studentProfile, teacherProfile, ...userWithoutPassword } = finalUpdatedUser;

    return {
      message: 'Profile updated successfully',
      data: {
        ...userWithoutPassword,
        avatarUrl: userWithoutPassword.avatar,
        ...(studentProfile ? {
          academicId: studentProfile.academicId,
          grade: studentProfile.grade,
          birthDate: studentProfile.birthDate,
          address: studentProfile.address,
        } : {}),
        ...(teacherProfile ? {
          specialization: teacherProfile.specialization,
          bio: teacherProfile.bio,
          experience: teacherProfile.experience,
        } : {}),
      }
    };
  }

  async getBadges(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true }
    });

    if (!user) throw new NotFoundException('User not found');
    const student = user.studentProfile;
    if (!student) {
      return {
        success: true,
        message: "Badges retrieved successfully",
        data: this.defaultBadges()
      };
    }

    // ================================================================
    // 1. جلب الأوسمة المكتسبة بشكل دائم من جدول EarnedBadge
    //    هذه الأوسمة لا تتأثر أبداً بأي تغييرات مستقبلية في المحتوى
    // ================================================================
    const permanentlyEarnedBadges = await this.prisma.earnedBadge.findMany({
      where: { studentId: student.id }
    });
    const earnedBadgeMap = new Map(
      permanentlyEarnedBadges.map(b => [b.key, b])
    );

    // ================================================================
    // 2. حساب الأوسمة الجديدة ديناميكياً (للأوسمة التي لم تُكتسب بعد)
    // ================================================================
    const completedLessonsCount = await this.prisma.lesson.count({
      where: {
        lessonProgress: { some: { studentId: student.id, isCompleted: true } }
      }
    });

    const activities = await this.prisma.lessonProgress.findMany({
      where: { studentId: student.id, isCompleted: true, completedAt: { not: null } },
    });
    
    let maxLessonsInOneDay = 0;
    const lessonsPerDay: Record<string, number> = {};
    const nightOwlDays = new Set<string>();
    const earlyBirdDays = new Set<string>();
    let earlyBirdProgress = 0;
    let reviewerProgress = 0;

    const dates = activities.map(a => {
      const dateObj = a.completedAt!;
      const dateStr = dateObj.toISOString().split('T')[0];
      const hour = dateObj.getHours();

      lessonsPerDay[dateStr] = (lessonsPerDay[dateStr] || 0) + 1;
      if (lessonsPerDay[dateStr] > maxLessonsInOneDay) {
        maxLessonsInOneDay = lessonsPerDay[dateStr];
      }

      if (hour >= 0 && hour < 5) {
        nightOwlDays.add(dateStr);
      }

      if (hour >= 5 && hour <= 9) {
        earlyBirdDays.add(dateStr);
      }

      if ((a as any).watchCount >= 2) {
        reviewerProgress = 1;
      }

      return dateStr;
    });
    
    const nightOwlProgress = nightOwlDays.size;

    const uniqueEarlyBirdDates = [...earlyBirdDays].sort();
    let currentEarlyBirdStreak = 0;
    let lastEarlyBirdDate: Date | null = null;

    for (const dateStr of uniqueEarlyBirdDates) {
      const date = new Date(dateStr);
      if (!lastEarlyBirdDate) {
        currentEarlyBirdStreak = 1;
      } else {
        const diffDays = Math.round((date.getTime() - lastEarlyBirdDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentEarlyBirdStreak++;
        } else if (diffDays > 1) {
          currentEarlyBirdStreak = 1;
        }
      }
      if (currentEarlyBirdStreak > earlyBirdProgress) {
        earlyBirdProgress = currentEarlyBirdStreak;
      }
      lastEarlyBirdDate = date;
    }

    const uniqueDates = [...new Set(dates)].sort();

    const passedExamsCount = await this.prisma.examAttempt.count({
      where: { studentId: student.id, status: 'PASSED' }
    });

    let maxStreak = 0;
    let currentStreak = 0;
    let lastDate: Date | null = null;

    for (const dateStr of uniqueDates) {
      const date = new Date(dateStr);
      if (!lastDate) {
        currentStreak = 1;
      } else {
        const diffDays = Math.round((date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      }
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
      lastDate = date;
    }

    // ================================================================
    // حساب fullyCompletedCourses للأوسمة الجديدة فقط
    // الأوسمة المكتسبة مسبقاً (nerd, terrifying_brain, elite) ستأتي من EarnedBadge
    // ================================================================
    const studentEnrollments = await this.prisma.enrollment.findMany({
      where: { studentId: student.id },
      select: { courseId: true }
    });

    let fullyCompletedCourses = 0;
    for (const enrollment of studentEnrollments) {
      // ✅ نفس منطق getCourseProgress: نفلتر PUBLISHED فقط لتطابق ما يراه الطالب كـ 100%
      const lessons = await this.prisma.lesson.findMany({
        where: { status: 'PUBLISHED', module: { courseId: enrollment.courseId } },
        select: { id: true }
      });
      if (lessons.length === 0) continue;

      const lessonIds = lessons.map((l) => l.id);

      // ✅ نحسب الدروس المكتملة عبر lessonProgress أو عبر اجتياز الاختبار
      const completedCount = await this.prisma.lesson.count({
        where: {
          id: { in: lessonIds },
          OR: [
            { lessonProgress: { some: { studentId: student.id, isCompleted: true } } },
            { exam: { attempts: { some: { studentId: student.id, status: 'PASSED' } } } },
          ],
        },
      });

      if (completedCount >= lessons.length) {
        fullyCompletedCourses++;
      }
    }

    const totalCourses = await this.prisma.course.count();
    const effectiveTotalCourses = totalCourses > 0 ? totalCourses : 10;

    // ================================================================
    // 3. تحديد tier بناءً على الامتحانات
    // ================================================================
    const computeTier = (isCurrentlyUnlocked: boolean): string => {
      if (!isCurrentlyUnlocked) return 'STANDARD';
      if (passedExamsCount >= 5) return 'PRO_MAX';
      if (passedExamsCount > 0) return 'PRO';
      return 'STANDARD';
    };

    // ================================================================
    // 4. دمج الأوسمة: المكتسبة الدائمة + الحساب الديناميكي للجديدة
    //    القاعدة: إذا كانت الوسام محفوظة في EarnedBadge → isUnlocked: true دائماً
    // ================================================================
    const badgeDefinitions = [
      {
        id: 1,
        key: "starter",
        dynamicUnlocked: completedLessonsCount >= 1,
        progress: Math.min(completedLessonsCount, 1),
        target: 1,
      },
      {
        id: 2,
        key: "persistence",
        dynamicUnlocked: maxStreak >= 3,
        progress: Math.min(maxStreak, 3),
        target: 3,
      },
      {
        id: 3,
        key: "continuous",
        dynamicUnlocked: maxStreak >= 7,
        progress: Math.min(maxStreak, 7),
        target: 7,
      },
      {
        id: 4,
        key: "explorer",
        dynamicUnlocked: completedLessonsCount >= 20,
        progress: Math.min(completedLessonsCount, 20),
        target: 20,
      },
      {
        id: 5,
        key: "nerd",
        dynamicUnlocked: fullyCompletedCourses >= 2,
        progress: Math.min(fullyCompletedCourses, 2),
        target: 2,
      },
      {
        id: 6,
        key: "terrifying_brain",
        dynamicUnlocked: fullyCompletedCourses >= 4,
        progress: Math.min(fullyCompletedCourses, 4),
        target: 4,
      },
      {
        id: 7,
        key: "elite",
        dynamicUnlocked: fullyCompletedCourses >= totalCourses && totalCourses > 0,
        progress: Math.min(fullyCompletedCourses, effectiveTotalCourses),
        target: effectiveTotalCourses,
      },
      {
        id: 8,
        key: "marathon",
        dynamicUnlocked: maxLessonsInOneDay >= 10,
        progress: Math.min(maxLessonsInOneDay, 10),
        target: 10,
      },
      {
        id: 9,
        key: "night_owl",
        dynamicUnlocked: nightOwlProgress >= 5,
        progress: Math.min(nightOwlProgress, 5),
        target: 5,
      },
      {
        id: 10,
        key: "early_bird",
        dynamicUnlocked: earlyBirdProgress >= 3,
        progress: Math.min(earlyBirdProgress, 3),
        target: 3,
      },
      {
        id: 11,
        key: "reviewer",
        dynamicUnlocked: reviewerProgress >= 1,
        progress: Math.min(reviewerProgress, 1),
        target: 1,
      },
    ];

    // ================================================================
    // 5. حفظ الأوسمة المكتسبة حديثاً في EarnedBadge (مرة واحدة فقط)
    //    upsert يضمن عدم التكرار
    // ================================================================
    const newlyEarnedBadgesToSave: Promise<any>[] = [];
    for (const def of badgeDefinitions) {
      if (def.dynamicUnlocked && !earnedBadgeMap.has(def.key)) {
        const tier = computeTier(true);
        newlyEarnedBadgesToSave.push(
          this.prisma.earnedBadge.upsert({
            where: { studentId_key: { studentId: student.id, key: def.key } },
            create: { studentId: student.id, key: def.key, tier },
            update: { tier }, // نحدث الـ tier فقط إذا تحسّن
          })
        );
      }
    }
    if (newlyEarnedBadgesToSave.length > 0) {
      await Promise.all(newlyEarnedBadgesToSave);
      // إعادة تحميل الأوسمة المكتسبة بعد الحفظ
      const refreshed = await this.prisma.earnedBadge.findMany({
        where: { studentId: student.id }
      });
      refreshed.forEach(b => earnedBadgeMap.set(b.key, b));
    }

    // ================================================================
    // 6. بناء قائمة الأوسمة النهائية
    //    - isUnlocked = true  إذا كانت في EarnedBadge (دائمة) أو مكتسبة الآن
    //    - earnedAt تُضاف للأوسمة المكتسبة لعرض تاريخ الحصول عليها
    // ================================================================
    const badges = badgeDefinitions.map(def => {
      const earned = earnedBadgeMap.get(def.key);
      const isUnlocked = !!earned || def.dynamicUnlocked;
      const tier = earned ? earned.tier : computeTier(def.dynamicUnlocked);

      return {
        id: def.id,
        key: def.key,
        isUnlocked,
        progress: def.progress,
        target: def.target,
        tier,
        earnedAt: earned ? earned.earnedAt : null,
      };
    });

    badges.sort((a, b) => {
      if (a.isUnlocked === b.isUnlocked) return 0;
      return a.isUnlocked ? -1 : 1;
    });

    return {
      success: true,
      message: "Badges retrieved successfully",
      data: badges
    };
  }

  private defaultBadges() {
    return [
      { id: 1, key: "starter", isUnlocked: false, progress: 0, target: 1, tier: 'STANDARD', earnedAt: null },
      { id: 2, key: "persistence", isUnlocked: false, progress: 0, target: 3, tier: 'STANDARD', earnedAt: null },
      { id: 3, key: "continuous", isUnlocked: false, progress: 0, target: 7, tier: 'STANDARD', earnedAt: null },
      { id: 4, key: "explorer", isUnlocked: false, progress: 0, target: 20, tier: 'STANDARD', earnedAt: null },
      { id: 5, key: "nerd", isUnlocked: false, progress: 0, target: 2, tier: 'STANDARD', earnedAt: null },
      { id: 6, key: "terrifying_brain", isUnlocked: false, progress: 0, target: 4, tier: 'STANDARD', earnedAt: null },
      { id: 7, key: "elite", isUnlocked: false, progress: 0, target: 10, tier: 'STANDARD', earnedAt: null },
      { id: 8, key: "marathon", isUnlocked: false, progress: 0, target: 10, tier: 'STANDARD', earnedAt: null },
      { id: 9, key: "night_owl", isUnlocked: false, progress: 0, target: 5, tier: 'STANDARD', earnedAt: null },
      { id: 10, key: "early_bird", isUnlocked: false, progress: 0, target: 3, tier: 'STANDARD', earnedAt: null },
      { id: 11, key: "reviewer", isUnlocked: false, progress: 0, target: 1, tier: 'STANDARD', earnedAt: null },
    ];
  }
}
