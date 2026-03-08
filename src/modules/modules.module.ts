import { Module } from '@nestjs/common';
import { ModulesController } from './controllers/modules.controller';
import { ModulesService } from './services/modules.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ModulesController],
  providers: [ModulesService],
})
export class ModulesModule { }
