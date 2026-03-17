import { useState, useCallback, memo } from 'react';
import {
  LayoutDashboard, Clock, Plus, Users, CheckCircle2,
  BarChart3, LogOut, ChevronDown, ChevronRight, Settings, Menu,
  UserCog, Upload, FileText, ChevronLeft,
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

  const [screen, setScreen]           = useState<Screen>(getDefaultScreen);
  const [timesheetOpen, setTSOpen]    = useState(true);
  const [adminOpen, setAdminOpen]     = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [refreshKey, setRefreshKey]   = useState(0);

  const notifyDataChanged = useCallback(() => setRefreshKey(k => k + 1), []);
  const goOverview        = useCallback(() => { setScreen('overview'); setSidebarOpen(false); }, []);
  const nav               = useCallback((s: Screen) => { setScreen(s); setSidebarOpen(false); }, []);

  if (!isAuthenticated || !user) return <><Login /><ToastContainer /></>;
  if (mustChangePassword)        return <><ForceChangePassword /><ToastContainer /></>;

  const canApprove     = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);
  const canManageTasks = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);
  const canAdmin       = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user.role);

  const navItem = (s: Screen, icon: React.ReactNode, label: string) => {
    const active = screen === s;
    return (
      <button key={s} onClick={() => nav(s)} title={collapsed ? label : undefined}
        style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'7px 12px', borderRadius:8,
          fontSize:13.5, fontWeight: active ? 600 : 500,
          color: active ? 'var(--primary)' : 'var(--text-2)',
          background: active ? 'var(--primary-tint)' : 'transparent',
          borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
          cursor:'pointer', border:'none', width:'100%', textAlign:'left',
          transition:'all 0.15s',
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background='var(--border)'; e.currentTarget.style.color='var(--text-1)'; } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-2)'; } }}
      >
        <span style={{ flexShrink:0, color: active ? 'var(--primary)' : 'var(--text-2)' }}>{icon}</span>
        {!collapsed && <span style={{ flex:1, textAlign:'left' }}>{label}</span>}
      </button>
    );
  };

  const sectionLabel = (label: string) =>
    !collapsed
      ? <p style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'14px 12px 4px', margin:0 }}>{label}</p>
      : <div style={{ marginTop:10 }} />;

  const initials = user.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2) ?? '?';

  const sidebarContent = (
    <div style={{
      display:'flex', flexDirection:'column', height:'100%',
      background:'#fff', borderRight:'1px solid var(--border)',
      width: collapsed ? 64 : 224, minWidth: collapsed ? 64 : 224,
      transition:'width 0.25s ease, min-width 0.25s ease',
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', padding:'14px 16px', borderBottom:'1px solid var(--border)', minHeight:58 }}>
        {!collapsed ? (
          <>
            <div style={{ display:'flex', alignItems:'baseline', flex:1 }}>
              <span style={{ fontSize:20, fontWeight:700, color:'#EF4444' }}>v</span>
              <span style={{ fontSize:20, fontWeight:700, color:'var(--text-1)' }}>Think</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#EF4444', marginLeft:2 }}>*</span>
            </div>
            <button onClick={() => setCollapsed(true)} title="Collapse"
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', padding:4 }}>
              <ChevronLeft style={{ width:16, height:16 }} />
            </button>
          </>
        ) : (
          <div style={{ display:'flex', alignItems:'baseline', margin:'0 auto' }}>
            <span style={{ fontSize:20, fontWeight:700, color:'#EF4444' }}>v</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#EF4444' }}>*</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex:1, overflowY:'auto', padding:'4px 8px', display:'flex', flexDirection:'column', gap:1 }}>
        {sectionLabel('PLATFORM')}
        {!isTeamMember && navItem('dashboard', <LayoutDashboard style={{ width:16, height:16 }} />, 'Dashboard')}
        {navItem('overview', <BarChart3 style={{ width:16, height:16 }} />, 'Overview')}

        {sectionLabel('TIMESHEET')}
        {!collapsed ? (
          <div>
            <button onClick={() => setTSOpen(v => !v)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderRadius:8, fontSize:13.5, fontWeight:500, color:'var(--text-2)', background:'transparent', borderLeft:'3px solid transparent', cursor:'pointer', border:'none', width:'100%' }}>
              <Clock style={{ width:16, height:16, flexShrink:0 }} />
              <span style={{ flex:1, textAlign:'left' }}>Timesheet</span>
              {timesheetOpen ? <ChevronDown style={{ width:14, height:14, color:'var(--text-3)' }} /> : <ChevronRight style={{ width:14, height:14, color:'var(--text-3)' }} />}
            </button>
            {timesheetOpen && (
              <div style={{ marginLeft:14, paddingLeft:12, borderLeft:'1px solid var(--border-mid)', display:'flex', flexDirection:'column', gap:1, marginTop:2 }}>
                {navItem('timesheet', <Clock style={{ width:16, height:16 }} />, 'Enter Timesheet')}
                {canApprove && navItem('approve', <CheckCircle2 style={{ width:16, height:16 }} />, 'Approve')}
              </div>
            )}
          </div>
        ) : (
          <>
            {navItem('timesheet', <Clock style={{ width:16, height:16 }} />, 'Enter Timesheet')}
            {canApprove && navItem('approve', <CheckCircle2 style={{ width:16, height:16 }} />, 'Approve')}
          </>
        )}

        {canManageTasks && (
          <>
            {sectionLabel('MANAGEMENT')}
            {navItem('tasks',  <Plus  style={{ width:16, height:16 }} />, 'Add Task')}
            {navItem('assign', <Users style={{ width:16, height:16 }} />, 'Assign Task')}
          </>
        )}

        {sectionLabel('REPORTS')}
        {navItem('reports', <FileText style={{ width:16, height:16 }} />, 'Reports')}

        {canAdmin && (
          <>
            {sectionLabel('SETTINGS')}
            {!collapsed ? (
              <div>
                <button onClick={() => setAdminOpen(v => !v)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderRadius:8, fontSize:13.5, fontWeight:500, color:'var(--text-2)', background:'transparent', borderLeft:'3px solid transparent', cursor:'pointer', border:'none', width:'100%' }}>
                  <Settings style={{ width:16, height:16, flexShrink:0 }} />
                  <span style={{ flex:1, textAlign:'left' }}>Admin</span>
                  {adminOpen ? <ChevronDown style={{ width:14, height:14, color:'var(--text-3)' }} /> : <ChevronRight style={{ width:14, height:14, color:'var(--text-3)' }} />}
                </button>
                {adminOpen && (
                  <div style={{ marginLeft:14, paddingLeft:12, borderLeft:'1px solid var(--border-mid)', display:'flex', flexDirection:'column', gap:1, marginTop:2 }}>
                    {navItem('manage-users', <UserCog style={{ width:16, height:16 }} />, 'Manage Users')}
                    {navItem('admin-upload', <Upload  style={{ width:16, height:16 }} />, 'Upload / Import')}
                  </div>
                )}
              </div>
            ) : (
              <>
                {navItem('manage-users', <UserCog style={{ width:16, height:16 }} />, 'Manage Users')}
                {navItem('admin-upload', <Upload  style={{ width:16, height:16 }} />, 'Upload / Import')}
              </>
            )}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop:'1px solid var(--border)', padding:'10px 8px', display:'flex', flexDirection:'column', gap:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderRadius:8, cursor:'pointer' }}
          title={collapsed ? `${user.name} · ${ROLE_LABELS[user.role] || user.role}` : undefined}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>
            {initials}
          </div>
          {!collapsed && (
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</p>
              <p style={{ fontSize:11, color:'var(--text-2)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ROLE_LABELS[user.role] || user.role}</p>
            </div>
          )}
        </div>

        <button onClick={logout} title={collapsed ? 'Sign out' : undefined}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderRadius:8, fontSize:12, fontWeight:500, color:'var(--danger)', background:'transparent', border:'none', cursor:'pointer', width:'100%' }}
          onMouseEnter={e => e.currentTarget.style.background='#FEF2F2'}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <LogOut style={{ width:15, height:15, flexShrink:0 }} />
          {!collapsed && <span>Sign out</span>}
        </button>

        {collapsed && (
          <button onClick={() => setCollapsed(false)} title="Expand"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:8, borderRadius:8, background:'transparent', border:'none', cursor:'pointer', color:'var(--text-3)', width:'100%' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--border)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <ChevronRight style={{ width:15, height:15 }} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--page-bg)' }}>
        <div className="hidden lg:flex shrink-0 flex-col">{sidebarContent}</div>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <div className="relative flex flex-col z-50">{sidebarContent}</div>
          </div>
        )}

        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div className="lg:hidden" style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'#fff', borderBottom:'1px solid var(--border)' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'none', cursor:'pointer' }}>
              <Menu style={{ width:20, height:20, color:'var(--text-2)' }} />
            </button>
            <span style={{ fontWeight:700, fontSize:16, color:'var(--text-1)' }}>
              <span style={{ color:'#EF4444' }}>v</span>Think<span style={{ color:'#EF4444' }}>*</span>
            </span>
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
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
