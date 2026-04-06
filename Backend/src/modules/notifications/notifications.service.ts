import { Injectable, InternalServerErrorException, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';

const GLOBAL_ID = 'global';

type NotificationSettingsRow = {
  id: string;
  timezone: string;
  weeklyReminderEnabled: boolean;
  statusReminderRules: unknown;
  updatedAt: Date;
  updatedById: string | null;
};

/**
 * Reads/writes `app_notification_settings` via `pg` (not Prisma delegates).
 * Avoids Prisma 7 driver-adapter issues with raw queries and avoids requiring
 * a regenerated client for this model.
 */
@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly log = new Logger(NotificationsService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy() {
    await this.pool.end().catch(() => undefined);
  }

  private mapDbError(err: unknown): never {
    const e = err as { code?: string; message?: string };
    if (e?.code === '42P01') {
      throw new InternalServerErrorException(
        'Table app_notification_settings is missing. From the Backend folder run: npx prisma migrate deploy',
      );
    }
    this.log.warn(e?.message || String(err));
    throw new InternalServerErrorException(e?.message || 'Notification settings database error');
  }

  async ensureRow(): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO "app_notification_settings" (id, timezone, "weeklyReminderEnabled", "statusReminderRules", "updatedAt")
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [GLOBAL_ID, 'Asia/Kolkata', true, '[]'],
      );
    } catch (err) {
      this.mapDbError(err);
    }
  }

  private async getRawRow(): Promise<NotificationSettingsRow> {
    try {
      const { rows } = await this.pool.query<NotificationSettingsRow>(
        `SELECT id, timezone, "weeklyReminderEnabled", "statusReminderRules", "updatedAt", "updatedById"
         FROM "app_notification_settings" WHERE id = $1`,
        [GLOBAL_ID],
      );
      const row = rows[0];
      if (!row) {
        throw new InternalServerErrorException('Notification settings row missing after insert');
      }
      return row;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.mapDbError(err);
    }
  }

  async getSettings() {
    await this.ensureRow();
    return this.getRawRow();
  }

  async updateSettings(dto: UpdateNotificationSettingsDto, updatedById: string) {
    await this.ensureRow();
    const current = await this.getRawRow();

    const weeklyReminderEnabled =
      dto.weeklyReminderEnabled !== undefined ? dto.weeklyReminderEnabled : current.weeklyReminderEnabled;

    let rules: unknown =
      dto.statusReminderRules !== undefined ? dto.statusReminderRules : current.statusReminderRules;
    if (typeof rules === 'string') {
      try {
        rules = JSON.parse(rules);
      } catch {
        rules = [];
      }
    }
    const rulesJson = JSON.stringify(rules ?? []);

    try {
      await this.pool.query(
        `UPDATE "app_notification_settings"
         SET "weeklyReminderEnabled" = $1,
             "statusReminderRules" = $2::jsonb,
             "updatedById" = $3,
             "updatedAt" = NOW()
         WHERE id = $4`,
        [weeklyReminderEnabled, rulesJson, updatedById, GLOBAL_ID],
      );
    } catch (err) {
      this.mapDbError(err);
    }

    return this.getRawRow();
  }
}
