import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class UploadcareStorageService {
  constructor(private configService: ConfigService) {}

  private getUploadsBaseDir(): string {
    if (fs.existsSync('/usr/src/app/uploads')) {
      return '/usr/src/app/uploads';
    }
    const localUploads = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(localUploads)) {
      fs.mkdirSync(localUploads, { recursive: true });
    }
    return localUploads;
  }

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

    // Step 1: Check the declared MIME type from HTTP header
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

    // Step 2: Validate actual file content (magic bytes) — prevents MIME type spoofing
    let detectedType: { mime: string; ext: string } | undefined;
    try {
      const fileTypeModule = await eval('import("file-type")');
      const fileTypeFromBuffer =
        fileTypeModule.fileTypeFromBuffer ??
        fileTypeModule.default?.fileTypeFromBuffer;
      if (typeof fileTypeFromBuffer === 'function') {
        detectedType = await fileTypeFromBuffer(file.buffer);
      }
    } catch (_e) {
      // If file-type fails to load, skip magic bytes check
    }

    if (detectedType !== undefined) {
      const allowedRealMimes = new Set([
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'video/mp4', 'video/quicktime',
        'video/x-msvideo',
      ]);

      if (!allowedRealMimes.has(detectedType.mime)) {
        throw new BadRequestException(
          'محتوى الملف لا يطابق نوعه المُعلَن. يُرفض الملف لأسباب أمنية.',
        );
      }

      // Step 3: Ensure declared type matches actual content (no spoofing)
      const mimeMatchMap: Record<string, string[]> = {
        'image/jpeg':      ['image/jpeg'],
        'image/png':       ['image/png'],
        'image/gif':       ['image/gif'],
        'image/webp':      ['image/webp'],
        'application/pdf': ['application/pdf'],
        'video/mp4':       ['video/mp4'],
        'video/quicktime': ['video/quicktime'],
        'video/x-msvideo': ['video/x-msvideo'],
        'video/avi':       ['video/x-msvideo'],
      };

      const acceptedReal = mimeMatchMap[file.mimetype];
      if (acceptedReal && !acceptedReal.includes(detectedType.mime)) {
        throw new BadRequestException(
          `نوع الملف المُعلَن (${file.mimetype}) لا يتطابق مع المحتوى الفعلي (${detectedType.mime}).`,
        );
      }
    }

    // تحديد المجلد: إما المجلد المخصص أو بناءً على نوع الملف
    let defaultFolder = 'images';
    if (file.mimetype === 'application/pdf') {
      defaultFolder = 'docs';
    } else if (file.mimetype.startsWith('video/')) {
      defaultFolder = 'videos';
    }
    const rawFolder = customFolder || defaultFolder;
    const folderName = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '') || defaultFolder;
    const baseDir = this.getUploadsBaseDir();
    const uploadDir = path.join(baseDir, folderName);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'video/avi': '.avi',
    };
    const safeExtension = extensions[file.mimetype];
    if (!safeExtension) {
      throw new BadRequestException('Unsupported file type');
    }

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
        const safeBase = this.getUploadsBaseDir();
        const resolvedPath = path.resolve(safeBase, relativePath);

        // Prevent path traversal: ensure the resolved path is still within uploads/
        if (!resolvedPath.startsWith(safeBase + path.sep) && resolvedPath !== safeBase) {
          console.error(`[Security] Blocked path traversal attempt: ${fileUrl}`);
          return;
        }

        if (fs.existsSync(resolvedPath)) {
          fs.unlinkSync(resolvedPath);
        }
      }
    } catch (error) {
      console.log(`Error deleting file: ${error.message}`);
    }
  }
}