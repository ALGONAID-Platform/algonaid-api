import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { AuthRollGuard } from '../auth/guards/auth-roll.guard';
import { userRoles } from '../auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage, diskStorage } from 'multer';
import { UploadcareStorageService } from '../utils/uploadcare-storage.service';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * دالة مساعدة لتحديد مسار مجلد uploads الرئيسي سواء في بيئة دوكر أو محلياً
 */
function getUploadsBasePath(): string {
  if (process.env.UPLOADS_PATH && fs.existsSync(process.env.UPLOADS_PATH)) {
    return process.env.UPLOADS_PATH;
  }
  if (fs.existsSync('/usr/src/app/uploads')) {
    return '/usr/src/app/uploads';
  }
  const localUploads = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(localUploads)) {
    fs.mkdirSync(localUploads, { recursive: true });
  }
  return localUploads;
}

/**
 * إعداد DiskStorage للتعامل مع الفيديوهات الكبيرة حتى 1 جيجابايت دون استهلاك RAM السيرفر
 */
const videoDiskStorage = diskStorage({
  destination: (req: any, file: any, cb: any) => {
    try {
      const baseDir = getUploadsBasePath();
      const courseId =
        req.params?.courseId || req.query?.courseId || req.body?.courseId;

      const courseFolder = courseId ? `course_${courseId}` : 'general';
      const targetDir = path.join(baseDir, 'videos', courseFolder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      cb(null, targetDir);
    } catch (err) {
      cb(err, '');
    }
  },
  filename: (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const safeExt = allowed.includes(ext) ? ext : '.mp4';
    const randomHex = crypto.randomBytes(16).toString('hex');
    const safeName = `${Date.now()}_${randomHex}${safeExt}`;
    cb(null, safeName);
  },
});

const videoFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi',
    'video/x-matroska',
    'video/webm',
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

  if (
    allowedMimes.includes(file.mimetype) ||
    file.mimetype.startsWith('video/') ||
    allowedExts.includes(ext)
  ) {
    return cb(null, true);
  }
  return cb(
    new BadRequestException(
      'نوع الملف غير مدعوم، يُسمح فقط بملفات الفيديو (mp4, mov, avi, mkv, webm)',
    ),
    false,
  );
};

// الحد الأقصى لحجم الفيديو: 1 جيجابايت
const ONE_GIGABYTE = 1024 * 1024 * 1024;

@ApiTags('Media & Uploads')
@Controller('media')
export class MediaController {
  constructor(
    private readonly uploadcareStorageService: UploadcareStorageService,
    private readonly configService: ConfigService,
  ) {}

  @Post(['images', 'upload'])
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: (req, file, cb) => {
          if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
            return cb(
              new BadRequestException('Only image files are allowed!'),
              false,
            );
          }
          cb(null, true);
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
      },
    ),
  )
  async uploadImage(
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; image?: Express.Multer.File[] },
  ) {
    const file = files?.file?.[0] || files?.image?.[0];
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const url = await this.uploadcareStorageService.upload(file);
      return {
        url,
        imageUrl: url,
        message: 'Image uploaded successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * رفع فيديو لكورس معين (حتى 1 جيجابايت) وحفظه في مجلد خاص بالكورس uploads/videos/course_<id>/
   */
  @Post('videos')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({
    summary:
      'رفع فيديو لكورس (حتى حجم 1 جيجابايت) وتخزينه في مجلد الكورس uploads/videos/course_<id>/',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'courseId',
    required: false,
    description: 'رقم الكورس لحفظ الفيديو داخل مجلده المخصص',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'ملف الفيديو (mp4, mov, avi, mkv, webm)',
        },
        video: {
          type: 'string',
          format: 'binary',
          description: 'بديل لحقل file',
        },
        courseId: {
          type: 'number',
          description: 'رقم الكورس لإنشاء مجلد مخصص له',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'تم رفع الفيديو بنجاح وإرجاع رابطه المباشر',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: videoDiskStorage,
        fileFilter: videoFileFilter,
        limits: { fileSize: ONE_GIGABYTE },
      },
    ),
  )
  async uploadVideo(
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; video?: Express.Multer.File[] },
    @Body('courseId') bodyCourseId?: string | number,
    @Query('courseId') queryCourseId?: string | number,
  ) {
    const file = files?.file?.[0] || files?.video?.[0];
    const courseId = bodyCourseId || queryCourseId;
    return this.handleUploadedVideo(file, courseId);
  }

  /**
   * مسار مباشر لرفع فيديو كورس بالـ ID في الرابط: POST /media/courses/:courseId/videos
   */
  @Post('courses/:courseId/videos')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({
    summary:
      'رفع فيديو لمسار كورس محدد POST /media/courses/:courseId/videos (حتى 1 جيجابايت)',
  })
  @ApiParam({ name: 'courseId', description: 'رقم الكورس' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: videoDiskStorage,
        fileFilter: videoFileFilter,
        limits: { fileSize: ONE_GIGABYTE },
      },
    ),
  )
  async uploadCourseVideo(
    @Param('courseId') courseId: string,
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ) {
    const file = files?.file?.[0] || files?.video?.[0];
    return this.handleUploadedVideo(file, courseId);
  }

  /**
   * معالجة الملف المرفوع ونقله إلى مجلد الكورس النهائي وحساب الرابط العام
   */
  private handleUploadedVideo(
    file?: Express.Multer.File,
    rawCourseId?: string | number,
  ) {
    if (!file) {
      throw new BadRequestException('لم يتم إرسال أي ملف فيديو صالح');
    }

    const courseId = rawCourseId ? String(rawCourseId).trim() : null;
    const baseDir = getUploadsBasePath();
    const targetFolder = courseId ? `course_${courseId}` : 'general';
    const targetDir = path.join(baseDir, 'videos', targetFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, file.filename);

    // إذا تم تخزين الملف في مجلد مؤقت (مثل general) لأن courseId أُرسل بعد حقل الملف، ننقله إلى مجلد الكورس
    if (file.path && file.path !== targetFilePath && fs.existsSync(file.path)) {
      try {
        fs.renameSync(file.path, targetFilePath);
      } catch (e) {
        fs.copyFileSync(file.path, targetFilePath);
        fs.unlinkSync(file.path);
      }
    }

    const rawUrl =
      this.configService.get<string>('APP_URL') ||
      'https://api.exchangesmangement.online';
    const domain = new URL(rawUrl).origin;

    const relativePath = `uploads/videos/${targetFolder}/${file.filename}`;
    const fullUrl = `${domain}/${relativePath}`;

    return {
      success: true,
      message: 'تم رفع الفيديو بنجاح وحفظه في مجلد الكورس',
      url: fullUrl,
      videoUrl: fullUrl,
      relativePath,
      courseId: courseId
        ? isNaN(Number(courseId))
          ? courseId
          : Number(courseId)
        : null,
      folder: `videos/${targetFolder}`,
      fileName: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
