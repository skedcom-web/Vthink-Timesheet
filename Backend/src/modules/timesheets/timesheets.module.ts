import { Module } from '@nestjs/common';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports:     [TasksModule],
  controllers: [TimesheetsController],
  providers:   [TimesheetsService],
  exports:     [TimesheetsService],   // ← export so DashboardModule can inject it
})
export class TimesheetsModule {}
