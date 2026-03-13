import { useState, useCallback, memo } from 'react';
import {
  LayoutDashboard, Clock, Plus, Users, CheckCircle2,
  BarChart3, LogOut, ChevronDown, ChevronRight, Settings, Menu, Eye,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Overview from './components/Overview';
import AddTask from './components/AddTask';
import AssignTask from './components/AssignTask';
import EnterTimesheet from './components/EnterTimesheet';
import ApproveTimesheet from './components/ApproveTimesheet';
import Reports from './components/Reports';
import AdminUpload from './components/AdminUpload';
import { ToastContainer } from './components/ui/Toast';

type Screen = 'dashboard' | 'overview' | 'tasks' | 'assign' | 'timesheet' | 'approve' | 'reports' | 'admin';

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

// ── Each screen is memoized so it only re-renders when its own props change ──
// This prevents ALL screens from re-rendering when App state changes (e.g. sidebar toggle)
const MemoOverview      = memo(Overview);
const MemoDashboard     = memo(Dashboard);
const MemoAddTask       = memo(AddTask);
const MemoAssignTask    = memo(AssignTask);
const MemoEnterTS       = memo(EnterTimesheet);
const MemoApproveTS     = memo(ApproveTimesheet);
const MemoReports       = memo(Reports);
const MemoAdminUpload   = memo(AdminUpload);

export default function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [screen, setScreen]               = useState<Screen>('dashboard');
  const [timesheetOpen, setTimesheetOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [refreshKey, setRefreshKey]       = useState(0);

  // Stable callback — never recreated, so memoized children never re-render because of it
  const notifyDataChanged = useCallback(() => setRefreshKey(k => k + 1), []);
  const goOverview        = useCallback(() => { setScreen('overview'); setSidebarOpen(false); }, []);
  const nav               = useCallback((s: Screen) => { setScreen(s); setSidebarOpen(false); }, []);

  if (!isAuthenticated || !user) return <><Login /><ToastContainer /></>;

  const canApprove     = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);
  const canManageTasks = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);
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
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: active ? '#4F46E5' : '#94A3B8' }}>{icon}</span>
        <span className="flex-1 text-left font-medium">{label}</span>
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#F5F3FF', borderRight: '1px solid #E4E1FC' }}>
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #E4E1FC' }}>
        <h1 className="text-xl font-bold">
          <span style={{ color: '#EF4444' }}>v</span><span style={{ color: '#1E293B' }}>Think</span>
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Timesheet Management</p>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6D28D9' }}>Platform</span>
        </div>
        {navItem('dashboard', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
        <div className="pt-3">
          <button onClick={() => setTimesheetOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: '#6D28D9' }}>
            <span>Timesheets</span>
            {timesheetOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {timesheetOpen && (
            <div className="mt-1 space-y-0.5">
              {navItem('overview',  <Eye className="w-4 h-4" />,         'Overview')}
              {canManageTasks && navItem('tasks',  <Plus className="w-4 h-4" />,        'Add Task')}
              {canManageTasks && navItem('assign', <Users className="w-4 h-4" />,       'Assign Task')}
              {navItem('timesheet', <Clock className="w-4 h-4" />,       'Enter Timesheet')}
              {canApprove && navItem('approve', <CheckCircle2 className="w-4 h-4" />,   'Approve')}
              {navItem('reports',   <BarChart3 className="w-4 h-4" />,   'Reports')}
            </div>
          )}
        </div>
        {canManageTasks && (
          <>
            <div className="px-3 pt-4 pb-1">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6D28D9' }}>Management</span>
            </div>
            {navItem('admin', <Settings className="w-4 h-4" />, 'Admin')}
          </>
        )}
      </nav>
      <div className="p-3" style={{ borderTop: '1px solid #E4E1FC' }}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: `linear-gradient(135deg, ${roleColor.from}, ${roleColor.to})` }}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{user.name}</div>
            <div className="text-xs truncate" style={{ color: '#7C3AED' }}>{ROLE_LABELS[user.role]}</div>
          </div>
          <button onClick={logout} className="p-1.5 rounded-lg"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EDE9FE'; e.currentTarget.style.color = '#7C3AED'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
            title="Sign out">
            <LogOut className="w-3.5 h-3.5" />
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
            <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-60 flex flex-col z-50">{sidebarContent}</div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile topbar */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-base font-bold">
              <span style={{ color: '#EF4444' }}>v</span>Think
            </h1>
            <button onClick={logout} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <LogOut className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* 
            All screens are rendered but only the active one is visible.
            Using display:none instead of conditional rendering means components
            stay mounted and never lose state or re-fetch on tab switch.
            Only Dashboard and Overview re-fetch when refreshKey changes.
          */}
          <main className="flex-1 overflow-y-auto">
            <div style={{ display: screen === 'dashboard' ? 'block' : 'none' }}>
              <MemoDashboard onNavigate={nav} refreshKey={refreshKey} />
            </div>
            <div style={{ display: screen === 'overview' ? 'block' : 'none' }}>
              <MemoOverview onNavigate={nav} refreshKey={refreshKey} />
            </div>
            <div style={{ display: screen === 'tasks' ? 'block' : 'none' }}>
              <MemoAddTask onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'assign' ? 'block' : 'none' }}>
              <MemoAssignTask onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'timesheet' ? 'block' : 'none' }}>
              <MemoEnterTS onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'approve' ? 'block' : 'none' }}>
              <MemoApproveTS onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
            <div style={{ display: screen === 'reports' ? 'block' : 'none' }}>
              <MemoReports onBack={goOverview} />
            </div>
            {canManageTasks && (
              <div style={{ display: screen === 'admin' ? 'block' : 'none' }}>
                <MemoAdminUpload onBack={goOverview} onDataChanged={notifyDataChanged} />
              </div>
            )}
          </main>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
