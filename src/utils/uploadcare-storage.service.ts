import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadcareStorageService {
  constructor(private configService: ConfigService) {}

  async upload(file: Express.Multer.File, customFolder?: string): Promise<string> {
    if (!file) {
      throw new BadRequestException('لم يتم رفع أي ملف');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/avi',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'الملف المرفوع غير مدعوم. مسموح برفع صور، PDF، وفيديوهات (mp4, mov, avi) فقط.',
      );
    }

    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('فشل معالجة محتوى الملف');
    }

    if (!file.size || file.size <= 0) {
      throw new BadRequestException('الملف فارغ أو غير صالح');
    }

    // تحديد المجلد: إما المجلد المخصص أو بناءً على نوع الملف
    let defaultFolder = 'images';
    if (file.mimetype === 'application/pdf') {
      defaultFolder = 'docs';
    } else if (file.mimetype.startsWith('video/')) {
      defaultFolder = 'videos';
    }
    const folderName = customFolder || defaultFolder;
    const uploadDir = path.join('/usr/src/app/uploads', folderName);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const safeExtension = ext === '.jpeg' ? '.jpg' : ext;

    const randomString = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');

    const fileName = `${randomString}${safeExtension}`;
    const fullPath = path.join(uploadDir, fileName);

    fs.writeFileSync(fullPath, file.buffer);

    const rawUrl =
      this.configService.get<string>('APP_URL') ||
      'https://api.exchangesmangement.online';

    const domain = new URL(rawUrl).origin;

    return `${domain}/uploads/${folderName}/${fileName}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (fileUrl && fileUrl.includes('/uploads/')) {
        const relativePath = fileUrl.split('/uploads/')[1];
        const filePath = path.join('/usr/src/app/uploads', relativePath);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.log(`Error deleting file: ${error.message}`);
    }
  }
}