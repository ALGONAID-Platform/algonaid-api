import { Module } from '@nestjs/common';
import { ModulesController } from './controllers/modules.controller';
import { ModulesService } from './services/modules.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule { }
