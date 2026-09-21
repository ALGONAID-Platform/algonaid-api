import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UploadcareStorageService } from '../utils/uploadcare-storage.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommentsController],
  providers: [CommentsService, UploadcareStorageService],
})
export class CommentsModule {}
