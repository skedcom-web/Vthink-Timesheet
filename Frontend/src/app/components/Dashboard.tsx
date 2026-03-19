import { useEffect, useState } from 'react';
import {
  Clock, CheckCircle2, AlertCircle, BarChart3, TrendingUp, TrendingDown,
  FileText, Plus, Eye, Users, Briefcase, ListTodo, AlertTriangle, CalendarX,
  ArrowRight, UserCheck, Shield, Building2, User, XCircle,
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
function StatCard({ label, value, sub, trend, up, Icon, color, bg }: {
  label: string; value: number | string; sub: string;
  trend: string; up: boolean; Icon: any; color: string; bg: string;
}) {
  return (
    <div style={{ background:'#fff', border:'1px solid #F1F5F9', borderRadius:14, padding:20, transition:'box-shadow 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon style={{ width:20, height:20, color }} />
        </div>
        <span style={{ fontSize:11, display:'flex', alignItems:'center', gap:4, fontWeight:600, color: up ? '#059669' : '#EF4444' }}>
          {up ? <TrendingUp style={{ width:12, height:12 }} /> : <TrendingDown style={{ width:12, height:12 }} />}
          {trend}
        </span>
      </div>
      <div style={{ fontSize:30, fontWeight:700, color:'#0F172A', letterSpacing:'-0.02em', marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'#475569' }}>{label}</div>
      <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{sub}</div>
    </div>
  );
}

// ── Pending Item Row ──────────────────────────────────────────────────────────
function PendingRow({ name, week, hours, submittedAt }: { name: string; week: string; hours: number; submittedAt: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #F8FAFC' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background:'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <User style={{ width:15, height:15, color:'#6366F1' }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:600, color:'#1E293B', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</p>
        <p style={{ fontSize:11, color:'#94A3B8', margin:'2px 0 0' }}>{weekLabel(week)} · Submitted {fmtDate(submittedAt)}</p>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#1E293B' }}>{Number(hours).toFixed(1)}h</span>
        <div style={{ fontSize:10, color:'#94A3B8' }}>total</div>
      </div>
    </div>
  );
}

// ── Section Card wrapper ──────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, iconColor, iconBg, count, countColor, children }: {
  title: string; icon: any; iconColor: string; iconBg: string;
  count?: number; countColor?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background:'#fff', border:'1px solid #F1F5F9', borderRadius:14, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:'1px solid #F8FAFC' }}>
        <div style={{ width:32, height:32, borderRadius:10, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon style={{ width:16, height:16, color:iconColor }} />
        </div>
        <h3 style={{ fontSize:14, fontWeight:700, color:'#1E293B', margin:0, flex:1 }}>{title}</h3>
        {count !== undefined && (
          <span style={{ fontSize:13, fontWeight:700, padding:'2px 10px', borderRadius:99, background: count > 0 ? (countColor ?? '#FEF2F2') : '#F1F5F9', color: count > 0 ? '#DC2626' : '#6B7280' }}>
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
          up={stats.pendingApprovals.count === 0} Icon={CheckCircle2} color="#EF4444" bg="#FEF2F2" />
        <StatCard label="This Week Submitted" value={hb?.weekSubmitted ?? 0} sub="Company-wide"
          trend="Across all employees" up={true} Icon={Clock} color="#6366F1" bg="#EEF2FF" />
        <StatCard label="This Month Submitted" value={hb?.monthSubmitted ?? 0} sub="Company-wide"
          trend={`${hb?.monthApproved ?? 0} approved · ${hb?.monthRejected ?? 0} rejected`}
          up={(hb?.monthApproved ?? 0) > 0} Icon={FileText} color="#8B5CF6" bg="#F5F3FF" />
        <StatCard label="Active Employees" value={hb?.totalUsers ?? 0} sub="Managers + Team Members"
          trend="Across all roles" up={true} Icon={Users} color="#10B981" bg="#ECFDF5" />
        <StatCard label="Active Projects" value={stats.projects?.total ?? 0} sub="In the system"
          trend={stats.projects?.trend ?? '—'} up={true} Icon={Briefcase} color="#2563EB" bg="#DBEAFE" />
        <StatCard label="Tasks" value={stats.tasks?.active ?? 0} sub={`of ${stats.tasks?.total ?? 0} total`}
          trend={stats.tasks?.delayed > 0 ? `${stats.tasks.delayed} delayed` : 'All on track'}
          up={stats.tasks?.delayed === 0} Icon={ListTodo} color="#DB2777" bg="#FCE7F3" />
      </div>

      {/* Hierarchy pending breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:14 }}>

        {/* Company Admin level */}
        <SectionCard title="Company Admin — Awaiting Your Approval" icon={Building2}
          iconColor="#2563EB" iconBg="#DBEAFE" count={hb?.caLevelPending ?? 0}>
          {(hb?.caDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'#94A3B8', paddingTop:12, margin:0 }}>No Company Admin timesheets pending</p>
          ) : hb.caDetails.map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(hb?.caLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#2563EB', background:'#DBEAFE', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>

        {/* Project Manager level */}
        <SectionCard title="Project Managers — Awaiting Your Approval" icon={UserCheck}
          iconColor="#8B5CF6" iconBg="#F5F3FF" count={hb?.pmLevelPending ?? 0}>
          {(hb?.pmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'#94A3B8', paddingTop:12, margin:0 }}>No Project Manager timesheets pending</p>
          ) : hb.pmDetails.map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(hb?.pmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#8B5CF6', background:'#F5F3FF', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>

        {/* Team Member level */}
        <SectionCard title="Team Members — Awaiting Your Approval" icon={Users}
          iconColor="#10B981" iconBg="#ECFDF5" count={hb?.tmLevelPending ?? 0}>
          {(hb?.tmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'#94A3B8', paddingTop:12, margin:0 }}>No Team Member timesheets pending</p>
          ) : hb.tmDetails.slice(0, 5).map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(hb?.tmLevelPending ?? 0) > 5 && (
            <p style={{ fontSize:11, color:'#94A3B8', marginTop:8, margin:0 }}>+{hb.tmLevelPending - 5} more — click Approve to see all</p>
          )}
          {(hb?.tmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#10B981', background:'#ECFDF5', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>
      </div>

      {/* Monthly activity summary */}
      <div style={{ background:'#fff', border:'1px solid #F1F5F9', borderRadius:14, padding:20 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:'#1E293B', margin:'0 0 16px' }}>This Month — Company Activity</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
          {[
            { label:'Submitted', value: hb?.monthSubmitted ?? 0, color:'#6366F1', bg:'#EEF2FF' },
            { label:'Approved',  value: hb?.monthApproved  ?? 0, color:'#10B981', bg:'#ECFDF5' },
            { label:'Rejected',  value: hb?.monthRejected  ?? 0, color:'#EF4444', bg:'#FEF2F2' },
            { label:'Pending',   value: totalPending,              color:'#F59E0B', bg:'#FFFBEB' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ textAlign:'center', padding:'12px 8px', borderRadius:10, background:bg }}>
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
            <button onClick={() => onNavigate('overview')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed #FECACA', background:'#FEF2F2', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <AlertTriangle style={{ width:28, height:28, color:'#EF4444', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#991B1B' }}>{stats.tasks.delayed} Delayed Task Creation{stats.tasks.delayed > 1 ? 's' : ''}</div>
                <div style={{ fontSize:11, color:'#DC2626' }}>Tasks created past their end date</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'#EF4444', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('tasks')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed #FDE68A', background:'#FFFBEB', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <CalendarX style={{ width:28, height:28, color:'#F59E0B', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#92400E' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date</div>
                <div style={{ fontSize:11, color:'#B45309' }}>Set deadlines to keep projects on track</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'#F59E0B', flexShrink:0 }} />
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
          up={stats.pendingApprovals.count === 0} Icon={CheckCircle2} color="#EF4444" bg="#FEF2F2" />
        <StatCard label="Timesheets Submitted" value={stats.timesheetsSubmitted.count} sub={stats.timesheetsSubmitted.period}
          trend={stats.timesheetsSubmitted.trend} up={stats.timesheetsSubmitted.up} Icon={FileText} color="#6366F1" bg="#EEF2FF" />
        <StatCard label="Approved by Me" value={ca?.approvedByMeThisMonth ?? 0} sub="This month"
          trend="Timesheets I approved" up={true} Icon={UserCheck} color="#10B981" bg="#ECFDF5" />
        <StatCard label="Hours Logged" value={stats.totalHoursLogged.count} sub={stats.totalHoursLogged.period}
          trend={stats.totalHoursLogged.trend} up={stats.totalHoursLogged.up} Icon={BarChart3} color="#10B981" bg="#ECFDF5" />
        <StatCard label="Active Projects" value={stats.projects?.total ?? 0} sub="In the system"
          trend={stats.projects?.trend ?? '—'} up={true} Icon={Briefcase} color="#2563EB" bg="#DBEAFE" />
        <StatCard label="Active Tasks" value={stats.tasks?.active ?? 0} sub={`of ${stats.tasks?.total ?? 0} total`}
          trend={stats.tasks?.delayed > 0 ? `${stats.tasks.delayed} delayed` : 'All on track'}
          up={stats.tasks?.delayed === 0} Icon={ListTodo} color="#8B5CF6" bg="#F5F3FF" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:14 }}>
        <SectionCard title="Project Managers — Awaiting Approval" icon={UserCheck}
          iconColor="#8B5CF6" iconBg="#F5F3FF" count={ca?.pmLevelPending ?? 0}>
          {(ca?.pmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'#94A3B8', paddingTop:12, margin:0 }}>No Project Manager timesheets pending</p>
          ) : ca.pmDetails.map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(ca?.pmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#8B5CF6', background:'#F5F3FF', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>

        <SectionCard title="Team Members — Awaiting Approval" icon={Users}
          iconColor="#10B981" iconBg="#ECFDF5" count={ca?.tmLevelPending ?? 0}>
          {(ca?.tmDetails?.length ?? 0) === 0 ? (
            <p style={{ fontSize:12, color:'#94A3B8', paddingTop:12, margin:0 }}>No Team Member timesheets pending</p>
          ) : ca.tmDetails.slice(0, 5).map((d: any, i: number) => (
            <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
          ))}
          {(ca?.tmLevelPending ?? 0) > 5 && (
            <p style={{ fontSize:11, color:'#94A3B8', marginTop:8, margin:0 }}>+{ca.tmLevelPending - 5} more in Approve screen</p>
          )}
          {(ca?.tmLevelPending ?? 0) > 0 && (
            <button onClick={() => onNavigate('approve')}
              style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#10B981', background:'#ECFDF5', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
              Review & Approve <ArrowRight style={{ width:13, height:13 }} />
            </button>
          )}
        </SectionCard>
      </div>

      {(stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed #FECACA', background:'#FEF2F2', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <AlertTriangle style={{ width:28, height:28, color:'#EF4444', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#991B1B' }}>{stats.tasks.delayed} Delayed Task Creation{stats.tasks.delayed > 1 ? 's' : ''}</div>
                <div style={{ fontSize:11, color:'#DC2626' }}>Tasks created past end date — view in Overview</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'#EF4444', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('tasks')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed #FDE68A', background:'#FFFBEB', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <CalendarX style={{ width:28, height:28, color:'#F59E0B', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#92400E' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date</div>
                <div style={{ fontSize:11, color:'#B45309' }}>Go to Add Task to set deadlines</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'#F59E0B', flexShrink:0 }} />
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
          up={stats.pendingApprovals.count === 0} Icon={CheckCircle2} color="#EF4444" bg="#FEF2F2" />
        <StatCard label="Timesheets Submitted" value={stats.timesheetsSubmitted.count} sub={stats.timesheetsSubmitted.period}
          trend={stats.timesheetsSubmitted.trend} up={stats.timesheetsSubmitted.up} Icon={FileText} color="#6366F1" bg="#EEF2FF" />
        <StatCard label="Pending Submission" value={stats.pendingTimesheets.count} sub="My own drafts"
          trend={stats.pendingTimesheets.trend} up={stats.pendingTimesheets.up} Icon={Clock} color="#F59E0B" bg="#FFFBEB" />
        <StatCard label="Approved by Me" value={pm?.approvedByMeThisMonth ?? 0} sub="This month"
          trend="Timesheets I approved" up={true} Icon={UserCheck} color="#10B981" bg="#ECFDF5" />
        <StatCard label="Hours Logged" value={stats.totalHoursLogged.count} sub={stats.totalHoursLogged.period}
          trend={stats.totalHoursLogged.trend} up={stats.totalHoursLogged.up} Icon={BarChart3} color="#10B981" bg="#ECFDF5" />
        <StatCard label="Active Tasks" value={stats.tasks?.active ?? 0} sub={`of ${stats.tasks?.total ?? 0} total`}
          trend={stats.tasks?.delayed > 0 ? `${stats.tasks.delayed} delayed` : 'All on track'}
          up={stats.tasks?.delayed === 0} Icon={ListTodo} color="#8B5CF6" bg="#F5F3FF" />
      </div>

      <SectionCard title="My Team — Timesheets Awaiting My Approval" icon={Users}
        iconColor="#6366F1" iconBg="#EEF2FF" count={pm?.directReportsPending ?? 0}>
        {(pm?.pendingDetails?.length ?? 0) === 0 ? (
          <p style={{ fontSize:12, color:'#94A3B8', paddingTop:12, margin:0 }}>No timesheets pending — your team is all caught up!</p>
        ) : pm.pendingDetails.map((d: any, i: number) => (
          <PendingRow key={i} name={d.name} week={d.week} hours={d.hours} submittedAt={d.submittedAt} />
        ))}
        {(pm?.directReportsPending ?? 0) > 0 && (
          <button onClick={() => onNavigate('approve')}
            style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#6366F1', background:'#EEF2FF', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
            Go to Approve Screen <ArrowRight style={{ width:13, height:13 }} />
          </button>
        )}
      </SectionCard>

      {(stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed #FECACA', background:'#FEF2F2', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <AlertTriangle style={{ width:28, height:28, color:'#EF4444', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#991B1B' }}>{stats.tasks.delayed} Delayed Creation{stats.tasks.delayed > 1 ? 's' : ''}</div>
                <div style={{ fontSize:11, color:'#DC2626' }}>View in Overview</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'#EF4444', flexShrink:0 }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('tasks')} style={{ textAlign:'left', padding:16, borderRadius:12, border:'2px dashed #FDE68A', background:'#FFFBEB', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <CalendarX style={{ width:28, height:28, color:'#F59E0B', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#92400E' }}>{stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date</div>
                <div style={{ fontSize:11, color:'#B45309' }}>Set deadlines in Add Task</div>
              </div>
              <ArrowRight style={{ width:14, height:14, color:'#F59E0B', flexShrink:0 }} />
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
  const roleBadge: Record<string, {color:string;bg:string}> = {
    SUPER_ADMIN:     {color:'#7C3AED',bg:'#EDE9FE'},
    COMPANY_ADMIN:   {color:'#2563EB',bg:'#DBEAFE'},
    PROJECT_MANAGER: {color:'#DB2777',bg:'#FCE7F3'},
    TEAM_MEMBER:     {color:'#059669',bg:'#D1FAE5'},
  };
  const badge = roleBadge[user?.role ?? ''] ?? roleBadge.TEAM_MEMBER;

  return (
    <div style={{ padding:24, background:'#F8FAFC', minHeight:'100%', display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize:11, color:'#94A3B8', marginBottom:8 }}>
          🏠 › Platform › <span style={{ color:'#475569', fontWeight:600 }}>Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#0F172A', letterSpacing:'-0.02em', margin:0 }}>
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, padding:'3px 12px', borderRadius:99, background:badge.bg, color:badge.color }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:badge.color }} />
            {roleLabel[user?.role ?? ''] ?? user?.role}
          </span>
        </div>
        <p style={{ fontSize:13, color:'#64748B', margin:'6px 0 0' }}>
          {isSuperAdmin   ? 'Company-wide visibility — track all pending actions across the hierarchy'
          : isCompanyAdmin ? 'Manage your team hierarchy — approve timesheets from managers and their reports'
          : isManager      ? 'Track your team\'s timesheet submissions and approve pending ones'
          : 'Your timesheet activity and task health at a glance'}
        </p>
      </div>

      {/* Error state */}
      {loadError && (
        <div style={{ padding:32, textAlign:'center', background:'#FEF2F2', borderRadius:14, border:'1px solid #FECACA' }}>
          <AlertTriangle style={{ width:32, height:32, color:'#DC2626', margin:'0 auto 12px' }} />
          <p style={{ fontSize:14, fontWeight:600, color:'#991B1B', margin:'0 0 6px' }}>Failed to load dashboard data</p>
          <p style={{ fontSize:12, color:'#DC2626', margin:'0 0 16px' }}>Please check the backend is running and try refreshing.</p>
          <button onClick={() => window.location.reload()}
            style={{ fontSize:13, fontWeight:600, color:'#fff', background:'#DC2626', border:'none', borderRadius:8, padding:'8px 20px', cursor:'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {initialLoad && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
          {Array.from({length:6}).map((_,i) => (
            <div key={i} style={{ height:130, borderRadius:14, background:'#E2E8F0', animation:'pulse 1.5s ease-in-out infinite' }} />
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
