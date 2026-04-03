import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeft, AlertTriangle, UserCheck, Clock, CheckCircle2, XCircle, RotateCcw, History, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { timesheetsApi, projectsApi, tasksApi, usersApi, projectConfigApi } from '../../services/api';
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
  refreshKey = 0,
}: {
  onBack: () => void;
  onDataChanged?: () => void;
  refreshKey?: number;
}) {
  const { user } = useAuthStore();
  const isAdmin  = ADMIN_ROLES.includes(user?.role ?? '');

  const [weekOffset,  setWeekOffset]  = useState(0);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [entries,     setEntries]     = useState<Entry[]>([{ projectId:'', taskId:'', tasks:[], hours:{} }]);
  const [savedId,     setSavedId]     = useState<string|null>(null);
  const [savedStatus, setSavedStatus]             = useState<string|null>(null); // DRAFT|SUBMITTED|APPROVED|REJECTED
  const [savedRejectionReason, setSavedRejectionReason] = useState<string|null>(null);
  const [stickyError,          setStickyError]          = useState<string|null>(null); // persistent dismissable error
  // Submit gate: canSubmit is ONLY set true by a successful Save Draft in this session.
  // Any entry change resets it to false — forcing a fresh save before Submit.
  const [canSubmit, setCanSubmit] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(false);
  const [myManager,   setMyManager]   = useState<{ managerName: string | null; managerEmployeeNo: string | null } | null>(null);

  // ── View tabs: 'entry' | 'history' ────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState<'entry'|'history'>('entry');
  const [allTimesheets, setAllTimesheets] = useState<any[]>([]);
  const [historyLoading,setHistoryLoading]= useState(false);
  const [expandedId,    setExpandedId]    = useState<string|null>(null);
  const [actionId,      setActionId]      = useState<string|null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  // Load manager info once on mount — shown as banner so employee knows who approves
  useEffect(() => {
    usersApi.getMyManager()
      .then(setMyManager)
      .catch(() => setMyManager({ managerName: null, managerEmployeeNo: null }));
  }, []);

  // ── Load full timesheet history (for History tab) ─────────────────────────
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    // getMine() always returns ONLY the logged-in user's own timesheets.
    // This is correct for ALL roles — managers/admins only see their own history here.
    timesheetsApi.getMine()
      .then((data: any[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
        );
        setAllTimesheets(sorted);
      })
      .catch(() => toast.error('Failed to load timesheet history'))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  // Listen for navigation signal from Overview — auto-switch to History tab
  // when user clicks "Enter Timesheet" with draft count shown
  useEffect(() => {
    const handler = () => setActiveTab('history');
    window.addEventListener('openTimesheetHistory', handler);
    return () => window.removeEventListener('openTimesheetHistory', handler);
  }, []);

  // ── Recall a submitted timesheet back to DRAFT ────────────────────────────
  const recallTimesheet = async (ts: any) => {
    setActionId(ts.id);
    try {
      await timesheetsApi.recall(ts.id);
      toast.success('Timesheet recalled — it is now a Draft you can edit');
      setAllTimesheets(prev => prev.map(t => t.id === ts.id ? { ...t, status: 'DRAFT', submittedAt: null } : t));
      onDataChanged?.();
      // If this is the currently loaded week, refresh the entry view
      if (ts.id === savedId) { setSavedStatus('DRAFT'); setSavedId(ts.id); }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to recall');
    } finally { setActionId(null); }
  };

  // ── Delete a draft timesheet ──────────────────────────────────────────────
  const deleteTimesheet = async (ts: any) => {
    setActionId(ts.id); setConfirmDelete(null);
    try {
      await timesheetsApi.deleteDraft(ts.id);
      toast.success('Draft deleted');
      setAllTimesheets(prev => prev.filter(t => t.id !== ts.id));
      onDataChanged?.();
      if (ts.id === savedId) { setSavedId(null); setSavedStatus(null); }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete draft');
    } finally { setActionId(null); }
  };

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
    projectConfigApi
      .getAll()
      .then(configs => {
        if (configs && configs.length > 0) setAllProjects(configs);
        else projectsApi.getAll().then(setAllProjects).catch(() => {});
      })
      .catch(() => projectsApi.getAll().then(setAllProjects).catch(() => {}));

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
  }, [isAdmin, refreshKey]);

  // ── Load existing timesheet for the selected week ────────────────────────────
  useEffect(() => {
    setFetching(true);
    timesheetsApi.getMyWeek(weekStart.toISOString().split('T')[0])
      .then(async ts => {
        if (ts) {
          setSavedId(ts.id);
          setSavedStatus(ts.status);
          setSavedRejectionReason((ts as any).rejectionReason ?? null);
          setStickyError(null);
          setCanSubmit(false); // must click Save Draft in this session before Submit
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
    setCanSubmit(false);
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
    setCanSubmit(false);
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

  // ── Centralised validation — returns error string or null if all rules pass ──
  const validateEntries = (): string | null => {
    const today    = new Date(); today.setHours(0,0,0,0);
    const dayDates = DAY_KEYS.map((_, i) => { const d = addDays(weekStart, i); d.setHours(0,0,0,0); return d; });

    // ── R1: Must have at least one row ───────────────────────────────────────
    const activeRows = entries.filter(e => e.projectId || e.taskId || Object.values(e.hours).some(h => (h||0) > 0));
    if (activeRows.length === 0)
      return 'Nothing to save — please select a project, task and enter your hours.';

    // ── R2 & R3: Every row must have project AND task (both mandatory) ────────
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const hasAnyInput = e.projectId || e.taskId || Object.values(e.hours).some(h => (h||0) > 0);
      if (!hasAnyInput) continue; // skip completely blank rows
      if (!e.projectId)
        return `Row ${i+1}: Project is required — please select a project.`;
      if (!e.taskId)
        return `Row ${i+1}: Task is required — please select a task for the selected project.`;
    }

    // ── R4: No duplicate project+task combination ────────────────────────────
    const seen = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      const e   = entries[i];
      if (!e.projectId || !e.taskId) continue;
      const key = `${e.projectId}::${e.taskId}`;
      if (seen.has(key)) {
        const task = e.tasks.find((t:any) => t.id === e.taskId);
        return `Row ${i+1}: Task "${task?.name ?? e.taskId}" is already entered in another row. Remove the duplicate.`;
      }
      seen.add(key);
    }

    // ── R5: Per-row hour and task-date validations ────────────────────────────
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e.projectId || !e.taskId) continue;

      const task     = e.tasks.find((t:any) => t.id === e.taskId);
      const label    = task?.name ? `"${task.name}"` : `Row ${i+1}`;
      const proj     = task?.project?.code ?? '';

      // R5a: Each day must be 0–24 h
      for (let d = 0; d < DAY_KEYS.length; d++) {
        const h = e.hours[DAY_KEYS[d]] || 0;
        if (h < 0)
          return `${label}: Hours cannot be negative on ${DAYS[d]} ${fmtDate(dayDates[d])}.`;
        if (h > 24)
          return `${label}: Cannot log more than 24h in a single day — ${DAYS[d]} ${fmtDate(dayDates[d])} shows ${h}h.`;
      }

      if (task) {
        // R5b: Task must not be expired (today > task endDate)
        if (task.endDate) {
          const taskEnd = new Date(task.endDate); taskEnd.setHours(0,0,0,0);
          const fmtEnd  = taskEnd.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
          if (taskEnd < today)
            return `${proj} — ${label}: This task expired on ${fmtEnd}. Cannot log hours for an expired task. Contact your manager to extend the task end date or assign a new task.`;

          // R5c: No hours on days after task end date
          for (let d = 0; d < DAY_KEYS.length; d++) {
            if ((e.hours[DAY_KEYS[d]] || 0) > 0 && dayDates[d] > taskEnd)
              return `${proj} — ${label}: Task ended on ${fmtEnd}. Cannot log hours from ${DAYS[d]} ${fmtDate(dayDates[d])} onwards. Contact your manager to extend the task end date.`;
          }
        }

        // R5d: No hours before task start date
        if (task.startDate) {
          const taskStart = new Date(task.startDate); taskStart.setHours(0,0,0,0);
          const fmtStart  = taskStart.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
          for (let d = 0; d < DAY_KEYS.length; d++) {
            if ((e.hours[DAY_KEYS[d]] || 0) > 0 && dayDates[d] < taskStart)
              return `${proj} — ${label}: Task starts on ${fmtStart}. Cannot log hours on ${DAYS[d]} ${fmtDate(dayDates[d])} before the task begins.`;
          }
        }
      }
    }

    // ── R6: Total hours across all days cannot exceed 24h per day ────────────
    for (let d = 0; d < DAY_KEYS.length; d++) {
      const dayTotal = entries.reduce((sum, e) => sum + (e.hours[DAY_KEYS[d]] || 0), 0);
      if (dayTotal > 24)
        return `${DAYS[d]} ${fmtDate(dayDates[d])}: Total hours across all rows is ${dayTotal}h — a single day cannot exceed 24 hours.`;
    }

    // ── R7: Weekly total must be at least 40 hours ───────────────────────────
    const weekTotal = entries.reduce((sum, e) => sum + DAY_KEYS.reduce((s, k) => s + (e.hours[k] || 0), 0), 0);
    if (weekTotal < 40)
      return `Weekly total is ${weekTotal}h — minimum 40 hours required for a full working week. Please complete your timesheet before saving.`;

    return null; // all rules passed
  };

  const save = async () => {
    setStickyError(null);

    const validationError = validateEntries();
    if (validationError) {
      setStickyError(validationError);
      return;
    }

    setLoading(true);
    try {
      const ts = await timesheetsApi.save(payload());
      setSavedId(ts.id);
      setSavedStatus(ts.status ?? 'DRAFT');
      setSavedRejectionReason((ts as any).rejectionReason ?? null);
      setStickyError(null);
      setCanSubmit(true); // explicit save succeeded — Submit now enabled
      toast.success('Timesheet saved as draft');
      onDataChanged?.();
    } catch (err: any) {
      // Backend validateTaskActive also checks end dates as a safety net —
      // display persistently so the user can read it before it disappears.
      setStickyError(extractError(err));
    } finally { setLoading(false); }
  };

  const submit = async () => {
    if (!savedId) { toast.error('Save the timesheet first before submitting'); return; }
    // Hard guard — canSubmit must be true (set only by successful save in this session)
    if (!canSubmit) {
      toast.error('Save Draft first before submitting');
      return;
    }
    if (stickyError) {
      toast.error('Fix the error above then Save Draft before submitting');
      return;
    }
    // Guard: REJECTED timesheets are reset to DRAFT on save (backend handles this),
    // so by the time submit is called, status should be DRAFT.
    // Block SUBMITTED and APPROVED only.
    if (savedStatus === 'SUBMITTED') {
      toast.error('This timesheet is already submitted — awaiting approval.');
      return;
    }
    if (savedStatus === 'APPROVED') {
      toast.error('This timesheet has already been approved.');
      return;
    }
    setLoading(true);
    try {
      await timesheetsApi.submit(savedId);
      toast.success('Timesheet submitted for approval!');
      onDataChanged?.();
      setSavedStatus('SUBMITTED'); // keeps both buttons disabled after submit
      setCanSubmit(false);
    } catch (err: any) {
      toast.error(extractError(err));
    } finally { setLoading(false); }
  };

  // ── Determine which projects to show in dropdown ─────────────────────────────
  // Admins → all projects
  // Team Members → only projects that have tasks assigned to them
  const projectOptions = isAdmin ? allProjects : assignedProjects;

  const sel  = { width:'100%', border:'1px solid var(--border-mid)', borderRadius:6, padding:'6px 8px', fontSize:13, background:'var(--card-bg)', outline:'none', fontFamily:"'Inter',system-ui,sans-serif" } as React.CSSProperties;
  const inp  = { width:52, textAlign:'center' as const, border:'1px solid var(--border-mid)', borderRadius:6, padding:'5px 2px', fontSize:13, background:'var(--card-bg)', outline:'none', fontFamily:"'Inter',system-ui,sans-serif" } as React.CSSProperties;
  const inpWk = { ...inp, background:'var(--border)' } as React.CSSProperties;

  // ── Status config for history tab ────────────────────────────────────────────
  const STATUS_CFG: Record<string,{label:string;bg:string;color:string;Icon:any}> = {
    DRAFT:     { label:'Draft',     bg:'#F3F4F6', color:'#6B7280', Icon:Clock         },
    SUBMITTED: { label:'Submitted', bg:'#FFFBEB',  color:'#B45309', Icon:Clock         },
    APPROVED:  { label:'Approved',  bg:'#DCFCE7',  color:'#16A34A', Icon:CheckCircle2  },
    REJECTED:  { label:'Rejected',  bg:'#FEF2F2',  color:'#DC2626', Icon:XCircle       },
  };

  const weekLabel = (start: string) => {
    const s = new Date(start), e = new Date(start);
    e.setDate(e.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
    return `${f(s)} – ${f(e)}, ${s.getFullYear()}`;
  };

  return (
    <div style={{ padding:24, background:'var(--page-bg)', minHeight:'100%' }}>

      {/* Back */}
      <button onClick={onBack}
        style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', marginBottom:16 }}>
        <ArrowLeft style={{ width:15, height:15 }} /> Back to Overview
      </button>

      {/* Breadcrumb + title */}
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:6 }}>
        Timesheets › <span style={{ color:'var(--text-2)', fontWeight:500 }}>{activeTab === 'history' ? 'History' : 'Enter Timesheet'}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:'0 0 4px' }}>
            {activeTab === 'history' ? 'Timesheet History' : 'Enter Timesheet'}
          </h1>
          <p style={{ fontSize:13, color:'var(--text-2)', margin:0 }}>
            {activeTab === 'history' ? 'View, recall or delete your past timesheets' : 'Log your work hours for the week'}
          </p>
        </div>
      </div>

      {/* ── Tabs: Enter Timesheet | History ── */}
      <div style={{ display:'flex', gap:2, marginBottom:20, padding:4, background:'var(--border)', borderRadius:10, width:'fit-content' }}>
        {([
          { id:'entry',   label:'Enter Timesheet', Icon:Clock    },
          { id:'history', label:'My History',       Icon:History  },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background: activeTab === id ? 'var(--card-bg)' : 'transparent',
              color:      activeTab === id ? 'var(--primary)' : 'var(--text-2)',
              boxShadow:  activeTab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
            <Icon style={{ width:15, height:15 }} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ HISTORY TAB ══════════════════════════════════ */}
      {activeTab === 'history' && (
        <div>
          {historyLoading ? (
            <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--text-3)' }}>Loading history…</div>
          ) : allTimesheets.length === 0 ? (
            <div className="card" style={{ padding:48, textAlign:'center' }}>
              <Clock style={{ width:36, height:36, color:'var(--border-mid)', margin:'0 auto 12px' }} />
              <p style={{ fontSize:14, color:'var(--text-2)', margin:0 }}>No timesheets yet</p>
              <p style={{ fontSize:12, color:'var(--text-3)', margin:'6px 0 0' }}>Switch to Enter Timesheet to log your first week</p>
            </div>
          ) : (
            <div className="card" style={{ overflow:'hidden' }}>
              {allTimesheets.map(ts => {
                const cfg  = STATUS_CFG[ts.status] || STATUS_CFG.DRAFT;
                const Icon = cfg.Icon;
                const isExp = expandedId === ts.id;
                const busy  = actionId === ts.id;
                return (
                  <div key={ts.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    {/* Row */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 20px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      {/* Status badge */}
                      <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:99,
                        background:cfg.bg, color:cfg.color, fontSize:12, fontWeight:600, flexShrink:0 }}>
                        <Icon style={{ width:12, height:12 }} />{cfg.label}
                      </div>

                      {/* Week label — click to expand entries */}
                      <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => setExpandedId(isExp ? null : ts.id)}>
                        <p style={{ fontSize:14, fontWeight:500, color:'var(--text-1)', margin:0 }}>{weekLabel(ts.weekStartDate)}</p>
                        <p style={{ fontSize:12, color:'var(--text-3)', margin:'2px 0 0' }}>
                          {ts.status === 'REJECTED' && ts.rejectionReason
                            ? <span style={{ color:'#DC2626' }}>Rejected: {ts.rejectionReason}</span>
                            : ts.status === 'APPROVED' && ts.approvedAt
                            ? `Approved ${new Date(ts.approvedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`
                            : ts.status === 'SUBMITTED' && ts.submittedAt
                            ? `Submitted ${new Date(ts.submittedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`
                            : ts.status === 'DRAFT'
                            ? <span style={{ color:'var(--primary)' }}>Draft — submit when ready</span>
                            : ''}
                        </p>
                      </div>

                      {/* Hours */}
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ fontSize:14, fontWeight:700, color:'var(--text-1)', margin:0 }}>{Number(ts.totalHours).toFixed(1)}h</p>
                        <p style={{ fontSize:11, color:'var(--text-3)', margin:'1px 0 0' }}>total</p>
                      </div>

                      {/* Actions */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                        {/* Recall — SUBMITTED only */}
                        {ts.status === 'SUBMITTED' && (
                          <button onClick={() => recallTimesheet(ts)} disabled={busy}
                            title="Pull back to Draft so you can edit and resubmit"
                            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8,
                              border:'1.5px solid #B45309', background:'#FFFBEB', color:'#B45309',
                              fontSize:12, fontWeight:600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
                            onMouseEnter={e => { if (!busy) e.currentTarget.style.background='#FDE68A'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='#FFFBEB'; }}>
                            <RotateCcw style={{ width:13, height:13 }} />
                            {busy ? 'Recalling…' : 'Recall'}
                          </button>
                        )}
                        {/* Edit + Delete — DRAFT only */}
                        {ts.status === 'DRAFT' && (
                          <>
                            {/* Edit — navigate to Entry tab set to that week */}
                            <button
                              onClick={() => {
                                // Calculate how many weeks offset this draft is from current week
                                const draftWeek   = new Date(ts.weekStartDate);
                                const currentWeek = new Date();
                                currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay() + 1);
                                currentWeek.setHours(0, 0, 0, 0);
                                draftWeek.setHours(0, 0, 0, 0);
                                const diffMs     = draftWeek.getTime() - currentWeek.getTime();
                                const diffWeeks  = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
                                setWeekOffset(diffWeeks);
                                setActiveTab('entry');
                              }}
                              title="Edit this draft"
                              style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8,
                                border:'1.5px solid #6366F1', background:'#EEF2FF', color:'#6366F1',
                                fontSize:12, fontWeight:600, cursor:'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background='#C7D2FE'; }}
                              onMouseLeave={e => { e.currentTarget.style.background='#EEF2FF'; }}>
                              <Pencil style={{ width:13, height:13 }} /> Edit
                            </button>
                            {/* Delete */}
                            <button onClick={() => setConfirmDelete(ts)} disabled={busy}
                              title="Permanently delete this draft"
                              style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8,
                                border:'1.5px solid #DC2626', background:'#FEF2F2', color:'#DC2626',
                                fontSize:12, fontWeight:600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
                              onMouseEnter={e => { if (!busy) e.currentTarget.style.background='#FECACA'; }}
                              onMouseLeave={e => { e.currentTarget.style.background='#FEF2F2'; }}>
                              <Trash2 style={{ width:13, height:13 }} />
                              {busy ? 'Deleting…' : 'Delete'}
                            </button>
                          </>
                        )}
                        {/* Expand/collapse */}
                        <button onClick={() => setExpandedId(isExp ? null : ts.id)}
                          style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-3)' }}>
                          {isExp ? <ChevronUp style={{ width:16, height:16 }} /> : <ChevronDown style={{ width:16, height:16 }} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded entry detail */}
                    {isExp && (
                      <div style={{ padding:'0 20px 16px', background:'var(--border)' }}>
                        {(!ts.entries || ts.entries.length === 0) ? (
                          <p style={{ fontSize:12, color:'var(--text-3)', paddingTop:12 }}>No entries recorded.</p>
                        ) : (
                          <div style={{ marginTop:12, borderRadius:10, overflow:'hidden', border:'1px solid var(--border-mid)' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, background:'var(--card-bg)' }}>
                              <thead>
                                <tr style={{ background:'var(--border)' }}>
                                  <th className="th" style={{ textAlign:'left', padding:'8px 12px' }}>Project</th>
                                  <th className="th" style={{ textAlign:'left', padding:'8px 12px' }}>Task</th>
                                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                                    <th key={d} className="th" style={{ padding:'8px', textAlign:'center' }}>{d}</th>
                                  ))}
                                  <th className="th" style={{ padding:'8px 12px', textAlign:'center' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ts.entries.map((e: any, i: number) => (
                                  <tr key={e.id ?? i} style={{ borderBottom:'1px solid var(--border)' }}>
                                    <td style={{ padding:'8px 12px', color:'var(--primary)', fontFamily:'monospace', fontWeight:700, fontSize:11 }}>
                                      {e.task?.project?.code || '—'}
                                    </td>
                                    <td style={{ padding:'8px 12px', color:'var(--text-1)', fontWeight:500 }}>
                                      {e.task?.name || e.taskId}
                                    </td>
                                    {DAY_KEYS.map((dk, di) => {
                                      const h = Number((e as any)[dk] ?? 0);
                                      return (
                                        <td key={di} style={{ padding:'8px', textAlign:'center', color: h > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                                          {h > 0 ? h.toFixed(1) : '—'}
                                        </td>
                                      );
                                    })}
                                    <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, color:'var(--primary)' }}>
                                      {Number(e.totalHours).toFixed(1)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr style={{ background:'var(--primary-tint)' }}>
                                  <td colSpan={2} style={{ padding:'8px 12px', fontWeight:700, color:'var(--primary)', fontSize:12 }}>Week Total</td>
                                  {DAY_KEYS.map(dk => {
                                    const day = ts.entries.reduce((s: number, e: any) => s + Number((e as any)[dk] ?? 0), 0);
                                    return (
                                      <td key={dk} style={{ padding:'8px', textAlign:'center', fontWeight:700, color:'var(--primary)', opacity: day > 0 ? 1 : 0.4 }}>
                                        {day > 0 ? day.toFixed(1) : '—'}
                                      </td>
                                    );
                                  })}
                                  <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, color:'var(--primary)' }}>
                                    {Number(ts.totalHours).toFixed(1)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Delete confirmation modal */}
          {confirmDelete && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
              <div className="card" style={{ padding:28, width:'100%', maxWidth:420 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'#FEF2F2', border:'2px solid #FECACA', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Trash2 style={{ width:20, height:20, color:'#DC2626' }} />
                </div>
                <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text-1)', textAlign:'center', margin:'0 0 8px' }}>Delete Draft?</h3>
                <p style={{ fontSize:13, color:'var(--text-2)', textAlign:'center', margin:'0 0 6px' }}>
                  Week of <strong>{weekLabel(confirmDelete.weekStartDate)}</strong>
                </p>
                <p style={{ fontSize:13, color:'#DC2626', textAlign:'center', margin:'0 0 24px' }}>This action is permanent and cannot be undone.</p>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setConfirmDelete(null)} className="btn-secondary" style={{ flex:1, justifyContent:'center' }}>Cancel</button>
                  <button onClick={() => deleteTimesheet(confirmDelete)} className="btn-danger" style={{ flex:1, justifyContent:'center' }}>
                    <Trash2 style={{ width:14, height:14 }} /> Yes, Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ ENTRY TAB ════════════════════════════════════ */}
      {activeTab === 'entry' && (
        <div>

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
        <div style={{ padding:32, textAlign:'center', background:'var(--card-bg)', borderRadius:16, border:'1px solid var(--border)', marginBottom:16 }}>
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
          style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-mid)', background:'var(--card-bg)', cursor:'pointer' }}>
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
          style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-mid)', background:'var(--card-bg)', cursor:'pointer' }}>
          <ChevronRight style={{ width:16, height:16, color:'var(--text-2)' }} />
        </button>
      </div>

      {/* Status banner for non-DRAFT timesheets */}
      {savedId && savedStatus && savedStatus !== 'DRAFT' && (
        <div style={{
          padding:'14px 16px', borderRadius:10, marginBottom:12,
          background: savedStatus === 'SUBMITTED' ? '#FFFBEB' : savedStatus === 'APPROVED' ? '#DCFCE7' : '#FEF2F2',
          border: `1px solid ${savedStatus === 'SUBMITTED' ? '#FDE68A' : savedStatus === 'APPROVED' ? '#86EFAC' : '#FECACA'}`,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
            <span style={{ fontSize:20, lineHeight:1.2 }}>
              {savedStatus === 'SUBMITTED' ? '⏳' : savedStatus === 'APPROVED' ? '✅' : '❌'}
            </span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:700, margin:'0 0 4px',
                color: savedStatus === 'SUBMITTED' ? '#92400E' : savedStatus === 'APPROVED' ? '#14532D' : '#991B1B' }}>
                {savedStatus === 'SUBMITTED' ? 'Awaiting Approval'
                  : savedStatus === 'APPROVED' ? 'Approved'
                  : '❗ Rejected — Action Required'}
              </p>
              {savedStatus === 'REJECTED' && savedRejectionReason && (
                <p style={{ fontSize:12, margin:'0 0 6px', color:'#DC2626', fontWeight:600 }}>
                  Reason: {savedRejectionReason}
                </p>
              )}
              <p style={{ fontSize:12, margin:0, lineHeight:1.6,
                color: savedStatus === 'SUBMITTED' ? '#B45309' : savedStatus === 'APPROVED' ? '#16A34A' : '#DC2626' }}>
                {savedStatus === 'SUBMITTED'
                  ? 'This timesheet has been submitted. Use Recall in your timesheet history to pull it back for editing.'
                  : savedStatus === 'APPROVED'
                  ? 'This timesheet has been approved by your manager.'
                  : 'Your timesheet was rejected. Correct your entries below, then Save Draft and Submit for Approval again.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Persistent dismissable error banner ─────────────────────────── */}
      {stickyError && (
        <div style={{
          display:'flex', alignItems:'flex-start', gap:12,
          padding:'14px 18px', borderRadius:12, marginBottom:14,
          background:'#FEF2F2', border:'2px solid #FECACA',
        }}>
          <AlertTriangle style={{ width:20, height:20, color:'#DC2626', flexShrink:0, marginTop:1 }} />
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'#991B1B', margin:'0 0 4px' }}>
              Cannot save — action required
            </p>
            <p style={{ fontSize:13, color:'#DC2626', margin:0, lineHeight:1.6 }}>
              {stickyError}
            </p>
          </div>
          <button
            onClick={() => setStickyError(null)}
            title="Dismiss"
            style={{ padding:'2px 6px', background:'none', border:'1px solid #FECACA', borderRadius:6, cursor:'pointer', color:'#DC2626', fontSize:16, lineHeight:1, flexShrink:0 }}>
            ✕
          </button>
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
                        onChange={e => { setCanSubmit(false); setEntries(prev => {
                          const u = [...prev];
                          u[idx] = { ...u[idx], taskId: e.target.value };
                          return u;
                        });}}
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
                        onClick={() => { setCanSubmit(false); setEntries(e => e.filter((_, i) => i !== idx)); }}
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
          onClick={() => { setCanSubmit(false); setEntries(e => [...e, { projectId:'', taskId:'', tasks:[], hours:{} }]); }}
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
            disabled={loading || !canSubmit || !!stickyError || savedStatus === 'SUBMITTED' || savedStatus === 'APPROVED'}
            className="btn-primary"
            title={!canSubmit ? 'Save Draft first — then Submit will be enabled' : stickyError ? 'Fix the error above then Save Draft before submitting' : savedStatus === 'SUBMITTED' ? 'Already submitted — awaiting approval' : savedStatus === 'APPROVED' ? 'Already approved' : 'Ready to submit'}
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
      )}

    </div>
  );
}
