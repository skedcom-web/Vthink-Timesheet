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
    private prisma: PrismaService,
  ) {}

  // ── List all users (SA + CA) ─────────────────────────────────────────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  listAll() {
    return this.usersService.listUsers();
  }

  // ── Employee options for Create User dropdown ────────────────────────────────
  @Get('employee-options')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  getEmployeeOptions() {
    return this.usersService.getEmployeeOptions();
  }

  // ── Create user ──────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
  createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: any) {
    return this.usersService.createUser(dto, actor);
  }

  // ── Revoke user access ───────────────────────────────────────────────────────
  @Patch(':id/revoke')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @HttpCode(HttpStatus.OK)
  revokeUser(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.usersService.revokeUser(id, actor.role);
  }

  // ── Restore user access ──────────────────────────────────────────────────────
  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @HttpCode(HttpStatus.OK)
  restoreUser(@Param('id') id: string) {
    return this.usersService.restoreUser(id);
  }

  // ── Admin resets a user's password ──────────────────────────────────────────
  @Post('reset-password')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  resetPassword(@Body() dto: ResetPasswordDto, @CurrentUser() actor: any) {
    return this.usersService.resetPassword(dto, actor.role);
  }

  // ── Logged-in user changes their own password ────────────────────────────────
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: any) {
    return this.usersService.changeOwnPassword(user.id, dto.currentPassword, dto.newPassword);
  }

  // ── Legacy: simple list for assignment dropdowns ────────────────────────────
  @Get('simple')
  getSimple() {
    return this.prisma.user.findMany({
      where:   { active: true },
      select:  { id: true, name: true, email: true, role: true, employeeId: true, department: true },
      orderBy: { name: 'asc' },
    });
  }
}
