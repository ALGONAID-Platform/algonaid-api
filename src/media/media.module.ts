import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { UploadcareStorageService } from '../utils/uploadcare-storage.service';

@Module({
  controllers: [MediaController],
  providers: [UploadcareStorageService],
})
export class MediaModule {}
