import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createCommentDto: CreateCommentDto) {
    const { text, lessonId, parentId } = createCommentDto;

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

    // Check if parent comment exists if parentId is provided
    if (parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    return this.prisma.comment.create({
      data: {
        text,
        userId,
        lessonId,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
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
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
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
            avatar: true
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
                course: true
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
    const isAdminOrOwner = userRole === 'ADMIN' || userRole === 'OWNER';
    const isInstructor = comment.lesson.module.course.instructorId === userId;

    if (!isOwner && !isAdminOrOwner && !isInstructor) {
      throw new ForbiddenException('You are not allowed to delete this comment');
    }

    return this.prisma.comment.delete({
      where: { id: commentId },
    });
  }
}
