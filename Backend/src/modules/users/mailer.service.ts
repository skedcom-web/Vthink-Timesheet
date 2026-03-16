import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
          // Allow self-signed certs in dev; remove in production
          rejectUnauthorized: this.config.get('NODE_ENV') === 'production',
        },
      });

      // Verify SMTP connection on startup
      this.transporter.verify((err) => {
        if (err) {
          this.logger.error(
            `❌ SMTP connection FAILED → ${host}:${port} | ${err.message}\n` +
            `   Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file.`,
          );
        } else {
          this.logger.log(`✅ SMTP connection verified → ${host}:${port} (user: ${user})`);
        }
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        `⚠️  SMTP not configured — emails will be logged to console only.\n` +
        `   Set SMTP_HOST, SMTP_USER, SMTP_PASS in Backend/.env to enable real email sending.`,
      );
    }
  }

  // ── Test SMTP (called from controller for manual verification) ─────────────
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      return {
        success: false,
        message: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env',
      };
    }
    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection successful ✅' };
    } catch (err: any) {
      return { success: false, message: `SMTP connection failed: ${err.message}` };
    }
  }

  // ── Send a test email to verify end-to-end ────────────────────────────────
  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      return {
        success: false,
        message: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env',
      };
    }
    try {
      await this.transporter.sendMail({
        from:    this.config.get('SMTP_FROM') || 'noreply@vthink.co.in',
        to,
        subject: 'vThink Timesheet — SMTP Test Email',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#6366F1,#7C3AED);padding:24px 32px">
              <h1 style="color:#fff;margin:0;font-size:20px"><span style="color:#fca5a5">v</span>Think Timesheet</h1>
            </div>
            <div style="padding:28px">
              <h2 style="color:#1e293b;margin:0 0 12px">✅ SMTP Test Successful</h2>
              <p style="color:#475569">This is a test email from the vThink Timesheet system. If you received this, your email configuration is working correctly.</p>
              <p style="color:#94a3b8;font-size:12px;margin-top:24px">Sent at: ${new Date().toISOString()}</p>
            </div>
          </div>`,
      });
      this.logger.log(`✅ Test email sent → ${to}`);
      return { success: true, message: `Test email sent to ${to}` };
    } catch (err: any) {
      this.logger.error(`❌ Test email failed → ${to} | ${err.message}`);
      return { success: false, message: `Failed to send test email: ${err.message}` };
    }
  }

  // ── Welcome email for new users ───────────────────────────────────────────
  async sendWelcomeEmail(opts: {
    to:            string;
    name:          string;
    employeeId:    string;
    tempPassword:  string;
    role:          string;
    customMessage?: string;
  }) {
    const roleLabel = {
      COMPANY_ADMIN:   'Company Admin',
      PROJECT_MANAGER: 'Project Manager',
      TEAM_MEMBER:     'Employee',
    }[opts.role] || opts.role;

    const defaultMsg =
      `You have been added to the vThink Timesheet system as ${roleLabel}.\n\n` +
      `Use your Employee ID as your username and the temporary password below to log in.\n` +
      `You will be asked to set a new password on first login.`;
    const bodyText = opts.customMessage || defaultMsg;

    const html = this.buildEmailHtml({
      title:   'Welcome to vThink Timesheet',
      heading: `Welcome, ${opts.name}!`,
      body:    bodyText,
      rows: [
        { label: 'Employee ID / Username', value: opts.employeeId },
        { label: 'Temporary Password',     value: opts.tempPassword, highlight: true },
        { label: 'Role',                   value: roleLabel },
      ],
      warning: '⚠ This is a temporary password. You will be required to set a new password on your first login. Do not share this password with anyone.',
    });

    await this.send({
      to:      opts.to,
      subject: 'Your vThink Timesheet Account has been Created',
      html,
    });
  }

  // ── Password reset email ──────────────────────────────────────────────────
  async sendPasswordResetEmail(opts: {
    to:            string;
    name:          string;
    employeeId:    string;
    tempPassword:  string;
    customMessage?: string;
  }) {
    const defaultMsg =
      `Your vThink Timesheet password has been reset by an administrator.\n` +
      `Use the temporary password below to log in. You will be asked to set a new password immediately.`;
    const bodyText = opts.customMessage || defaultMsg;

    const html = this.buildEmailHtml({
      title:   'Password Reset — vThink Timesheet',
      heading: `Password Reset — ${opts.name}`,
      body:    bodyText,
      rows: [
        { label: 'Employee ID / Username', value: opts.employeeId },
        { label: 'Temporary Password',     value: opts.tempPassword, highlight: true },
      ],
      warning: '⚠ This is a temporary password valid for 24 hours. You must set a new password on login. If you did not request this, contact your administrator immediately.',
    });

    await this.send({
      to:      opts.to,
      subject: 'vThink Timesheet — Password Reset',
      html,
    });
  }

  // ── Shared HTML builder ───────────────────────────────────────────────────
  private buildEmailHtml(opts: {
    title:   string;
    heading: string;
    body:    string;
    rows:    { label: string; value: string; highlight?: boolean }[];
    warning: string;
  }): string {
    const rows = opts.rows
      .map(
        (r) =>
          `<tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;vertical-align:top">${r.label}</td>
            <td style="color:${r.highlight ? '#4f46e5' : '#1e293b'};font-weight:${r.highlight ? '700' : '600'};font-size:14px;letter-spacing:${r.highlight ? '2px' : '0'}">${r.value}</td>
          </tr>`,
      )
      .join('');

    return `
      <div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6366F1,#7C3AED);padding:28px 32px">
          <h1 style="color:#fff;margin:0;font-size:22px">
            <span style="color:#fca5a5">v</span>Think Timesheet
          </h1>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1e293b;margin:0 0 8px">${opts.heading}</h2>
          <p style="color:#475569;margin:0 0 24px;white-space:pre-line">${opts.body}</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
            <table style="width:100%;border-collapse:collapse">${rows}</table>
          </div>
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px">
            <p style="color:#92400e;margin:0;font-size:13px">${opts.warning}</p>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            This is an automated message from vThink Timesheet System. Please do not reply to this email.
          </p>
        </div>
      </div>`;
  }

  // ── Core send method ──────────────────────────────────────────────────────
  private async send(opts: { to: string; subject: string; html: string }) {
    if (!this.transporter) {
      // Dev fallback: log full details to console
      this.logger.warn(
        `\n📧 EMAIL NOT SENT (SMTP not configured)\n` +
        `   To:      ${opts.to}\n` +
        `   Subject: ${opts.subject}\n` +
        `   ➜ Add SMTP credentials to Backend/.env to enable real email delivery.\n`,
      );
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from:    this.config.get('SMTP_FROM') || 'noreply@vthink.co.in',
        to:      opts.to,
        subject: opts.subject,
        html:    opts.html,
      });
      this.logger.log(`✅ Email sent → ${opts.to} | MessageId: ${info.messageId}`);
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to send email → ${opts.to}\n` +
        `   Error: ${err.message}\n` +
        `   Code:  ${err.code || 'N/A'}\n` +
        `   Check SMTP credentials in Backend/.env`,
      );
      // Do NOT throw — user creation should not fail if email fails
    }
  }
}
