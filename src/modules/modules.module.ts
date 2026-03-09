import { Module } from '@nestjs/common';
import { ModulesController } from './controllers/modules.controller';
import { ModulesService } from './services/modules.service';

@Module({
  controllers: [ModulesController],
  providers: [ModulesService],
})
export class ModulesModule { }
