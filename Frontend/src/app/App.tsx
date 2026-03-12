import { useState } from 'react';
import {
  LayoutDashboard, Clock, Plus, Users, CheckCircle2,
  BarChart3, LogOut, ChevronDown, ChevronRight, Settings,
  Menu, Eye
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

export default function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [screen, setScreen]               = useState<Screen>('dashboard');
  const [timesheetOpen, setTimesheetOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen]     = useState(false);

  if (!isAuthenticated || !user) return <><Login /><ToastContainer /></>;

  const canApprove     = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);
  const canManageTasks = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);

  const nav = (s: Screen) => { setScreen(s); setSidebarOpen(false); };
  const goOverview = () => nav('overview');

  const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.TEAM_MEMBER;

  const navItem = (s: Screen, icon: React.ReactNode, label: string, hidden = false) => {
    if (hidden) return null;
    const active = screen === s;
    return (
      <button key={s} onClick={() => nav(s)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
        style={{
          background: active ? '#EDE9FE' : 'transparent',
          color: active ? '#4F46E5' : '#64748B',
          borderLeft: active ? '2px solid #7C3AED' : '2px solid transparent',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#EDE9FE'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: active ? '#4F46E5' : '#94A3B8' }}>{icon}</span>
        <span className="flex-1 text-left font-medium">{label}</span>
      </button>
    );
  };

  const sidebar = (
    <div className="flex flex-col h-full" style={{ background: '#F5F3FF', borderRight: '1px solid #E4E1FC' }}>
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #E4E1FC' }}>
        <h1 className="text-xl font-bold">
          <span style={{ color: '#EF4444' }}>v</span><span style={{ color: '#1E293B' }}>Think</span>
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Timesheet Management</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6D28D9' }}>Platform</span>
        </div>
        {navItem('dashboard', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}

        <div className="pt-3">
          <button onClick={() => setTimesheetOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-widest transition-colors"
            style={{ color: '#6D28D9' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#4C1D95')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6D28D9')}
          >
            <span>Timesheets</span>
            {timesheetOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {timesheetOpen && (
            <div className="mt-1 space-y-0.5">
              {navItem('overview',  <Eye className="w-4 h-4" />,          'Overview')}
              {canManageTasks && navItem('tasks',    <Plus className="w-4 h-4" />,        'Add Task')}
              {canManageTasks && navItem('assign',   <Users className="w-4 h-4" />,       'Assign Task')}
              {navItem('timesheet', <Clock className="w-4 h-4" />,        'Enter Timesheet')}
              {canApprove && navItem('approve', <CheckCircle2 className="w-4 h-4" />, 'Approve')}
              {navItem('reports',   <BarChart3 className="w-4 h-4" />,    'Reports')}
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

      {/* User footer */}
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
          <button onClick={logout} className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EDE9FE'; e.currentTarget.style.color = '#7C3AED'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // All non-overview/dashboard screens get an onBack that goes to overview
  const screens: Record<Screen, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={(s) => nav(s as Screen)} />,
    overview:  <Overview onNavigate={(s) => nav(s as Screen)} />,
    tasks:     <AddTask onBack={goOverview} />,
    assign:    <AssignTask onBack={goOverview} />,
    timesheet: <EnterTimesheet onBack={goOverview} />,
    approve:   <ApproveTimesheet onBack={goOverview} />,
    reports:   <Reports onBack={goOverview} />,
    admin: (
      <div className="min-h-full p-8" style={{ background: 'linear-gradient(135deg, #F0F0FF 0%, #EEF2FF 40%, #F5F3FF 100%)' }}>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={goOverview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.7)', color: '#6366F1', border: '1px solid #C7D2FE' }}
          >
            ← Back to Overview
          </button>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2" style={{ letterSpacing: '-0.02em' }}>Admin</h1>
        <p className="text-slate-500 text-sm">System administration panel — coming soon.</p>
      </div>
    ),
  };

  return (
    <>
      <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
        {/* Desktop sidebar */}
        <div className="hidden lg:flex w-60 shrink-0 flex-col">
          {sidebar}
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-60 flex flex-col z-50">{sidebar}</div>
          </div>
        )}

        {/* Main */}
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

          {/* Page content — full height */}
          <main className="flex-1 overflow-y-auto">
            {screens[screen]}
          </main>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
