import { Controller, Post, UploadedFile, UploadedFiles, UseInterceptors, BadRequestException, UseGuards } from '@nestjs/common';
import { AuthRollGuard } from '../auth/guards/auth-roll.guard';
import { userRoles } from '../auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadcareStorageService } from '../utils/uploadcare-storage.service';

@Controller('media')
export class MediaController {
  constructor(private readonly uploadcareStorageService: UploadcareStorageService) {}

  @Post(['images', 'upload'])
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ], {
    storage: memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  }))
  async uploadImage(@UploadedFiles() files: { file?: Express.Multer.File[]; image?: Express.Multer.File[] }) {
    const file = files?.file?.[0] || files?.image?.[0];
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    try {
      const url = await this.uploadcareStorageService.upload(file);
      return {
        url,
        imageUrl: url,
        message: 'Image uploaded successfully'
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('videos')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(mp4|mov|avi|quicktime|x-msvideo)$/)) {
        return cb(new BadRequestException('Only video files (mp4, mov, avi) are allowed!'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    try {
      const url = await this.uploadcareStorageService.upload(file);
      return {
        url,
        message: 'Video uploaded successfully'
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
