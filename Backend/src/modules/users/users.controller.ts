import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, UsePipes, ValidationPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { MailerService } from './mailer.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateUserDto, ResetPasswordDto, ChangePasswordDto,
} from './dto/create-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private mailerService: MailerService,
    private prisma: PrismaService,
  ) {}

  // ── List users scoped by actor role ─────────────────────────────────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  listAll(@CurrentUser() actor: any) {
    return this.usersService.listUsers(actor.role);
  }

  // ── Employee options for dropdown ────────────────────────────────────────────
  @Get('employee-options')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  getEmployeeOptions() {
    return this.usersService.getEmployeeOptions();
  }

  // ── SMTP status ───────────────────────────────────────────────────────────────
  @Get('smtp-status')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  checkSmtp() {
    return this.mailerService.testConnection();
  }

  // ── Test email ────────────────────────────────────────────────────────────────
  @Post('test-email')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @HttpCode(HttpStatus.OK)
  sendTestEmail(@Body() body: { email: string }) {
    return this.mailerService.sendTestEmail(body.email);
  }

  // ── Create user (SA + CA + PM — each restricted by role hierarchy) ────────────
  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
  createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: any) {
    return this.usersService.createUser(dto, actor);
  }

  // ── Revoke user ───────────────────────────────────────────────────────────────
  @Patch(':id/revoke')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @HttpCode(HttpStatus.OK)
  revokeUser(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.usersService.revokeUser(id, actor.role);
  }

  // ── Restore user ──────────────────────────────────────────────────────────────
  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @HttpCode(HttpStatus.OK)
  restoreUser(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.usersService.restoreUser(id, actor.role);
  }

  // ── Reset password ────────────────────────────────────────────────────────────
  @Post('reset-password')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  resetPassword(@Body() dto: ResetPasswordDto, @CurrentUser() actor: any) {
    return this.usersService.resetPassword(dto, actor.role);
  }

  // ── Change own password ───────────────────────────────────────────────────────
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: any) {
    return this.usersService.changeOwnPassword(user.id, dto.currentPassword, dto.newPassword);
  }

  // ── Simple list for assignment dropdowns ─────────────────────────────────────
  @Get('simple')
  getSimple() {
    return this.prisma.user.findMany({
      where:   { active: true },
      select:  { id: true, name: true, email: true, role: true, employeeId: true, department: true },
      orderBy: { name: 'asc' },
    });
  }
}
