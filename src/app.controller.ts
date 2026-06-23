import { Controller, Get, Param, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
