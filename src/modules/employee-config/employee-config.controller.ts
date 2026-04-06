import {
  Controller, Post, Get, Body, UseGuards, UseInterceptors,
  UploadedFile, HttpCode, HttpStatus, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmployeeConfigService } from './employee-config.service';

interface UploadedFileType { buffer: Buffer; originalname: string; size: number; }

@ApiTags('Employee Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/employee-config')
export class EmployeeConfigController {
  constructor(private readonly svc: EmployeeConfigService) {}

  // ── Summary first — must be before any :param routes ────────────────────────
  @Get('summary')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  getSummary() {
    return this.svc.getSummary();
  }

  // ── Upload Excel ─────────────────────────────────────────────────────────────
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
      message: `Imported ${result.employees} employee(s) successfully`,
      employees: result.employees,
      byDesignation: result.byDesignation,
    };
  }

  // ── Get all employees (for AssignTask dropdown) ──────────────────────────────
  @Get()
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER')
  getAll() {
    return this.svc.getAll();
  }

  // ── Lookup by name for autofill — disable strict validation ─────────────────
  @Post('lookup')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  lookupByName(@Body('name') name: string) {
    if (!name) return null;
    return this.svc.getByName(name);
  }

  // ── Manually add new employee — disable strict validation ────────────────────
  @Post('add-one')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  addOne(@Body() body: any) {
    const { employeeNo, name, designation, email } = body;
    if (!employeeNo || !name || !designation || !email) {
      throw new Error('employeeNo, name, designation and email are all required');
    }
    return this.svc.addOne(employeeNo, name, designation, email);
  }
}
