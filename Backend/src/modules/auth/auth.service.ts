import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    // Support login by email OR by employeeId (used as username)
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // If not found by email, try employeeId field
    if (!user) {
      const byEmpId = await this.prisma.user.findUnique({ where: { employeeId: dto.email } });
      if (byEmpId) user = byEmpId;
    }

    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user);

    // Tell the frontend if the user must change their password
    return {
      ...tokens,
      mustChangePassword: (user as any).mustChangePassword ?? false,
    };
  }

  async generateTokens(user: { id: string; email: string; role: string; name: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret:    this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        employeeId: true, department: true,
        mustChangePassword: true,
      },
    });
    return user;
  }
}
