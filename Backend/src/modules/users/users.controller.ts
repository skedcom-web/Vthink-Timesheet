import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, role: true, employeeId: true, department: true },
      orderBy: { name: 'asc' },
    });
  }
}
