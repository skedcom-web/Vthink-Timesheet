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

  // ── Forgot Password — sends a reset link (no temp password) ─────────────────
  // Called from the public login screen. Does NOT require authentication.
  // Generates a secure token, stores it hashed, emails a direct reset link.
  async forgotPassword(identifier: string) {
    // Find user by email OR employeeId (case-insensitive)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email:      { equals: identifier, mode: 'insensitive' } },
          { employeeId: { equals: identifier, mode: 'insensitive' } },
        ],
        active: true,
      },
    });

    // Always return success message to prevent user enumeration
    if (!user) {
      this.logger.warn(`Forgot password: no active user found for "${identifier}"`);
      return { message: 'If that account exists, a reset link has been sent.' };
    }

    // Generate a secure random token
    const rawToken    = crypto.randomBytes(32).toString('hex');
    const tokenHash   = await bcrypt.hash(rawToken, 10);
    const expiry      = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data:  { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
    });

    // Build the reset link — points to the frontend reset page
    const appUrl    = process.env.APP_URL || 'http://localhost:5173';
    const resetLink = `${appUrl}/reset-password?token=${rawToken}&userId=${user.id}`;

    this.mailer.sendForgotPasswordEmail({
      to:        user.email,
      name:      user.name,
      resetLink,
    }).catch(() => {});

    return { message: 'If that account exists, a reset link has been sent.' };
  }

  // ── Set new password via reset token (no temp password needed) ───────────────
  // Called after user clicks the reset link in their email.
  async setNewPasswordViaToken(userId: string, token: string, newPassword: string) {
    if (newPassword.length < 8)
      throw new BadRequestException('Password must be at least 8 characters');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry)
      throw new BadRequestException('Invalid or expired reset link. Please request a new one.');

    // Check expiry
    if (new Date() > user.passwordResetExpiry)
      throw new BadRequestException('This reset link has expired. Please request a new one.');

    // Verify token
    const valid = await bcrypt.compare(token, user.passwordResetToken);
    if (!valid)
      throw new BadRequestException('Invalid reset link. Please request a new one.');

    // Set new password — no mustChangePassword flag needed
    await this.prisma.user.update({
      where: { id: userId },
      data:  {
        passwordHash:        await bcrypt.hash(newPassword, 12),
        mustChangePassword:  false,
        passwordResetToken:  null,
        passwordResetExpiry: null,
      },
    });

    return { message: 'Password updated successfully. You can now log in.' };
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

  // ── Get the manager for the currently logged-in user ────────────────────────
  // Looks up employee_configs by the user's employeeId, then joins to users
  // to get the manager's name, employeeId, and email.
  async getMyManager(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true, name: true },
    });
    if (!user?.employeeId) return { managerName: null, managerEmployeeNo: null };

    try {
      // ── Step 1: Find this employee's row in employee_configs ─────────────────
      // Get their managerEmployeeNo (e.g. "VTM01") — this is the code from the upload
      const empRows = await this.prisma.$queryRawUnsafe<
        { managerEmployeeNo: string | null }[]
      >(`
        SELECT "managerEmployeeNo"
        FROM   employee_configs
        WHERE  LOWER("employeeNo") = LOWER($1)
          AND  active = true
        LIMIT  1
      `, user.employeeId);

      if (!empRows.length || !empRows[0].managerEmployeeNo) {
        return { managerName: null, managerEmployeeNo: null, managerEmail: null };
      }

      const managerCode = empRows[0].managerEmployeeNo;

      // ── Step 2: Look up the manager's name from employee_configs ─────────────
      // The manager's employeeNo in employee_configs = the managerEmployeeNo from step 1
      // This works even if the manager's users.employeeId is different from their EC code
      const managerEcRows = await this.prisma.$queryRawUnsafe<
        { name: string; email: string | null; employeeNo: string }[]
      >(`
        SELECT name, email, "employeeNo"
        FROM   employee_configs
        WHERE  LOWER("employeeNo") = LOWER($1)
          AND  active = true
        LIMIT  1
      `, managerCode);

      if (!managerEcRows.length) {
        // Manager code exists but not in employee_configs — return the raw code
        return { managerName: null, managerEmployeeNo: managerCode, managerEmail: null };
      }

      const managerEc = managerEcRows[0];

      // ── Step 3: Try to find manager's user account for their system employeeId ─
      // Attempt match by email first (most reliable), then by name
      let managerSystemId: string | null = null;
      try {
        const userMatch = managerEc.email
          ? await this.prisma.user.findFirst({
              where: { email: { equals: managerEc.email, mode: 'insensitive' }, active: true },
              select: { employeeId: true },
            })
          : await this.prisma.user.findFirst({
              where: { name: { equals: managerEc.name, mode: 'insensitive' }, active: true },
              select: { employeeId: true },
            });
        managerSystemId = userMatch?.employeeId ?? null;
      } catch { /* ignore */ }

      return {
        managerName:       managerEc.name,
        // Show the manager's system employeeId if found, otherwise the EC code
        managerEmployeeNo: managerSystemId ?? managerCode,
        managerEmail:      managerEc.email,
      };
    } catch (err) {
      this.logger.warn('getMyManager lookup failed:', err?.message);
    }
    return { managerName: null, managerEmployeeNo: null, managerEmail: null };
  }
}
