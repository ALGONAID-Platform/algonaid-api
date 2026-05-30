import { BadRequestException, Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { MulterModule } from '@nestjs/platform-express/multer';
import { extname } from 'path/win32';
import { diskStorage } from 'multer';
import { pdfFileSizeLimit, UniqueSuffix, uploadsFolder } from 'src/utils/conistants';
import { MESSAGES } from 'src/utils/messages';

@Module({
  imports: [
    MulterModule.register(
      {  
        storage: diskStorage({
          destination: `./${uploadsFolder}`,
          filename: (req, file, callback) => {
            const uniqueSuffix = UniqueSuffix;
            const ext = extname(file.originalname);
            callback(null, `lesson-pdf-${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(pdf)$/)) {
            return callback(new BadRequestException(MESSAGES.LESSONS.ONLY_PDF_ALLOWED), false);
          }
          callback(null, true);
        },
        limits: { fileSize: pdfFileSizeLimit }, // Limit file size to 10MB

      }
    )
    ,
    PrismaModule,
    AuthModule
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule { }


