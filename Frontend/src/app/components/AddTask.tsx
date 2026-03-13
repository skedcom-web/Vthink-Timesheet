import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, RotateCcw, Eye, Pencil,
  CheckCircle2, PauseCircle, XCircle, DollarSign, Ban,
  ChevronDown, Search, Check, AlertTriangle, Timer, CalendarX,
} from 'lucide-react';
import { tasksApi, projectsApi, projectConfigApi } from '../../services/api';
import { toast } from './ui/Toast';

// ── Constants ─────────────────────────────────────────────────────────────────
const TASK_TYPES   = ['DEVELOPMENT', 'DESIGN', 'TESTING', 'MANAGEMENT', 'SUPPORT', 'DOCUMENTATION', 'MEETING'];
const PRIORITIES   = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TASK_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

const LS_KEY = 'vthink_task_name_pool';
const DEFAULT_TASK_NAMES = [
  'Sprint Planning', 'Backlog Grooming', 'UI Design Review',
  'Database Schema Design', 'API Integration', 'Code Review',
  'Unit Testing', 'Regression Testing', 'Bug Fix', 'Deployment Setup',
  'Documentation', 'Client Meeting', 'Daily Standup',
  'Performance Optimisation', 'Security Audit',
];

function loadTaskNames(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...DEFAULT_TASK_NAMES];
}
function saveTaskNames(names: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(names));
}

type TabMode = 'add' | 'view-select' | 'view-detail' | 'edit';

