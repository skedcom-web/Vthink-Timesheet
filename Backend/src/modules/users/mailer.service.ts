import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// ── App login URL ─────────────────────────────────────────────────────────────
// Set APP_URL in .env to your deployment URL, e.g. https://timesheet.vthink.co.in
// Falls back to localhost for local development.
const DEFAULT_APP_URL = 'http://localhost:5173';

// ── Role display labels ───────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:     'Super Admin',
  COMPANY_ADMIN:   'Company Admin',
  PROJECT_MANAGER: 'Project Manager',
  TEAM_MEMBER:     'Employee',
};

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
        host, port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: this.config.get('NODE_ENV') === 'production' },
      });
      this.transporter.verify((err) => {
        if (err) {
          const hint = host?.includes('gmail')
            ? ' → For Gmail: use an App Password (myaccount.google.com/apppasswords), NOT your regular password.'
            : '';
          this.logger.error(`❌ SMTP FAILED → ${host}:${port} | ${err.message}${hint}`);
        } else {
          this.logger.log(`✅ SMTP verified → ${host}:${port} (${user})`);
        }
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        `⚠️  SMTP not configured — emails logged to console only.\n` +
        `   Gmail setup:\n` +
        `     SMTP_HOST=smtp.gmail.com\n` +
        `     SMTP_PORT=587\n` +
        `     SMTP_USER=your-gmail@gmail.com\n` +
        `     SMTP_PASS=<16-char App Password from myaccount.google.com/apppasswords>\n` +
        `     SMTP_FROM=your-gmail@gmail.com`,
      );
    }
  }

  // ── SMTP test ───────────────────────────────────────────────────────────────
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) return { success: false, message: 'SMTP not configured' };
    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection successful ✅' };
    } catch (err: any) {
      return { success: false, message: `SMTP failed: ${err.message}` };
    }
  }

  // ── Send a test email to verify end-to-end delivery ──────────────────────
  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      return { success: false, message: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env' };
    }
    try {
      await this.transporter.sendMail({
        from:    this.config.get('SMTP_FROM') || 'noreply@vthink.co.in',
        to,
        subject: 'vThink Timesheet — SMTP Test Email',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#1A56DB,#1e40af);padding:24px 32px">
              <h1 style="color:#fff;margin:0;font-size:20px"><span style="color:#93C5FD">v</span>Think Timesheet</h1>
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

  // ── Welcome email — new user account created ─────────────────────────────────
  // Default template matches the spec exactly.
  // If customMessage is provided it replaces the body text only;
  // the login credentials box and warning footer are always included.
  async sendWelcomeEmail(opts: {
    to:             string;
    name:           string;
    employeeId:     string;
    tempPassword:   string;
    role:           string;
    customMessage?: string;  // replaces body text if provided
  }) {
    const roleLabel  = ROLE_LABELS[opts.role] || opts.role;
    const appUrl     = this.config.get<string>('APP_URL') || DEFAULT_APP_URL;

    // ── Default body — matches the spec template exactly ─────────────────────
    const defaultBody =
      `Dear ${opts.name},\n\n` +
      `Welcome to the VThink Timesheet!\n\n` +
      `Your account has been successfully created. Please use the login credentials below to access the system. ` +
      `You will be required to change your password during your first login for security purposes.`;

    const bodyText = opts.customMessage?.trim() || defaultBody;

    const html = this.buildWelcomeHtml({
      name:         opts.name,
      employeeId:   opts.employeeId,
      tempPassword: opts.tempPassword,
      roleLabel,
      bodyText,
      appUrl,
    });

    await this.send({
      to:      opts.to,
      subject: `Your vThink Timesheet Account has been Created`,
      html,
    });
  }

  // ── Password reset email ─────────────────────────────────────────────────────
  async sendPasswordResetEmail(opts: {
    to:             string;
    name:           string;
    employeeId:     string;
    tempPassword:   string;
    customMessage?: string;
  }) {
    const appUrl = this.config.get<string>('APP_URL') || DEFAULT_APP_URL;

    const defaultBody =
      `Dear ${opts.name},\n\n` +
      `Your vThink Timesheet password has been reset by an administrator.\n` +
      `Use the temporary password below to log in. You will be asked to set a new password immediately.`;

    const bodyText = opts.customMessage?.trim() || defaultBody;

    const html = this.buildPasswordResetHtml({
      name:         opts.name,
      employeeId:   opts.employeeId,
      tempPassword: opts.tempPassword,
      bodyText,
      appUrl,
    });

    await this.send({
      to:      opts.to,
      subject: `vThink Timesheet — Password Reset`,
      html,
    });
  }

  // ── Forgot Password email — sends a direct reset link (no temp password) ───────
  // Matches the spec template exactly.
  async sendForgotPasswordEmail(opts: {
    to:         string;
    name:       string;
    resetLink:  string;
  }) {
    const html = this.buildForgotPasswordHtml(opts);
    await this.send({
      to:      opts.to,
      subject: 'vThink Timesheet — Forgot Password / Reset Request',
      html,
    });
  }

  // ── Welcome email HTML template ──────────────────────────────────────────────
  private buildWelcomeHtml(opts: {
    name:         string;
    employeeId:   string;
    tempPassword: string;
    roleLabel:    string;
    bodyText:     string;
    appUrl:       string;
  }): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A56DB,#1e40af);padding:28px 32px">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <span style="font-size:24px;font-weight:700;color:#ffffff">
                    <span style="color:#93C5FD">v</span>Think<span style="color:#ffffff;font-size:12px;vertical-align:super">®</span>
                    <span style="font-weight:300;margin-left:4px">Timesheet</span>
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <!-- Greeting -->
            <p style="color:#1e293b;font-size:15px;margin:0 0 20px;white-space:pre-line;line-height:1.6">${opts.bodyText}</p>

            <!-- Login Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#F8FAFF;border:1px solid #BFDBFE;border-radius:8px;margin-bottom:20px">
              <tr>
                <td style="padding:16px 20px">
                  <p style="color:#1A56DB;font-size:13px;font-weight:700;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px">
                    🔐 Login Details
                  </p>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:5px 0;width:180px;vertical-align:top">Username / Email</td>
                      <td style="color:#1e293b;font-size:13px;font-weight:600;padding:5px 0">${opts.employeeId}</td>
                    </tr>
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:5px 0;vertical-align:top">Temporary Password</td>
                      <td style="padding:5px 0">
                        <span style="color:#1A56DB;font-size:15px;font-weight:700;letter-spacing:2px;background:#EFF6FF;padding:3px 10px;border-radius:4px;font-family:monospace">${opts.tempPassword}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:5px 0;vertical-align:top">Role</td>
                      <td style="color:#1e293b;font-size:13px;font-weight:600;padding:5px 0">${opts.roleLabel}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;margin-bottom:20px">
              <tr>
                <td style="padding:12px 16px">
                  <p style="color:#92400E;font-size:13px;margin:0;line-height:1.5">
                    ⚠ This is a temporary password. You will be required to set a new password when you log in for the first time.
                    Please do not share this password with anyone.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Login Link -->
            <p style="color:#475569;font-size:13px;margin:0 0 16px">
              You can access the system using the following link:
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#1A56DB;border-radius:8px">
                  <a href="${opts.appUrl}" target="_blank"
                    style="display:inline-block;padding:10px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">
                    Access vThink Timesheet →
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#475569;font-size:13px;margin:0 0 8px">
              If you experience any issues accessing your account, please contact the system administrator.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px">
            <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;line-height:1.6">
              This is an automated message from the VThink Timesheet. Please do not reply to this email.<br>
              <strong style="color:#64748b">Regards, vThink Support Team</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // ── Forgot Password HTML template ──────────────────────────────────────────────
  private buildForgotPasswordHtml(opts: {
    name:      string;
    resetLink: string;
  }): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A56DB,#1e40af);padding:28px 32px">
            <span style="font-size:24px;font-weight:700;color:#ffffff">
              <span style="color:#93C5FD">v</span>Think<span style="color:#ffffff;font-size:12px;vertical-align:super">®</span>
              <span style="font-weight:300;margin-left:4px">Timesheet</span>
            </span>
          </td>
        </tr>

        <!-- Subject line styled -->
        <tr>
          <td style="background:#EFF6FF;padding:12px 32px;border-bottom:1px solid #BFDBFE">
            <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600">
              🔐 Forgot Password / Reset Request
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="color:#1e293b;font-size:15px;margin:0 0 20px;line-height:1.6">
              Dear ${opts.name},
            </p>
            <p style="color:#475569;font-size:14px;margin:0 0 20px;line-height:1.7">
              To reset your password, please click the link below:
            </p>

            <!-- Reset Password Link label + button — matches spec exactly -->
            <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 10px">Reset Password Link:</p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:8px">
              <tr>
                <td style="background:#1A56DB;border-radius:8px">
                  <a href="${opts.resetLink}" target="_blank"
                    style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">
                    Reset My Password →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px">
              <a href="${opts.resetLink}" style="color:#1A56DB;font-size:11px;word-break:break-all">${opts.resetLink}</a>
            </p>

            <p style="color:#475569;font-size:14px;margin:0 0 20px;line-height:1.7">
              This link will allow you to create a new password for your account.
            </p>

            <!-- Warning box -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;margin-bottom:20px">
              <tr>
                <td style="padding:12px 16px">
                  <p style="color:#92400E;font-size:13px;margin:0;line-height:1.6">
                    ⚠ If you did not request this password reset, please ignore this email.
                    Your account will remain secure.
                  </p>
                </td>
              </tr>
            </table>

            <p style="color:#64748b;font-size:13px;margin:0 0 8px;line-height:1.6">
              For security reasons, this link will expire in <strong>1 hour</strong>.
            </p>
            <p style="color:#64748b;font-size:13px;margin:0;line-height:1.6">
              If you continue to experience issues, please contact the system administrator.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px">
            <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;line-height:1.6">
              This is an automated message from the vThink Timesheet Management System. Please do not reply to this email.<br>
              <strong style="color:#64748b">Regards, vThink Timesheet Support Team</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // ── Password reset HTML template ─────────────────────────────────────────────
  private buildPasswordResetHtml(opts: {
    name:         string;
    employeeId:   string;
    tempPassword: string;
    bodyText:     string;
    appUrl:       string;
  }): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A56DB,#1e40af);padding:28px 32px">
            <span style="font-size:24px;font-weight:700;color:#ffffff">
              <span style="color:#93C5FD">v</span>Think<span style="color:#ffffff;font-size:12px;vertical-align:super">®</span>
              <span style="font-weight:300;margin-left:4px">Timesheet</span>
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="color:#1e293b;font-size:15px;margin:0 0 20px;white-space:pre-line;line-height:1.6">${opts.bodyText}</p>

            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#F8FAFF;border:1px solid #BFDBFE;border-radius:8px;margin-bottom:20px">
              <tr>
                <td style="padding:16px 20px">
                  <p style="color:#1A56DB;font-size:13px;font-weight:700;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px">
                    🔐 New Login Credentials
                  </p>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:5px 0;width:180px">Username / Email</td>
                      <td style="color:#1e293b;font-size:13px;font-weight:600;padding:5px 0">${opts.employeeId}</td>
                    </tr>
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:5px 0">Temporary Password</td>
                      <td style="padding:5px 0">
                        <span style="color:#1A56DB;font-size:15px;font-weight:700;letter-spacing:2px;background:#EFF6FF;padding:3px 10px;border-radius:4px;font-family:monospace">${opts.tempPassword}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;margin-bottom:20px">
              <tr>
                <td style="padding:12px 16px">
                  <p style="color:#92400E;font-size:13px;margin:0;line-height:1.5">
                    ⚠ This is a temporary password valid for 24 hours. You must set a new password on login.
                    If you did not request this, contact your administrator immediately.
                  </p>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px">
              <tr>
                <td style="background:#1A56DB;border-radius:8px">
                  <a href="${opts.appUrl}" target="_blank"
                    style="display:inline-block;padding:10px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">
                    Log In Now →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px">
            <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;line-height:1.6">
              This is an automated message from the VThink Timesheet. Please do not reply to this email.<br>
              <strong style="color:#64748b">Regards, vThink Support Team</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // ── Core send ────────────────────────────────────────────────────────────────
  private async send(opts: { to: string; subject: string; html: string }) {
    if (!this.transporter) {
      this.logger.warn(
        `\n📧 EMAIL NOT SENT (SMTP not configured)\n` +
        `   To:      ${opts.to}\n` +
        `   Subject: ${opts.subject}\n` +
        `   ➜ Set SMTP_HOST, SMTP_USER, SMTP_PASS in Backend/.env\n`,
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
      this.logger.log(`✅ Email sent → ${opts.to} | ${info.messageId}`);
    } catch (err: any) {
      this.logger.error(
        `❌ Email failed → ${opts.to} | ${err.message}\n` +
        `   Check SMTP credentials in Backend/.env`,
      );
      // Never throw — email failure must NOT block user creation
    }
  }
}
