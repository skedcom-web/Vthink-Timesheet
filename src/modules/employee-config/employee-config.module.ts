import { Module } from '@nestjs/common';
import { EmployeeConfigController } from './employee-config.controller';
import { EmployeeConfigService } from './employee-config.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeConfigController],
  providers: [EmployeeConfigService],
  exports: [EmployeeConfigService],
})
export class EmployeeConfigModule {}
