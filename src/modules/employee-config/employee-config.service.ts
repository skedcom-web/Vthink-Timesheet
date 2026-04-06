import { Injectable, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class EmployeeConfigService implements OnModuleInit {
  private readonly logger = new Logger(EmployeeConfigService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "employee_configs" (
          "id"                TEXT NOT NULL,
          "employeeNo"        TEXT NOT NULL,
          "name"              TEXT NOT NULL,
          "designation"       TEXT,
          "email"             TEXT,
          "managerEmployeeNo" TEXT,
          "active"            BOOLEAN NOT NULL DEFAULT true,
          "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "employee_configs_pkey" PRIMARY KEY ("id")
        );
      `);
      // Add column if table already existed without it (safe migration)
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE employee_configs
          ADD COLUMN IF NOT EXISTS "managerEmployeeNo" TEXT;
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "employee_configs_employeeNo_key"
          ON "employee_configs"("employeeNo");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "employee_configs_active_idx"
          ON "employee_configs"("active");
      `);
      this.logger.log('EmployeeConfig table ready ✓');
    } catch (err) {
      this.logger.error('Failed to initialise EmployeeConfig table', err);
    }
  }

  // ── Parse Excel ── columns: Employee Number | Employee Name | Designation | Email ──
  async parseXlsx(buffer: Buffer): Promise<any[]> {
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(buffer as any); }
    catch { throw new BadRequestException('Invalid or corrupt Excel file.'); }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel file has no sheets.');

    const headers: Record<string, number> = {};
    sheet.getRow(1).eachCell((cell, col) => {
      const v = String(cell.value ?? '').trim().toLowerCase();
      if (v) headers[v] = col;
    });

    const getCol = (...hints: string[]) => {
      for (const hint of hints) {
        const key = Object.keys(headers).find(k => k.includes(hint.toLowerCase()));
        if (key) return headers[key];
      }
      return -1;
    };

    const empNoCol     = getCol('employee number', 'employee no', 'emp no', 'emp id', 'employee id');
    const nameCol      = getCol('employee name', 'name');
    const desgCol      = getCol('designation', 'curr.designation', 'title', 'position');
    const emailCol     = getCol('email', 'e-mail', 'mail');
    const managerCol   = getCol('manager employee no', 'manager emp no', 'manager id', 'manager employee id', 'manager no', 'manager');

    if (nameCol === -1)
      throw new BadRequestException(
        `Could not find "Employee Name" column. Found: ${Object.keys(headers).join(', ')}`
      );

    const parsed: any[] = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const c = (col: number) => col > 0 ? String(row.getCell(col).value ?? '').trim() : '';
      const name = c(nameCol);
      if (!name) return;
      parsed.push({
        employeeNo:        c(empNoCol) || `EMP${String(rowNum).padStart(4, '0')}`,
        name,
        designation:       c(desgCol)  || null,
        email:             c(emailCol) || null,
        managerEmployeeNo: c(managerCol) || null,
      });
    });

    if (!parsed.length)
      throw new BadRequestException('No valid employee rows found. Data must start from row 2.');

    return parsed;
  }

  async upsertFromFile(buffer: Buffer): Promise<{ employees: number; byDesignation: Record<string, number> }> {
    const rows = await this.parseXlsx(buffer);
    const byDesignation: Record<string, number> = {};

    for (const row of rows) {
      const desgKey = row.designation || 'Unspecified';
      byDesignation[desgKey] = (byDesignation[desgKey] || 0) + 1;

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO employee_configs (id, "employeeNo", name, designation, email, "managerEmployeeNo", active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT ("employeeNo") DO UPDATE
           SET name = EXCLUDED.name, designation = EXCLUDED.designation,
               email = EXCLUDED.email,
               "managerEmployeeNo" = EXCLUDED."managerEmployeeNo",
               active = true, "updatedAt" = NOW()`,
        crypto.randomUUID(), row.employeeNo, row.name, row.designation, row.email, row.managerEmployeeNo
      );
    }

    return { employees: rows.length, byDesignation };
  }

  async addOne(employeeNo: string, name: string, designation: string, email: string): Promise<any> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO employee_configs (id, "employeeNo", name, designation, email, active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT ("employeeNo") DO UPDATE
         SET name = EXCLUDED.name, designation = EXCLUDED.designation,
             email = EXCLUDED.email, active = true, "updatedAt" = NOW()`,
      crypto.randomUUID(), employeeNo, name, designation, email
    );
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "employeeNo", name, designation, email FROM employee_configs WHERE "employeeNo" = $1`,
      employeeNo
    );
    return rows[0];
  }

  async getAll(): Promise<any[]> {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "employeeNo", name, designation, email, "managerEmployeeNo"
       FROM employee_configs WHERE active = true ORDER BY name ASC`
    );
  }

  async getByName(name: string): Promise<any | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "employeeNo", name, designation, email, "managerEmployeeNo"
       FROM employee_configs WHERE LOWER(name) = LOWER($1) AND active = true LIMIT 1`,
      name
    );
    return rows[0] ?? null;
  }

  async getSummary(): Promise<{
    total: number;
    byDesignation: { designation: string; count: number }[];
    byManager: { managerEmployeeNo: string; count: number }[];
  }> {
    const [totalRows, byDesgRows, byMgrRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM employee_configs WHERE active = true`
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(designation, 'Unspecified') AS designation, COUNT(*)::int AS count
         FROM employee_configs WHERE active = true
         GROUP BY designation ORDER BY count DESC`
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COALESCE("managerEmployeeNo", 'Unassigned') AS "managerEmployeeNo", COUNT(*)::int AS count
         FROM employee_configs WHERE active = true
         GROUP BY "managerEmployeeNo" ORDER BY count DESC`
      ),
    ]);
    return {
      total:         Number(totalRows[0]?.count ?? 0),
      byDesignation: byDesgRows.map(r => ({ designation: r.designation, count: Number(r.count) })),
      byManager:     byMgrRows.map(r => ({ managerEmployeeNo: r.managerEmployeeNo, count: Number(r.count) })),
    };
  }
}
