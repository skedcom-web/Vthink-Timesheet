import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeft, AlertTriangle, UserCheck } from 'lucide-react';
import { timesheetsApi, projectsApi, tasksApi, usersApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from './ui/Toast';

const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const ADMIN_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'];

function getWeekStart(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmtDate(d: Date) { return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }); }
function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

interface Entry {
  projectId: string;
  taskId:    string;
  tasks:     any[];
  hours:     Record<string, number>;
}

export default function EnterTimesheet({
  onBack,
  onDataChanged,
}: {
  onBack:          () => void;
  onDataChanged?:  () => void;
}) {
  const { user } = useAuthStore();
  const isAdmin  = ADMIN_ROLES.includes(user?.role ?? '');

  const [weekOffset,  setWeekOffset]  = useState(0);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [entries,     setEntries]     = useState<Entry[]>([{ projectId:'', taskId:'', tasks:[], hours:{} }]);
  const [savedId,     setSavedId]     = useState<string|null>(null);
  const [savedStatus, setSavedStatus] = useState<string|null>(null); // DRAFT|SUBMITTED|APPROVED|REJECTED
  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(false);
  const [myManager,   setMyManager]   = useState<{ managerName: string | null; managerEmployeeNo: string | null } | null>(null);

  // Load manager info once on mount — shown as banner so employee knows who approves
  useEffect(() => {
    usersApi.getMyManager()
      .then(setMyManager)
      .catch(() => setMyManager({ managerName: null, managerEmployeeNo: null }));
  }, []);

  // For Team Members: pre-load ALL their assigned tasks once on mount.
  // Group them by project so we can populate the project dropdown and
  // task dropdown without any extra API call when the user picks a project.
  const [assignedTasksByProject, setAssignedTasksByProject] = useState<Record<string, any[]>>({});
  const [assignedProjects,       setAssignedProjects]       = useState<any[]>([]);
  const [loadingAssigned,        setLoadingAssigned]        = useState(false);

  const weekStart = getWeekStart(weekOffset);
  const weekEnd   = addDays(weekStart, 6);

  // ── Load projects + (for Team Members) their assigned tasks ─────────────────
  useEffect(() => {
    projectsApi.getAll().then(setAllProjects).catch(() => {});

    if (!isAdmin) {
      // Team Member: load only their assigned tasks
      setLoadingAssigned(true);
      tasksApi.getMyAssigned()
        .then((tasks: any[]) => {
          // Group by projectId
          const byProject: Record<string, any[]> = {};
          const projMap:   Record<string, any>   = {};

          tasks.forEach(t => {
            const pid = t.projectId ?? t.project?.id;
            if (!pid) return;
            if (!byProject[pid]) {
              byProject[pid] = [];
              projMap[pid]   = t.project ?? { id: pid, code: pid, name: pid };
            }
            byProject[pid].push(t);
          });

          setAssignedTasksByProject(byProject);
          setAssignedProjects(Object.values(projMap));
        })
        .catch(() => {
          toast.error('Failed to load your assigned tasks. Please refresh.');
        })
        .finally(() => setLoadingAssigned(false));
    }
  }, [isAdmin]);

  // ── Load existing timesheet for the selected week ────────────────────────────
  useEffect(() => {
    setFetching(true);
    timesheetsApi.getMyWeek(weekStart.toISOString().split('T')[0])
      .then(async ts => {
        if (ts) {
          setSavedId(ts.id);
          setSavedStatus(ts.status);
          // Rebuild entries — for each saved entry we need the task list too
          const rebuiltEntries = await Promise.all(
            ts.entries.map(async (e: any) => {
              const pid = e.task?.project?.id || '';
              let taskList: any[] = [];

              if (pid) {
                if (isAdmin) {
                  taskList = await tasksApi.getActive(pid).catch(() => []);
                } else {
                  taskList = assignedTasksByProject[pid] ?? [];
                }
              }

              return {
                projectId: pid,
                taskId:    e.taskId,
                tasks:     taskList,
                hours:     Object.fromEntries(DAY_KEYS.map(k => [k, Number(e[k])])),
              };
            })
          );
          setEntries(rebuiltEntries);
        } else {
          setSavedId(null);
          setSavedStatus(null);
          setEntries([{ projectId:'', taskId:'', tasks:[], hours:{} }]);
        }
      })
      .catch(() => {
        setSavedId(null);
        setSavedStatus(null);
        setEntries([{ projectId:'', taskId:'', tasks:[], hours:{} }]);
      })
      .finally(() => setFetching(false));
  }, [weekOffset, isAdmin]);

  // ── When user picks a project, populate the task dropdown ───────────────────
  const updateProject = async (idx: number, projectId: string) => {
    const updated = [...entries];
    updated[idx]  = { ...updated[idx], projectId, taskId:'', tasks:[] };
    setEntries(updated);

    if (!projectId) return;

    let taskList: any[] = [];
    if (isAdmin) {
      // Admins see all active tasks for the project
      taskList = await tasksApi.getActive(projectId).catch(() => []);
    } else {
      // Team Members see only tasks assigned to them for this project
      taskList = assignedTasksByProject[projectId] ?? [];
    }

    updated[idx].tasks = taskList;
    setEntries([...updated]);
  };

  const updateHour = (idx: number, day: string, val: string) => {
    const updated = [...entries];
    updated[idx].hours = { ...updated[idx].hours, [day]: Math.max(0, Math.min(24, Number(val) || 0)) };
    setEntries(updated);
  };

  const rowTotal  = (e: Entry) => DAY_KEYS.reduce((s, k) => s + (e.hours[k] || 0), 0);
  const weekTotal = entries.reduce((s, e) => s + rowTotal(e), 0);

  const payload = () => ({
    weekStartDate: weekStart.toISOString().split('T')[0],
    weekEndDate:   weekEnd.toISOString().split('T')[0],
    entries: entries.filter(e => e.taskId).map(e => ({
      projectId: e.projectId,
      taskId:    e.taskId,
      ...Object.fromEntries(DAY_KEYS.map(k => [k, e.hours[k] || 0])),
    })),
  });

  // ── Extract a clean error message from backend response ─────────────────────
  const extractError = (err: any): string => {
    return err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || 'An unexpected error occurred';
  };

  const save = async () => {
    if (!entries.some(e => e.taskId)) { toast.error('Add at least one task before saving'); return; }

    // ── Client-side end-date validation ─────────────────────────────────────────
    // Block saving if:
    //   • The task end date has already passed (today > endDate)
    //   • The selected week starts after the task end date
    //   • Hours are entered for days that fall after the task end date
    for (const entry of entries) {
      if (!entry.taskId) continue;
      const task = entry.tasks.find((t: any) => t.id === entry.taskId);
      if (!task?.endDate) continue;

      const endDate = new Date(task.endDate); endDate.setHours(0,0,0,0);
      const proj    = task.project?.code ?? 'Project';
      const fmtEnd  = endDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      const errMsg  = `${proj} — ${task.name} ended on ${fmtEnd}. Cannot enter time for this task. Contact your manager to either extend the task end date or assign a new task.`;

      // Check if hours are entered for any day AFTER the end date
      const dayDates = DAY_KEYS.map((_, i) => { const d = addDays(weekStart, i); d.setHours(0,0,0,0); return d; });
      for (let i = 0; i < DAY_KEYS.length; i++) {
        const dk    = DAY_KEYS[i];
        const hours = entry.hours[dk] || 0;
        if (hours > 0 && dayDates[i] > endDate) {
          const dayLabel = DAYS[i] + ' ' + fmtDate(dayDates[i]);
          toast.error(`Cannot log ${hours}h on ${dayLabel} — ${errMsg}`);
          return;
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────

    setLoading(true);
    try {
      const ts = await timesheetsApi.save(payload());
      setSavedId(ts.id);
      setSavedStatus(ts.status ?? 'DRAFT'); // use actual status from server response
      toast.success('Timesheet saved as draft');
      onDataChanged?.();
    } catch (err: any) {
      // Backend validateTaskActive also checks end dates as a safety net —
      // display the message exactly as returned so the user knows what to do.
      toast.error(extractError(err));
    } finally { setLoading(false); }
  };

  const submit = async () => {
    if (!savedId) { toast.error('Save the timesheet first before submitting'); return; }
    // Guard: only submit if the current status is DRAFT
    if (savedStatus && savedStatus !== 'DRAFT') {
      if (savedStatus === 'SUBMITTED') {
        toast.error('This timesheet has already been submitted and is awaiting approval.');
      } else if (savedStatus === 'APPROVED') {
        toast.error('This timesheet has already been approved.');
      } else {
        toast.error(`Cannot submit — current status is ${savedStatus}.`);
      }
      return;
    }
    setLoading(true);
    try {
      await timesheetsApi.submit(savedId);
      toast.success('Timesheet submitted for approval!');
      onDataChanged?.();
      setSavedId(null);
      setSavedStatus(null);
    } catch (err: any) {
      toast.error(extractError(err));
    } finally { setLoading(false); }
  };

  // ── Determine which projects to show in dropdown ─────────────────────────────
  // Admins → all projects
  // Team Members → only projects that have tasks assigned to them
  const projectOptions = isAdmin ? allProjects : assignedProjects;

  const sel  = { width:'100%', border:'1px solid var(--border-mid)', borderRadius:6, padding:'6px 8px', fontSize:13, background:'#fff', outline:'none', fontFamily:"'Inter',system-ui,sans-serif" } as React.CSSProperties;
  const inp  = { width:52, textAlign:'center' as const, border:'1px solid var(--border-mid)', borderRadius:6, padding:'5px 2px', fontSize:13, background:'#fff', outline:'none', fontFamily:"'Inter',system-ui,sans-serif" } as React.CSSProperties;
  const inpWk = { ...inp, background:'var(--border)' } as React.CSSProperties;

  return (
    <div style={{ padding:24, background:'var(--page-bg)', minHeight:'100%' }}>

      {/* Back */}
      <button onClick={onBack}
        style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', marginBottom:16 }}>
        <ArrowLeft style={{ width:15, height:15 }} /> Back to Overview
      </button>

      {/* Breadcrumb + title */}
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:6 }}>
        Timesheets › <span style={{ color:'var(--text-2)', fontWeight:500 }}>Enter Timesheet</span>
      </div>
      <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:'0 0 4px' }}>Enter Timesheet</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 20px' }}>Log your work hours for the week</p>

      {/* Manager approval banner — shown to all roles so everyone knows who approves */}
      {myManager?.managerName && (
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 16px', borderRadius:10, marginBottom:12,
          background:'#F0FDF4', border:'1px solid #86EFAC',
        }}>
          <UserCheck style={{ width:16, height:16, color:'#16A34A', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <span style={{ fontSize:13, color:'#15803D', fontWeight:600 }}>
              Submitted to: {myManager.managerName}
            </span>
            {myManager.managerEmployeeNo && (
              <span style={{ fontSize:12, color:'#16A34A', marginLeft:6, opacity:0.8 }}>
                ({myManager.managerEmployeeNo})
              </span>
            )}
          </div>
          <span style={{ fontSize:11, color:'#16A34A', opacity:0.7 }}>
            Your timesheet will go to this manager for approval
          </span>
        </div>
      )}

      {/* No manager configured warning */}
      {myManager !== null && !myManager.managerName && (
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 16px', borderRadius:10, marginBottom:12,
          background:'#FFFBEB', border:'1px solid #FDE68A',
        }}>
          <AlertTriangle style={{ width:16, height:16, color:'#D97706', flexShrink:0 }} />
          <span style={{ fontSize:13, color:'#92400E' }}>
            No manager assigned to your profile. Contact your administrator to set a manager via the employee upload.
          </span>
        </div>
      )}

      {/* Info banner for Team Members — explains task scope */}
      {!isAdmin && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', background:'var(--primary-tint)', border:'1px solid #BFDBFE', borderRadius:10, marginBottom:16, fontSize:13 }}>
          <AlertTriangle style={{ width:16, height:16, color:'var(--primary)', flexShrink:0, marginTop:1 }} />
          <span style={{ color:'var(--primary)' }}>
            Only showing projects and tasks your manager has assigned to you.
            Contact your manager if a task is missing.
          </span>
        </div>
      )}

      {/* No tasks assigned message */}
      {!isAdmin && !loadingAssigned && assignedProjects.length === 0 && (
        <div style={{ padding:32, textAlign:'center', background:'#fff', borderRadius:16, border:'1px solid var(--border)', marginBottom:16 }}>
          <AlertTriangle style={{ width:36, height:36, color:'#F59E0B', margin:'0 auto 12px' }} />
          <p style={{ fontSize:15, fontWeight:600, color:'var(--text-1)', margin:'0 0 6px' }}>No tasks assigned yet</p>
          <p style={{ fontSize:13, color:'var(--text-2)', margin:0 }}>
            Your manager hasn't assigned any tasks to you. Please contact your manager.
          </p>
        </div>
      )}

      {/* Week navigator */}
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', marginBottom:16 }}>
        <button onClick={() => setWeekOffset(w => w - 1)}
          style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-mid)', background:'#fff', cursor:'pointer' }}>
          <ChevronLeft style={{ width:16, height:16, color:'var(--text-2)' }} />
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text-1)' }}>
            Week of {fmtDate(weekStart)} – {fmtDate(weekEnd)}
          </div>
          <div style={{ fontSize:12, color:'var(--text-3)' }}>
            {weekOffset === 0 ? 'Current Week'
              : weekOffset < 0 ? `${Math.abs(weekOffset)} week(s) ago`
              : `${weekOffset} week(s) ahead`}
          </div>
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)}
          style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-mid)', background:'#fff', cursor:'pointer' }}>
          <ChevronRight style={{ width:16, height:16, color:'var(--text-2)' }} />
        </button>
      </div>

      {/* Status banner for non-DRAFT timesheets */}
      {savedId && savedStatus && savedStatus !== 'DRAFT' && (
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'12px 16px', borderRadius:10, marginBottom:12,
          background: savedStatus === 'SUBMITTED' ? '#FFFBEB' : savedStatus === 'APPROVED' ? '#DCFCE7' : '#FEF2F2',
          border: `1px solid ${savedStatus === 'SUBMITTED' ? '#FDE68A' : savedStatus === 'APPROVED' ? '#86EFAC' : '#FECACA'}`,
        }}>
          <span style={{ fontSize:20 }}>
            {savedStatus === 'SUBMITTED' ? '⏳' : savedStatus === 'APPROVED' ? '✅' : '❌'}
          </span>
          <div>
            <p style={{ fontSize:13, fontWeight:600, margin:'0 0 2px',
              color: savedStatus === 'SUBMITTED' ? '#92400E' : savedStatus === 'APPROVED' ? '#14532D' : '#991B1B' }}>
              {savedStatus === 'SUBMITTED' ? 'Awaiting Approval'
                : savedStatus === 'APPROVED' ? 'Approved'
                : 'Rejected — edit and resubmit'}
            </p>
            <p style={{ fontSize:12, margin:0,
              color: savedStatus === 'SUBMITTED' ? '#B45309' : savedStatus === 'APPROVED' ? '#16A34A' : '#DC2626' }}>
              {savedStatus === 'SUBMITTED'
                ? 'This timesheet has been submitted. Use Recall in your timesheet history to pull it back for editing.'
                : savedStatus === 'APPROVED'
                ? 'This timesheet has been approved by your manager.'
                : 'Your manager sent this back. Edit the hours below and resubmit.'}
            </p>
          </div>
        </div>
      )}

      {/* Timesheet grid */}
      <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
        {fetching || loadingAssigned ? (
          <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--text-3)' }}>
            Loading timesheet...
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--border)' }}>
                  <th className="th" style={{ textAlign:'left', padding:'10px 14px', minWidth:150 }}>Project</th>
                  <th className="th" style={{ textAlign:'left', padding:'10px 14px', minWidth:180 }}>Task</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className="th" style={{ padding:'8px', textAlign:'center', minWidth:58, color: i >= 5 ? 'var(--text-3)' : undefined }}>
                      <div>{d}</div>
                      <div style={{ fontSize:10, fontWeight:400, color:'var(--text-3)' }}>
                        {fmtDate(addDays(weekStart, i))}
                      </div>
                    </th>
                  ))}
                  <th className="th" style={{ padding:'8px 12px', textAlign:'center', minWidth:58 }}>Total</th>
                  <th style={{ width:36 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={idx} style={{ borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* Project dropdown */}
                    <td style={{ padding:'8px 10px' }}>
                      <select value={entry.projectId} onChange={e => updateProject(idx, e.target.value)} style={sel}>
                        <option value="">Select project</option>
                        {projectOptions.map(p => (
                          <option key={p.id} value={p.id}>{p.code}</option>
                        ))}
                      </select>
                    </td>

                    {/* Task dropdown */}
                    <td style={{ padding:'8px 10px' }}>
                      <select
                        value={entry.taskId}
                        onChange={e => setEntries(prev => {
                          const u = [...prev];
                          u[idx] = { ...u[idx], taskId: e.target.value };
                          return u;
                        })}
                        disabled={!entry.projectId}
                        style={{ ...sel, opacity: entry.projectId ? 1 : 0.45 }}
                      >
                        <option value="">Select task</option>
                        {entry.tasks.map((t: any) => {
                          // Mark tasks whose end date has passed so user knows upfront
                          const todayCheck = new Date(); todayCheck.setHours(0,0,0,0);
                          const taskEnd    = t.endDate ? new Date(t.endDate) : null;
                          if (taskEnd) taskEnd.setHours(0,0,0,0);
                          const isExpired  = taskEnd && taskEnd < todayCheck;
                          const endLabel   = taskEnd
                            ? ` (ends ${taskEnd.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}${isExpired ? ' — EXPIRED' : ''})`
                            : '';
                          return (
                            <option key={t.id} value={t.id} disabled={isExpired ?? false}>
                              {t.name}{endLabel}
                            </option>
                          );
                        })}
                      </select>
                      {/* Show "No tasks assigned" hint for Team Members when project has no tasks */}
                      {!isAdmin && entry.projectId && entry.tasks.length === 0 && (
                        <p style={{ fontSize:11, color:'#F59E0B', margin:'3px 0 0' }}>
                          No tasks assigned for this project
                        </p>
                      )}
                    </td>

                    {/* Hour inputs */}
                    {DAY_KEYS.map((dk, di) => (
                      <td key={dk} style={{ padding:'6px 3px', textAlign:'center' }}>
                        <input
                          type="number" min={0} max={24} step={0.5}
                          value={entry.hours[dk] || ''}
                          onChange={e => updateHour(idx, dk, e.target.value)}
                          style={di >= 5 ? inpWk : inp}
                          placeholder="0"
                        />
                      </td>
                    ))}

                    {/* Row total */}
                    <td style={{ padding:'6px 8px', textAlign:'center' }}>
                      <span style={{ fontSize:13, fontWeight:700, color: rowTotal(entry) > 8 ? '#F59E0B' : 'var(--text-1)' }}>
                        {rowTotal(entry).toFixed(1)}h
                      </span>
                    </td>

                    {/* Delete row */}
                    <td style={{ padding:'6px 4px', textAlign:'center' }}>
                      <button
                        onClick={() => setEntries(e => e.filter((_, i) => i !== idx))}
                        style={{ padding:5, borderRadius:6, border:'none', background:'none', cursor:'pointer', color:'var(--text-3)' }}
                        onMouseEnter={e => { e.currentTarget.style.background='#FEF2F2'; e.currentTarget.style.color='#DC2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--text-3)'; }}
                      >
                        <Trash2 style={{ width:14, height:14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Weekly totals footer */}
              <tfoot>
                <tr style={{ background:'var(--primary-tint)' }}>
                  <td colSpan={2} style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'var(--primary)' }}>
                    Weekly Total
                  </td>
                  {DAY_KEYS.map(dk => (
                    <td key={dk} style={{ padding:'10px 4px', textAlign:'center', fontSize:13, fontWeight:700, color:'var(--primary)' }}>
                      {entries.reduce((s, e) => s + (e.hours[dk] || 0), 0).toFixed(1)}
                    </td>
                  ))}
                  <td style={{ padding:'10px 10px', textAlign:'center', fontSize:13, fontWeight:700, color:'var(--primary)' }}>
                    {weekTotal.toFixed(1)}h
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button
          onClick={() => setEntries(e => [...e, { projectId:'', taskId:'', tasks:[], hours:{} }])}
          style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer' }}
        >
          <Plus style={{ width:15, height:15 }} /> Add Row
        </button>
        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={save}
            disabled={loading || savedStatus === 'SUBMITTED' || savedStatus === 'APPROVED'}
            className="btn-secondary"
            title={savedStatus === 'SUBMITTED' ? 'Recall timesheet first to edit it' : savedStatus === 'APPROVED' ? 'Approved timesheets cannot be edited' : ''}
          >
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={submit}
            disabled={loading || !savedId || savedStatus === 'SUBMITTED' || savedStatus === 'APPROVED'}
            className="btn-primary"
            title={savedStatus === 'SUBMITTED' ? 'Already submitted — awaiting approval' : savedStatus === 'APPROVED' ? 'Already approved' : ''}
          >
            Submit for Approval
          </button>
        </div>
      </div>

      {savedId && savedStatus === 'DRAFT' && (
        <p style={{ fontSize:12, color:'#16A34A', marginTop:8, textAlign:'right' }}>
          ✓ Draft saved — click Submit when ready
        </p>
      )}
      {savedId && savedStatus === 'SUBMITTED' && (
        <p style={{ fontSize:12, color:'#B45309', marginTop:8, textAlign:'right' }}>
          ⏳ Already submitted — awaiting manager approval
        </p>
      )}
      {savedId && savedStatus === 'APPROVED' && (
        <p style={{ fontSize:12, color:'#16A34A', marginTop:8, textAlign:'right' }}>
          ✓ Approved
        </p>
      )}
    </div>
  );
}
