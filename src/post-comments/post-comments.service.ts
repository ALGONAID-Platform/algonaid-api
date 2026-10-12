import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { UpdatePostCommentDto } from './dto/update-post-comment.dto';
import { Role } from '@prisma/client';

@Injectable()
export class PostCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(postId: number, userId: number, dto: CreatePostCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('المنشور غير موجود');
    if (!post.allowComments) throw new ForbiddenException('التعليقات مغلقة لهذا المنشور');

    let parent: { id: number; userId: number } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.postComment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, userId: true },
      });
      if (!parent) throw new NotFoundException('التعليق المردود عليه غير موجود');
    }

    let finalMentionedUserIds: number[] = dto.mentionedUserIds ? [...dto.mentionedUserIds] : [];

    // Extract markdown mentions @[Name](id) or @[id](Name)
    if (dto.text) {
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(dto.text)) !== null) {
        const first = match[1];
        const second = match[2];
        let parsedId = parseInt(second, 10);
        if (isNaN(parsedId)) {
          parsedId = parseInt(first, 10);
        }
        if (!isNaN(parsedId) && !finalMentionedUserIds.includes(parsedId)) {
          finalMentionedUserIds.push(parsedId);
        }
      }
    }

    // Automatically notify the author of the parent comment if it's a reply
    if (parent && parent.userId !== userId && !finalMentionedUserIds.includes(parent.userId)) {
      finalMentionedUserIds.push(parent.userId);
    }

    // Automatically notify the author of the post when someone comments on their post
    if (post.authorId !== userId && !finalMentionedUserIds.includes(post.authorId)) {
      finalMentionedUserIds.push(post.authorId);
    }

    // Filter out the commenter themselves
    finalMentionedUserIds = finalMentionedUserIds.filter(id => id !== userId);

    if (finalMentionedUserIds.length > 0) {
      const validUsers = await this.prisma.user.findMany({
        where: { id: { in: finalMentionedUserIds } },
        select: { id: true },
      });
      finalMentionedUserIds = validUsers.map(u => u.id);
    }

    return (this.prisma.postComment.create as any)({
      data: {
        text: dto.text,
        imageUrl: dto.imageUrl,
        postId,
        userId,
        parentId: dto.parentId,
        ...(finalMentionedUserIds.length > 0 && {
          mentions: {
            create: finalMentionedUserIds.map(targetUserId => ({
              mentionedUserId: targetUserId,
              postId,
            })),
          },
        }),
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
  }

  async findAllByPost(postId: number) {
    return this.prisma.postComment.findMany({
      where: { postId, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async update(commentId: number, userId: number, userRole: Role, dto: UpdatePostCommentDto) {
    const comment = await this.prisma.postComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('التعليق غير موجود');

    // Only the author can update their own comment, or an Owner
    if (comment.userId !== userId && userRole !== Role.OWNER) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا التعليق');
    }

    return this.prisma.postComment.update({
      where: { id: commentId },
      data: {
        text: dto.text,
        imageUrl: dto.imageUrl,
      },
    });
  }

  async remove(commentId: number, userId: number, userRole: Role) {
    const comment = await this.prisma.postComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('التعليق غير موجود');

    if (comment.userId !== userId && userRole !== Role.OWNER) {
      throw new ForbiddenException('غير مصرح لك بحذف هذا التعليق');
    }

    return this.prisma.postComment.delete({
      where: { id: commentId },
    });
  }
}
