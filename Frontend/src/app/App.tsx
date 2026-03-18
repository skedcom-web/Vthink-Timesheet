import { useState, useCallback, memo } from 'react';
import {
  LayoutDashboard, Clock, Plus, Users, CheckCircle2,
  BarChart3, LogOut, ChevronDown, ChevronRight,
  Settings, UserCog, Upload, FileText, Menu, X, Flag,
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
  SUPER_ADMIN:'Super Admin', COMPANY_ADMIN:'Company Admin',
  PROJECT_MANAGER:'Project Manager', TEAM_MEMBER:'Team Member',
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
      const p    = JSON.parse(raw);
      const role = p?.state?.user?.role;
      if (role === 'TEAM_MEMBER') return 'overview';
      if (role) return 'dashboard';
    }
  } catch { /* ignore */ }
  // No saved session yet (fresh login) — 'overview' is safe for ALL roles.
  // Dashboard is only visible to admins, so defaulting to it causes blank
  // screen for Team Members on their first login.
  return 'overview';
}

export default function App() {
  const { user, isAuthenticated, mustChangePassword, logout } = useAuthStore();
  const isTeamMember = user?.role === 'TEAM_MEMBER';

  const [screen, setScreen]           = useState<Screen>(getDefaultScreen);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [timesheetOpen, setTSOpen]    = useState(true);
  const [adminOpen, setAdminOpen]     = useState(true);
  const [refreshKey, setRefreshKey]   = useState(0);

  const notifyDataChanged = useCallback(() => setRefreshKey(k => k + 1), []);
  const goOverview        = useCallback(() => { setScreen('overview'); setDrawerOpen(false); }, []);
  const nav               = useCallback((s: Screen) => { setScreen(s); setDrawerOpen(false); }, []);

  if (!isAuthenticated || !user) return <><Login /><ToastContainer /></>;
  if (mustChangePassword)        return <><ForceChangePassword /><ToastContainer /></>;

  const canApprove     = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user.role);
  const canManageTasks = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user.role);
  const canAdmin       = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user.role);

  const initials = user.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2) ?? '?';

  // ── Nav item — KRA style: large, full border-bottom ──
  const navItem = (s: Screen, Icon: any, label: string, sub = false) => {
    const active = screen === s;
    return (
      <button key={s} onClick={() => nav(s)}
        className={`${sub ? 'kra-nav-sub' : 'kra-nav-item'} ${active ? 'active' : ''}`}>
        <Icon style={{ width: sub ? 16 : 20, height: sub ? 16 : 20, flexShrink:0 }} />
        <span style={{ flex:1 }}>{label}</span>
      </button>
    );
  };

  // ── KRA Drawer sidebar ──
  const drawerContent = (
    <div className="drawer">
      {/* Logo header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'baseline' }}>
            <span style={{ fontSize:20, fontWeight:700, color:'#E02424' }}>v</span>
            <span style={{ fontSize:20, fontWeight:700, color:'var(--text-1)' }}>Think</span>
            <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:1, marginTop:-6, alignSelf:'flex-start' }}>®</span>
          </div>
          <span style={{ fontSize:20, fontWeight:700, color:'var(--text-1)', marginLeft:4 }}>Timesheet</span>
        </div>
        <button onClick={() => setDrawerOpen(false)}
          style={{ padding:6, borderRadius:8, border:'none', background:'var(--border)', cursor:'pointer', color:'var(--text-2)', display:'flex' }}>
          <X style={{ width:16, height:16 }} />
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ flex:1, overflowY:'auto' }} className="scrollbar-hide">
        {!isTeamMember && navItem('dashboard', LayoutDashboard, 'Dashboard')}
        {navItem('overview', BarChart3, 'Overview')}

        {/* Timesheet group */}
        <button onClick={() => setTSOpen(v => !v)} className="kra-nav-item">
          <Clock style={{ width:20, height:20 }} />
          <span style={{ flex:1 }}>Timesheet</span>
          {timesheetOpen ? <ChevronDown style={{ width:16, height:16, color:'var(--text-3)' }} /> : <ChevronRight style={{ width:16, height:16, color:'var(--text-3)' }} />}
        </button>
        {timesheetOpen && (
          <>
            {navItem('timesheet', Clock, 'Enter Timesheet', true)}
            {canApprove && navItem('approve', CheckCircle2, 'Approve Timesheets', true)}
          </>
        )}

        {canManageTasks && navItem('tasks',  Plus,  'Add Task')}
        {canManageTasks && navItem('assign', Users, 'Assign Task')}
        {navItem('reports', FileText, 'Reports')}

        {/* Admin group */}
        {canAdmin && (
          <>
            <button onClick={() => setAdminOpen(v => !v)} className="kra-nav-item">
              <Settings style={{ width:20, height:20 }} />
              <span style={{ flex:1 }}>Admin</span>
              {adminOpen ? <ChevronDown style={{ width:16, height:16, color:'var(--text-3)' }} /> : <ChevronRight style={{ width:16, height:16, color:'var(--text-3)' }} />}
            </button>
            {adminOpen && (
              <>
                {navItem('manage-users', UserCog, 'Manage Users', true)}
                {navItem('admin-upload', Upload,  'Upload / Import', true)}
              </>
            )}
          </>
        )}
      </nav>

      {/* User section at bottom */}
      <div style={{ borderTop:'1px solid var(--border)', padding:'16px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</p>
            <p style={{ fontSize:12, color:'var(--text-2)', margin:0 }}>{ROLE_LABELS[user.role] || user.role}</p>
          </div>
        </div>
        <button onClick={logout}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:14, fontWeight:500, width:'100%' }}>
          <LogOut style={{ width:16, height:16 }} />
          Sign out
        </button>
      </div>
    </div>
  );

  // ── KRA Top bar — always visible ──
  const topBar = (
    <div style={{
      position:'sticky', top:0, zIndex:30,
      display:'flex', alignItems:'center', gap:16,
      padding:'0 24px', height:60,
      background:'#fff',
      borderBottom:'1px solid var(--border)',
      boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Hamburger */}
      <button onClick={() => setDrawerOpen(true)}
        style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid var(--border)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Menu style={{ width:18, height:18, color:'var(--text-1)' }} />
      </button>

      {/* Brand in top bar — KRA style */}
      <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
        <div style={{ display:'flex', alignItems:'baseline' }}>
          <span style={{ fontSize:18, fontWeight:700, color:'#E02424' }}>v</span>
          <span style={{ fontSize:18, fontWeight:700, color:'var(--text-1)' }}>Think</span>
          <span style={{ fontSize:10, color:'var(--text-3)', marginLeft:1, alignSelf:'flex-start' }}>®</span>
        </div>
        <span style={{ fontSize:18, fontWeight:700, color:'var(--text-1)' }}>Timesheet</span>
      </div>

      <div style={{ flex:1 }} />

      {/* User avatar — top right */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', margin:0 }}>{user.name}</p>
          <p style={{ fontSize:11, color:'var(--text-2)', margin:0 }}>{ROLE_LABELS[user.role]}</p>
        </div>
        <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
          {initials}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--page-bg)' }}>
        {topBar}

        {/* Main scrollable area */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {/* Overview + Timesheet + Reports — all roles */}
          <div style={{ display: screen === 'overview'  ? 'block' : 'none' }}>
            {isTeamMember
              ? <MemoTeamMemberOverview key="tm-overview" refreshKey={refreshKey} onNavigate={nav as any} />
              : <MemoOverview           key="overview"    refreshKey={refreshKey} onNavigate={nav as any} />
            }
          </div>
          <div style={{ display: screen === 'timesheet' ? 'block' : 'none' }}>
            <MemoEnterTS key="timesheet" onBack={goOverview} onDataChanged={notifyDataChanged} />
          </div>
          <div style={{ display: screen === 'reports'   ? 'block' : 'none' }}>
            {isTeamMember
              ? <MemoTeamMemberReports key="tm-reports" onBack={goOverview} />
              : <MemoReports           key="reports"    onBack={goOverview} />
            }
          </div>

          {/* Admin-only screens — NOT mounted for Team Members */}
          {!isTeamMember && (
            <>
              <div style={{ display: screen === 'dashboard' ? 'block' : 'none' }}>
                <MemoDashboard key="dashboard" refreshKey={refreshKey} onNavigate={nav as any} />
              </div>
              {canApprove && (
                <div style={{ display: screen === 'approve' ? 'block' : 'none' }}>
                  <MemoApproveTS key="approve" onBack={goOverview} onDataChanged={notifyDataChanged} />
                </div>
              )}
              {canManageTasks && (
                <>
                  <div style={{ display: screen === 'tasks'  ? 'block' : 'none' }}>
                    <MemoAddTask key="tasks" onBack={goOverview} onDataChanged={notifyDataChanged} />
                  </div>
                  <div style={{ display: screen === 'assign' ? 'block' : 'none' }}>
                    <MemoAssignTask key="assign" onBack={goOverview} onDataChanged={notifyDataChanged} />
                  </div>
                </>
              )}
              {canAdmin && (
                <>
                  <div style={{ display: screen === 'admin-upload'  ? 'block' : 'none' }}>
                    <MemoAdminUpload key="admin-upload" onBack={goOverview} onDataChanged={notifyDataChanged} />
                  </div>
                  <div style={{ display: screen === 'manage-users' ? 'block' : 'none' }}>
                    <MemoManageUsers key="manage-users" onBack={goOverview} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Drawer + overlay */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          {drawerContent}
        </>
      )}

      <ToastContainer />
    </>
  );
}
