import { useEffect, useState } from 'react';
import {
  Clock, CheckCircle2, AlertCircle, FileText, Plus, Eye,
  Users, Briefcase, ListTodo, AlertTriangle, CalendarX, ArrowRight,
} from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const ROLE_META: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN:     { label:'Super Admin',     color:'#1A56DB' },
  COMPANY_ADMIN:   { label:'Company Admin',   color:'#0694A2' },
  PROJECT_MANAGER: { label:'Project Manager', color:'#7E3AF2' },
  TEAM_MEMBER:     { label:'Team Member',     color:'#0E9F6E' },
};

// KRA-style: large solid circle + label + big number
function StatCard({ label, value, Icon, iconBg }: { label: string; value: string|number; Icon: any; iconBg: string }) {
  return (
    <div className="card card-hover" style={{ padding:24, display:'flex', alignItems:'center', gap:20 }}>
      <div className="stat-icon" style={{ background:iconBg }}>
        <Icon style={{ width:26, height:26, color:'#fff' }} />
      </div>
      <div>
        <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 4px', fontWeight:500 }}>{label}</p>
        <p style={{ fontSize:32, fontWeight:700, color:'var(--text-1)', margin:0, letterSpacing:'-0.02em' }}>{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate, refreshKey = 0 }: { onNavigate: (s: string) => void; refreshKey?: number }) {
  const { user }    = useAuthStore();
  const [stats,     setStats]      = useState<any>(null);
  const [loading,   setLoading]    = useState(true);

  useEffect(() => {
    dashboardApi.getStats().then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, [refreshKey]);

  const roleInfo = ROLE_META[user?.role || ''] || ROLE_META.TEAM_MEMBER;
  const isAdmin  = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user?.role || '');

  const statCards = stats ? [
    { label:'Timesheets Submitted', value:stats.timesheetsSubmitted.count, Icon:FileText,     iconBg:'#1A56DB' },
    { label:'Pending Submission',   value:stats.pendingTimesheets.count,   Icon:Clock,        iconBg:'#C27803' },
    { label:'Pending Approvals',    value:stats.pendingApprovals.count,    Icon:AlertCircle,  iconBg:'#E02424' },
    { label:'Hours Logged',         value:stats.totalHoursLogged.count,    Icon:Clock,        iconBg:'#0E9F6E' },
  ] : [];

  const healthCards = stats ? [
    { label:'Active Projects',    value:stats.projects?.total ?? 0,  Icon:Briefcase,     iconBg:'#1A56DB' },
    { label:'Total Tasks',        value:stats.tasks?.total ?? 0,     Icon:ListTodo,      iconBg:'#7E3AF2' },
    { label:'Delayed Creations',  value:stats.tasks?.delayed ?? 0,   Icon:AlertTriangle, iconBg:'#E02424' },
    { label:'No End Date',        value:stats.tasks?.noEndDate ?? 0, Icon:CalendarX,     iconBg:'#C27803' },
  ] : [];

  const quickActions = [
    { label:'Overview',        icon:Eye,         screen:'overview',  desc:'Projects & tasks' },
    { label:'Enter Timesheet', icon:Clock,       screen:'timesheet', desc:'Log weekly hours' },
    { label:'Add Task',        icon:Plus,        screen:'tasks',     desc:'Create a task' },
    { label:'Reports',         icon:FileText,    screen:'reports',   desc:'Analyse data' },
    ...(user?.role !== 'TEAM_MEMBER' ? [{ label:'Approve', icon:CheckCircle2, screen:'approve', desc:'Review submissions' }] : []),
  ];

  return (
    <div style={{ padding:28, display:'flex', flexDirection:'column', gap:24 }}>
      {/* ── Welcome header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:'0 0 4px' }}>
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-2)' }}>
            <span style={{ fontWeight:600, color:'var(--text-1)' }}>Role:</span>
            <span style={{ padding:'2px 10px', borderRadius:99, background:`${roleInfo.color}18`, color:roleInfo.color, fontSize:12, fontWeight:600 }}>{roleInfo.label}</span>
          </div>
        </div>
      </div>

      {/* ── Timesheet stats ── */}
      <div>
        <h2 style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', margin:'0 0 14px' }}>My Goals Overview</h2>
        {loading
          ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
              {Array.from({length:4}).map((_,i) => <div key={i} className="card" style={{ height:96 }} />)}
            </div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
              {statCards.map(c => <StatCard key={c.label} {...c} />)}
            </div>
        }
      </div>

      {/* ── Project health (admin) ── */}
      {isAdmin && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', margin:'0 0 14px' }}>Project & Task Health</h2>
          {loading
            ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
                {Array.from({length:4}).map((_,i) => <div key={i} className="card" style={{ height:96 }} />)}
              </div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
                {healthCards.map(c => <StatCard key={c.label} {...c} />)}
              </div>
          }
        </div>
      )}

      {/* ── Deviation banners ── */}
      {isAdmin && stats && (stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:14 }}>
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')} className="card card-hover"
              style={{ padding:16, display:'flex', alignItems:'center', gap:12, cursor:'pointer', border:'2px solid #FECACA', background:'#FDE8E8', textAlign:'left', width:'100%' }}>
              <AlertTriangle style={{ width:28, height:28, color:'#E02424', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'#9B1C1C', margin:'0 0 2px' }}>{stats.tasks.delayed} Delayed Creation{stats.tasks.delayed>1?'s':''}</p>
                <p style={{ fontSize:12, color:'#E02424', margin:0 }}>Tasks created after their end date</p>
              </div>
              <ArrowRight style={{ width:16, height:16, color:'#E02424', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('overview')} className="card card-hover"
              style={{ padding:16, display:'flex', alignItems:'center', gap:12, cursor:'pointer', border:'2px solid #FDE68A', background:'#FFFBEB', textAlign:'left', width:'100%' }}>
              <CalendarX style={{ width:28, height:28, color:'#C27803', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'#92400E', margin:'0 0 2px' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate>1?'s':''} Without End Date</p>
                <p style={{ fontSize:12, color:'#C27803', margin:0 }}>No deadline set</p>
              </div>
              <ArrowRight style={{ width:16, height:16, color:'#C27803', flexShrink:0 }} />
            </button>
          )}
        </div>
      )}

      {/* ── Recent Activity card (KRA style) ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, alignItems:'start' }}>
        {/* Quick actions */}
        <div className="card" style={{ padding:24 }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', margin:'0 0 16px' }}>Quick Actions</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
            {quickActions.map(action => {
              const Icon = action.icon;
              const hasBadge = action.screen === 'approve' && stats?.pendingApprovals?.count > 0;
              return (
                <button key={action.screen} onClick={() => onNavigate(action.screen)}
                  style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:16, borderRadius:12, border:'1.5px solid var(--border)', background:'#fff', cursor:'pointer', transition:'all 0.15s', textAlign:'center' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.background='var(--primary-tint)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='#fff'; }}>
                  {hasBadge && (
                    <span style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#E02424', color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {stats.pendingApprovals.count}
                    </span>
                  )}
                  <div style={{ width:44, height:44, borderRadius:'50%', background:'#1A56DB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon style={{ width:20, height:20, color:'#fff' }} />
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', margin:'0 0 2px' }}>{action.label}</p>
                    <p style={{ fontSize:11, color:'var(--text-3)', margin:0 }}>{action.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Team members */}
        {isAdmin && stats && (
          <div className="card" style={{ padding:24 }}>
            <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', margin:'0 0 16px' }}>Team</h3>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
              <div className="stat-icon" style={{ background:'#0694A2' }}>
                <Users style={{ width:24, height:24, color:'#fff' }} />
              </div>
              <div>
                <p style={{ fontSize:28, fontWeight:700, color:'var(--text-1)', margin:0 }}>{stats.team?.members ?? 0}</p>
                <p style={{ fontSize:13, color:'var(--text-2)', margin:0 }}>Active Members</p>
              </div>
            </div>
            <button onClick={() => onNavigate('assign')} className="btn-outline" style={{ width:'100%', justifyContent:'center' }}>
              Assign Tasks <ArrowRight style={{ width:14, height:14 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