const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string; Icon: any }> = {
  ACTIVE:    { label: 'Active',    bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', Icon: CheckCircle2 },
  ON_HOLD:   { label: 'On Hold',   bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', Icon: PauseCircle  },
  COMPLETED: { label: 'Completed', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', Icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', Icon: XCircle      },
};

const CREATION_STATUS_META: Record<string, { label: string; bg: string; text: string; border: string; Icon: any }> = {
  ON_TIME_CREATION: { label: 'On Time Creation',  bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', Icon: CheckCircle2  },
  DELAYED_CREATION: { label: 'Delayed Creation',   bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', Icon: AlertTriangle },
  NO_END_DATE:      { label: 'No End Date Set',    bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', Icon: CalendarX     },
};
const PRIORITY_META: Record<string, { bg: string; text: string }> = {
  LOW:      { bg: '#ECFDF5', text: '#059669' },
  MEDIUM:   { bg: '#FFFBEB', text: '#B45309' },
  HIGH:     { bg: '#FEF2F2', text: '#991B1B' },
  CRITICAL: { bg: '#FDF4FF', text: '#7E22CE' },
};
const TYPE_LABELS: Record<string, string> = {
  DEVELOPMENT: 'Development', DESIGN: 'Design', TESTING: 'Testing',
  MANAGEMENT: 'Management', SUPPORT: 'Support', DOCUMENTATION: 'Documentation', MEETING: 'Meeting',
};

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
const emptyForm = {
  projectId: '', name: '', description: '', taskType: 'DEVELOPMENT',
  priority: 'MEDIUM', startDate: '', endDate: '', billable: true, status: 'ACTIVE',
};

// ── Task Name Combo Box ────────────────────────────────────────────────────────
function TaskNameCombo({ value, onChange, taskNamePool, onAddName, disabled = false }: {
  value: string; onChange: (v: string) => void;
  taskNamePool: string[]; onAddName: (name: string) => void; disabled?: boolean;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef             = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = taskNamePool.filter(n => n.toLowerCase().includes(search.toLowerCase()));
  const isNew    = search.trim() !== '' && !taskNamePool.some(n => n.toLowerCase() === search.trim().toLowerCase());

  const selectOption = (name: string) => { onChange(name); setSearch(''); setOpen(false); };
  const addNew = () => {
    const t = search.trim();
    if (!t) return;
    onAddName(t); onChange(t); setSearch(''); setOpen(false);
  };

  const base = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50";

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={base + ' flex items-center justify-between cursor-pointer gap-2 ' + (disabled ? 'opacity-60 cursor-not-allowed' : '')}
        onClick={() => { if (!disabled) { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); } }}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value || 'Select or type a task name...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { isNew ? addNew() : (filtered[0] && selectOption(filtered[0])); } if (e.key === 'Escape') setOpen(false); }}
              placeholder="Search or type a new task name..."
              className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && !isNew && (
              <div className="px-4 py-3 text-sm text-slate-400 italic">No matches found</div>
            )}
            {filtered.map(name => (
              <button key={name} onClick={() => selectOption(name)}
                className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                {value === name
                  ? <><Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" /><span className="font-medium text-indigo-700">{name}</span></>
                  : <><span className="w-3.5 h-3.5 shrink-0" /><span className="text-slate-700">{name}</span></>}
              </button>
            ))}
            {isNew && (
              <button onClick={addNew}
                className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors border-t border-indigo-100">
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Add new: <span className="font-semibold ml-1">"{search.trim()}"</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AddTask({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {
  const [tab, setTab]           = useState<TabMode>('add');
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks]       = useState<any[]>([]);
  const [form, setForm]         = useState({ ...emptyForm });
  const [loading, setLoading]   = useState(false);
  const [taskNamePool, setTaskNamePool] = useState<string[]>(loadTaskNames);

  const [selProjectId, setSelProjectId] = useState('');
  const [selTaskId, setSelTaskId]       = useState('');
  const [taskDetail, setTaskDetail]     = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load projects: prefer projectConfig table (uploaded), fallback to projects table
  // projectConfigApi.getAll() returns { id (projects table ID), code, name, ... }
  useEffect(() => {
    projectConfigApi.getAll()
      .then(configs => {
        if (configs && configs.length > 0) {
          setProjects(configs);
        } else {
          projectsApi.getAll().then(setProjects).catch(() => {});
        }
      })
      .catch(() => projectsApi.getAll().then(setProjects).catch(() => {}));
  }, []);

  // When project changes, load its task names and merge into the combo pool
  useEffect(() => {
    if (!form.projectId) return;
    projectConfigApi.getTaskNames(form.projectId)
      .then((names: { id: string; name: string }[]) => {
        if (names && names.length > 0) {
          const nameStrings = names.map(n => n.name);
          setTaskNamePool(prev => {
            const merged = Array.from(new Set([...nameStrings, ...prev]));
            saveTaskNames(merged);
            return merged;
          });
        }
      })
      .catch(() => {});
  }, [form.projectId]);

  useEffect(() => {
    if (selProjectId && (tab === 'view-select' || tab === 'edit')) {
      tasksApi.getAll(selProjectId).then(setTasks).catch(() => {});
    } else { setTasks([]); }
    setSelTaskId(''); setTaskDetail(null);
  }, [selProjectId, tab]);

  useEffect(() => {
    if (!selTaskId) { setTaskDetail(null); return; }
    setDetailLoading(true);
    tasksApi.getOne(selTaskId)
      .then(t => {
        setTaskDetail(t);
        if (tab === 'view-detail' || tab === 'edit') {
          setForm({
            projectId: t.projectId, name: t.name, description: t.description || '',
            taskType: t.taskType, priority: t.priority,
            startDate: t.startDate ? t.startDate.slice(0, 10) : '',
            endDate:   t.endDate   ? t.endDate.slice(0, 10)   : '',
            billable: t.billable, status: t.status,
          });
        }
      })
      .catch(() => toast.error('Failed to load task'))
      .finally(() => setDetailLoading(false));
  }, [selTaskId]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleAddTaskName = (name: string) => {
    setTaskNamePool(prev => { const u = [...prev, name]; saveTaskNames(u); return u; });
    toast.success(`"${name}" added to task name list`);
  };

  const handleCreate = async () => {
    if (!form.projectId || !form.name) { toast.error('Project and Task Name are required'); return; }
    if (!form.startDate) { toast.error('Start Date is required'); return; }
    setLoading(true);
    try {
      await tasksApi.create({
        projectId: form.projectId, name: form.name, description: form.description || undefined,
        taskType: form.taskType, priority: form.priority,
        startDate: form.startDate || undefined, endDate: form.endDate || undefined,
        billable: form.billable,
      });
      toast.success('Task created successfully');
      onDataChanged?.();
      setForm({ ...emptyForm });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create task');
    } finally { setLoading(false); }
  };

  const handleSaveEdit = async () => {
    if (!selTaskId || !form.name) { toast.error('Task Name is required'); return; }
    setLoading(true);
    try {
      const updated = await tasksApi.update(selTaskId, {
        name: form.name, description: form.description || undefined,
        taskType: form.taskType, priority: form.priority,
        startDate: form.startDate || undefined, endDate: form.endDate || undefined,
        billable: form.billable, status: form.status,
      });
      setTaskDetail(updated);
      toast.success('Task updated successfully');
      onDataChanged?.();
      setTab('view-detail');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update task');
    } finally { setLoading(false); }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1";
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50";

  const renderFormFields = (isEdit = false) => (
    <div className="space-y-5">
      {/* ROW 1: Project + Task Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Project <span className="text-red-500">*</span></label>
          {isEdit ? (
            <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-500">
              {projects.find(p => p.id === form.projectId)?.name || '—'}
            </div>
          ) : (
            <select value={form.projectId} onChange={e => set('projectId', e.target.value)} className={inputCls}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className={labelCls}>Task Type</label>
          <select value={form.taskType} onChange={e => set('taskType', e.target.value)} className={inputCls}>
            {TASK_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {/* ROW 2: Task Name — full-width combo */}
      <div>
        <label className={labelCls}>
          Task Name <span className="text-red-500">*</span>
          <span className="ml-2 text-xs font-normal text-slate-400">— select from list or type a new name to add it</span>
        </label>
        <TaskNameCombo
          value={form.name}
          onChange={v => set('name', v)}
          taskNamePool={taskNamePool}
          onAddName={handleAddTaskName}
        />
      </div>

      {/* ROW 3: Priority + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Priority</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        {isEdit && (
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ROW 4: Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Start Date <span className="text-red-500">*</span></label>
          <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls + (!form.startDate && tab === 'add' ? ' border-red-300 bg-red-50' : '')} required />
        </div>
        <div>
          <label className={labelCls}>End Date</label>
          <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* ROW 5: Billable toggle */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => set('billable', !form.billable)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.billable ? 'bg-indigo-600' : 'bg-slate-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.billable ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm font-medium flex items-center gap-1">
          {form.billable
            ? <><DollarSign className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">Billable</span></>
            : <><Ban className="w-3.5 h-3.5 text-red-400" /><span className="text-slate-500">Non-Billable</span></>}
        </span>
      </div>

      {/* ROW 6: Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          rows={3} placeholder="Optional task description..." className={inputCls + ' resize-none'} />
      </div>
    </div>
  );

  const renderViewDetail = () => {
    if (!taskDetail) return null;
    const sm = STATUS_META[taskDetail.status] || STATUS_META.ACTIVE;
    const pm = PRIORITY_META[taskDetail.priority] || PRIORITY_META.MEDIUM;
    const StatusIcon = sm.Icon;
    return (
      <div className="mt-4 border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-start justify-between px-6 py-4" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div className="text-xs text-slate-400 mb-1">{projects.find(p => p.id === taskDetail.projectId)?.code}</div>
            <div className="text-lg font-semibold text-slate-800">{taskDetail.name}</div>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
            style={{ background: sm.bg, color: sm.text, borderColor: sm.border }}>
            <StatusIcon className="w-3.5 h-3.5" /> {sm.label}
          </span>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {[
            { label: 'Task Type', value: TYPE_LABELS[taskDetail.taskType] || taskDetail.taskType },
            { label: 'Priority', value: (
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: pm.bg, color: pm.text }}>
                {taskDetail.priority.charAt(0) + taskDetail.priority.slice(1).toLowerCase()}
              </span>
            )},
            { label: 'Start Date', value: fmtDate(taskDetail.startDate) },
            { label: 'End Date',   value: fmtDate(taskDetail.endDate)   },
            { label: 'Billable', value: (
              <span className="flex items-center gap-1 text-sm" style={{ color: taskDetail.billable ? '#059669' : '#EF4444' }}>
                {taskDetail.billable ? <DollarSign className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                {taskDetail.billable ? 'Billable' : 'Non-Billable'}
              </span>
            )},
            { label: 'Created By', value: taskDetail.createdBy?.name || '—' },
            { label: 'Creation Status', value: (() => {
              const cs = taskDetail.creationStatus || 'ON_TIME_CREATION';
              const m  = CREATION_STATUS_META[cs] || CREATION_STATUS_META.ON_TIME_CREATION;
              const CsIcon = m.Icon;
              return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                  style={{ background: m.bg, color: m.text, borderColor: m.border }}>
                  <CsIcon className="w-3 h-3" /> {m.label}
                </span>
              );
            })() },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-sm text-slate-800">{value}</div>
            </div>
          ))}
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</div>
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 min-h-[60px]">
              {taskDetail.description || <span className="text-slate-400 italic">No description provided</span>}
            </div>
          </div>
          {taskDetail.assignments?.length > 0 && (
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Assigned To</div>
              <div className="flex flex-wrap gap-2">
                {taskDetail.assignments.map((a: any) => (
                  <span key={a.id} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-medium text-indigo-700">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {a.employee?.name?.[0]}
                    </span>
                    {a.employee?.name}
                    {a.employee?.employeeId && <span className="text-indigo-400">· {a.employee.employeeId}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {taskDetail.status !== 'ACTIVE' && (
          <div className="mx-6 mb-6 flex items-center gap-2 p-3 rounded-lg text-sm"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
            <PauseCircle className="w-4 h-4 shrink-0" />
            Time logging is disabled — this task is <strong>{sm.label}</strong>.
          </div>
        )}
      </div>
    );
  };

  const renderSelector = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Project <span className="text-red-500">*</span></label>
          <select value={selProjectId} onChange={e => setSelProjectId(e.target.value)} className={inputCls}>
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Task <span className="text-red-500">*</span></label>
          <select value={selTaskId} onChange={e => setSelTaskId(e.target.value)} disabled={!selProjectId} className={inputCls + ' disabled:opacity-50'}>
            <option value="">Select task...</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.name} [{t.status.replace('_', ' ')}]</option>)}
          </select>
        </div>
      </div>
      {detailLoading && <div className="text-sm text-slate-400 animate-pulse">Loading task...</div>}
      {selTaskId && !detailLoading && taskDetail && (
        tab === 'view-select' || tab === 'view-detail'
          ? renderViewDetail()
          : (
            <div className="space-y-5 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
              <p className="text-sm font-medium text-slate-700">Editing: <span className="text-indigo-600">{taskDetail.name}</span></p>
              {renderFormFields(true)}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveEdit} disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => { setTab('view-select'); setTaskDetail(null); setSelTaskId(''); setSelProjectId(''); }}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Tasks</h1>
      <p className="text-slate-500 text-sm mb-6">Create, view and manage tasks for your projects</p>

      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: '#F1F5F9', width: 'fit-content' }}>
        {([
          { id: 'add',         label: 'Add Task',  Icon: Plus   },
          { id: 'view-select', label: 'View Task', Icon: Eye    },
          { id: 'edit',        label: 'Edit Task', Icon: Pencil },
        ] as const).map(({ id, label, Icon }) => {
          const active = tab === id || (id === 'view-select' && tab === 'view-detail');
          return (
            <button key={id}
              onClick={() => { setTab(id); setSelProjectId(''); setSelTaskId(''); setTaskDetail(null); setForm({ ...emptyForm }); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? '#FFFFFF' : 'transparent',
                color:      active ? '#4F46E5' : '#64748B',
                boxShadow:  active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'add' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {renderFormFields(false)}
          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> {loading ? 'Creating...' : 'Create Task'}
            </button>
            <button onClick={() => setForm({ ...emptyForm })}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      )}
      {(tab === 'view-select' || tab === 'view-detail') && renderSelector()}
      {tab === 'edit' && renderSelector()}
    </div>
  );
}
