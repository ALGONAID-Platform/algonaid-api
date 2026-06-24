import { Controller, Get, Param, Header, Post, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadcareStorageService } from './utils/uploadcare-storage.service';
import { AuthRollGuard } from './auth/guards/auth-roll.guard';
import { userRoles } from './auth/decorators/user_roll.decorator';
import { Role } from './prisma/client/enums';
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
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload general image (e.g., from RTF editor)' })
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
