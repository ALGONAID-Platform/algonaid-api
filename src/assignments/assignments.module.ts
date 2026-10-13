import { Module } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { UploadcareStorageService } from 'src/utils/uploadcare-storage.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, UploadcareStorageService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}

