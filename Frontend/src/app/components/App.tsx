import { useState, useCallback, memo } from 'react';
import {
  LayoutDashboard, Clock, Plus, Users, CheckCircle2,
  BarChart3, LogOut, ChevronDown, ChevronRight, Settings, Menu,
  UserCog, Upload, FileText,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Login from './components/Login';
import ForceChangePassword from './components/ForceChangePassword';
import Dashboard from './components/Dashboard';
import Overview from './components/Overview';
import TeamMemberOverview from './components/TeamMemberOverview';
import AddTask from './components/AddTask';
import AssignTask from './components/AssignTask';
import EnterTimesheet from './components/EnterTimesheet';
import ApproveTimesheet from './components/ApproveTimesheet';
import Reports from './components/Reports';
import TeamMemberReports from './components/TeamMemberReports';
import AdminUpload from './components/AdminUpload';
import ManageUsers from './components/ManageUsers';
import { ToastContainer } from './components/ui/Toast';

type Screen = 'dashboard' | 'overview' | 'tasks' | 'assign' | 'timesheet'
            | 'approve' | 'reports' | 'admin-upload' | 'manage-users';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', COMPANY_ADMIN: 'Company Admin',
  PROJECT_MANAGER: 'Project Manager', TEAM_MEMBER: 'Team Member',
};
const ROLE_COLORS: Record<string, { from: string; to: string }> = {
  SUPER_ADMIN:     { from: '#7C3AED', to: '#6D28D9' },
  COMPANY_ADMIN:   { from: '#2563EB', to: '#1D4ED8' },
  PROJECT_MANAGER: { from: '#DB2777', to: '#BE185D' },
  TEAM_MEMBER:     { from: '#059669', to: '#047857' },
};

const MemoOverview           = memo(Overview);
const MemoTeamMemberOverview = memo(TeamMemberOverview);
const MemoDashboard          = memo(Dashboard);
const MemoAddTask            = memo(AddTask);
const MemoAssignTask         = memo(AssignTask);
const MemoEnterTS            = memo(EnterTimesheet);
const MemoApproveTS          = memo(ApproveTimesheet);
const MemoReports            = memo(Reports);
const MemoTeamMemberReports  = memo(TeamMemberReports);
const MemoAdminUpload        = memo(AdminUpload);
const MemoManageUsers        = memo(ManageUsers);

function getDefaultScreen(): Screen {
  try {
    const raw = localStorage.getItem('vthink-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.user?.role === 'TEAM_MEMBER') return 'overview';
    }
  } catch { /* ignore */ }
  return 'dashboard';
}

