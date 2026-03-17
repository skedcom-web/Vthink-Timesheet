import { useEffect, useState } from 'react';
import {
  Clock, CheckCircle2, AlertCircle, ArrowRight,
  Briefcase, Activity, AlertTriangle, CalendarX, Timer, ListTodo, TrendingUp, TrendingDown,
} from 'lucide-react';
import { projectsApi, tasksApi, timesheetsApi, usersApi, dashboardApi, projectConfigApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

const TS_STATUS: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg:'#F3F4F6', text:'#6B7280', dot:'#9CA3AF' },
  SUBMITTED: { bg:'#FFFBEB', text:'#B45309', dot:'#F59E0B' },
  APPROVED:  { bg:'#DCFCE7', text:'#15803D', dot:'#16A34A' },
  REJECTED:  { bg:'#FEF2F2', text:'#DC2626', dot:'#DC2626' },
};
const TASK_STATUS: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg:'#DCFCE7', text:'#15803D' },
  ON_HOLD:   { bg:'#FFFBEB', text:'#B45309' },
  COMPLETED: { bg:'#DBEAFE', text:'#1D4ED8' },
  CANCELLED: { bg:'#F3F4F6', text:'#6B7280' },
};
const CS_META = {
  ON_TIME_CREATION: { label:'On Time',    bg:'#DCFCE7', text:'#15803D', border:'#86EFAC', dot:'#16A34A' },
  DELAYED_CREATION: { label:'Delayed',    bg:'#FEF2F2', text:'#DC2626', border:'#FECACA', dot:'#EF4444' },
  NO_END_DATE:      { label:'No End Date',bg:'#FFFBEB', text:'#B45309', border:'#FDE68A', dot:'#F59E0B' },
} as const;
type CSKey = keyof typeof CS_META;

