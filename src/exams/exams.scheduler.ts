import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, ExamType } from '@prisma/client';
import { sortByRankingCriteria } from './helpers/ranking.helper';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class ExamsScheduler {
  private readonly logger = new Logger(ExamsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredChallenges() {
    const now = new Date();

    // جلب جميع الاختبارات المنتهية التي لم يُعلن عن نتائجها بعد
    // استبعاد الاختبارات المعلنة مسبقاً يضمن أداءً فائقاً وعدم استهلاك الموارد كل دقيقة
    const expiredExams = await this.prisma.exam.findMany({
      where: {
        endTime: { lte: now },
        comments: {
          none: {
            text: { contains: 'إعلان نتائج وتكريم الأوائل' },
          },
        },
      },
      include: {
        course: {
          include: {
            teacher: { select: { userId: true } },
          },
        },
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  include: {
                    teacher: { select: { userId: true } },
                  },
                },
              },
            },
          },
        },
        questions: { select: { points: true } },
      },
    });

    if (expiredExams.length === 0) return;

    for (const exam of expiredExams) {
      try {
        // 1. إغلاق أي محاولات كانت لا تزال معلقة أثناء انتهاء الوقت
        const updated = await this.prisma.examAttempt.updateMany({
          where: {
            examId: exam.id,
            status: ExamStatus.IN_PROGRESS,
          },
          data: {
            status: ExamStatus.FAILED,
            completedAt: now,
          },
        });

        if (updated.count > 0) {
          this.logger.log(
            `Exam "${exam.title}" (ID: ${exam.id}) ended — closed ${updated.count} open attempt(s)`,
          );
        }

        // 2. جلب جميع المحاولات المكتملة للاختبار
        const allAttempts = await this.prisma.examAttempt.findMany({
          where: {
            examId: exam.id,
            status: { not: ExamStatus.IN_PROGRESS },
          },
          select: {
            id: true,
            score: true,
            timeTaken: true,
            startedAt: true,
            completedAt: true,
            isRanked: true,
            student: {
              select: {
                id: true,
                userId: true,
                user: { select: { id: true, name: true, avatar: true } },
              },
            },
          },
        });

        // 3. تحديد المشرف أو المعلم المسؤول عن الكورس/الاختبار
        const instructorUserId =
          exam.course?.teacher?.userId ||
          exam.lesson?.module?.course?.teacher?.userId;
        const authorId = instructorUserId || (await this.getDefaultAuthorId());

        // 4. استخراج الطلاب الذين شاركوا فعلياً في هذا الاختبار (دون تكرار)
        const participantUserIds = Array.from(
          new Set(
            allAttempts
              .map((att) => att.student?.userId)
              .filter((id): id is number => typeof id === 'number' && id > 0),
          ),
        );

        // إذا لم تكن هناك أي محاولات، يتم تسجيل إعلان رسمي بعدم وجود مشاركات لمنع إعادة الفحص
        if (allAttempts.length === 0) {
          await this.prisma.comment.create({
            data: {
              userId: authorId,
              examId: exam.id,
              text: `🏆 **إعلان نتائج وتكريم الأوائل في اختبار: ${exam.title}**\n\nانتهى وقت الاختبار ولم تسجل أي محاولة مكتملة.`,
              parentId: null,
            },
          });
          continue;
        }

        // 5. احتساب الإحصائيات وترتيب الطلاب لاختيار الثلاثة الأوائل
        const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0) || 100;
        const rankedAttempts = allAttempts.filter((att) => att.isRanked);
        const sortedAttempts = sortByRankingCriteria(
          (rankedAttempts.length > 0 ? rankedAttempts : allAttempts) as any,
          exam.rankingCriteria,
        );

        const highestScore = sortedAttempts.length > 0 ? sortedAttempts[0].score : 0;
        const avgScore =
          sortedAttempts.length > 0
            ? Math.round(sortedAttempts.reduce((sum, a) => sum + a.score, 0) / sortedAttempts.length)
            : 0;

        const highestPct = totalPoints > 0 ? Math.round((highestScore / totalPoints) * 100) : 0;
        const avgPct = totalPoints > 0 ? Math.round((avgScore / totalPoints) * 100) : 0;

        // اختيار الثلاثة الأوائل
        const top3 = sortedAttempts.slice(0, 3);
        const medals = ['🥇 المركز الأول', '🥈 المركز الثاني', '🥉 المركز الثالث'];
        let top3Lines = '';
        top3.forEach((att, idx) => {
          const name = att.student?.user?.name || 'طالب';
          const pct = totalPoints > 0 ? Math.round((att.score / totalPoints) * 100) : 0;
          top3Lines += `\n${medals[idx]}: **${name}** — الدرجة: **${att.score}/${totalPoints}** (${pct}%)`;
        });

        // 6. صياغة الإعلان الرسمي الموحد للاختبار متضمناً الإحصائيات والأوائل
        const announcementMessage = `🏆 **إعلان نتائج وتكريم الأوائل في اختبار: ${exam.title}**

📊 **إحصائيات الاختبار:**
• إجمالي المشاركين: ${participantUserIds.length} طالب
• أعلى درجة محققة: ${highestScore}/${totalPoints} (${highestPct}%)
• متوسط درجات المشاركين: ${avgScore}/${totalPoints} (${avgPct}%)

🌟 **قائمة الثلاثة الأوائل (لوحة الشرف):**${top3Lines}

تهانينا لجميع الأبطال المشاركين، ونتمنى لكم مزيداً من التفوق والنجاح! 👏🎉`;

        // 7. نشر تعليق واحد فقط في قسم التعليقات الخاص بالاختبار
        const comment = await this.prisma.comment.create({
          data: {
            userId: authorId,
            examId: exam.id,
            text: announcementMessage,
            parentId: null,
          },
        });

        // 8. عمل منشن (Mentions) حصرياً للذين شاركوا في الاختبار + المشرف/المعلم
        const usersToMention = Array.from(
          new Set([
            ...participantUserIds,
            ...(instructorUserId ? [instructorUserId] : []),
          ]),
        );

        if (usersToMention.length > 0) {
          await this.prisma.mention.createMany({
            data: usersToMention.map((uid) => ({
              commentId: comment.id,
              mentionedUserId: uid,
              isRead: false,
            })),
          });
        }

        this.logger.log(
          `Exam "${exam.title}" (ID: ${exam.id}) result announced: 1 comment with ${usersToMention.length} mentions.`,
        );
      } catch (err) {
        this.logger.error(
          `Error handling exam result announcement for exam ID ${exam.id}: ${err.message}`,
          err.stack,
        );
      }
    }
  }

  private async getDefaultAuthorId(): Promise<number> {
    const admin = await this.prisma.user.findFirst({
      where: { role: { in: ['OWNER', 'ADMIN'] } },
      select: { id: true },
    });
    return admin?.id || 1;
  }
}
