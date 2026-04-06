import { useState, useCallback, memo, useEffect } from 'react';
import {
  LayoutDashboard, Clock, Plus, Users, CheckCircle2,
  BarChart3, LogOut, ChevronDown, ChevronRight,
  Settings, UserCog, Upload, FileText, Bell,
  PanelLeft, PanelLeftClose, Sun, Moon,
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
import AdminNotifications from './components/AdminNotifications';
import { ToastContainer } from './components/ui/Toast';
import { VthinkRedV, VthinkThinkReg } from './components/VthinkWordmark';

type Screen = 'dashboard' | 'overview' | 'tasks' | 'assign' | 'timesheet'
            | 'approve' | 'reports' | 'admin-upload' | 'manage-users' | 'admin-notifications';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:'Super Admin', COMPANY_ADMIN:'Company Admin',
  PROJECT_MANAGER:'Project Manager', TEAM_MEMBER:'Team Member',
};

const VALID_AUTH_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'] as const;

const SIDEBAR_COLLAPSE_KEY = 'vthink-sidebar-collapsed';
const THEME_KEY = 'vthink-theme';

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
const MemoAdminNotifications = memo(AdminNotifications);

/** First screen to show for a role (also used after login so a stale `screen` cannot hide all panels). */
function getDefaultScreenForRole(role: string | undefined): Screen {
  if (role === 'TEAM_MEMBER') return 'overview';
  if (role === 'SUPER_ADMIN') return 'dashboard';
  return 'overview';
}

function getDefaultScreen(): Screen {
  try {
    const raw = localStorage.getItem('vthink-auth');
    if (raw) {
      const p = JSON.parse(raw);
      return getDefaultScreenForRole(p?.state?.user?.role);
    }
  } catch { /* ignore */ }
  return 'overview';
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'; } catch { return false; }
}

function readTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch { /* ignore */ }
  return 'light';
}