export default function App() {
  const { user, isAuthenticated, mustChangePassword, logout } = useAuthStore();
  const isTeamMember = user?.role === 'TEAM_MEMBER';
  const [screen, setScreen]               = useState<Screen>(getDefaultScreen);
  const [timesheetOpen, setTimesheetOpen] = useState(true);
  const [adminOpen, setAdminOpen]         = useState(true);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [refreshKey, setRefreshKey]       = useState(0);

  const notifyDataChanged = useCallback(() => setRefreshKey(k => k + 1), []);
  const goOverview        = useCallback(() => { setScreen('overview'); setSidebarOpen(false); }, []);
  const nav               = useCallback((s: Screen) => { setScreen(s); setSidebarOpen(false); }, []);

  // Not authenticated → Login
  if (!isAuthenticated || !user) return <><Login /><ToastContainer /></>;

  // Must change password → intercept before showing app
  if (mustChangePassword) return <><ForceChangePassword /><ToastContainer /></>;

  const canApprove     = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);
  const canManageTasks = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);
  const canAdmin       = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user.role);
  const roleColor      = ROLE_COLORS[user.role] || ROLE_COLORS.TEAM_MEMBER;

  const navItem = (s: Screen, icon: React.ReactNode, label: string) => {
    const active = screen === s;
    return (
      <button key={s} onClick={() => nav(s)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
        style={{
          background:  active ? '#EDE9FE' : 'transparent',
          color:       active ? '#4F46E5' : '#64748B',
          borderLeft:  active ? '2px solid #7C3AED' : '2px solid transparent',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#EDE9FE'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ color: active ? '#4F46E5' : '#94A3B8' }}>{icon}</span>
        <span className="flex-1 text-left font-medium">{label}</span>
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#F5F3FF', borderRight: '1px solid #E4E1FC' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-indigo-100">
        <h1 className="text-2xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          <span style={{ color: '#EF4444' }}>v</span><span style={{ color: '#1E293B' }}>Think</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Timesheet Management</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {!isTeamMember && navItem('dashboard', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
        {navItem('overview',  <BarChart3       className="w-4 h-4" />, 'Overview')}

        {/* Timesheet group */}
        <div>
          <button onClick={() => setTimesheetOpen(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 transition-all hover:bg-indigo-50">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="flex-1 text-left font-medium">Timesheet</span>
            {timesheetOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {timesheetOpen && (
            <div className="ml-4 pl-3 border-l border-indigo-100 space-y-0.5 mt-0.5">
              {navItem('timesheet', <Clock className="w-4 h-4" />, 'Enter Timesheet')}
              {canApprove && navItem('approve', <CheckCircle2 className="w-4 h-4" />, 'Approve')}
            </div>
          )}
        </div>

        {canManageTasks && navItem('tasks',  <Plus  className="w-4 h-4" />, 'Add Task')}
        {canManageTasks && navItem('assign', <Users className="w-4 h-4" />, 'Assign Task')}
        {navItem('reports', <FileText className="w-4 h-4" />, 'Reports')}

        {/* Admin group */}
        {canAdmin && (
          <div>
            <button onClick={() => setAdminOpen(v => !v)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 transition-all hover:bg-indigo-50">
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="flex-1 text-left font-medium">Admin</span>
              {adminOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {adminOpen && (
              <div className="ml-4 pl-3 border-l border-indigo-100 space-y-0.5 mt-0.5">
                {navItem('manage-users',  <UserCog className="w-4 h-4" />, 'Add / Manage Users')}
                {navItem('admin-upload',  <Upload  className="w-4 h-4" />, 'Upload / Import')}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-indigo-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: `linear-gradient(135deg, ${roleColor.from}15, ${roleColor.to}10)` }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: `linear-gradient(135deg, ${roleColor.from}, ${roleColor.to})` }}>
            {user.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{user.name}</p>
            <p className="text-xs truncate" style={{ color: roleColor.from }}>
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
          <button onClick={logout} title="Sign out"
            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
        {/* Desktop sidebar */}
        <div className="hidden lg:flex w-60 shrink-0 flex-col">{sidebarContent}</div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-60 flex flex-col z-50">{sidebarContent}</div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
            <button onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5 text-slate-600" /></button>
            <span className="font-bold text-slate-900">
              <span style={{ color: '#EF4444' }}>v</span>Think Timesheet
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/*
              All screens mounted once, visibility toggled by display:none.
              This prevents re-mount flicker on navigation.
            */}
            <div style={{ display: screen === 'dashboard'    ? 'block' : 'none' }}>
              {!isTeamMember && <MemoDashboard key="dashboard" refreshKey={refreshKey} onNavigate={nav as any} />}
            </div>
            <div style={{ display: screen === 'overview'     ? 'block' : 'none' }}>
              {isTeamMember
                ? <MemoTeamMemberOverview key="tm-overview" refreshKey={refreshKey} onNavigate={nav as any} />
                : <MemoOverview key="overview" refreshKey={refreshKey} onNavigate={nav as any} />
              }
            </div>
            <div style={{ display: screen === 'tasks'        ? 'block' : 'none' }}>
              <MemoAddTask key="tasks" onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'assign'       ? 'block' : 'none' }}>
              <MemoAssignTask key="assign" onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'timesheet'    ? 'block' : 'none' }}>
              <MemoEnterTS key="timesheet" onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'approve'      ? 'block' : 'none' }}>
              <MemoApproveTS key="approve" onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'reports'      ? 'block' : 'none' }}>
              {isTeamMember
                ? <MemoTeamMemberReports key="tm-reports" onBack={goOverview} />
                : <MemoReports key="reports" onBack={goOverview} />
              }
            </div>
            <div style={{ display: screen === 'admin-upload' ? 'block' : 'none' }}>
              <MemoAdminUpload key="admin-upload" onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'manage-users' ? 'block' : 'none' }}>
              <MemoManageUsers key="manage-users" onBack={goOverview} />
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
