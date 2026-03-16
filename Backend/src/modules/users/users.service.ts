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

  private generateTempPassword(): string {
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const digits  = '23456789';
    const special = '@#$!';
    const rand    = (s: string) => s[crypto.randomInt(s.length)];
    const parts   = [rand(upper), rand(upper), rand(lower), rand(lower),
                     rand(digits), rand(digits), rand(special), rand(special)];
    for (let i = parts.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    return parts.join('');
  }

  // ── Role hierarchy rules ────────────────────────────────────────────────────
  // SUPER_ADMIN     → can create: COMPANY_ADMIN, PROJECT_MANAGER, TEAM_MEMBER
  // COMPANY_ADMIN   → can create: PROJECT_MANAGER, TEAM_MEMBER
  // PROJECT_MANAGER → can create: TEAM_MEMBER only
  private canCreateRole(actorRole: string, targetRole: string): boolean {
    const hierarchy: Record<string, string[]> = {
      SUPER_ADMIN:     ['COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
      COMPANY_ADMIN:   ['PROJECT_MANAGER', 'TEAM_MEMBER'],
      PROJECT_MANAGER: ['TEAM_MEMBER'],
      TEAM_MEMBER:     [],
    };
    return (hierarchy[actorRole] || []).includes(targetRole);
  }

  // ── Create user ─────────────────────────────────────────────────────────────
  async createUser(dto: CreateUserDto, createdBy: { id: string; role: string }) {
    if (!this.canCreateRole(createdBy.role, dto.role)) {
      throw new ForbiddenException(
        `A ${createdBy.role.replace('_', ' ')} cannot create a ${dto.role.replace('_', ' ')} account`,
      );
    }

    const existingEmail = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (existingEmail) throw new ConflictException('Email already in use');

    if (dto.employeeId) {
      const existingEmp = await this.prisma.user.findFirst({
        where: { employeeId: { equals: dto.employeeId, mode: 'insensitive' } },
      });
      if (existingEmp) throw new ConflictException('Employee ID already in use');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const expiry       = new Date(Date.now() + 24 * 60 * 60 * 1000);

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

    this.mailer.sendWelcomeEmail({
      to:            dto.email,
      name:          dto.name,
      employeeId:    dto.employeeId || dto.email,
      tempPassword,
      role:          dto.role,
      customMessage: dto.customEmailMessage,
    }).catch(() => {});

    return { ...user, tempPassword };
  }

  // ── List users — scoped by role ─────────────────────────────────────────────
  async listUsers(actorRole: string) {
    // Each role only sees users they can manage (below them in hierarchy)
    const visibleRoles: Record<string, string[]> = {
      SUPER_ADMIN:     ['COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
      COMPANY_ADMIN:   ['PROJECT_MANAGER', 'TEAM_MEMBER'],
      PROJECT_MANAGER: ['TEAM_MEMBER'],
      TEAM_MEMBER:     [],
    };
    const roles = visibleRoles[actorRole] || [];

    return this.prisma.user.findMany({
      where: { role: { in: roles as any } },
      select: {
        id: true, name: true, email: true, role: true,
        employeeId: true, department: true, active: true,
        mustChangePassword: true, createdAt: true,
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  // ── Revoke / Restore ────────────────────────────────────────────────────────
  async revokeUser(userId: string, actorRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!this.canCreateRole(actorRole, user.role))
      throw new ForbiddenException('You do not have permission to revoke this user');

    return this.prisma.user.update({
      where: { id: userId },
      data:  { active: false },
      select: { id: true, name: true, active: true },
    });
  }

  async restoreUser(userId: string, actorRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!this.canCreateRole(actorRole, user.role))
      throw new ForbiddenException('You do not have permission to restore this user');

    return this.prisma.user.update({
      where: { id: userId },
      data:  { active: true },
      select: { id: true, name: true, active: true },
    });
  }

  // ── Reset password ──────────────────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto, actorRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!this.canCreateRole(actorRole, user.role))
      throw new ForbiddenException('You do not have permission to reset this user\'s password');

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

    this.mailer.sendPasswordResetEmail({
      to:            user.email,
      name:          user.name,
      employeeId:    user.employeeId || user.email,
      tempPassword,
      customMessage: dto.customEmailMessage,
    }).catch(() => {});

    return { message: 'Password reset. User will be required to change on next login.', tempPassword };
  }

  // ── Change own password ─────────────────────────────────────────────────────
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8)
      throw new BadRequestException('New password must be at least 8 characters');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (currentPassword === newPassword)
      throw new BadRequestException('New password must be different from the current password');

    await this.prisma.user.update({
      where: { id: userId },
      data:  {
        passwordHash:        await bcrypt.hash(newPassword, 12),
        mustChangePassword:  false,
        passwordResetToken:  null,
        passwordResetExpiry: null,
      },
    });

    return { message: 'Password changed successfully' };
  }

  async getEmployeeOptions() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "employeeNo", name, email, designation
       FROM employee_configs WHERE active = true ORDER BY name ASC`
    );
  }
}
