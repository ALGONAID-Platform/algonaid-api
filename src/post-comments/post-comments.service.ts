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

    if (dto.parentId) {
      const parent = await this.prisma.postComment.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('التعليق المردود عليه غير موجود');
    }

    return this.prisma.postComment.create({
      data: {
        text: dto.text,
        imageUrl: dto.imageUrl,
        postId,
        userId,
        parentId: dto.parentId,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      }
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
          orderBy: { createdAt: 'asc' }
        }
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
