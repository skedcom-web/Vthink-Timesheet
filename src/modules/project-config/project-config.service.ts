import { Injectable, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

interface ParsedRow {
  code:        string;
  name:        string;
  client?:     string;
  description?: string;
  taskNames:   string[];
}

@Injectable()
export class ProjectConfigService implements OnModuleInit {
  private readonly logger = new Logger(ProjectConfigService.name);

  constructor(private prisma: PrismaService) {}

  // ── Auto-create config tables on startup ─────────────────────────────────────
  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "project_configs" (
          "id"          TEXT NOT NULL,
          "code"        TEXT NOT NULL,
          "name"        TEXT NOT NULL,
          "client"      TEXT,
          "description" TEXT,
          "active"      BOOLEAN NOT NULL DEFAULT true,
          "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "project_configs_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "project_configs_code_key" ON "project_configs"("code");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "project_configs_active_idx" ON "project_configs"("active");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "task_name_configs" (
          "id"              TEXT NOT NULL,
          "projectConfigId" TEXT NOT NULL,
          "name"            TEXT NOT NULL,
          "active"          BOOLEAN NOT NULL DEFAULT true,
          "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "task_name_configs_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "task_name_configs_projectConfigId_name_key"
          ON "task_name_configs"("projectConfigId", "name");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "task_name_configs_projectConfigId_idx"
          ON "task_name_configs"("projectConfigId");
      `);
      await this.prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'task_name_configs_projectConfigId_fkey'
              AND table_name = 'task_name_configs'
          ) THEN
            ALTER TABLE "task_name_configs"
              ADD CONSTRAINT "task_name_configs_projectConfigId_fkey"
              FOREIGN KEY ("projectConfigId") REFERENCES "project_configs"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END;
        $$ language 'plpgsql';
      `);
      await this.prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS update_project_configs_updated_at ON "project_configs";
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER update_project_configs_updated_at
          BEFORE UPDATE ON "project_configs"
          FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
      `);
      this.logger.log('ProjectConfig tables ready ✓');
    } catch (err) {
      this.logger.error('Failed to initialise ProjectConfig tables', err);
    }
  }

  // ── Parse Excel buffer ────────────────────────────────────────────────────────
  async parseXlsx(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Invalid or corrupt Excel file. Please upload a valid .xlsx file.');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel file has no sheets.');

    const headers: Record<string, number> = {};
    sheet.getRow(1).eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim().toLowerCase();
      if (val) headers[val] = colNumber;
    });

    if (!Object.keys(headers).length)
      throw new BadRequestException('Could not read header row. Make sure row 1 contains column names.');

    const getCol = (hints: string[]): number => {
      for (const hint of hints) {
        const key = Object.keys(headers).find(h => h.includes(hint.toLowerCase()));
        if (key) return headers[key];
      }
      return -1;
    };

    const nameCol   = getCol(['project name', 'project']);
    const clientCol = getCol(['client']);
    const descCol   = getCol(['description', 'desc']);
    const taskCol   = getCol(['task type', 'task types', 'task']);

    if (nameCol === -1)
      throw new BadRequestException(
        `Could not find a "Project Name" column. Found: ${Object.keys(headers).join(', ')}`
      );

    const parsed: ParsedRow[] = [];

    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const cellVal = (col: number) =>
        col > 0 ? String(row.getCell(col).value ?? '').trim() : '';

      const name = cellVal(nameCol);
      if (!name) return;

      const code = name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .toUpperCase()
        .substring(0, 30) || `PROJECT_${rowNum}`;

      const client      = cellVal(clientCol) || undefined;
      const description = cellVal(descCol)   || undefined;
      const taskTypesRaw = cellVal(taskCol);
      const taskNames   = taskTypesRaw
        ? [...new Set(taskTypesRaw.split(/[|;,]/).map(t => t.trim()).filter(t => t.length > 0))]
        : [];

      parsed.push({ code, name, client, description, taskNames });
    });

    if (!parsed.length)
      throw new BadRequestException('No valid project rows found. Make sure data starts from row 2.');

    return parsed;
  }

  // ── Upsert rows → project_configs AND projects tables ────────────────────────
  async upsertFromFile(buffer: Buffer): Promise<{ projects: number; taskNames: number }> {
    const rows = await this.parseXlsx(buffer);
    let totalTaskNames = 0;

    for (const row of rows) {
      // ── 1. Upsert into project_configs ──────────────────────────────────────
      let configId: string;
      const existingConfig = await this.prisma.projectConfig.findUnique({ where: { code: row.code } });

      if (existingConfig) {
        await this.prisma.projectConfig.update({
          where: { code: row.code },
          data:  { name: row.name, client: row.client ?? null, description: row.description ?? null, active: true },
        });
        configId = existingConfig.id;
      } else {
        const created = await this.prisma.projectConfig.create({
          data: {
            id:          crypto.randomUUID(),
            code:        row.code,
            name:        row.name,
            client:      row.client ?? null,
            description: row.description ?? null,
            active:      true,
          },
        });
        configId = created.id;
      }

      // ── 2. Sync into projects table (so tasks can reference it) ─────────────
      const existingProject = await this.prisma.project.findUnique({ where: { code: row.code } });

      if (existingProject) {
        await this.prisma.project.update({
          where: { code: row.code },
          data:  {
            name:        row.name,
            description: row.description ?? null,
            clientName:  row.client ?? null,
            status:      'ACTIVE' as any,
          },
        });
      } else {
        await this.prisma.project.create({
          data: {
            id:          configId,   // ← Same ID as project_configs row for easy cross-reference
            code:        row.code,
            name:        row.name,
            description: row.description ?? null,
            clientName:  row.client ?? null,
            status:      'ACTIVE' as any,
          },
        });
      }

      // ── 3. Upsert task name configs ─────────────────────────────────────────
      for (const taskName of row.taskNames) {
        const existingTask = await this.prisma.taskNameConfig.findUnique({
          where: { projectConfigId_name: { projectConfigId: configId, name: taskName } },
        });
        if (!existingTask) {
          await this.prisma.taskNameConfig.create({
            data: { id: crypto.randomUUID(), projectConfigId: configId, name: taskName, active: true },
          });
        } else if (!existingTask.active) {
          await this.prisma.taskNameConfig.update({
            where: { id: existingTask.id },
            data:  { active: true },
          });
        }
      }

      totalTaskNames += row.taskNames.length;
    }

    return { projects: rows.length, taskNames: totalTaskNames };
  }

  // ── Return projects from project_configs joined with projects.id ─────────────
  // Returns id = projects.id so frontend can pass it directly to tasksApi.create()
  async getAllProjects() {
    const configs = await this.prisma.projectConfig.findMany({
      where:   { active: true },
      select:  { id: true, code: true, name: true, client: true, description: true },
      orderBy: { name: 'asc' },
    });

    // For each config, resolve the actual projects table ID (same id if synced by us,
    // but guard against edge cases where project may have been created independently)
    const result = await Promise.all(
      configs.map(async (cfg) => {
        const proj = await this.prisma.project.findUnique({
          where:  { code: cfg.code },
          select: { id: true },
        });
        return {
          id:          proj?.id ?? cfg.id,   // ← Always return the projects table ID
          configId:    cfg.id,
          code:        cfg.code,
          name:        cfg.name,
          client:      cfg.client,
          description: cfg.description,
        };
      })
    );

    return result;
  }

  // ── Get task names by projectConfigId (used after project selection) ─────────
  async getTaskNamesForProject(projectId: string) {
    // projectId may be the projects table ID — find matching config by code
    const project = await this.prisma.project.findUnique({
      where:  { id: projectId },
      select: { code: true },
    });

    if (project) {
      const config = await this.prisma.projectConfig.findUnique({
        where:  { code: project.code },
        select: { id: true },
      });
      if (config) {
        return this.prisma.taskNameConfig.findMany({
          where:   { projectConfigId: config.id, active: true },
          select:  { id: true, name: true },
          orderBy: { name: 'asc' },
        });
      }
    }

    // Fallback: treat projectId directly as configId
    return this.prisma.taskNameConfig.findMany({
      where:   { projectConfigId: projectId, active: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAllTaskNames() {
    const records = await this.prisma.taskNameConfig.findMany({
      where:    { active: true },
      select:   { name: true },
      distinct: ['name'],
      orderBy:  { name: 'asc' },
    });
    return records.map(r => r.name);
  }

  async getFullList() {
    return this.prisma.projectConfig.findMany({
      where:   { active: true },
      include: {
        taskNames: {
          where:   { active: true },
          select:  { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getSummary(): Promise<{ totalProjects: number; totalTaskNames: number }> {
    const [projRows, taskRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM project_configs WHERE active = true`
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM task_name_configs WHERE active = true`
      ),
    ]);
    return {
      totalProjects:  Number(projRows[0]?.count ?? 0),
      totalTaskNames: Number(taskRows[0]?.count ?? 0),
    };
  }
}
