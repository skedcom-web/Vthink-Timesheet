import {
  Injectable, BadRequestException, NotFoundException,
  ConflictException, ForbiddenException, OnModuleInit, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from './mailer.service';
import { CreateUserDto, ResetPasswordDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
  ) {}

  // ── Ensure new columns exist on users table ──────────────────────────────────
  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS "mustChangePassword"  BOOLEAN   NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "passwordResetToken"  TEXT,
          ADD COLUMN IF NOT EXISTS "passwordResetExpiry" TIMESTAMP(3);
      `);
      this.logger.log('User password-reset columns ready ✓');
    } catch (err) {
      this.logger.error('Failed to add password-reset columns', err);
    }
  }

  // ── Generate a readable temp password: 4 uppercase + 4 digits + 2 special ────
  private generateTempPassword(): string {
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const digits  = '23456789';
    const special = '@#$!';
    const rand    = (s: string) => s[crypto.randomInt(s.length)];
    const parts   = [rand(upper), rand(upper), rand(lower), rand(lower),
                     rand(digits), rand(digits), rand(special), rand(special)];
    // Shuffle
    for (let i = parts.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    return parts.join('');
  }

  // ── Create user ──────────────────────────────────────────────────────────────
  async createUser(dto: CreateUserDto, createdBy: { id: string; role: string }) {
    // Only SA can create CA; SA+CA can create PM+Employee
    if (dto.role === 'COMPANY_ADMIN' && createdBy.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can create Company Admin accounts');
    }

    // Check duplicates
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email already in use');

    if (dto.employeeId) {
      const existingEmp = await this.prisma.user.findUnique({ where: { employeeId: dto.employeeId } });
      if (existingEmp) throw new ConflictException('Employee ID already in use');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const expiry       = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        name:               dto.name,
        email:              dto.email,
        passwordHash,
        role:               dto.role as any,
        employeeId:         dto.employeeId   || null,
        department:         dto.department   || null,
        active:             true,
        mustChangePassword: true,
        passwordResetToken:  await bcrypt.hash(tempPassword, 10),
        passwordResetExpiry: expiry,
      },
      select: { id: true, name: true, email: true, role: true, employeeId: true, department: true, active: true, mustChangePassword: true },
    });

    // Send welcome email (non-blocking)
    this.mailer.sendWelcomeEmail({
      to:            dto.email,
      name:          dto.name,
      employeeId:    dto.employeeId || dto.email,
      tempPassword,
      role:          dto.role,
      customMessage: dto.customEmailMessage,
    }).catch(() => {});

    // Return tempPassword so admin can see it on screen too
    return { ...user, tempPassword };
  }

  // ── List all users ───────────────────────────────────────────────────────────
  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true,
        employeeId: true, department: true, active: true,
        mustChangePassword: true, createdAt: true,
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  // ── Revoke / Restore access ──────────────────────────────────────────────────
  async revokeUser(userId: string, actorRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot revoke Super Admin');
    if (user.role === 'COMPANY_ADMIN' && actorRole !== 'SUPER_ADMIN')
      throw new ForbiddenException('Only Super Admin can revoke Company Admin');

    return this.prisma.user.update({
      where: { id: userId },
      data:  { active: false },
      select: { id: true, name: true, active: true },
    });
  }

  async restoreUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data:  { active: true },
      select: { id: true, name: true, active: true },
    });
  }

  // ── Admin resets a user's password ──────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto, actorRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot reset Super Admin password this way');

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const expiry       = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: dto.userId },
      data:  {
        passwordHash,
        mustChangePassword:  true,
        passwordResetToken:  await bcrypt.hash(tempPassword, 10),
        passwordResetExpiry: expiry,
      },
    });

    // Send reset email
    this.mailer.sendPasswordResetEmail({
      to:            user.email,
      name:          user.name,
      employeeId:    user.employeeId || user.email,
      tempPassword,
      customMessage: dto.customEmailMessage,
    }).catch(() => {});

    return { message: 'Password reset. User will be required to change on next login.', tempPassword };
  }

  // ── User changes their own password (first-login or self-service) ────────────
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8)
      throw new BadRequestException('New password must be at least 8 characters');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (currentPassword === newPassword)
      throw new BadRequestException('New password must be different from the current password');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data:  {
        passwordHash:        newHash,
        mustChangePassword:  false,
        passwordResetToken:  null,
        passwordResetExpiry: null,
      },
    });

    return { message: 'Password changed successfully' };
  }

  // ── Get employee options from employee_configs for the create-user dropdown ──
  async getEmployeeOptions() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "employeeNo", name, email, designation
       FROM employee_configs WHERE active = true ORDER BY name ASC`
    );
  }
}
