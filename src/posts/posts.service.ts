import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPostDto: CreatePostDto, authorId: number) {
    const { pollOptions, ...postData } = createPostDto;

    let mentionedUserIds: number[] = [];
    if (postData.content) {
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(postData.content)) !== null) {
        const first = match[1];
        const second = match[2];
        let parsedId = parseInt(second, 10);
        if (isNaN(parsedId)) {
          parsedId = parseInt(first, 10);
        }
        if (!isNaN(parsedId) && parsedId !== authorId && !mentionedUserIds.includes(parsedId)) {
          mentionedUserIds.push(parsedId);
        }
      }
    }

    if (mentionedUserIds.length > 0) {
      const validUsers = await this.prisma.user.findMany({
        where: { id: { in: mentionedUserIds } },
        select: { id: true },
      });
      mentionedUserIds = validUsers.map(u => u.id);
    }
    
    return (this.prisma.post.create as any)({
      data: {
        ...postData,
        authorId,
        pollOptions: postData.isPoll && pollOptions ? {
          create: pollOptions.map(text => ({ text }))
        } : undefined,
        ...(mentionedUserIds.length > 0 && {
          mentions: {
            create: mentionedUserIds.map(uid => ({
              mentionedUserId: uid,
            })),
          },
        }),
      },
    });
  }

  async findAll(userId: number, cursor?: number, limit: number = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 50); // between 1 and 50
    const args: any = {
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, avatar: true, role: true } },
        _count: { select: { comments: true, likes: true } },
        pollOptions: { include: { _count: { select: { votes: true } } } },
        likes: { where: { userId }, select: { id: true } },
      },
    };
    if (cursor) {
      args.cursor = { id: cursor };
      args.skip = 1;
    }
    const posts = await this.prisma.post.findMany(args);
    return posts.map((post: any) => {
      const hasLiked = post.likes && post.likes.length > 0;
      delete post.likes;
      return { ...post, hasLiked };
    });
  }

  async findOne(id: number, userId?: number) {
    if (userId) {
      // Unique View Tracking
      const existingView = await this.prisma.postView.findUnique({
        where: { postId_userId: { postId: id, userId } },
      });
      
      if (!existingView) {
        await this.prisma.$transaction([
          this.prisma.postView.create({ data: { postId: id, userId } }),
          this.prisma.post.update({ where: { id }, data: { views: { increment: 1 } } })
        ]).catch(() => null); // Ignore race conditions
      }
    }
    
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true, role: true } },
        _count: { select: { comments: true, likes: true } },
        pollOptions: { include: { _count: { select: { votes: true } } } },
        likes: userId ? { where: { userId }, select: { id: true } } : false,
      },
    });
    
    if (!post) {
      throw new NotFoundException('المنشور غير موجود');
    }
    
    let hasLiked = false;
    const postAny = post as any;
    if (postAny.likes) {
      hasLiked = postAny.likes.length > 0;
      delete postAny.likes;
    }
    
    return { ...postAny, hasLiked };
  }

  async update(id: number, updatePostDto: UpdatePostDto, userId: number, role: string) {
    const post = await this.findOne(id); // Check existence
    
    if (post.authorId !== userId && role !== 'OWNER') {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا المنشور');
    }
    
    // We prevent updating poll options directly here to preserve vote integrity.
    const { pollOptions, ...postData } = updatePostDto;
    
    return this.prisma.post.update({
      where: { id },
      data: postData,
    });
  }

  async remove(id: number, userId: number, role: string) {
    const post = await this.findOne(id); // Check existence
    
    if (post.authorId !== userId && role !== 'OWNER') {
      throw new ForbiddenException('غير مصرح لك بحذف هذا المنشور');
    }
    
    return this.prisma.post.delete({
      where: { id },
    });
  }

  async toggleLike(postId: number, userId: number) {
    await this.findOne(postId); // Check existence
    const existingLike = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingLike) {
      await this.prisma.postLike.delete({
        where: { id: existingLike.id },
      });
      return { message: 'تم إزالة الإعجاب', liked: false };
    } else {
      await this.prisma.postLike.create({
        data: { postId, userId },
      });
      return { message: 'تم الإعجاب', liked: true };
    }
  }

  async votePoll(postId: number, optionId: number, userId: number) {
    const post = await this.findOne(postId);
    if (!post.isPoll) {
      throw new NotFoundException('هذا المنشور ليس استطلاعاً');
    }

    const option = await this.prisma.pollOption.findFirst({
      where: { id: optionId, postId }
    });
    if (!option) {
      throw new NotFoundException('الخيار غير موجود');
    }

    // Check if user already voted in this poll
    const existingVote = await this.prisma.pollVote.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingVote) {
      throw new NotFoundException('لقد قمت بالتصويت مسبقاً في هذا الاستطلاع');
    }

    await this.prisma.pollVote.create({
      data: { postId, optionId, userId },
    });

    return { message: 'تم تسجيل تصويتك بنجاح' };
  }
}
