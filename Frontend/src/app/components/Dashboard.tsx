import { useEffect, useState } from 'react';
import {
  Clock, CheckCircle2, AlertCircle, FileText, Plus, Eye,
  Users, Briefcase, ListTodo, AlertTriangle, CalendarX, ArrowRight,
} from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN:     { label: 'Super Admin',     color: '#4F38F6', bg: '#EEEFFE' },
  COMPANY_ADMIN:   { label: 'Company Admin',   color: '#0EA5E9', bg: '#E0F2FE' },
  PROJECT_MANAGER: { label: 'Project Manager', color: '#DB2777', bg: '#FCE7F3' },
  TEAM_MEMBER:     { label: 'Team Member',     color: '#16A34A', bg: '#DCFCE7' },
};

// OMS-style triangle delta indicator
function Delta({ value, suffix = '' }: { value: string | number; suffix?: string }) {
  const num = parseFloat(String(value));
  const up  = !String(value).startsWith('-');
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:11, fontWeight:600, color: up ? '#16A34A' : '#DC2626' }}>
      <svg width="10" height="10" viewBox="0 0 12 12">
        <path d={up ? 'M6 2L10 9H2Z' : 'M6 10L2 3H10Z'} fill="currentColor" />
      </svg>
      {value}{suffix}
    </span>
  );
}

function StatCard({ label, value, sub, trend, up, Icon, color, bg }: {
  label: string; value: number | string; sub: string;
  trend: string; up: boolean; Icon: any; color: string; bg: string;
}) {
  return (
    <div className="card card-hover p-5">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ width:36, height:36, borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon style={{ width:18, height:18, color }} />
        </div>
        <Delta value={trend} />
      </div>
      <div style={{ fontSize:28, fontWeight:700, color:'var(--text-1)', letterSpacing:'-0.02em', marginBottom:2 }}>
        {value}
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)' }}>{label}</div>
      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{sub}</div>
    </div>
  );
}

