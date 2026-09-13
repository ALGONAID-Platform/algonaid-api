import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadcareStorageService } from '../utils/uploadcare-storage.service';

@Controller('media')
export class MediaController {
  constructor(private readonly uploadcareStorageService: UploadcareStorageService) {}

  @Post('images')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    try {
      const url = await this.uploadcareStorageService.upload(file);
      return {
        url,
        message: 'Image uploaded successfully'
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
