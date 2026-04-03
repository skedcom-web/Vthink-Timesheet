import { useEffect, useState } from 'react';
import {
  Clock, CheckCircle2, BarChart3, TrendingUp, TrendingDown,
  FileText, Users, Briefcase, ListTodo, AlertTriangle, CalendarX,
  ArrowRight, UserCheck, Building2, User, Home,
} from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

// ── Shared helpers ────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function weekLabel(start: string) {
  const s = new Date(start), e = new Date(start);
  e.setDate(e.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${f(s)} – ${f(e)}`;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, trend, up, Icon, color }: {
  label: string; value: number | string; sub: string;
  trend: string; up: boolean; Icon: any; color: string;
}) {
  const iconBg = `color-mix(in srgb, ${color} 22%, var(--card-bg))`;
  return (
    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:20, transition:'box-shadow 0.2s', boxShadow:'var(--shadow-card)' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card)')}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon style={{ width:20, height:20, color }} />
        </div>
        <span style={{ fontSize:11, display:'flex', alignItems:'center', gap:4, fontWeight:600, color: up ? 'var(--success)' : 'var(--danger)' }}>
          {up ? <TrendingUp style={{ width:12, height:12 }} /> : <TrendingDown style={{ width:12, height:12 }} />}
          {trend}
        </span>
      </div>
      <div style={{ fontSize:30, fontWeight:700, color:'var(--text-1)', letterSpacing:'-0.02em', marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)' }}>{label}</div>
      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{sub}</div>
    </div>
  );
}

// ── Pending Item Row ──────────────────────────────────────────────────────────
function PendingRow({ name, week, hours, submittedAt }: { name: string; week: string; hours: number; submittedAt: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--primary-tint)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <User style={{ width:15, height:15, color:'var(--primary)' }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</p>
        <p style={{ fontSize:11, color:'var(--text-3)', margin:'2px 0 0' }}>{weekLabel(week)} · Submitted {fmtDate(submittedAt)}</p>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-1)' }}>{Number(hours).toFixed(1)}h</span>
        <div style={{ fontSize:10, color:'var(--text-3)' }}>total</div>
      </div>
    </div>
  );
}

// ── Section Card wrapper ──────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, iconColor, count, countColor, children }: {
  title: string; icon: any; iconColor: string;
  count?: number; countColor?: string; children: React.ReactNode;
}) {
  const headerIconBg = `color-mix(in srgb, ${iconColor} 22%, var(--card-bg))`;
  return (
    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ width:32, height:32, borderRadius:10, background:headerIconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon style={{ width:16, height:16, color:iconColor }} />
        </div>
        <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-1)', margin:0, flex:1 }}>{title}</h3>
        {count !== undefined && (
          <span style={{ fontSize:13, fontWeight:700, padding:'2px 10px', borderRadius:99, background: count > 0 ? (countColor ?? 'var(--danger-tint)') : 'var(--border)', color: count > 0 ? 'var(--danger)' : 'var(--text-2)' }}>
            {count}
          </span>
        )}
      </div>
      <div style={{ padding:'4px 20px 16px' }}>{children}</div>
    </div>
  );
}

// ── SUPER ADMIN DASHBOARD ─────────────────────────────────────────────────────
function SuperAdminDashboard({ stats, onNavigate }: { stats: any; onNavigate: (s: string) => void }) {
  const hb = stats.hierarchyBreakdown;
  const totalPending = (hb?.caLevelPending ?? 0) + (hb?.pmLevelPending ?? 0) + (hb?.tmLevelPending ?? 0);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Summary KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
        <StatCard label="Pending Approvals" value={stats.pendingApprovals.count} sub="Your level — approve now"
          trend={stats.pendingApprovals.count === 0 ? 'All clear' : `${stats.pendingApprovals.count} need review`}
          up={stats.pendingApprovals.count === 0} Icon={CheckCircle2} color="#EF4444" />
        <StatCard label="This Week Submitted" value={hb?.weekSubmitted ?? 0} sub="Company-wide"
          trend="Across all employees" up={true} Icon={Clock} color="#6366F1" />
        <StatCard label="This Month Submitted" value={hb?.monthSubmitted ?? 0} sub="Company-wide"
          trend={`${hb?.monthApproved ?? 0} approved · ${hb?.monthRejected ?? 0} rejected`}
          up={(hb?.monthApproved ?? 0) > 0} Icon={FileText} color="#8B5CF6" />
        <StatCard label="Active Employees" value={hb?.totalUsers ?? 0} sub="Managers + Team Members"
          trend="Across all roles" up={true} Icon={Users} color="#10B981" />
        <StatCard label="Active Projects" value={stats.projects?.total ?? 0} sub="In the system"
          trend={stats.projects?.trend ?? '—'} up={true} Icon={Briefcase} color="#2563EB" />
        <StatCard label="Tasks" value={stats.tasks?.active ?? 0} sub={`of ${stats.tasks?.total ?? 0} total`}
          trend={stats.tasks?.delayed > 0 ? `${stats.tasks.delayed} delayed` : 'All on track'}
          up={stats.tasks?.delayed === 0} Icon={ListTodo} color="#DB2777" />
      </div>

      {/* Hierarchy pending breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:14 }}>

        {/* Company Admin level */}
        <SectionCard title="Company Admin — Awaiting Your Approval" icon={Building2}
          iconColor="#2563EB" count={hb?.caLevelPending ?? 0}>
          {(hb?.caDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'var(--text-3)', paddingTop:12, margin:0 }}>No Company Admin timesheets pending</p>
          ) : hb.caDetails.map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(hb?.caLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#2563EB', background:'color-mix(in srgb, #2563EB 22%, var(--card-bg))', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>

        {/* Project Manager level */}
        <SectionCard title="Project Managers — Awaiting Your Approval" icon={UserCheck}
          iconColor="#8B5CF6" count={hb?.pmLevelPending ?? 0}>
          {(hb?.pmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'var(--text-3)', paddingTop:12, margin:0 }}>No Project Manager timesheets pending</p>
          ) : hb.pmDetails.map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(hb?.pmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#8B5CF6', background:'color-mix(in srgb, #8B5CF6 22%, var(--card-bg))', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>

        {/* Team Member level */}
        <SectionCard title="Team Members — Awaiting Your Approval" icon={Users}
          iconColor="#10B981" count={hb?.tmLevelPending ?? 0}>
          {(hb?.tmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'var(--text-3)', paddingTop:12, margin:0 }}>No Team Member timesheets pending</p>
          ) : hb.tmDetails.slice(0, 5).map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(hb?.tmLevelPending ?? 0) > 5 && (
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:8, margin:0 }}>+{hb.tmLevelPending - 5} more — click Approve to see all</p>
          )}
          {(hb?.tmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#10B981', background:'color-mix(in srgb, #10B981 22%, var(--card-bg))', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>
      </div>

      {/* Monthly activity summary */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:20, boxShadow:'var(--shadow-card)' }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-1)', margin:'0 0 16px' }}>This Month — Company Activity</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
          {[
            { label:'Submitted', value: hb?.monthSubmitted ?? 0, color:'#6366F1' },
            { label:'Approved',  value: hb?.monthApproved  ?? 0, color:'#10B981' },
            { label:'Rejected',  value: hb?.monthRejected  ?? 0, color:'#EF4444' },
            { label:'Pending',   value: totalPending,              color:'#F59E0B' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              textAlign:'center', padding:'12px 8px', borderRadius:10,
              background: `color-mix(in srgb, ${color} 26%, var(--card-bg))`,
              border: `1px solid color-mix(in srgb, ${color} 40%, var(--border))`,
            }}>
              <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:11, fontWeight:600, color, marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Task health alerts */}
      {(stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed color-mix(in srgb, var(--danger) 55%, var(--border))', background:'color-mix(in srgb, var(--danger) 14%, var(--card-bg))', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <AlertTriangle style={{ width:28, height:28, color:'var(--danger)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--danger)' }}>{stats.tasks.delayed} Delayed Task Creation{stats.tasks.delayed > 1 ? 's' : ''}</div>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>Tasks created past their end date</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'var(--danger)', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('tasks')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed color-mix(in srgb, var(--warning) 50%, var(--border))', background:'color-mix(in srgb, var(--warning) 14%, var(--card-bg))', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <CalendarX style={{ width:28, height:28, color:'var(--warning)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date</div>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>Set deadlines to keep projects on track</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'var(--warning)', flexShrink:0 }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── COMPANY ADMIN DASHBOARD ───────────────────────────────────────────────────
function CompanyAdminDashboard({ stats, onNavigate }: { stats: any; onNavigate: (s: string) => void }) {
  const ca = stats.caHierarchy;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
        <StatCard label="Pending Approvals" value={stats.pendingApprovals.count} sub="Your hierarchy"
          trend={stats.pendingApprovals.count === 0 ? 'All clear' : `${stats.pendingApprovals.count} need review`}
          up={stats.pendingApprovals.count === 0} Icon={CheckCircle2} color="#EF4444" />
        <StatCard label="Timesheets Submitted" value={stats.timesheetsSubmitted.count} sub={stats.timesheetsSubmitted.period}
          trend={stats.timesheetsSubmitted.trend} up={stats.timesheetsSubmitted.up} Icon={FileText} color="#6366F1" />
        <StatCard label="Approved by Me" value={ca?.approvedByMeThisMonth ?? 0} sub="This month"
          trend="Timesheets I approved" up={true} Icon={UserCheck} color="#10B981" />
        <StatCard label="Hours Logged" value={stats.totalHoursLogged.count} sub={stats.totalHoursLogged.period}
          trend={stats.totalHoursLogged.trend} up={stats.totalHoursLogged.up} Icon={BarChart3} color="#10B981" />
        <StatCard label="Active Projects" value={stats.projects?.total ?? 0} sub="In the system"
          trend={stats.projects?.trend ?? '—'} up={true} Icon={Briefcase} color="#2563EB" />
        <StatCard label="Active Tasks" value={stats.tasks?.active ?? 0} sub={`of ${stats.tasks?.total ?? 0} total`}
          trend={stats.tasks?.delayed > 0 ? `${stats.tasks.delayed} delayed` : 'All on track'}
          up={stats.tasks?.delayed === 0} Icon={ListTodo} color="#8B5CF6" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:14 }}>
        <SectionCard title="Project Managers — Awaiting Approval" icon={UserCheck}
          iconColor="#8B5CF6" count={ca?.pmLevelPending ?? 0}>
          {(ca?.pmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'var(--text-3)', paddingTop:12, margin:0 }}>No Project Manager timesheets pending</p>
          ) : ca.pmDetails.map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(ca?.pmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#8B5CF6', background:'color-mix(in srgb, #8B5CF6 22%, var(--card-bg))', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>

        <SectionCard title="Team Members — Awaiting Approval" icon={Users}
          iconColor="#10B981" count={ca?.tmLevelPending ?? 0}>
          {(ca?.tmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'var(--text-3)', paddingTop:12, margin:0 }}>No Team Member timesheets pending</p>
          ) : ca.tmDetails.slice(0, 5).map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(ca?.tmLevelPending ?? 0) > 5 && (
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:8, margin:0 }}>+{ca.tmLevelPending - 5} more in Approve screen</p>
          )}
          {(ca?.tmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#10B981', background:'color-mix(in srgb, #10B981 22%, var(--card-bg))', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>
      </div>

      {(stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed color-mix(in srgb, var(--danger) 55%, var(--border))', background:'color-mix(in srgb, var(--danger) 14%, var(--card-bg))', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <AlertTriangle style={{ width:28, height:28, color:'var(--danger)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--danger)' }}>{stats.tasks.delayed} Delayed Task Creation{stats.tasks.delayed > 1 ? 's' : ''}</div>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>Tasks created past end date — view in Overview</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'var(--danger)', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('tasks')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed color-mix(in srgb, var(--warning) 50%, var(--border))', background:'color-mix(in srgb, var(--warning) 14%, var(--card-bg))', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <CalendarX style={{ width:28, height:28, color:'var(--warning)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date</div>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>Go to Add Task to set deadlines</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'var(--warning)', flexShrink:0 }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── PROJECT MANAGER DASHBOARD ─────────────────────────────────────────────────
function ProjectManagerDashboard({ stats, onNavigate }: { stats: any; onNavigate: (s: string) => void }) {
  const pm = stats.pmHierarchy;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
        <StatCard label="Pending Approvals" value={stats.pendingApprovals.count} sub="My direct reports"
          trend={stats.pendingApprovals.count === 0 ? 'All clear' : `${stats.pendingApprovals.count} need review`}
          up={stats.pendingApprovals.count === 0} Icon={CheckCircle2} color="#EF4444" />
        <StatCard label="Timesheets Submitted" value={stats.timesheetsSubmitted.count} sub={stats.timesheetsSubmitted.period}
          trend={stats.timesheetsSubmitted.trend} up={stats.timesheetsSubmitted.up} Icon={FileText} color="#6366F1" />
        <StatCard label="Pending Submission" value={stats.pendingTimesheets.count} sub="My own drafts"
          trend={stats.pendingTimesheets.trend} up={stats.pendingTimesheets.up} Icon={Clock} color="#F59E0B" />
        <StatCard label="Approved by Me" value={pm?.approvedByMeThisMonth ?? 0} sub="This month"
          trend="Timesheets I approved" up={true} Icon={UserCheck} color="#10B981" />
        <StatCard label="Hours Logged" value={stats.totalHoursLogged.count} sub={stats.totalHoursLogged.period}
          trend={stats.totalHoursLogged.trend} up={stats.totalHoursLogged.up} Icon={BarChart3} color="#10B981" />
        <StatCard label="Active Tasks" value={stats.tasks?.active ?? 0} sub={`of ${stats.tasks?.total ?? 0} total`}
          trend={stats.tasks?.delayed > 0 ? `${stats.tasks.delayed} delayed` : 'All on track'}
          up={stats.tasks?.delayed === 0} Icon={ListTodo} color="#8B5CF6" />
      </div>

      <SectionCard title="My Team — Timesheets Awaiting My Approval" icon={Users}
        iconColor="#6366F1" count={pm?.directReportsPending ?? 0}>
        {(pm?.pendingDetails?.length ?? 0) === 0 ? (
          <p style={{ fontSize:12, color:'var(--text-3)', paddingTop:12, margin:0 }}>No timesheets pending — your team is all caught up!</p>
        ) : pm.pendingDetails.map((d: any, i: number) => (
          <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
        ))}
        {(pm?.directReportsPending ?? 0) > 0 && (
          <button onClick={() => onNavigate('approve')}
            style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#6366F1', background:'color-mix(in srgb, #6366F1 22%, var(--card-bg))', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
            Go to Approve Screen <ArrowRight style={{ width:13, height:13 }} />
          </button>
        )}
      </SectionCard>

      {(stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed color-mix(in srgb, var(--danger) 55%, var(--border))', background:'color-mix(in srgb, var(--danger) 14%, var(--card-bg))', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <AlertTriangle style={{ width:28, height:28, color:'var(--danger)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--danger)' }}>{stats.tasks.delayed} Delayed Creation{stats.tasks.delayed > 1 ? 's' : ''}</div>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>View in Overview</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'var(--danger)', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('tasks')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed color-mix(in srgb, var(--warning) 50%, var(--border))', background:'color-mix(in srgb, var(--warning) 14%, var(--card-bg))', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <CalendarX style={{ width:28, height:28, color:'var(--warning)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date</div>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>Set deadlines in Add Task</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'var(--warning)', flexShrink:0 }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate, refreshKey = 0 }: { onNavigate: (screen: string) => void; refreshKey?: number }) {
  const { user }       = useAuthStore();
  const [stats, setStats]           = useState<any>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
    dashboardApi.getStats()
      .then(s => { setStats(s); setInitialLoad(false); })
      .catch(() => { setInitialLoad(false); setLoadError(true); });
  }, [refreshKey]);

  const isSuperAdmin   = user?.role === 'SUPER_ADMIN';
  const isCompanyAdmin = user?.role === 'COMPANY_ADMIN';
  const isManager      = user?.role === 'PROJECT_MANAGER';

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN:'Super Admin', COMPANY_ADMIN:'Company Admin',
    PROJECT_MANAGER:'Project Manager', TEAM_MEMBER:'Team Member',
  };
  const roleBadge: Record<string, { color: string }> = {
    SUPER_ADMIN:     { color:'#8B5CF6' },
    COMPANY_ADMIN:   { color:'#2563EB' },
    PROJECT_MANAGER: { color:'#DB2777' },
    TEAM_MEMBER:     { color:'#059669' },
  };
  const badge = roleBadge[user?.role ?? ''] ?? roleBadge.TEAM_MEMBER;

  return (
    <div style={{ padding:28, background:'var(--page-bg)', minHeight:'100%', display:'flex', flexDirection:'column', gap:22 }}>

      {/* Header — same copy & logic; template-style breadcrumbs & type scale */}
      <div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
          <Home style={{ width:14, height:14, flexShrink:0 }} />
          <span>›</span>
          <span>Platform</span>
          <span>›</span>
          <span style={{ color:'var(--text-2)', fontWeight:600 }}>Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <h1 style={{ fontSize:28, fontWeight:700, color:'var(--text-1)', letterSpacing:'-0.02em', margin:0, lineHeight:1.2 }}>
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, padding:'4px 14px', borderRadius:999, background:`color-mix(in srgb, ${badge.color} 18%, var(--card-bg))`, color:badge.color }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:badge.color }} />
            {roleLabel[user?.role ?? ''] ?? user?.role}
          </span>
        </div>
        <p style={{ fontSize:14, color:'var(--text-2)', margin:'8px 0 0', maxWidth:720, lineHeight:1.5 }}>
          {isSuperAdmin   ? 'Company-wide visibility — track all pending actions across the hierarchy'
          : isCompanyAdmin ? 'Manage your team hierarchy — approve timesheets from managers and their reports'
          : isManager      ? 'Track your team\'s timesheet submissions and approve pending ones'
          : 'Your timesheet activity and task health at a glance'}
        </p>
      </div>

      {/* Error state */}
      {loadError && (
        <div style={{ padding:32, textAlign:'center', background:'var(--danger-tint)', borderRadius:14, border:'1px solid var(--danger)' }}>
          <AlertTriangle style={{ width:32, height:32, color:'var(--danger)', margin:'0 auto 12px' }} />
          <p style={{ fontSize:14, fontWeight:600, color:'var(--danger)', margin:'0 0 6px' }}>Failed to load dashboard data</p>
          <p style={{ fontSize:12, color:'var(--danger)', margin:'0 0 16px' }}>Please check the backend is running and try refreshing.</p>
          <button onClick={() => window.location.reload()}
            style={{ fontSize:13, fontWeight:600, color:'#fff', background:'var(--danger)', border:'none', borderRadius:8, padding:'8px 20px', cursor:'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {initialLoad && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
          {Array.from({length:6}).map((_,i) => (
            <div key={i} style={{ height:130, borderRadius:14, background:'var(--border-mid)', opacity:0.5, animation:'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Role-specific dashboard */}
      {!initialLoad && stats && isSuperAdmin   && <SuperAdminDashboard   stats={stats} onNavigate={onNavigate} />}
      {!initialLoad && stats && isCompanyAdmin && <CompanyAdminDashboard stats={stats} onNavigate={onNavigate} />}
      {!initialLoad && stats && isManager      && <ProjectManagerDashboard stats={stats} onNavigate={onNavigate} />}

    </div>
  );
}
