import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Role, Prisma } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to check if user is staff (Owner/Admin) or the instructor of this course
   */
  private async isStaffOrInstructor(instructorId: number, userId?: number): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });
    if (!user) return false;
    if (user.role === Role.OWNER || user.role === Role.ADMIN) return true;
    if (user.teacherProfile && user.teacherProfile.id === instructorId) return true;
    return false;
  }

  async create(userId: number, createCommentDto: CreateCommentDto) {
    const { text, lessonId, examId, parentId, mentionedUserIds, imageUrl } = createCommentDto;

    // Check email verification in DB
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }
    if (!user.emailVerified && user.role === Role.STUDENT) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'يجب تأكيد حسابك عبر البريد الإلكتروني أولاً للمشاركة في التعليقات.',
        action: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }

    if (!lessonId && !examId) {
      throw new BadRequestException('Must provide either lessonId or examId');
    }

    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { include: { course: true } } },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');
      if (lesson.status !== 'PUBLISHED') throw new ForbiddenException('Comments are unavailable for unpublished lessons');

      const isStaff = await this.isStaffOrInstructor(lesson.module.course.instructorId, userId);
      const now = new Date();
      const isScheduledFuture =
        !isStaff &&
        lesson.scheduledAt &&
        new Date(lesson.scheduledAt) > now &&
        lesson.liveStatus !== 'LIVE_NOW' &&
        lesson.liveStatus !== 'COMPLETED';

      if (isScheduledFuture) {
        throw new ForbiddenException('التعليقات مغلقة حالياً لهذا الدرس حتى يحين موعده المحدد.');
      }
    }

    if (examId) {
      const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) throw new NotFoundException('Exam not found');
    }


    let finalMentionedUserIds = mentionedUserIds ? [...mentionedUserIds] : [];

    // Check if parent comment exists if parentId is provided
    if (parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }

      // Automatically mention the author of the parent comment (if it's not the user replying to themselves)
      if (parent.userId !== userId && !finalMentionedUserIds.includes(parent.userId)) {
        finalMentionedUserIds.push(parent.userId);
      }
    }

    // Automatically notify the course/exam teacher if someone comments or replies
    let teacherUserId: number | null = null;
    if (lessonId) {
      const lessonWithTeacher = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { module: { select: { course: { select: { teacher: { select: { userId: true } } } } } } }
      });
      teacherUserId = lessonWithTeacher?.module?.course?.teacher?.userId ?? null;
    } else if (examId) {
      const examWithTeacher = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: {
          course: { select: { teacher: { select: { userId: true } } } },
          lesson: { select: { module: { select: { course: { select: { teacher: { select: { userId: true } } } } } } } }
        }
      });
      teacherUserId = examWithTeacher?.course?.teacher?.userId ?? examWithTeacher?.lesson?.module?.course?.teacher?.userId ?? null;
    }

    if (teacherUserId && teacherUserId !== userId && !finalMentionedUserIds.includes(teacherUserId)) {
      finalMentionedUserIds.push(teacherUserId);
    }

    const commentData: any = {
      text,
      userId,
      parentId,
      ...(lessonId && { lessonId }),
      ...(examId && { examId }),
      ...(imageUrl && { imageUrl }),
    };

    // Remove the user's own ID from the mentions list so they don't get a notification for themselves
    finalMentionedUserIds = finalMentionedUserIds.filter(id => id !== userId);

    if (finalMentionedUserIds && finalMentionedUserIds.length > 0) {
      commentData.mentions = {
        create: finalMentionedUserIds.map(id => ({
          mentionedUserId: id
        }))
      };
    }

    return this.prisma.comment.create({
      data: commentData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true,
          }
        }
      }
    });
  }

  async getCommentsByLesson(lessonId: number, userId?: number) {
    // Check if lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!lesson || lesson.status !== 'PUBLISHED') {
      throw new NotFoundException('Lesson not found');
    }

    if (userId) {
      const isStaff = await this.isStaffOrInstructor(lesson.module.course.instructorId, userId);
      const now = new Date();
      const isScheduledFuture =
        !isStaff &&
        lesson.scheduledAt &&
        new Date(lesson.scheduledAt) > now &&
        lesson.liveStatus !== 'LIVE_NOW' &&
        lesson.liveStatus !== 'COMPLETED';

      if (isScheduledFuture) {
        throw new ForbiddenException('التعليقات والدردشة مغلقة حالياً لهذا الدرس حتى يحين موعده المحدد.');
      }
    }

    // Fetch top-level comments with their nested replies
    // استبعاد إشعارات تسليم التكاليف وتصحيحها من قسم التعليقات العام للدرس حتى لا تتلوث التعليقات ولا يراها بقية الطلاب
    return this.prisma.comment.findMany({
      where: {
        lessonId,
        parentId: null,
        NOT: {
          OR: [
            { text: { contains: 'بتسليم تكليف' } },
            { text: { contains: 'بالرد على تكليفك' } },
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true,
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                createdAt: true,
              }
            }
          },
          orderBy: {
            createdAt: 'asc',
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getCommentsByExam(examId: number, userId?: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    return this.prisma.comment.findMany({
      where: {
        examId,
        parentId: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true,
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                createdAt: true,
              }
            }
          },
          orderBy: {
            createdAt: 'asc',
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getLatestCommentsByCourse(courseId: number, limit: number = 5) {
    return this.prisma.comment.findMany({
      where: {
        lesson: {
          status: 'PUBLISHED',
          module: {
            courseId: courseId
          }
        },
        parentId: null // Only fetch top-level comments
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true
          }
        },
        lesson: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
  }

  async update(userId: number, commentId: number, text: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You are not allowed to update this comment');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { text },
    });
  }

  async remove(userId: number, userRole: string, commentId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        lesson: {
          include: {
            module: { include: { course: { include: { teacher: true } } } }
          }
        },
        exam: {
          include: {
            course: { include: { teacher: true } },
            lesson: { include: { module: { include: { course: { include: { teacher: true } } } } } }
          }
        }
      }
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const isOwner = comment.userId === userId;
    const isOwnerRole = userRole === 'OWNER';
    let isInstructor = false;

    if (comment.lesson) {
      isInstructor = comment.lesson.module.course.teacher.userId === userId;
    } else if (comment.exam) {
      if (comment.exam.course) {
        isInstructor = comment.exam.course.teacher.userId === userId;
      } else if (comment.exam.lesson) {
        isInstructor = comment.exam.lesson.module.course.teacher.userId === userId;
      }
    }

    if (!isOwner && !isOwnerRole && !isInstructor) {
      throw new ForbiddenException('You are not allowed to delete this comment');
    }

    return this.prisma.comment.delete({
      where: { id: commentId },
    });
  }

  async getMyMentions(userId: number, userRole: Role = Role.STUDENT, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // كل مستخدم (طالباً كان أو معلماً أو أدمن) يجلب فقط الإشعارات والإشارات الموجهة إليه حصرياً
    // هذا يمنع تكرار إشعارات الإعلانات العامة للكورسات (مثل إضافة اختبار جديد أو درس جديد) للأدمن/المعلم بعدد الطلاب
    const whereClause: Prisma.MentionWhereInput = {
      mentionedUserId: userId,
    };

    const [data, total] = await Promise.all([
      (this.prisma.mention.findMany as any)({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          comment: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true }
              },
              lesson: {
                select: { id: true, title: true }
              },
              exam: {
                select: { id: true, title: true }
              },
              parent: {
                select: { userId: true }
              }
            }
          },
          postComment: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true }
              },
              post: {
                select: { id: true, title: true, content: true }
              },
              parent: {
                select: { userId: true }
              }
            }
          },
          post: {
            include: {
              author: {
                select: { id: true, name: true, avatar: true }
              }
            }
          }
        }
      }),
      this.prisma.mention.count({
        where: whereClause
      })
    ]);

    const mappedData = data.map((mention: any) => {
      if (mention.comment) {
        const isReply = mention.comment.parent && mention.comment.parent.userId === mention.mentionedUserId;
        let type: string = isReply ? 'REPLY' : 'MENTION';
        const text = mention.comment.text || '';

        if (
          text.includes('تمت الموافقة على اشتراكك') ||
          text.includes('تم قبول اشتراكك') ||
          text.includes('تفعيل دورتك بنجاح') ||
          text.includes('طلب اشتراكك في كورس')
        ) {
          type = 'COURSE_ENROLLMENT';
        } else if (
          text.includes('نتيجة الاختبار') ||
          text.includes('انتهى وقت اختبار') ||
          text.includes('إعلان نتائج وتكريم الأوائل')
        ) {
          type = 'EXAM_RESULT';
        } else if (
          text.includes('بإضافة اختبار جديد') ||
          text.includes('بإضافة كويز') ||
          text.includes('بإضافة تحدي') ||
          text.includes('بإضافة الاختبار النهائي') ||
          text.includes('اختبار جديد بعنوان')
        ) {
          type = 'NEW_EXAM';
        } else if (text.includes('بالرد على تكليفك') || text.includes('قام المعلم بالرد')) {
          type = 'ASSIGNMENT_FEEDBACK';
        } else if (text.includes('بتسليم تكليف') || text.includes('قام الطالب بتسليم')) {
          type = 'ASSIGNMENT_SUBMISSION';
        } else if (text.includes('بإضافة درس جديد') || text.includes('درس جديد بعنوان')) {
          type = 'NEW_LESSON';
        }

        return {
          ...mention,
          type,
        };
      }

      if (mention.postComment) {
        const isReply = (mention.postComment.parent && mention.postComment.parent.userId === mention.mentionedUserId) ||
                        (mention.postComment.post.authorId === mention.mentionedUserId && !mention.postComment.parent);
        return {
          id: mention.id,
          isRead: mention.isRead,
          createdAt: mention.createdAt,
          commentId: mention.postComment.id,
          mentionedUserId: mention.mentionedUserId,
          type: isReply ? 'REPLY' : 'MENTION',
          comment: {
            id: mention.postComment.id,
            text: mention.postComment.text,
            imageUrl: mention.postComment.imageUrl,
            createdAt: mention.postComment.createdAt,
            updatedAt: mention.postComment.updatedAt,
            lessonId: null,
            examId: null,
            postId: mention.postComment.postId,
            post: {
              id: mention.postComment.post.id,
              title: mention.postComment.post.title || (mention.postComment.post.content ? mention.postComment.post.content.substring(0, 30) : 'منشور'),
            },
            user: mention.postComment.user,
            parentId: mention.postComment.parentId,
            parent: mention.postComment.parent ? { userId: mention.postComment.parent.userId } : null,
            replies: [],
          }
        };
      }

      if (mention.post) {
        return {
          id: mention.id,
          isRead: mention.isRead,
          createdAt: mention.createdAt,
          commentId: mention.post.id,
          mentionedUserId: mention.mentionedUserId,
          type: 'MENTION',
          comment: {
            id: mention.post.id,
            text: mention.post.content,
            imageUrl: mention.post.imageUrl,
            createdAt: mention.post.createdAt,
            updatedAt: mention.post.updatedAt,
            lessonId: null,
            examId: null,
            postId: mention.post.id,
            post: {
              id: mention.post.id,
              title: mention.post.title || (mention.post.content ? mention.post.content.substring(0, 30) : 'منشور'),
            },
            user: mention.post.author,
            parentId: null,
            replies: [],
          }
        };
      }

      return {
        ...mention,
        type: 'MENTION'
      };
    });

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getUnreadMentionsCount(userId: number, userRole: Role = Role.STUDENT) {
    const whereClause: Prisma.MentionWhereInput = {
      mentionedUserId: userId,
      isRead: false,
    };

    const count = await this.prisma.mention.count({
      where: whereClause
    });
    return { count };
  }

  async markMentionAsRead(userId: number, userRole: Role, mentionId: number) {
    const mention = await this.prisma.mention.findUnique({
      where: { id: mentionId }
    });
    if (!mention) {
      throw new NotFoundException('Mention not found');
    }

    const isAuthorized = mention.mentionedUserId === userId;

    if (!isAuthorized) {
      throw new ForbiddenException('You do not have access to this mention');
    }

    return this.prisma.mention.update({
      where: { id: mentionId },
      data: { isRead: true }
    });
  }
}
