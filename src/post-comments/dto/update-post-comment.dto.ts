import { PartialType } from '@nestjs/swagger';
import { CreatePostCommentDto } from './create-post-comment.dto';

export class UpdatePostCommentDto extends PartialType(CreatePostCommentDto) {}
