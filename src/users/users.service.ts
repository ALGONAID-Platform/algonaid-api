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

    const { password, studentProfile, teacherProfile, ...userWithoutPassword } = user;
    
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
      } : {})
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

    const { password, studentProfile, teacherProfile, ...userWithoutPassword } = finalUpdatedUser;

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
        } : {})
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

    const getTier = (isUnlocked: boolean) => {
      if (!isUnlocked) return 'STANDARD';
      if (passedExamsCount >= 5) return 'PRO_MAX';
      if (passedExamsCount > 0) return 'PRO';
      return 'STANDARD';
    };

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

    const studentEnrollments = await this.prisma.enrollment.findMany({
      where: { studentId: student.id },
      select: { courseId: true }
    });

    let fullyCompletedCourses = 0;
    for (const enrollment of studentEnrollments) {
      const lessons = await this.prisma.lesson.findMany({
        where: { module: { courseId: enrollment.courseId } },
        select: { id: true }
      });
      if (lessons.length === 0) continue;

      const completedCount = await this.prisma.lesson.count({
        where: {
          id: { in: lessons.map((l) => l.id) },
          lessonProgress: { some: { studentId: student.id, isCompleted: true } }
        },
      });

      if (completedCount >= lessons.length) {
        fullyCompletedCourses++;
      }
    }

    const totalCourses = await this.prisma.course.count();
    const effectiveTotalCourses = totalCourses > 0 ? totalCourses : 10;

    const badges = [
      {
        id: 1,
        key: "starter",
        isUnlocked: completedLessonsCount >= 1,
        progress: Math.min(completedLessonsCount, 1),
        target: 1,
        tier: getTier(completedLessonsCount >= 1)
      },
      {
        id: 2,
        key: "persistence",
        isUnlocked: maxStreak >= 3,
        progress: Math.min(maxStreak, 3),
        target: 3,
        tier: getTier(maxStreak >= 3)
      },
      {
        id: 3,
        key: "continuous",
        isUnlocked: maxStreak >= 7,
        progress: Math.min(maxStreak, 7),
        target: 7,
        tier: getTier(maxStreak >= 7)
      },
      {
        id: 4,
        key: "explorer",
        isUnlocked: completedLessonsCount >= 20,
        progress: Math.min(completedLessonsCount, 20),
        target: 20,
        tier: getTier(completedLessonsCount >= 20)
      },
      {
        id: 5,
        key: "nerd",
        isUnlocked: fullyCompletedCourses >= 2,
        progress: Math.min(fullyCompletedCourses, 2),
        target: 2,
        tier: getTier(fullyCompletedCourses >= 2)
      },
      {
        id: 6,
        key: "terrifying_brain",
        isUnlocked: fullyCompletedCourses >= 4,
        progress: Math.min(fullyCompletedCourses, 4),
        target: 4,
        tier: getTier(fullyCompletedCourses >= 4)
      },
      {
        id: 7,
        key: "elite",
        isUnlocked: fullyCompletedCourses >= totalCourses && totalCourses > 0,
        progress: Math.min(fullyCompletedCourses, effectiveTotalCourses),
        target: effectiveTotalCourses,
        tier: getTier(fullyCompletedCourses >= totalCourses && totalCourses > 0)
      },
      {
        id: 8,
        key: "marathon",
        isUnlocked: maxLessonsInOneDay >= 10,
        progress: Math.min(maxLessonsInOneDay, 10),
        target: 10,
        tier: getTier(maxLessonsInOneDay >= 10)
      },
      {
        id: 9,
        key: "night_owl",
        isUnlocked: nightOwlProgress >= 5,
        progress: Math.min(nightOwlProgress, 5),
        target: 5,
        tier: getTier(nightOwlProgress >= 5)
      },
      {
        id: 10,
        key: "early_bird",
        isUnlocked: earlyBirdProgress >= 3,
        progress: Math.min(earlyBirdProgress, 3),
        target: 3,
        tier: getTier(earlyBirdProgress >= 3)
      },
      {
        id: 11,
        key: "reviewer",
        isUnlocked: reviewerProgress >= 1,
        progress: Math.min(reviewerProgress, 1),
        target: 1,
        tier: getTier(reviewerProgress >= 1)
      }
    ];

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
      { id: 1, key: "starter", isUnlocked: false, progress: 0, target: 1, tier: 'STANDARD' },
      { id: 2, key: "persistence", isUnlocked: false, progress: 0, target: 3, tier: 'STANDARD' },
      { id: 3, key: "continuous", isUnlocked: false, progress: 0, target: 7, tier: 'STANDARD' },
      { id: 4, key: "explorer", isUnlocked: false, progress: 0, target: 20, tier: 'STANDARD' },
      { id: 5, key: "nerd", isUnlocked: false, progress: 0, target: 2, tier: 'STANDARD' },
      { id: 6, key: "terrifying_brain", isUnlocked: false, progress: 0, target: 4, tier: 'STANDARD' },
      { id: 7, key: "elite", isUnlocked: false, progress: 0, target: 10, tier: 'STANDARD' },
      { id: 8, key: "marathon", isUnlocked: false, progress: 0, target: 10, tier: 'STANDARD' },
      { id: 9, key: "night_owl", isUnlocked: false, progress: 0, target: 5, tier: 'STANDARD' },
      { id: 10, key: "early_bird", isUnlocked: false, progress: 0, target: 3, tier: 'STANDARD' },
      { id: 11, key: "reviewer", isUnlocked: false, progress: 0, target: 1, tier: 'STANDARD' }
    ];
  }
}
