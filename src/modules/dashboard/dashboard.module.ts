import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { TimesheetsModule } from '../timesheets/timesheets.module';

@Module({
  imports:     [TimesheetsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
