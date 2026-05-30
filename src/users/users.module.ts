import { Module, BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MulterModule } from '@nestjs/platform-express/multer';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { uploadsFolder } from 'src/utils/conistants';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: `./${uploadsFolder}`,
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `profile-${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          return callback(new BadRequestException('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    })
  ],
  controllers: [UsersController],
  providers: [UsersService]
})
export class UsersModule {}
