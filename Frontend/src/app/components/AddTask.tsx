import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, RotateCcw, Eye, Pencil, ChevronRight, CheckCircle2, Clock, PauseCircle, XCircle, DollarSign, Ban } from 'lucide-react';
import { tasksApi, projectsApi } from '../../services/api';
import { toast } from './ui/Toast';

const TASK_TYPES  = ['DEVELOPMENT', 'DESIGN', 'TESTING', 'MANAGEMENT', 'SUPPORT', 'DOCUMENTATION', 'MEETING'];
const PRIORITIES  = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TASK_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

type TabMode = 'add' | 'view-select' | 'view-detail' | 'edit';

const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string; Icon: any }> = {
  ACTIVE:    { label: 'Active',    bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', Icon: CheckCircle2 },
  ON_HOLD:   { label: 'On Hold',   bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', Icon: PauseCircle  },
  COMPLETED: { label: 'Completed', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', Icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', Icon: XCircle      },
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

export default function AddTask({ onBack }: { onBack: () => void }) {
  const [tab, setTab]             = useState<TabMode>('add');
  const [projects, setProjects]   = useState<any[]>([]);
  const [tasks, setTasks]         = useState<any[]>([]);
  const [form, setForm]           = useState({ ...emptyForm });
  const [loading, setLoading]     = useState(false);

  // View/Edit state
  const [selProjectId, setSelProjectId] = useState('');
  const [selTaskId, setSelTaskId]       = useState('');
  const [taskDetail, setTaskDetail]     = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { projectsApi.getAll().then(setProjects).catch(() => {}); }, []);

  // Load tasks for view/edit project selection
  useEffect(() => {
    if (selProjectId && (tab === 'view-select' || tab === 'edit')) {
      tasksApi.getAll(selProjectId).then(setTasks).catch(() => {});
    } else {
      setTasks([]);
    }
    setSelTaskId('');
    setTaskDetail(null);
  }, [selProjectId, tab]);

  // Load task detail on task selection
  useEffect(() => {
    if (!selTaskId) { setTaskDetail(null); return; }
    setDetailLoading(true);
    tasksApi.getOne(selTaskId)
      .then(t => {
        setTaskDetail(t);
        if (tab === 'view-detail' || tab === 'edit') {
          setForm({
            projectId:   t.projectId,
            name:        t.name,
            description: t.description || '',
            taskType:    t.taskType,
            priority:    t.priority,
            startDate:   t.startDate ? t.startDate.slice(0, 10) : '',
            endDate:     t.endDate   ? t.endDate.slice(0, 10)   : '',
            billable:    t.billable,
            status:      t.status,
          });
        }
      })
      .catch(() => toast.error('Failed to load task'))
      .finally(() => setDetailLoading(false));
  }, [selTaskId]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ── CREATE ──
  const handleCreate = async () => {
    if (!form.projectId || !form.name) { toast.error('Project and Task Name are required'); return; }
    setLoading(true);
    try {
      await tasksApi.create({
        projectId: form.projectId, name: form.name, description: form.description || undefined,
        taskType: form.taskType, priority: form.priority,
        startDate: form.startDate || undefined, endDate: form.endDate || undefined,
        billable: form.billable,
      });
      toast.success('Task created successfully');
      setForm({ ...emptyForm });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create task');
    } finally { setLoading(false); }
  };

  // ── SAVE EDIT ──
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
      // Switch to view after save
      setTab('view-detail');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update task');
    } finally { setLoading(false); }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1";
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50";

  // ── SHARED FORM FIELDS (used in both Add and Edit) ──
  const renderFormFields = (isEdit = false) => (
    <div className="space-y-5">
      {/* Project + Name */}
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
          <label className={labelCls}>Task Name <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Database Schema Design" className={inputCls} />
        </div>
      </div>

      {/* Task Type + Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Task Type</label>
          <select value={form.taskType} onChange={e => set('taskType', e.target.value)} className={inputCls}>
            {TASK_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Start Date</label>
          <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>End Date</label>
          <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Billable + Status (status only in edit mode) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Billable</label>
          <div className="flex items-center gap-3 mt-1">
            {[true, false].map(v => (
              <button key={String(v)} type="button" onClick={() => set('billable', v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  background:   form.billable === v ? (v ? '#ECFDF5' : '#FEF2F2') : '#F8FAFC',
                  borderColor:  form.billable === v ? (v ? '#10B981' : '#EF4444') : '#E2E8F0',
                  color:        form.billable === v ? (v ? '#065F46' : '#991B1B') : '#94A3B8',
                }}
              >
                {v ? <DollarSign className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                {v ? 'Billable' : 'Non-Billable'}
              </button>
            ))}
          </div>
        </div>
        {isEdit && (
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              {TASK_STATUSES.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ').charAt(0) + s.replace('_', ' ').slice(1).toLowerCase()}</option>
              ))}
            </select>
            {(form.status === 'ON_HOLD' || form.status === 'COMPLETED' || form.status === 'CANCELLED') && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <PauseCircle className="w-3 h-3" />
                Employees won't be able to log hours against this task
              </p>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          rows={3} placeholder="Describe the task..." className={inputCls + ' resize-none'} />
      </div>
    </div>
  );

  // ── VIEW DETAIL ──
  const renderViewDetail = () => {
    if (!taskDetail) return null;
    const sm = STATUS_META[taskDetail.status] || STATUS_META.ACTIVE;
    const pm = PRIORITY_META[taskDetail.priority] || PRIORITY_META.MEDIUM;
    const StatusIcon = sm.Icon;

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Header bar */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#FAFBFF', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{taskDetail.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{taskDetail.project?.code} — {taskDetail.project?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{ background: sm.bg, color: sm.text, borderColor: sm.border }}>
              <StatusIcon className="w-3.5 h-3.5" /> {sm.label}
            </span>
            <button onClick={() => setTab('edit')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Edit Task
            </button>
          </div>
        </div>

        {/* Fields grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {[
            { label: 'Task Type',  value: TYPE_LABELS[taskDetail.taskType] || taskDetail.taskType },
            { label: 'Priority',   value: (
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: pm.bg, color: pm.text }}>
                {taskDetail.priority.charAt(0) + taskDetail.priority.slice(1).toLowerCase()}
              </span>
            )},
            { label: 'Start Date', value: fmtDate(taskDetail.startDate) },
            { label: 'End Date',   value: fmtDate(taskDetail.endDate)   },
            { label: 'Billable',   value: (
              <span className="flex items-center gap-1 text-sm" style={{ color: taskDetail.billable ? '#059669' : '#EF4444' }}>
                {taskDetail.billable ? <DollarSign className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                {taskDetail.billable ? 'Billable' : 'Non-Billable'}
              </span>
            )},
            { label: 'Created By', value: taskDetail.createdBy?.name || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-sm text-slate-800">{value}</div>
            </div>
          ))}

          {/* Description full width */}
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</div>
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 min-h-[60px]">
              {taskDetail.description || <span className="text-slate-400 italic">No description provided</span>}
            </div>
          </div>

          {/* Assignments */}
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

        {/* Blocked warning */}
        {taskDetail.status !== 'ACTIVE' && (
          <div className="mx-6 mb-6 flex items-center gap-2 p-3 rounded-lg text-sm"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
            <PauseCircle className="w-4 h-4 shrink-0" />
            Time logging is disabled for this task because it is <strong>{sm.label}</strong>.
          </div>
        )}
      </div>
    );
  };

  // ── PROJECT + TASK SELECTOR (shared by view and edit) ──
  const renderSelector = (title: string) => (
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
            {tasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} [{t.status.replace('_', ' ')}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {detailLoading && <div className="text-sm text-slate-400 animate-pulse">Loading task...</div>}

      {/* Show detail/edit inline after selection */}
      {selTaskId && !detailLoading && taskDetail && (
        tab === 'view-select' || tab === 'view-detail' ? renderViewDetail() :
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
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Tasks</h1>
      <p className="text-slate-500 text-sm mb-6">Create, view and manage tasks for your projects</p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: '#F1F5F9', width: 'fit-content' }}>
        {([
          { id: 'add',        label: 'Add Task',  Icon: Plus   },
          { id: 'view-select', label: 'View Task', Icon: Eye    },
          { id: 'edit',        label: 'Edit Task', Icon: Pencil },
        ] as const).map(({ id, label, Icon }) => {
          const active = tab === id || (id === 'view-select' && tab === 'view-detail');
          return (
            <button key={id} onClick={() => { setTab(id); setSelProjectId(''); setSelTaskId(''); setTaskDetail(null); setForm({ ...emptyForm }); }}
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

      {/* Tab: Add */}
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

      {/* Tab: View */}
      {(tab === 'view-select' || tab === 'view-detail') && renderSelector('View Task')}

      {/* Tab: Edit */}
      {tab === 'edit' && renderSelector('Edit Task')}
    </div>
  );
}