export default function App() {
  const { user, isAuthenticated, mustChangePassword, logout } = useAuthStore();
  const isTeamMember  = user?.role === 'TEAM_MEMBER';
  const isSuperAdmin  = user?.role === 'SUPER_ADMIN';

  const [screen, setScreen]           = useState<Screen>(getDefaultScreen);
  const [collapsed, setCollapsed]     = useState(readCollapsed);
  const [theme, setTheme]             = useState<'light' | 'dark'>(readTheme);
  const [timesheetOpen, setTSOpen]    = useState(true);
  const [adminOpen, setAdminOpen]     = useState(true);
  const [refreshKey, setRefreshKey]   = useState(0);

  // Login + mandatory password change: always light. Theme toggle exists only in the sidebar after login.
  useEffect(() => {
    const preApp = !isAuthenticated || !user || mustChangePassword;
    if (preApp) {
      document.documentElement.setAttribute('data-theme', 'light');
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [isAuthenticated, user, mustChangePassword, theme]);

  // After sign-in (or user switch without full reload), reset route. Otherwise e.g. SUPER_ADMIN can be
  // left on `timesheet` from a previous account — that screen is not mounted for them → blank main area.
  useEffect(() => {
    if (!user?.id) return;
    setScreen(getDefaultScreenForRole(user.role));
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (!user.id || !user.role || !VALID_AUTH_ROLES.includes(user.role as (typeof VALID_AUTH_ROLES)[number])) {
      logout();
    }
  }, [isAuthenticated, user, logout]);

  const notifyDataChanged = useCallback(() => setRefreshKey(k => k + 1), []);
  const goOverview        = useCallback(() => { setScreen('overview'); }, []);
  const nav               = useCallback((s: Screen) => {
    if (isSuperAdmin && s === 'timesheet') return;
    setScreen(s);
  }, [isSuperAdmin]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const n = !c;
      try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    );
  }
  if (mustChangePassword) {
    return (
      <>
        <ForceChangePassword />
        <ToastContainer />
      </>
    );
  }

  const canApprove     = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user.role);
  const canManageTasks = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user.role);
  const canAdmin       = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user.role);

  const viewScreen: Screen =
    isSuperAdmin && screen === 'timesheet'
      ? 'dashboard'
      : !isSuperAdmin && screen === 'admin-notifications'
        ? 'overview'
        : screen;

  const initials = user.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2) ?? '?';

  const navItem = (s: Screen, Icon: any, label: string, sub = false) => {
    const active = viewScreen === s;
    return (
      <button
        key={s}
        type="button"
        onClick={() => nav(s)}
        title={collapsed ? label : undefined}
        className={`${sub ? 'kra-nav-sub' : 'kra-nav-item'} ${active ? 'active' : ''}`}
      >
        <Icon style={{ width: sub ? 16 : 20, height: sub ? 16 : 20, flexShrink:0 }} />
        <span className="vthink-nav-label" style={{ flex:1 }}>{label}</span>
      </button>
    );
  };

  const sidebarClass = `vthink-sidebar${collapsed ? ' vthink-sidebar--collapsed' : ''}`;

  return (
    <>
      <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--page-bg)' }}>
        <div className={sidebarClass}>
          <div
            style={{
              padding: collapsed ? '20px 12px' : '22px 24px',
              borderBottom:'1px solid var(--border)',
              display:'flex',
              alignItems:'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <div style={{ display:'flex', alignItems:'baseline', gap: 0, flexWrap:'wrap', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <VthinkRedV fontSize={22} style={{ flexShrink: 0 }} />
              <span
                className="vthink-brand-rest"
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, marginLeft: 0, fontFamily: "'Inter', system-ui, sans-serif" }}
              >
                <VthinkThinkReg fontSize={22} thinkColor="var(--text-1)" />
                <span style={{ fontSize:20, fontWeight:700, color:'var(--text-1)', letterSpacing: '-0.02em' }}>Timesheet</span>
              </span>
            </div>
          </div>

          <nav style={{ flex:1, overflowY:'auto' }} className="scrollbar-hide">
            {!isTeamMember && navItem('dashboard', LayoutDashboard, 'Dashboard')}
            {navItem('overview', BarChart3, 'Overview')}

            <button
              type="button"
              onClick={() => setTSOpen(v => !v)}
              title={collapsed ? 'Timesheet' : undefined}
              className="kra-nav-item"
            >
              <Clock style={{ width:20, height:20 }} />
              <span className="vthink-nav-label" style={{ flex:1 }}>Timesheet</span>
              <span className="vthink-nav-chevron">
                {timesheetOpen
                  ? <ChevronDown style={{ width:16, height:16, color:'var(--text-3)' }} />
                  : <ChevronRight style={{ width:16, height:16, color:'var(--text-3)' }} />}
              </span>
            </button>
            {timesheetOpen && (
              <>
                {!isSuperAdmin && navItem('timesheet', Clock, 'Enter Timesheet', true)}
                {canApprove && navItem('approve', CheckCircle2, 'Approve Timesheets', true)}
              </>
            )}

            {canManageTasks && navItem('tasks',  Plus,  'Add Task')}
            {canManageTasks && navItem('assign', Users, 'Assign Task')}
            {navItem('reports', FileText, 'Reports')}

            {canAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setAdminOpen(v => !v)}
                  title={collapsed ? 'Admin' : undefined}
                  className="kra-nav-item"
                >
                  <Settings style={{ width:20, height:20 }} />
                  <span className="vthink-nav-label" style={{ flex:1 }}>Admin</span>
                  <span className="vthink-nav-chevron">
                    {adminOpen
                      ? <ChevronDown style={{ width:16, height:16, color:'var(--text-3)' }} />
                      : <ChevronRight style={{ width:16, height:16, color:'var(--text-3)' }} />}
                  </span>
                </button>
                {adminOpen && (
                  <>
                    {navItem('manage-users', UserCog, 'Manage Users', true)}
                    {navItem('admin-upload', Upload,  'Upload / Import', true)}
                    {isSuperAdmin && navItem('admin-notifications', Bell, 'Notifications', true)}
                  </>
                )}
              </>
            )}
          </nav>

          <div
            style={{
              borderTop:'1px solid var(--border)',
              padding: collapsed ? '12px 8px' : '16px 24px',
              display:'flex',
              flexDirection:'column',
              gap: 10,
            }}
          >
            <div
              style={{
                display:'flex',
                flexDirection:'column',
                gap: 8,
                alignItems:'stretch',
                width:'100%',
              }}
            >
              <button
                type="button"
                className="vthink-sidebar__footer-btn"
                onClick={toggleTheme}
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                style={!collapsed ? { width: '100%', justifyContent: 'flex-start', paddingLeft: 14, paddingRight: 14 } : undefined}
              >
                {theme === 'light'
                  ? <Moon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  : <Sun style={{ width: 18, height: 18, flexShrink: 0 }} />}
                {!collapsed && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    {theme === 'light' ? 'Dark mode' : 'Light mode'}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="vthink-sidebar__footer-btn"
                onClick={toggleCollapse}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={!collapsed ? { width: '100%', justifyContent: 'flex-start', paddingLeft: 14, paddingRight: 14 } : undefined}
              >
                {collapsed
                  ? <PanelLeft style={{ width: 18, height: 18, flexShrink: 0 }} />
                  : <PanelLeftClose style={{ width: 18, height: 18, flexShrink: 0 }} />}
                {!collapsed && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Collapse</span>
                )}
              </button>
            </div>

            <div
              style={{
                display:'flex',
                alignItems:'center',
                gap: 12,
                marginTop: 4,
                flexDirection: collapsed ? 'column' : 'row',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
            >
              <div style={{
                width:40, height:40, borderRadius:'50%',
                background:'var(--vthink-purple)', color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, fontWeight:700, flexShrink:0,
              }}>
                {initials}
              </div>
              {!collapsed && (
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</p>
                  <p style={{ fontSize:12, color:'var(--text-2)', margin:0 }}>{ROLE_LABELS[user.role] || user.role}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={logout}
              title={collapsed ? 'Sign out' : undefined}
              style={{
                display:'flex',
                alignItems:'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 8,
                padding: collapsed ? '10px' : '8px 0',
                background:'none',
                border:'none',
                cursor:'pointer',
                color:'var(--danger)',
                fontSize:14,
                fontWeight:500,
                width:'100%',
                borderRadius: 8,
              }}
            >
              <LogOut style={{ width:16, height:16, flexShrink:0 }} />
              {!collapsed && 'Sign out'}
            </button>
          </div>
        </div>

        <div style={{ flex:1, minWidth:0, overflowY:'auto', background:'var(--page-bg)', color:'var(--text-1)' }}>
          <div style={{ display: viewScreen === 'dashboard'    ? 'block' : 'none' }}>
            {!isTeamMember && <MemoDashboard key="dashboard" refreshKey={refreshKey} onNavigate={nav as any} />}
          </div>
          <div style={{ display: viewScreen === 'overview'     ? 'block' : 'none' }}>
            {isTeamMember
              ? <MemoTeamMemberOverview key="tm-overview" refreshKey={refreshKey} onNavigate={nav as any} />
              : <MemoOverview key="overview" refreshKey={refreshKey} onNavigate={nav as any} />}
          </div>
          <div style={{ display: viewScreen === 'tasks'        ? 'block' : 'none' }}>
            <MemoAddTask key="tasks" refreshKey={refreshKey} onBack={goOverview} onDataChanged={notifyDataChanged} />
          </div>
          <div style={{ display: viewScreen === 'assign'       ? 'block' : 'none' }}>
            <MemoAssignTask key="assign" refreshKey={refreshKey} onBack={goOverview} onDataChanged={notifyDataChanged} />
          </div>
          {!isSuperAdmin && (
            <div style={{ display: viewScreen === 'timesheet' ? 'block' : 'none' }}>
              <MemoEnterTS key="timesheet" refreshKey={refreshKey} onBack={goOverview} onDataChanged={notifyDataChanged} />
            </div>
          )}
          <div style={{ display: viewScreen === 'approve'      ? 'block' : 'none' }}>
            <MemoApproveTS key="approve" onBack={goOverview} onDataChanged={notifyDataChanged} />
          </div>
          <div style={{ display: viewScreen === 'reports'      ? 'block' : 'none' }}>
            {isTeamMember
              ? <MemoTeamMemberReports key="tm-reports" refreshKey={refreshKey} onBack={goOverview} />
              : <MemoReports key="reports" refreshKey={refreshKey} onBack={goOverview} />}
          </div>
          <div style={{ display: viewScreen === 'admin-upload' ? 'block' : 'none' }}>
            <MemoAdminUpload key="admin-upload" onBack={goOverview} onDataChanged={notifyDataChanged} />
          </div>
          <div style={{ display: viewScreen === 'manage-users' ? 'block' : 'none' }}>
            <MemoManageUsers key="manage-users" refreshKey={refreshKey} onBack={goOverview} />
          </div>
          {isSuperAdmin && viewScreen === 'admin-notifications' && (
            <div>
              <MemoAdminNotifications key="admin-notifications" onBack={goOverview} />
            </div>
          )}
        </div>
      </div>

      <ToastContainer />
    </>
  );
}
