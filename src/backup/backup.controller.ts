import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayloadType } from 'src/utils/types';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('admin-database-backup')
@ApiBearerAuth('JWT-auth')
@Controller('admin/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @ApiOperation({ summary: 'إنشاء نسخة احتياطية جديدة لقاعدة البيانات (للأدمن والمالك)' })
  @ApiResponse({ status: 201, description: 'تم إنشاء النسخة الاحتياطية بنجاح.' })
  @Post('create')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.OWNER, Role.ADMIN)
  async createBackup(
    @CurrentUser() user: JwtPayloadType,
    @Body() dto: CreateBackupDto,
  ) {
    return this.backupService.createBackup(user, dto);
  }

  @ApiOperation({ summary: 'عرض قائمة النسخ الاحتياطية المحفوظة على السيرفر' })
  @ApiResponse({ status: 200, description: 'قائمة بالنسخ الاحتياطية وتواريخها وأحجامها.' })
  @Get()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.OWNER, Role.ADMIN)
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Get('list')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.OWNER, Role.ADMIN)
  async listBackupsAlias() {
    return this.backupService.listBackups();
  }

  @ApiOperation({ summary: 'فحص والتحقق من سلامة نسخة احتياطية (Checksum & Verification)' })
  @ApiParam({ name: 'fileName', description: 'اسم ملف النسخة الاحتياطية' })
  @Get(':fileName/verify')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.OWNER, Role.ADMIN)
  async verifyBackup(@Param('fileName') fileName: string) {
    return this.backupService.verifyBackup(fileName);
  }

  @ApiOperation({ summary: 'تحميل ملف النسخة الاحتياطية إلى جهاز المستخدم' })
  @ApiParam({ name: 'fileName', description: 'اسم ملف النسخة الاحتياطية' })
  @Get(':fileName/download')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.OWNER, Role.ADMIN)
  async downloadBackup(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName: safeName } = this.backupService.getBackupDownloadPath(fileName);
    return res.download(filePath, safeName);
  }

  @ApiOperation({ summary: 'استرجاع قاعدة البيانات من نسخة احتياطية (خاص بالمالك OWNER فقط)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiResponse({ status: 200, description: 'تم استرجاع قاعدة البيانات بنجاح.' })
  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRollGuard)
  @userRoles(Role.OWNER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 200 * 1024 * 1024 }, // حتى 200 ميجابايت للنسخ الكبيرة
    }),
  )
  async restoreBackup(
    @CurrentUser() user: JwtPayloadType,
    @Body() dto: RestoreBackupDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.backupService.restoreBackup(user, dto, file);
  }

  @ApiOperation({ summary: 'حذف نسخة احتياطية قديمة من السيرفر (خاص بالمالك OWNER فقط)' })
  @ApiParam({ name: 'fileName', description: 'اسم ملف النسخة الاحتياطية' })
  @Delete(':fileName')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.OWNER)
  async deleteBackup(@Param('fileName') fileName: string) {
    return this.backupService.deleteBackup(fileName);
  }
}
