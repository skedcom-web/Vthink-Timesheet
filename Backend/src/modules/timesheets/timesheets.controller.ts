import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TimesheetsService } from './timesheets.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';

@ApiTags('Timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/timesheets')
export class TimesheetsController {
  constructor(private timesheetsService: TimesheetsService) {}

  @Post()
  createOrUpdate(@Body() dto: CreateTimesheetDto, @CurrentUser() user: any) {
    return this.timesheetsService.createOrUpdate(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.timesheetsService.findAll(user);
  }

  @Get('pending')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  getPending() { return this.timesheetsService.getPending(); }

  @Get('week')
  getMyWeek(@CurrentUser() user: any, @Query('weekStartDate') weekStartDate: string) {
    return this.timesheetsService.getMyWeek(user.id, weekStartDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheetsService.findOne(id, user);
  }

  @Put(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheetsService.submit(id, user.id);
  }

  @Put(':id/approve')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheetsService.approve(id, user.id);
  }

  @Put(':id/reject')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @ApiBody({ schema: { properties: { reason: { type: 'string' } } } })
  reject(@Param('id') id: string, @CurrentUser() user: any, @Body('reason') reason?: string) {
    return this.timesheetsService.reject(id, user.id, reason);
  }

  @Put(':id/recall')
  recall(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheetsService.recall(id, user.id, user.role);
  }

  @Delete(':id')
  deleteDraft(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheetsService.deleteDraft(id, user.id);
  }
}
