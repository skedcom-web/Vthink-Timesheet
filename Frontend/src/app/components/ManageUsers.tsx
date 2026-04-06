import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, UserPlus, Users, Search, RefreshCw, Loader2,
  CheckCircle2, AlertCircle, ShieldOff, ShieldCheck, KeyRound,
  ChevronDown, Eye, EyeOff, Copy, X, UserCog,
} from 'lucide-react';
import { usersApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from './ui/Toast';

// All possible role options
const ALL_ROLE_OPTIONS = [
  { value: 'COMPANY_ADMIN',   label: 'Company Admin',   color: 'var(--primary)',              bg: 'var(--primary-tint)' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager', color: 'var(--vthink-purple)',      bg: 'var(--vthink-purple-soft)' },
  { value: 'TEAM_MEMBER',     label: 'Employee',        color: 'var(--success)',            bg: 'var(--success-tint)' },
];

// Roles each actor can create
const CREATABLE_ROLES: Record<string, string[]> = {
  SUPER_ADMIN:     ['COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  COMPANY_ADMIN:   ['PROJECT_MANAGER', 'TEAM_MEMBER'],
  PROJECT_MANAGER: ['TEAM_MEMBER'],
  TEAM_MEMBER:     [],
};
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:     'Super Admin',
  COMPANY_ADMIN:   'Company Admin',
  PROJECT_MANAGER: 'Project Manager',
  TEAM_MEMBER:     'Employee',
};
const ROLE_COLOR: Record<string, { color: string; bg: string }> = {
  SUPER_ADMIN:     { color: 'var(--vthink-purple)', bg: 'var(--vthink-purple-soft)' },
  COMPANY_ADMIN:   { color: 'var(--primary)', bg: 'var(--primary-tint)' },
  PROJECT_MANAGER: { color: 'var(--vthink-purple)', bg: 'var(--vthink-purple-soft)' },
  TEAM_MEMBER:     { color: 'var(--success)', bg: 'var(--success-tint)' },
};

interface UserRecord {
  id: string; name: string; email: string; role: string;
  employeeId?: string; department?: string;
  active: boolean; mustChangePassword: boolean; createdAt: string;
}
interface EmpOption { employeeNo: string; name: string; email: string; designation: string; }

// ── Default welcome email template — shown in the UI so admin can preview/edit ──
// This mirrors the server-side default in mailer.service.ts.
// If the admin clears this field, the server uses its own default template.
const DEFAULT_WELCOME_TEMPLATE = (name: string, role: string) => {
  const roleLabel: Record<string,string> = {
    COMPANY_ADMIN: 'Company Admin',
    PROJECT_MANAGER: 'Project Manager',
    TEAM_MEMBER: 'Employee',
  };
  const rl = roleLabel[role] || role;
  return `Dear ${name || '{{Name}}'},

Welcome to the VThink Timesheet!

Your account has been successfully created. Please use the login credentials below to access the system. You will be required to change your password during your first login for security purposes.

Login Details:
Username / Email: {{Employee ID}}
Temporary Password: {{Temporary Password}}
Role: ${rl}

⚠ This is a temporary password. You will be required to set a new password when you log in for the first time. Please do not share this password with anyone.

You can access the system using the following link:
{{App Login URL}}

If you experience any issues accessing your account, please contact the system administrator.

This is an automated message from the VThink Timesheet. Please do not reply to this email.

Regards,
vThink Support Team`;
};

export default function ManageUsers({
  onBack,
  refreshKey = 0,
}: {
  onBack: () => void;
  refreshKey?: number;
}) {
  const { user: currentUser } = useAuthStore();
  const ROLE_OPTIONS = ALL_ROLE_OPTIONS.filter(r =>
    (CREATABLE_ROLES[currentUser?.role || ''] || []).includes(r.value)
  );
  const [tab, setTab]                 = useState<'list' | 'add'>('list');
  const [users, setUsers]             = useState<UserRecord[]>([]);
  const [empOptions, setEmpOptions]   = useState<EmpOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('');

  // Add user form
  const [form, setForm] = useState({
    name: '', email: '', employeeId: '', department: '', role: '',
    customEmailMessage: '',
  });
  const [showEmailMsg, setShowEmailMsg]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [createdResult, setCreatedResult] = useState<{ name: string; tempPassword: string } | null>(null);

  // Reset password modal
  const [resetTarget, setResetTarget]       = useState<UserRecord | null>(null);
  const [resetMsg, setResetMsg]             = useState('');
  const [resetResult, setResetResult]       = useState<string | null>(null);
  const [resetting, setResetting]           = useState(false);
  const [showTempPw, setShowTempPw]         = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try { setUsers(await usersApi.getAll()); }
    catch (e: any) {
      // 403 = role not permitted — do NOT show a toast, just stay empty
      if (e?.response?.status !== 403) {
        toast.error('Failed to load users');
      }
    }
    finally { setLoadingUsers(false); }
  }, []);

  useEffect(() => {
    fetchUsers();
    usersApi.getEmployeeOptions().then(setEmpOptions).catch(() => {});
  }, [fetchUsers, refreshKey]);

  // Auto-fill from employee_configs when employeeId is selected
  const handleEmpSelect = (empNo: string) => {
    const emp = empOptions.find(e => e.employeeNo === empNo);
    if (emp) {
      setForm(f => ({
        ...f,
        employeeId:  emp.employeeNo,
        name:        emp.name,
        email:       emp.email || f.email,
        department:  emp.designation || f.department,
      }));
    } else {
      setForm(f => ({ ...f, employeeId: empNo }));
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) || (u.employeeId || '').toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  // ── Add user ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    // New attempt: always clear the previous success panel first (validation may fail after).
    setCreatedResult(null);
    setShowTempPw(false);

    if (!form.name || !form.email || !form.role) {
      toast.error('Name, Email and Role are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await usersApi.create(form);
      setCreatedResult({ name: res.name, tempPassword: res.tempPassword });
      toast.success(`User "${res.name}" created successfully`);
      setForm({ name:'', email:'', employeeId:'', department:'', role:'', customEmailMessage:'' });
      setShowEmailMsg(false);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to create user');
    } finally { setSubmitting(false); }
  };

  // ── Revoke / Restore ─────────────────────────────────────────────────────────
  const handleRevoke = async (u: UserRecord) => {
    try {
      await usersApi.revoke(u.id);
      toast.success(`Access revoked for ${u.name}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to revoke access');
    }
  };
  const handleRestore = async (u: UserRecord) => {
    try {
      await usersApi.restore(u.id);
      toast.success(`Access restored for ${u.name}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to restore access');
    }
  };

  // ── Reset password ────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!resetTarget) return;
    setResetting(true); setResetResult(null);
    try {
      const res = await usersApi.resetPassword({ userId: resetTarget.id, customEmailMessage: resetMsg || undefined });
      setResetResult(res.tempPassword);
      toast.success('Password reset successfully');
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to reset password');
    } finally { setResetting(false); }
  };

  const lbl = 'block text-sm font-medium text-[var(--text-1)] mb-1';
  const inp = 'w-full border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-[var(--card-bg)] text-[var(--text-1)]';

  return (
    <div className="p-6 max-w-6xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--primary)] hover:opacity-85 font-medium mb-4 transition-opacity">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-tint flex items-center justify-center">
          <UserCog className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold font-bold color-text-1">User Management</h1>
          <p className="text-[var(--text-2)] text-sm">Add users, manage access and reset passwords</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 tabs-segment-bg p-1 rounded-xl mb-6 w-fit">
        {(['list','add'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setCreatedResult(null); }}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === t ? 'var(--card-bg)' : 'transparent', color: tab === t ? 'var(--primary)' : 'var(--text-2)',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t === 'list' ? <><Users className="w-4 h-4 inline mr-1.5" />Manage Users</> : <><UserPlus className="w-4 h-4 inline mr-1.5" />Add New User</>}
          </button>
        ))}
      </div>

      {/* ── ADD USER TAB ─────────────────────────────────────────────────────── */}
      {tab === 'add' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[var(--text-1)] mb-2">Create New User Account</h2>

            {/* Employee No — dropdown from employee_configs */}
            <div>
              <label className={lbl}>Employee No <span className="text-xs text-slate-400">(from Employee Upload)</span></label>
              <select value={form.employeeId} onChange={e => handleEmpSelect(e.target.value)} className={inp}>
                <option value="">Select or leave blank to fill manually…</option>
                {empOptions.map(e => (
                  <option key={e.employeeNo} value={e.employeeNo}>{e.employeeNo} — {e.name}</option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className={lbl}>Full Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="e.g. Rajesh Babu" className={inp} />
            </div>

            {/* Email */}
            <div>
              <label className={lbl}>Email Address <span className="text-red-500">*</span></label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                placeholder="e.g. rajesh@vthink.co.in" className={inp} />
            </div>

            {/* Department / Designation */}
            <div>
              <label className={lbl}>Designation / Department</label>
              <input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}
                placeholder="e.g. Senior Professional" className={inp} />
            </div>

            {/* Role */}
            <div>
              <label className={lbl}>Access Role <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {ROLE_OPTIONS.map(r => (
                  <button key={r.value} type="button"
                    onClick={() => setForm(f => ({...f, role: r.value}))}
                    className="px-3 py-2.5 rounded-lg text-xs font-semibold border-2 transition-all"
                    style={{
                      borderColor: form.role === r.value ? r.color : 'var(--border)',
                      background:  form.role === r.value ? r.bg    : 'var(--page-bg)',
                      color:       form.role === r.value ? r.color : 'var(--text-2)',
                    }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Email message — shows default template, admin can customise */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <label className="block text-sm font-medium text-[var(--text-1)]">
                  Welcome Email Message
                </label>
                <button type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    customEmailMessage: f.customEmailMessage ? '' : DEFAULT_WELCOME_TEMPLATE(f.name, f.role)
                  }))}
                  className="text-xs text-[var(--primary)] hover:opacity-85 font-medium underline">
                  {form.customEmailMessage ? 'Clear (use server default)' : 'Preview default template'}
                </button>
              </div>
              <textarea
                value={form.customEmailMessage}
                onChange={e => setForm(f => ({...f, customEmailMessage: e.target.value}))}
                rows={10}
                placeholder={`Default template will be used if left empty.

Click "Preview default template" above to see and edit the default message before sending.`}
                className={inp + ' resize-y'}
                style={{ fontFamily:'monospace', fontSize:12 }}
              />
              <p className="text-xs text-slate-400 mt-1">
                💡 Leave empty to use the default template. Or edit the text above — the actual login credentials and login URL are always included automatically.
              </p>
            </div>

            <button onClick={handleCreate} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--vthink-purple))' }}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                          : <><UserPlus className="w-4 h-4" /> Create User & Send Email</>}
            </button>
          </div>

          {/* Result panel */}
          <div className="space-y-4">
            {createdResult ? (
              <div className="surface-callout-success rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                  <h3 className="font-semibold text-[var(--text-1)]">User Created Successfully</h3>
                </div>
                <p className="text-sm text-[var(--text-2)] mb-4">
                  <strong className="text-[var(--text-1)]">{createdResult.name}</strong> has been created. A welcome email with login instructions has been sent.
                </p>
                <div
                  className="bg-[var(--card-bg)] rounded-lg p-4 border"
                  style={{ borderColor: 'color-mix(in srgb, var(--success) 35%, var(--border))' }}
                >
                  <p className="text-xs text-[var(--text-3)] mb-1">Temporary Password (also sent via email)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-base font-bold tracking-widest text-[var(--primary)] flex-1">
                      {showTempPw ? createdResult.tempPassword : '••••••••'}
                    </code>
                    <button onClick={() => setShowTempPw(v => !v)} className="text-slate-400 hover:text-slate-600">
                      {showTempPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(createdResult.tempPassword); toast.success('Copied!'); }}
                      className="text-slate-400 hover:text-primary">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-3)] mt-3">
                  The user must change this password on first login. It expires in 24 hours.
                </p>
              </div>
            ) : (
              <div className="surface-muted-panel rounded-xl p-6">
                <h3 className="font-semibold text-[var(--text-1)] mb-3">How it works</h3>
                <div className="space-y-3">
                  {[
                    { n:'1', t:'Fill in employee details',   d:'Select from Employee Upload list or enter manually' },
                    { n:'2', t:'Choose access role',          d:'Company Admin, Project Manager or Employee' },
                    { n:'3', t:'System creates account',      d:'A secure temporary password is generated automatically' },
                    { n:'4', t:'Email is sent automatically', d:'Welcome email with temp password is sent to the user' },
                    { n:'5', t:'User sets new password',      d:'On first login, user must change their temporary password' },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full surface-icon-btn text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</div>
                      <div><p className="text-sm font-medium text-[var(--text-1)]">{s.t}</p><p className="text-xs text-[var(--text-3)]">{s.d}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MANAGE USERS TAB ─────────────────────────────────────────────────── */}
      {tab === 'list' && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or employee ID…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--card-bg)] text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--card-bg)] text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Roles</option>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <button onClick={fetchUsers} disabled={loadingUsers}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 px-5 py-2 tabs-segment-bg text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide">
            <div className="col-span-3">Name / Emp ID</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Users className="w-10 h-10 text-slate-200" />
              <p className="text-sm">{search || roleFilter ? 'No users match your filter' : 'No users yet'}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map(u => {
                const rc = ROLE_COLOR[u.role] || ROLE_COLOR.TEAM_MEMBER;
                return (
                  <div key={u.id} className="grid grid-cols-12 px-5 py-3 items-center hover:bg-[var(--nav-hover-bg)] transition-colors">
                    <div className="col-span-3">
                      <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.employeeId || '—'}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm text-slate-600 truncate">{u.email}</p>
                      {u.department && <p className="text-xs text-slate-400 truncate">{u.department}</p>}
                    </div>
                    <div className="col-span-2">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ color: rc.color, background: rc.bg }}>
                        {ROLE_LABEL[u.role]}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: u.active ? 'var(--success)' : 'var(--danger)' }}>
                          {u.active
                            ? <><CheckCircle2 className="w-3 h-3" />Active</>
                            : <><AlertCircle  className="w-3 h-3" />Revoked</>}
                        </span>
                        {u.mustChangePassword && (
                          <span className="text-xs text-[var(--warning)] flex items-center gap-1">
                            <KeyRound className="w-3 h-3" />Temp pw
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {/* Reset password */}
                      {u.active && u.role !== 'SUPER_ADMIN' && (
                        <button onClick={() => { setResetTarget(u); setResetResult(null); setResetMsg(''); }}
                          title="Reset Password"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--warning)] hover:bg-[var(--warning-tint)] transition-colors">
                          <KeyRound className="w-4 h-4" />
                        </button>
                      )}
                      {/* Revoke / Restore */}
                      {u.role !== 'SUPER_ADMIN' && (
                        u.active
                          ? <button onClick={() => handleRevoke(u)} title="Revoke Access"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--danger)] hover:bg-[var(--danger-tint)] transition-colors">
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          : <button onClick={() => handleRestore(u)} title="Restore Access"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--success)] hover:bg-[var(--success-tint)] transition-colors">
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Reset Password Modal ─────────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[var(--warning)]" />
                <h3 className="font-semibold text-[var(--text-1)]">Reset Password</h3>
              </div>
              <button onClick={() => { setResetTarget(null); setResetResult(null); }}
                className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {!resetResult ? (
              <>
                <p className="text-sm text-[var(--text-2)] mb-4">
                  Reset password for <strong className="text-[var(--text-1)]">{resetTarget.name}</strong> ({resetTarget.email}).
                  A new temporary password will be generated and emailed.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--text-1)] mb-1">
                    Custom email message <span className="text-[var(--text-3)] font-normal">(optional)</span>
                  </label>
                  <textarea value={resetMsg} onChange={e => setResetMsg(e.target.value)}
                    rows={3} placeholder="Leave blank to use the default reset message…"
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--card-bg)] text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleReset} disabled={resetting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                    style={{ background: 'var(--warning)' }}>
                    {resetting ? <><Loader2 className="w-4 h-4 animate-spin" />Resetting…</>
                               : <><KeyRound className="w-4 h-4" />Reset & Send Email</>}
                  </button>
                  <button onClick={() => setResetTarget(null)}
                    className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-2)] text-sm hover:bg-[var(--nav-hover-bg)]">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div className="surface-callout-success rounded-xl p-4 mb-4">
                  <p className="text-sm font-medium text-[var(--text-1)] mb-2">Password reset successfully!</p>
                  <p className="text-xs text-[var(--text-2)] mb-3">New temporary password (also emailed):</p>
                  <div
                    className="flex items-center gap-2 bg-[var(--card-bg)] rounded-lg px-3 py-2 border"
                    style={{ borderColor: 'color-mix(in srgb, var(--success) 35%, var(--border))' }}
                  >
                    <code className="font-bold tracking-widest text-[var(--primary)] flex-1 text-sm">
                      {showTempPw ? resetResult : '••••••••'}
                    </code>
                    <button onClick={() => setShowTempPw(v => !v)} className="text-slate-400 hover:text-slate-600">
                      {showTempPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(resetResult); toast.success('Copied!'); }}
                      className="text-slate-400 hover:text-primary">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button onClick={() => { setResetTarget(null); setResetResult(null); setShowTempPw(false); }}
                  className="w-full py-2.5 rounded-lg tabs-segment-bg text-[var(--text-1)] text-sm font-medium hover:opacity-90 border border-[var(--border)] transition-opacity">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
