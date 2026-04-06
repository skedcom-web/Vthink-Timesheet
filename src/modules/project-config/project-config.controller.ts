import {
  Controller, Post, Get, Param, UseGuards,
  UseInterceptors, UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProjectConfigService } from './project-config.service';

interface UploadedFileType {
  fieldname:    string;
  originalname: string;
  encoding:     string;
  mimetype:     string;
  buffer:       Buffer;
  size:         number;
}

@ApiTags('Project Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/project-config')
export class ProjectConfigController {
  constructor(private readonly svc: ProjectConfigService) {}

  // ── Upload Excel → syncs to both project_configs and projects tables ─────────
  @Post('upload')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = file.originalname.match(/\.(xlsx|xls)$/i);
      cb(ok ? null : new Error('Only .xlsx and .xls files are allowed') as any, !!ok);
    },
  }))
  async uploadFile(@UploadedFile() file: UploadedFileType) {
    if (!file) throw new Error('No file uploaded');
    const result = await this.svc.upsertFromFile(file.buffer);
    return {
      success: true,
      message: `Imported ${result.projects} project(s) and ${result.taskNames} task name(s) successfully`,
      ...result,
    };
  }

  // ── List all active projects — returns projects.id so tasks can be created ───
  @Get()
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER')
  getAll() {
    return this.svc.getAllProjects();
  }

  // ── Full list with task names (admin table) ──────────────────────────────────
  @Get('full')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  getFull() {
    return this.svc.getFullList();
  }

  // ── All unique task names ────────────────────────────────────────────────────
  @Get('task-names/all')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER')
  getAllTaskNames() {
    return this.svc.getAllTaskNames();
  }

  // ── Summary counts for Admin page ──────────────────────────────────────────
  @Get('summary')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  getSummary() {
    return this.svc.getSummary();
  }

  // ── Task names for a project — accepts projects table ID ────────────────────
  // NOTE: this route must come AFTER /task-names/all to avoid route conflict
  @Get(':id/task-names')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER')
  getTaskNames(@Param('id') id: string) {
    return this.svc.getTaskNamesForProject(id);
  }
}