function ProjectRow({ proj, tasks }: { proj: any; tasks: any[] }) {
  const pt        = tasks.filter(t => t.projectId === proj.id || t.project?.id === proj.id);
  const delayed   = pt.filter(t => t.creationStatus === 'DELAYED_CREATION');
  const noEnd     = pt.filter(t => t.creationStatus === 'NO_END_DATE');
  const onTime    = pt.filter(t => t.creationStatus === 'ON_TIME_CREATION');
  const total     = pt.length;
  const devCount  = delayed.length + noEnd.length;
  if (total === 0) return null;
  return (
    <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.background='#FAFAFA')}
      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, padding:'2px 8px', borderRadius:4, background:'var(--primary-tint)', color:'var(--primary)' }}>{proj.code}</span>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text-1)' }}>{proj.name}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {devCount > 0 && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#FEF2F2', color:'#DC2626' }}>
              <AlertTriangle style={{ width:11, height:11 }} />{devCount} deviation{devCount > 1 ? 's' : ''}
            </span>
          )}
          <span style={{ fontSize:11, color:'var(--text-3)' }}>{total} task{total !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
        {([['ON_TIME_CREATION', onTime.length, CheckCircle2], ['DELAYED_CREATION', delayed.length, AlertTriangle], ['NO_END_DATE', noEnd.length, CalendarX]] as const).map(([key, count, Icon]) => {
          const m = CS_META[key as CSKey];
          return (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, border:`1px solid ${m.border}`, background:m.bg }}>
              <Icon style={{ width:14, height:14, color:m.text, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:m.text, lineHeight:1 }}>{count}</div>
                <div style={{ fontSize:11, color:m.text, opacity:0.75, marginTop:1 }}>{m.label}</div>
              </div>
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <div style={{ display:'flex', height:6, borderRadius:99, overflow:'hidden', gap:2 }}>
          {onTime.length  > 0 && <div style={{ flex:onTime.length,  background:'#16A34A', borderRadius:99 }} />}
          {delayed.length > 0 && <div style={{ flex:delayed.length, background:'#DC2626', borderRadius:99 }} />}
          {noEnd.length   > 0 && <div style={{ flex:noEnd.length,   background:'#F59E0B', borderRadius:99 }} />}
        </div>
      )}
      {(delayed.length > 0 || noEnd.length > 0) && (
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
          {delayed.slice(0,3).map((t: any) => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
              <AlertTriangle style={{ width:11, height:11, color:'#DC2626', flexShrink:0 }} />
              <span style={{ color:'var(--text-1)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</span>
              <span style={{ color:'var(--text-3)', flexShrink:0 }}>{t.endDate ? `ended ${fmt(t.endDate)}` : ''}</span>
            </div>
          ))}
          {noEnd.slice(0,3).map((t: any) => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
              <CalendarX style={{ width:11, height:11, color:'#F59E0B', flexShrink:0 }} />
              <span style={{ color:'var(--text-1)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</span>
              <span style={{ color:'var(--text-3)', flexShrink:0 }}>no end date</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Overview({ onNavigate, refreshKey = 0 }: { onNavigate: (s: string) => void; refreshKey?: number }) {
  const { user }  = useAuthStore();
  const [stats,      setStats]      = useState<any>(null);
  const [projects,   setProjects]   = useState<any[]>([]);
  const [tasks,      setTasks]      = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const isAdmin = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER'].includes(user?.role || '');

  useEffect(() => {
    Promise.allSettled([
      dashboardApi.getStats(), projectConfigApi.getAll(), projectsApi.getAll(),
      tasksApi.getAll(), timesheetsApi.getAll(),
      isAdmin ? usersApi.getAll() : Promise.resolve([]),
    ]).then(([s, pc, p, t, ts]) => {
      if (s.status  === 'fulfilled') setStats(s.value);
      const seen = new Set<string>(); const merged: any[] = [];
      [...(pc.status==='fulfilled'?pc.value||[]:[]),(p.status==='fulfilled'?p.value||[]:[])].forEach(pr => { if (!seen.has(pr.id)){seen.add(pr.id);merged.push(pr);} });
      setProjects(merged);
      if (t.status  === 'fulfilled') setTasks(t.value||[]);
      if (ts.status === 'fulfilled') setTimesheets(ts.value||[]);
    }).finally(() => setInitialLoad(false));
  }, [isAdmin, refreshKey]);

  const pending     = timesheets.filter(t => t.status === 'SUBMITTED');
  const recent      = [...timesheets].sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,5);
  const delayed     = tasks.filter(t => t.creationStatus === 'DELAYED_CREATION');
  const noEndDate   = tasks.filter(t => t.creationStatus === 'NO_END_DATE');
  const onTime      = tasks.filter(t => t.creationStatus === 'ON_TIME_CREATION');
  const byStatus    = ['ACTIVE','ON_HOLD','COMPLETED','CANCELLED'].map(s => ({ status:s, label:s.replace('_',' '), count:tasks.filter(t=>t.status===s).length }));

  const statCards = [
    { label:'Active Projects',   value:projects.length, icon:Briefcase,     color:'var(--primary)',  bg:'var(--primary-tint)', trend:`${tasks.length} tasks total`, up:true },
    { label:'Total Tasks',       value:tasks.length,    icon:ListTodo,       color:'#8B5CF6',         bg:'#F5F3FF',             trend:`${tasks.filter(t=>t.status==='ACTIVE').length} active`, up:true },
    { label:'Delayed Creations', value:delayed.length,  icon:AlertTriangle,  color:'#DC2626',         bg:'#FEF2F2',             trend:delayed.length>0?'Needs attention':'All on time', up:delayed.length===0 },
    { label:'No End Date',       value:noEndDate.length,icon:CalendarX,      color:'#F59E0B',         bg:'#FFFBEB',             trend:noEndDate.length>0?'Action required':'All dated', up:noEndDate.length===0 },
  ];

  if (initialLoad) return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
      {Array.from({length:4}).map((_,i) => <div key={i} style={{ height:80, background:'var(--border)', borderRadius:12, animation:'pulse 1.5s ease-in-out infinite' }} />)}
    </div>
  );

  const P = { padding:'20px 24px' };

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20, background:'var(--page-bg)', minHeight:'100%' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-3)', marginBottom:6 }}>
            <span>Platform</span><span>›</span><span style={{ color:'var(--text-2)', fontWeight:500 }}>Overview</span>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:0 }}>Overview</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', margin:'4px 0 0' }}>Projects, tasks, creation health and timesheet workflow</p>
        </div>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', background:'#DCFCE7', color:'#15803D', borderRadius:8, fontSize:12, fontWeight:500 }}>
          <Activity style={{ width:12, height:12 }} /> Live
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
        {statCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card card-hover" style={{ padding:20 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon style={{ width:18, height:18, color:c.color }} />
                </div>
                <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, fontWeight:600, color: c.up ? '#16A34A' : '#DC2626' }}>
                  {c.up ? <TrendingUp style={{ width:11, height:11 }} /> : <TrendingDown style={{ width:11, height:11 }} />}
                  {c.trend}
                </span>
              </div>
              <div style={{ fontSize:28, fontWeight:700, color:'var(--text-1)', letterSpacing:'-0.02em', marginBottom:2 }}>{c.value}</div>
              <div style={{ fontSize:12, color:'var(--text-2)' }}>{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
        {/* Left */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* Task creation health */}
          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Timer style={{ width:16, height:16, color:'var(--primary)' }} />
                <h3 style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', margin:0 }}>Task Creation Health</h3>
                <span style={{ fontSize:12, color:'var(--text-3)' }}>per project</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {(['ON_TIME_CREATION','DELAYED_CREATION','NO_END_DATE'] as CSKey[]).map(k => (
                  <span key={k} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-2)' }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:CS_META[k].dot, display:'inline-block' }} />
                    {CS_META[k].label}
                  </span>
                ))}
              </div>
            </div>
            {tasks.length > 0 && (
              <div style={{ padding:'10px 20px', background:'var(--border)', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-2)', marginBottom:6 }}>
                  <span style={{ fontWeight:500 }}>All Projects</span>
                  <span>{tasks.length} tasks total</span>
                </div>
                <div style={{ display:'flex', height:8, borderRadius:99, overflow:'hidden', gap:2 }}>
                  {onTime.length   > 0 && <div style={{ flex:onTime.length,   background:'#16A34A', borderRadius:99 }} />}
                  {delayed.length  > 0 && <div style={{ flex:delayed.length,  background:'#DC2626', borderRadius:99 }} />}
                  {noEndDate.length > 0 && <div style={{ flex:noEndDate.length,background:'#F59E0B', borderRadius:99 }} />}
                </div>
                <div style={{ display:'flex', gap:16, marginTop:6, fontSize:11 }}>
                  <span style={{ color:'#16A34A' }}>{onTime.length} on time</span>
                  <span style={{ color:'#DC2626' }}>{delayed.length} delayed</span>
                  <span style={{ color:'#F59E0B' }}>{noEndDate.length} no end date</span>
                </div>
              </div>
            )}
            {projects.length === 0
              ? <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--text-3)' }}>No projects yet</div>
              : projects.map(proj => <ProjectRow key={proj.id} proj={proj} tasks={tasks} />)
            }
          </div>

          {/* Task status breakdown */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <ListTodo style={{ width:16, height:16, color:'#8B5CF6' }} />
              <h3 style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', margin:0 }}>Task Status Breakdown</h3>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {byStatus.map(({ status, label, count }) => {
                const col = TASK_STATUS[status] || { bg:'#F3F4F6', text:'#6B7280' };
                const pct = tasks.length ? Math.round((count/tasks.length)*100) : 0;
                return (
                  <div key={status} style={{ borderRadius:10, padding:14, background:col.bg }}>
                    <div style={{ fontSize:24, fontWeight:700, color:col.text, marginBottom:2 }}>{count}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:col.text }}>{label}</div>
                    <div className="progress-bar" style={{ marginTop:8, background:'rgba(255,255,255,0.6)' }}>
                      <div className="progress-fill" style={{ width:`${pct}%`, background:col.text }} />
                    </div>
                    <div style={{ fontSize:11, color:col.text, opacity:0.7, marginTop:4 }}>{pct}% of total</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {noEndDate.length > 0 && (
            <div className="card" style={{ overflow:'hidden', border:'2px solid #FDE68A' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 16px', background:'#FFFBEB', borderBottom:'1px solid #FDE68A' }}>
                <CalendarX style={{ width:15, height:15, color:'#B45309' }} />
                <h3 style={{ fontSize:12, fontWeight:600, color:'#92400E', margin:0, flex:1 }}>Action Required — No End Date</h3>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'#F59E0B', color:'#fff' }}>{noEndDate.length}</span>
              </div>
              {noEndDate.slice(0,8).map((t: any) => (
                <div key={t.id} style={{ padding:'10px 16px', borderBottom:'1px solid #FFFBEB' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#FFFBEB')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                    <span style={{ fontSize:10, fontFamily:'monospace', padding:'1px 6px', borderRadius:4, background:'var(--primary-tint)', color:'var(--primary)' }}>{t.project?.code||'—'}</span>
                    <span style={{ fontSize:11, color:'var(--text-3)' }}>{t.startDate ? `Started ${fmt(t.startDate)}` : 'No start date either'}</span>
                  </div>
                </div>
              ))}
              {noEndDate.length > 8 && <div style={{ padding:'8px 16px', fontSize:11, color:'#B45309', fontWeight:500 }}>+{noEndDate.length-8} more</div>}
              <div style={{ padding:'10px 16px', background:'#FFFBEB', borderTop:'1px solid #FDE68A' }}>
                <button onClick={() => onNavigate('tasks')} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#B45309', background:'none', border:'none', cursor:'pointer' }}>
                  Go to Tasks to update <ArrowRight style={{ width:12, height:12 }} />
                </button>
              </div>
            </div>
          )}

          {delayed.length > 0 && (
            <div className="card" style={{ overflow:'hidden', border:'2px solid #FECACA' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 16px', background:'#FEF2F2', borderBottom:'1px solid #FECACA' }}>
                <AlertTriangle style={{ width:15, height:15, color:'#DC2626' }} />
                <h3 style={{ fontSize:12, fontWeight:600, color:'#991B1B', margin:0, flex:1 }}>Delayed Creations</h3>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'#DC2626', color:'#fff' }}>{delayed.length}</span>
              </div>
              {delayed.slice(0,6).map((t: any) => (
                <div key={t.id} style={{ padding:'10px 16px', borderBottom:'1px solid #FEF2F2' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#FEF2F2')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                    <span style={{ fontSize:10, fontFamily:'monospace', padding:'1px 6px', borderRadius:4, background:'var(--primary-tint)', color:'var(--primary)' }}>{t.project?.code||'—'}</span>
                    <span style={{ fontSize:11, color:'#DC2626' }}>{t.endDate ? `ended ${fmt(t.endDate)}` : ''}</span>
                  </div>
                </div>
              ))}
              {delayed.length > 6 && <div style={{ padding:'8px 16px', fontSize:11, color:'#DC2626', fontWeight:500 }}>+{delayed.length-6} more</div>}
            </div>
          )}

          {/* Workflow status */}
          <div className="card" style={{ padding:16 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
              <Activity style={{ width:14, height:14, color:'#16A34A' }} /> Workflow Status
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { label:'Enter Timesheet',    screen:'timesheet', icon:Clock,        color:'var(--primary)', desc:'Log weekly hours', count:timesheets.filter(t=>t.status==='DRAFT').length },
                { label:'Submit for Approval',screen:'timesheet', icon:ArrowRight,   color:'#8B5CF6',        desc:'Submit sheets',    count:timesheets.filter(t=>t.status==='SUBMITTED').length },
                { label:'Approve Timesheets', screen:'approve',   icon:CheckCircle2, color:'#16A34A',        desc:'Review & approve', count:pending.length },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <button key={i} onClick={() => onNavigate(step.screen)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'#fff', cursor:'pointer', textAlign:'left', transition:'all 0.15s', width:'100%' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=step.color; e.currentTarget.style.background=step.color==='var(--primary)' ? 'var(--primary-tint)' : `${step.color}10`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='#fff'; }}>
                    <div style={{ width:34, height:34, borderRadius:8, background:`${step.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon style={{ width:15, height:15, color:step.color }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)' }}>{step.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>{step.desc}</div>
                    </div>
                    {step.count > 0 && (
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:99, background:`${step.color}18`, color:step.color }}>{step.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent timesheets */}
          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
              <h3 style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', margin:0, display:'flex', alignItems:'center', gap:6 }}>
                <Clock style={{ width:14, height:14, color:'#F59E0B' }} /> Recent Timesheets
              </h3>
              <button onClick={() => onNavigate('approve')} style={{ fontSize:11, color:'var(--primary)', fontWeight:600, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                View all <ArrowRight style={{ width:11, height:11 }} />
              </button>
            </div>
            {recent.length === 0
              ? <div style={{ padding:20, textAlign:'center', fontSize:12, color:'var(--text-3)' }}>No timesheets yet</div>
              : recent.map(ts => {
                const sc = TS_STATUS[ts.status] || TS_STATUS.DRAFT;
                return (
                  <div key={ts.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background='var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)' }}>{ts.employee?.name||'—'}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{fmt(ts.weekStartDate)}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-1)' }}>{Number(ts.totalHours).toFixed(0)}h</div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end', marginTop:2 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:sc.dot, display:'inline-block' }} />
                          <span style={{ fontSize:11, color:sc.text }}>{ts.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>

          {pending.length > 0 && isAdmin && (
            <button onClick={() => onNavigate('approve')} className="card"
              style={{ padding:14, display:'flex', alignItems:'center', gap:12, cursor:'pointer', border:'2px dashed #8B5CF6', background:'#F5F3FF', textAlign:'left', width:'100%' }}>
              <AlertCircle style={{ width:28, height:28, color:'#8B5CF6', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#6B21A8' }}>{pending.length} Timesheet{pending.length>1?'s':''} Pending</div>
                <div style={{ fontSize:11, color:'#7E22CE' }}>Click to review and approve</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
