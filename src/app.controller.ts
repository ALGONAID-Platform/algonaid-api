import { Controller, Get, Param, Header, Post, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import { UploadcareStorageService } from './utils/uploadcare-storage.service';
import { AuthRollGuard } from './auth/guards/auth-roll.guard';
import { userRoles } from './auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly uploadcareStorageService: UploadcareStorageService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('.well-known/assetlinks.json')
  @ApiOperation({ summary: 'Serve Android App Links configuration' })
  getAssetLinks() {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.algonaid.app',
          sha256_cert_fingerprints: [
            '9F:A0:38:8A:41:31:FB:43:8D:E3:E4:C3:13:1F:D9:E6:42:4D:3B:96:30:71:82:68:04:96:92:C2:AA:A2:92:6D'
          ],
        },
      },
    ];
  }

  @Get('modulesList/:courseId')
  @Header('Content-Type', 'text/html')
  getCourseRedirect(@Param('courseId') courseId: string): string {
    return this.appService.getRedirectPage('course', courseId);
  }

  @Get('lessonDetails/:lessonId')
  @Header('Content-Type', 'text/html')
  getLessonRedirect(@Param('lessonId') lessonId: string): string {
    return this.appService.getRedirectPage('lesson', lessonId);
  }

  @Post('upload/image')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'مسموح برفع صور وملفات PDF فقط',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload general image or PDF' })
  @ApiConsumes('multipart/form-data')
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadcareStorageService.upload(file);
    return {
      url,
      filename: file.originalname,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}
