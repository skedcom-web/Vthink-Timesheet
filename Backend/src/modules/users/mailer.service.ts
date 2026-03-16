import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: any;

  constructor(private config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    const port = parseInt(this.config.get('SMTP_PORT') || '587');
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');
    const from = this.config.get('SMTP_FROM') || 'noreply@vthink.co.in';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host, port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Mailer configured → ${host}:${port}`);
    } else {
      // Dev fallback — log emails to console instead of sending
      this.transporter = null;
      this.logger.warn('SMTP not configured. Emails will be logged to console only.');
    }
  }

  async sendWelcomeEmail(opts: {
    to:           string;
    name:         string;
    employeeId:   string;
    tempPassword: string;
    role:         string;
    customMessage?: string;
  }) {
    const roleLabel = {
      COMPANY_ADMIN:   'Company Admin',
      PROJECT_MANAGER: 'Project Manager',
      TEAM_MEMBER:     'Employee',
    }[opts.role] || opts.role;

    const defaultMsg = `You have been added to the vThink Timesheet system as ${roleLabel}.\n\nUse your Employee ID as your username and the temporary password below to log in.\nYou will be asked to set a new password on first login.`;
    const bodyText = opts.customMessage || defaultMsg;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6366F1,#7C3AED);padding:28px 32px">
          <h1 style="color:#fff;margin:0;font-size:22px">
            <span style="color:#fca5a5">v</span>Think Timesheet
          </h1>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1e293b;margin:0 0 8px">Welcome, ${opts.name}!</h2>
          <p style="color:#475569;margin:0 0 24px;white-space:pre-line">${bodyText}</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#64748b;font-size:13px;padding:4px 0">Employee ID / Username</td>
                  <td style="color:#1e293b;font-weight:700;font-size:14px">${opts.employeeId}</td></tr>
              <tr><td style="color:#64748b;font-size:13px;padding:4px 0">Temporary Password</td>
                  <td style="color:#4f46e5;font-weight:700;font-size:14px;letter-spacing:2px">${opts.tempPassword}</td></tr>
              <tr><td style="color:#64748b;font-size:13px;padding:4px 0">Role</td>
                  <td style="color:#1e293b;font-size:14px">${roleLabel}</td></tr>
            </table>
          </div>
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px">
            <p style="color:#92400e;margin:0;font-size:13px">
              ⚠ This is a temporary password. You will be required to set a new password on your first login.
              Do not share this password with anyone.
            </p>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            This is an automated message from vThink Timesheet System. Please do not reply to this email.
          </p>
        </div>
      </div>`;

    await this.send({ to: opts.to, subject: 'Your vThink Timesheet Account has been Created', html });
  }

  async sendPasswordResetEmail(opts: {
    to:           string;
    name:         string;
    employeeId:   string;
    tempPassword: string;
    customMessage?: string;
  }) {
    const defaultMsg = `Your vThink Timesheet password has been reset by an administrator.\nUse the temporary password below to log in. You will be asked to set a new password immediately.`;
    const bodyText = opts.customMessage || defaultMsg;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6366F1,#7C3AED);padding:28px 32px">
          <h1 style="color:#fff;margin:0;font-size:22px">
            <span style="color:#fca5a5">v</span>Think Timesheet
          </h1>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1e293b;margin:0 0 8px">Password Reset — ${opts.name}</h2>
          <p style="color:#475569;margin:0 0 24px;white-space:pre-line">${bodyText}</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#64748b;font-size:13px;padding:4px 0">Employee ID / Username</td>
                  <td style="color:#1e293b;font-weight:700;font-size:14px">${opts.employeeId}</td></tr>
              <tr><td style="color:#64748b;font-size:13px;padding:4px 0">Temporary Password</td>
                  <td style="color:#4f46e5;font-weight:700;font-size:14px;letter-spacing:2px">${opts.tempPassword}</td></tr>
            </table>
          </div>
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px">
            <p style="color:#92400e;margin:0;font-size:13px">
              ⚠ This is a temporary password valid for 24 hours. You must set a new password on login.
            </p>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">If you did not request this, contact your administrator immediately.</p>
        </div>
      </div>`;

    await this.send({ to: opts.to, subject: 'vThink Timesheet — Password Reset', html });
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    if (!this.transporter) {
      // Dev mode: log to console
      this.logger.log(`\n📧 EMAIL (console-only — SMTP not configured)\n   To:      ${opts.to}\n   Subject: ${opts.subject}\n`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.config.get('SMTP_FROM') || 'noreply@vthink.co.in',
        to:   opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      this.logger.log(`Email sent → ${opts.to}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}`, err);
      // Don't throw — user creation should not fail if email fails
    }
  }
}