export default function Dashboard({ onNavigate, refreshKey = 0 }: { onNavigate: (screen: string) => void; refreshKey?: number }) {
  const { user }    = useAuthStore();
  const [stats,     setStats]      = useState<any>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    dashboardApi.getStats()
      .then(s => { setStats(s); setInitialLoad(false); })
      .catch(() => setInitialLoad(false));
  }, [refreshKey]);

  const roleInfo = ROLE_META[user?.role || ''] || ROLE_META.TEAM_MEMBER;
  const isAdmin  = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user?.role || '');

  const statCards = stats ? [
    { label:'Timesheets Submitted', value:stats.timesheetsSubmitted.count, sub:stats.timesheetsSubmitted.period,  trend:stats.timesheetsSubmitted.trend, up:stats.timesheetsSubmitted.up, Icon:FileText, color:'#4F38F6', bg:'#EEEFFE' },
    { label:'Pending Submission',   value:stats.pendingTimesheets.count,   sub:'Draft timesheets',                trend:stats.pendingTimesheets.trend,   up:stats.pendingTimesheets.up,   Icon:Clock,    color:'#F59E0B', bg:'#FFFBEB' },
    { label:'Pending Approvals',    value:stats.pendingApprovals.count,    sub:'Awaiting review',                 trend:stats.pendingApprovals.trend,    up:stats.pendingApprovals.up,    Icon:AlertCircle,color:'#DC2626', bg:'#FEF2F2' },
    { label:'Hours Logged',         value:stats.totalHoursLogged.count,    sub:stats.totalHoursLogged.period,     trend:stats.totalHoursLogged.trend,    up:stats.totalHoursLogged.up,    Icon:Clock,    color:'#14B8A6', bg:'#F0FDFA' },
  ] : [];

  const healthCards = stats ? [
    { label:'Active Projects',    value:stats.projects?.total ?? 0,   sub:'In the system', trend:stats.projects?.trend ?? '—', up:true, Icon:Briefcase,     color:'#4F38F6', bg:'#EEEFFE' },
    { label:'Total Tasks',        value:stats.tasks?.total ?? 0,      sub:`${stats.tasks?.active ?? 0} active`, trend:`${stats.tasks?.onTime ?? 0} on-time`, up:true, Icon:ListTodo, color:'#8B5CF6', bg:'#F5F3FF' },
    { label:'Delayed Creations',  value:stats.tasks?.delayed ?? 0,    sub:'Past end-date at creation', trend:stats.tasks?.delayed === 0 ? 'All on time' : 'Needs attention', up:stats.tasks?.delayed === 0, Icon:AlertTriangle, color:'#DC2626', bg:'#FEF2F2' },
    { label:'No End Date',        value:stats.tasks?.noEndDate ?? 0,  sub:'Tasks without deadline',    trend:stats.tasks?.noEndDate === 0 ? 'All dated' : 'Action required',  up:stats.tasks?.noEndDate === 0, Icon:CalendarX, color:'#F59E0B', bg:'#FFFBEB' },
  ] : [];

  const quickActions = [
    { label:'Overview',            icon:Eye,         screen:'overview',  desc:'Projects & tasks'      },
    { label:'Enter Timesheet',     icon:Clock,       screen:'timesheet', desc:'Log weekly hours'      },
    { label:'Add Task',            icon:Plus,        screen:'tasks',     desc:'Create a task'         },
    { label:'View Reports',        icon:FileText,    screen:'reports',   desc:'Analyse data'          },
    ...(user?.role !== 'TEAM_MEMBER'
      ? [{ label:'Approve', icon:CheckCircle2, screen:'approve', desc:'Review submissions' }]
      : []),
  ];

  const sectionTitle = (text: string) => (
    <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>{text}</p>
  );

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20, background:'var(--page-bg)', minHeight:'100%' }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-3)', marginBottom:6 }}>
          <span>Platform</span><span>›</span><span style={{ color:'var(--text-2)', fontWeight:500 }}>Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:0 }}>
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', background:roleInfo.bg, color:roleInfo.color, borderRadius:99, fontSize:11, fontWeight:600, border:`1px solid ${roleInfo.color}30` }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:roleInfo.color, display:'inline-block' }} />
            {roleInfo.label}
          </span>
        </div>
        <p style={{ fontSize:13, color:'var(--text-2)', marginTop:4 }}>Real-time view of your timesheet activity.</p>
      </div>

      {/* ── Timesheet stat cards ── */}
      <div>
        {sectionTitle('Timesheet Activity')}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14 }}>
          {initialLoad
            ? Array.from({length:4}).map((_, i) => <div key={i} className="card" style={{ height:140, animation:'pulse 1.5s ease-in-out infinite' }} />)
            : statCards.map(c => <StatCard key={c.label} {...c} />)
          }
        </div>
      </div>

      {/* ── Project & task health (admin) ── */}
      {isAdmin && (
        <div>
          {sectionTitle('Project & Task Health')}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14 }}>
            {initialLoad
              ? Array.from({length:4}).map((_, i) => <div key={i} className="card" style={{ height:140 }} />)
              : healthCards.map(c => <StatCard key={c.label} {...c} />)
            }
          </div>
        </div>
      )}

      {/* ── Deviation banners ── */}
      {isAdmin && stats && (stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px,1fr))', gap:14 }}>
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')} className="card card-hover"
              style={{ padding:16, display:'flex', alignItems:'center', gap:12, cursor:'pointer', border:'2px dashed #FECACA', background:'#FEF2F2', textAlign:'left', width:'100%' }}>
              <AlertTriangle style={{ width:28, height:28, color:'#DC2626', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#991B1B', margin:'0 0 2px' }}>{stats.tasks.delayed} Delayed Creation{stats.tasks.delayed > 1 ? 's' : ''}</p>
                <p style={{ fontSize:11, color:'#DC2626', margin:0 }}>Tasks created after their end date</p>
              </div>
              <ArrowRight style={{ width:16, height:16, color:'#DC2626', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('overview')} className="card card-hover"
              style={{ padding:16, display:'flex', alignItems:'center', gap:12, cursor:'pointer', border:'2px dashed #FDE68A', background:'#FFFBEB', textAlign:'left', width:'100%' }}>
              <CalendarX style={{ width:28, height:28, color:'#F59E0B', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#92400E', margin:'0 0 2px' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date</p>
                <p style={{ fontSize:11, color:'#B45309', margin:0 }}>No deadline set — view in Overview</p>
              </div>
              <ArrowRight style={{ width:16, height:16, color:'#F59E0B', flexShrink:0 }} />
            </button>
          )}
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="card p-5">
        <h2 style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:14 }}>Quick Actions</h2>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${quickActions.length}, 1fr)`, gap:10 }}>
          {quickActions.map(action => {
            const Icon = action.icon;
            const hasBadge = action.screen === 'approve' && stats?.pendingApprovals?.count > 0;
            return (
              <button key={action.screen} onClick={() => onNavigate(action.screen)}
                style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:14, borderRadius:10, border:'1px solid var(--border)', background:'#fff', cursor:'pointer', transition:'all 0.15s', textAlign:'center' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-tint)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fff'; }}
              >
                {hasBadge && (
                  <span style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#DC2626', color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {stats.pendingApprovals.count}
                  </span>
                )}
                <div style={{ width:36, height:36, borderRadius:8, background:'var(--primary-tint)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon style={{ width:18, height:18, color:'var(--primary)' }} />
                </div>
                <div>
                  <p style={{ fontSize:11, fontWeight:600, color:'var(--text-1)', margin:'0 0 2px' }}>{action.label}</p>
                  <p style={{ fontSize:10, color:'var(--text-3)', margin:0 }}>{action.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Team members ── */}
      {isAdmin && stats && (
        <div className="card p-5" style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:'#ECFEFF', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Users style={{ width:22, height:22, color:'#0891B2' }} />
          </div>
          <div>
            <p style={{ fontSize:24, fontWeight:700, color:'var(--text-1)', margin:0 }}>{stats.team?.members ?? 0}</p>
            <p style={{ fontSize:12, color:'var(--text-2)', margin:0 }}>Active Team Members</p>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <button onClick={() => onNavigate('assign')} className="btn-secondary" style={{ fontSize:12 }}>
              Assign Tasks <ArrowRight style={{ width:13, height:13 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Live badge ── */}
      <div className="card p-4" style={{ display:'flex', alignItems:'center', gap:12, background:'var(--primary-tint)', border:'1px solid var(--primary-tint-mid)' }}>
        <CheckCircle2 style={{ width:18, height:18, color:'var(--primary)', flexShrink:0 }} />
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--primary)', margin:0 }}>Connected to PostgreSQL via Docker</p>
          <p style={{ fontSize:11, color:'var(--primary)', opacity:0.75, margin:0 }}>All data is live — counts reflect the database in real time.</p>
        </div>
      </div>

    </div>
  );
}
