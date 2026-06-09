import { BadRequestException, Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { MulterModule } from '@nestjs/platform-express/multer';
import { memoryStorage } from 'multer';
import { pdfFileSizeLimit } from 'src/utils/conistants';
import { MESSAGES } from 'src/utils/messages';
import { SupabaseStorageService } from 'src/utils/supabase-storage.service';

@Module({
  imports: [
    MulterModule.register(
      {  
        storage: memoryStorage(),
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(pdf)$/)) {
            return callback(new BadRequestException(MESSAGES.LESSONS.ONLY_PDF_ALLOWED), false);
          }
          callback(null, true);
        },
        limits: { fileSize: pdfFileSizeLimit }, // Limit file size to 10MB
      }
    ),
    PrismaModule,
    AuthModule
  ],
  controllers: [LessonsController],
  providers: [LessonsService, SupabaseStorageService],
  exports: [LessonsService],
})
export class LessonsModule { }


