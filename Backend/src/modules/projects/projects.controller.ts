import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id/tasks')
  getProjectTasks(@Param('id') id: string) {
    return this.prisma.task.findMany({
      where: { projectId: id, status: { not: 'COMPLETED' } },
      select: { id: true, name: true, taskType: true, status: true },
    });
  }
}
