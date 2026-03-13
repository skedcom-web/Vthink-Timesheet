import { Module } from '@nestjs/common';
import { ProjectConfigController } from './project-config.controller';
import { ProjectConfigService } from './project-config.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectConfigController],
  providers: [ProjectConfigService],
  exports: [ProjectConfigService],
})
export class ProjectConfigModule {}
