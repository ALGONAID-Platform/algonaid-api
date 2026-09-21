import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createCommentDto: CreateCommentDto) {
    const { text, lessonId, parentId, mentionedUserIds, imageUrl } = createCommentDto;

    // Check if lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.status !== 'PUBLISHED') {
      throw new ForbiddenException('Comments are unavailable for unpublished lessons');
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

    // Build the data object
    const commentData: any = {
      text,
      userId,
      lessonId,
      parentId,
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

  async getCommentsByLesson(lessonId: number) {
    // Check if lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson || lesson.status !== 'PUBLISHED') {
      throw new NotFoundException('Lesson not found');
    }

    // Fetch top-level comments with their nested replies
    return this.prisma.comment.findMany({
      where: {
        lessonId,
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
            module: {
              include: {
                course: {
                  include: {
                    teacher: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const isOwner = comment.userId === userId;
    const isOwnerRole = userRole === 'OWNER';
    const isInstructor = comment.lesson.module.course.teacher.userId === userId;

    if (!isOwner && !isOwnerRole && !isInstructor) {
      throw new ForbiddenException('You are not allowed to delete this comment');
    }

    return this.prisma.comment.delete({
      where: { id: commentId },
    });
  }

  async getMyMentions(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.mention.findMany({
        where: { mentionedUserId: userId },
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
              parent: {
                select: { userId: true }
              }
            }
          }
        }
      }),
      this.prisma.mention.count({
        where: { mentionedUserId: userId }
      })
    ]);

    const mappedData = data.map(mention => {
      const isReply = mention.comment.parent && mention.comment.parent.userId === mention.mentionedUserId;
      // We can remove parent from the final output if we want, or leave it. We'll leave it for simplicity.
      return {
        ...mention,
        type: isReply ? 'REPLY' : 'MENTION'
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

  async getUnreadMentionsCount(userId: number) {
    const count = await this.prisma.mention.count({
      where: {
        mentionedUserId: userId,
        isRead: false
      }
    });
    return { count };
  }

  async markMentionAsRead(userId: number, mentionId: number) {
    const mention = await this.prisma.mention.findUnique({
      where: { id: mentionId }
    });
    if (!mention) {
      throw new NotFoundException('Mention not found');
    }
    if (mention.mentionedUserId !== userId) {
      throw new ForbiddenException('You do not have access to this mention');
    }

    return this.prisma.mention.update({
      where: { id: mentionId },
      data: { isRead: true }
    });
  }
}
