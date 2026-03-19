import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ChevronDown, X, UserPlus, Plus, Pencil,
  Filter, CheckCircle2, XCircle, AlertTriangle, Calendar,
} from 'lucide-react';
import { assignmentsApi, projectsApi, tasksApi } from '../../services/api';
import { employeeConfigApi } from '../../services/api';
import { toast } from './ui/Toast';

interface EmpOption { id?: string; employeeNo: string; name: string; designation: string; email: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isExpired(iso?: string | null) {
  if (!iso) return false;
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = new Date();    t.setHours(0, 0, 0, 0);
  return d < t;
}

const STATUS_META: Record<string, { bg: string; text: string }> = {
  ACTIVE:     { bg: '#DCFCE7', text: '#15803D' },
  INACTIVE:   { bg: '#F1F5F9', text: '#6B7280' },
  COMPLETED:  { bg: '#EFF6FF', text: '#1D4ED8' },
  CANCELLED:  { bg: '#FEF2F2', text: '#DC2626' },
};

export default function AssignTask({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {

  // ── View: 'list' | 'new' | 'edit' ──────────────────────────────────────────
  const [view,        setView]        = useState<'list' | 'new' | 'edit'>('list');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Form / project / task state
  const [projects,    setProjects]    = useState<any[]>([]);
  const [tasks,       setTasks]       = useState<any[]>([]);
  const [empOptions,  setEmpOptions]  = useState<EmpOption[]>([]);
  const [loading,     setLoading]     = useState(false);

  const [form, setForm] = useState({
    projectId: '', taskId: '',
    assignStartDate: '', assignEndDate: '',
    allocationPercentage: 100, roleOnTask: '',
  });

  // Employee combo state
  const [empName,        setEmpName]        = useState('');
  const [empNo,          setEmpNo]          = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empEmail,       setEmpEmail]       = useState('');
  const [isNewEmp,       setIsNewEmp]       = useState(false);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [filteredEmps,   setFilteredEmps]   = useState<EmpOption[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Edit assignment state
  const [editAsgn,    setEditAsgn]    = useState<any>(null);
  const [filterProject, setFilterProject] = useState('');

  // ── Load on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(() => {});
    employeeConfigApi.getAll().then(setEmpOptions).catch(() => {});
    loadAssignments();
  }, []);

  const loadAssignments = () => {
    setListLoading(true);
    assignmentsApi.getAll()
      .then(setAssignments)
      .catch(() => toast.error('Failed to load assignments'))
      .finally(() => setListLoading(false));
  };

  // Load tasks when project changes
  useEffect(() => {
    if (form.projectId) {
      tasksApi.getAll(form.projectId).then(setTasks).catch(() => {});
    } else { setTasks([]); }
    setForm(f => ({ ...f, taskId: '' }));
  }, [form.projectId]);

  // Filter employee dropdown
  useEffect(() => {
    if (!empName.trim()) { setFilteredEmps(empOptions.slice(0, 50)); return; }
    const q = empName.toLowerCase();
    setFilteredEmps(empOptions.filter(e =>
      e.name.toLowerCase().includes(q) || e.employeeNo.toLowerCase().includes(q)
    ).slice(0, 50));
  }, [empName, empOptions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const selectEmployee = (emp: EmpOption) => {
    setEmpName(emp.name); setEmpNo(emp.employeeNo);
    setEmpDesignation(emp.designation || ''); setEmpEmail(emp.email || '');
    setIsNewEmp(false); setShowDropdown(false);
  };

  const clearEmployee = () => {
    setEmpName(''); setEmpNo(''); setEmpDesignation(''); setEmpEmail('');
    setIsNewEmp(false);
  };

  const handleNameBlur = async () => {
    if (!empName.trim()) return;
    const match = empOptions.find(e => e.name.toLowerCase() === empName.trim().toLowerCase());
    if (match) { selectEmployee(match); return; }
    try {
      const found = await employeeConfigApi.lookupByName(empName.trim());
      if (found) { selectEmployee(found); employeeConfigApi.getAll().then(setEmpOptions).catch(() => {}); }
      else { setIsNewEmp(true); setEmpNo(''); setEmpDesignation(''); setEmpEmail(''); }
    } catch { setIsNewEmp(true); }
    setShowDropdown(false);
  };

  const cancelForm = () => {
    setView('list'); setEditAsgn(null);
    setForm({ projectId: '', taskId: '', assignStartDate: '', assignEndDate: '', allocationPercentage: 100, roleOnTask: '' });
    clearEmployee();
  };

  // ── Validation: assignEndDate must NOT exceed the task's endDate ──────────────
  // If the task has an endDate and the assignment endDate is later — block it.
  // The manager must first extend the task's endDate in Add Task, or create a new task.
  const validateAssignEndDate = (): boolean => {
    if (!form.assignEndDate) return true;
    const selectedTask = tasks.find(t => t.id === form.taskId);
    if (!selectedTask?.endDate) return true; // no task end date — any assignment date is fine

    const taskEnd   = new Date(selectedTask.endDate); taskEnd.setHours(0, 0, 0, 0);
    const assignEnd = new Date(form.assignEndDate);   assignEnd.setHours(0, 0, 0, 0);

    if (assignEnd > taskEnd) {
      toast.error(
        `Assignment end date (${fmtDate(form.assignEndDate)}) cannot exceed the task end date ` +
        `(${fmtDate(selectedTask.endDate)}). ` +
        `Either extend the task's end date in "Add Task" first, or create a new task and re-assign.`,
        { duration: 8000 } as any
      );
      return false;
    }
    return true;
  };

  // ── Create new assignment ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.projectId || !form.taskId) { toast.error('Please select Project and Task'); return; }
    if (!empName.trim())                  { toast.error('Please enter Employee Name'); return; }
    if (!form.assignStartDate || !form.assignEndDate) { toast.error('Please enter Start and End Dates'); return; }
    if (!validateAssignEndDate()) return;

    if (isNewEmp) {
      if (!empNo.trim() || !empDesignation.trim() || !empEmail.trim()) {
        toast.error('Employee No, Designation and Email are mandatory for new employees'); return;
      }
      try {
        await employeeConfigApi.addOne({ employeeNo: empNo.trim(), name: empName.trim(), designation: empDesignation.trim(), email: empEmail.trim() });
        employeeConfigApi.getAll().then(setEmpOptions).catch(() => {});
        toast.success(`New employee "${empName}" saved to the system`);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to save new employee'); return;
      }
    }

    setLoading(true);
    try {
      await assignmentsApi.create({
        taskId:               form.taskId,
        employeeNo:           empNo      || undefined,
        employeeName:         empName    || undefined,
        assignStartDate:      form.assignStartDate,
        assignEndDate:        form.assignEndDate,
        allocationPercentage: form.allocationPercentage,
        roleOnTask:           form.roleOnTask || undefined,
      });
      toast.success('Task assigned successfully');
      onDataChanged?.();
      cancelForm();
      loadAssignments();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Failed to assign task');
    } finally { setLoading(false); }
  };

  // ── Update assignment end date ────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!form.assignEndDate) { toast.error('End Date is required'); return; }
    if (!validateAssignEndDate()) return;

    setLoading(true);
    try {
      await assignmentsApi.update(editAsgn.id, {
        assignEndDate:        form.assignEndDate,
        allocationPercentage: form.allocationPercentage,
        roleOnTask:           form.roleOnTask || undefined,
      });
      toast.success('Assignment updated');
      onDataChanged?.();
      cancelForm();
      loadAssignments();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Failed to update assignment');
    } finally { setLoading(false); }
  };

  const openEdit = (asgn: any) => {
    setEditAsgn(asgn);
    // Pre-load tasks for the project so validation has task.endDate
    if (asgn.task?.project?.id || asgn.task?.projectId) {
      tasksApi.getAll(asgn.task?.project?.id || asgn.task?.projectId)
        .then(setTasks).catch(() => {});
    }
    setForm({
      projectId:            asgn.task?.project?.id || asgn.task?.projectId || '',
      taskId:               asgn.taskId,
      assignStartDate:      asgn.assignStartDate ? asgn.assignStartDate.slice(0, 10) : '',
      assignEndDate:        asgn.assignEndDate    ? asgn.assignEndDate.slice(0, 10)   : '',
      allocationPercentage: asgn.allocationPercentage || 100,
      roleOnTask:           asgn.roleOnTask || '',
    });
    setView('edit');
  };

  // Shared styles
  const lbl  = 'block text-sm font-medium text-slate-700 mb-1';
  const inp  = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50';
  const inpR = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-600 cursor-not-allowed';
  const inpM = 'w-full border border-amber-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50';

  // Filtered assignments
  const displayedAssignments = filterProject
    ? assignments.filter(a => a.task?.project?.id === filterProject)
    : assignments;

  // ── Employee combo (shared between new/edit forms) ────────────────────────────
  const renderEmpCombo = (readOnly = false) => (
    <div className="md:col-span-2">
      <label className={lbl}>
        Employee Name <span className="text-red-500">*</span>
        {isNewEmp && (
          <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
            <UserPlus className="w-3 h-3 inline mr-1" />New employee — fill details below
          </span>
        )}
      </label>
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <input type="text" value={empName}
            onChange={e => { if (!readOnly) { setEmpName(e.target.value); setShowDropdown(true); setIsNewEmp(false); setEmpNo(''); setEmpDesignation(''); setEmpEmail(''); } }}
            onFocus={() => !readOnly && setShowDropdown(true)}
            onBlur={readOnly ? undefined : handleNameBlur}
            placeholder={readOnly ? '' : 'Type or select employee name...'}
            readOnly={readOnly}
            className={(readOnly ? inpR : inp) + ' pr-16'}
          />
          {!readOnly && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {empName && (
                <button type="button" onMouseDown={e => { e.preventDefault(); clearEmployee(); }} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button type="button" onMouseDown={e => { e.preventDefault(); setShowDropdown(v => !v); }} className="p-1 text-slate-400 hover:text-indigo-600">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        {showDropdown && !readOnly && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {filteredEmps.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 italic">No match — type a name and fill details below to add new employee</div>
            ) : filteredEmps.map((emp, i) => (
              <button key={emp.employeeNo + i} type="button"
                onMouseDown={e => { e.preventDefault(); selectEmployee(emp); }}
                className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0">
                <div className="text-sm font-medium text-slate-800">{emp.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{emp.employeeNo}{emp.designation ? ` · ${emp.designation}` : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── VIEW: List (landing page) ─────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400 mb-1">Management › <span className="text-slate-600">Assign Task</span></div>
          <h1 className="text-2xl font-semibold text-slate-900">Assign Task</h1>
          <p className="text-slate-500 text-sm mt-1">View and manage task assignments</p>
        </div>
        <button onClick={() => { cancelForm(); setView('new'); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-200 transition-colors">
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filter by project:</span>
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{displayedAssignments.length} assignment{displayedAssignments.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {listLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : displayedAssignments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-6 h-6 text-slate-400" />
          </div>
          <div className="text-slate-700 font-medium mb-1">No assignments yet</div>
          <div className="text-slate-400 text-sm mb-4">{filterProject ? 'No assignments for this project.' : 'Assign tasks to employees to get started.'}</div>
          <button onClick={() => { cancelForm(); setView('new'); }}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> New Assignment
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Task</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Project</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Period</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Alloc</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {displayedAssignments.map(asgn => {
                const sm    = STATUS_META[asgn.status] || STATUS_META.ACTIVE;
                const expd  = isExpired(asgn.assignEndDate);
                const taskExpd = isExpired(asgn.task?.endDate);
                return (
                  <tr key={asgn.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{asgn.employeeName || asgn.employee?.name || '—'}</div>
                      <div className="text-xs text-slate-400">{asgn.employeeNo || asgn.employee?.employeeId}</div>
                      {asgn.task?.project?.name && (
                        <div className="text-xs text-indigo-500 mt-0.5">{asgn.task.project.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{asgn.task?.name || '—'}</div>
                      {taskExpd && (
                        <div className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> Task expired {fmtDate(asgn.task?.endDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {asgn.task?.project?.code || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(asgn.assignStartDate)} → {' '}
                        <span className={expd ? 'text-red-500 font-medium' : ''}>
                          {expd && '⚠ '}{fmtDate(asgn.assignEndDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{asgn.allocationPercentage || 100}%</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: sm.bg, color: sm.text }}>
                        {asgn.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(asgn)}
                        className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                        title="Edit / extend assignment">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── VIEW: New Assignment ──────────────────────────────────────────────────────
  if (view === 'new') return (
    <div className="p-6 max-w-2xl">
      <button onClick={cancelForm} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Assignments
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400 mb-1">Management › Assign Task › <span className="text-slate-600">New Assignment</span></div>
          <h1 className="text-2xl font-semibold text-slate-900">New Assignment</h1>
        </div>
      </div>

      {/* Task end-date info banner when task is selected */}
      {form.taskId && (() => {
        const task = tasks.find(t => t.id === form.taskId);
        if (!task) return null;
        const expired = isExpired(task.endDate);
        if (expired) return (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">This task's end date has passed ({fmtDate(task.endDate)})</p>
              <p className="text-sm text-red-700 mt-0.5">
                Employees cannot log hours. Go to <strong>Add Task</strong> to extend the end date, or create a new task and assign that instead.
              </p>
            </div>
          </div>
        );
        if (task.endDate) return (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-5">
            <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Task ends on <strong>{fmtDate(task.endDate)}</strong>. Your assignment end date cannot exceed this date.
              To assign beyond this date, first extend the task end date in <strong>Add Task</strong>.
            </p>
          </div>
        );
        return null;
      })()}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={lbl}>Project <span className="text-red-500">*</span></label>
            <select value={form.projectId} onChange={e => set('projectId', e.target.value)} className={inp}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Task <span className="text-red-500">*</span></label>
            <select value={form.taskId} onChange={e => set('taskId', e.target.value)} disabled={!form.projectId} className={inp + ' disabled:opacity-50'}>
              <option value="">Select task...</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}{t.endDate ? ` (ends ${fmtDate(t.endDate)})` : ''}</option>)}
            </select>
          </div>

          {renderEmpCombo(false)}

          <div>
            <label className={lbl}>Employee No {isNewEmp && <span className="text-red-500">*</span>}</label>
            <input type="text" value={empNo} onChange={e => isNewEmp && setEmpNo(e.target.value)}
              readOnly={!isNewEmp} placeholder={isNewEmp ? 'e.g. VT001' : 'Auto-populated'}
              className={isNewEmp ? inpM : inpR} />
          </div>
          <div>
            <label className={lbl}>Designation {isNewEmp && <span className="text-red-500">*</span>}</label>
            <input type="text" value={empDesignation} onChange={e => isNewEmp && setEmpDesignation(e.target.value)}
              readOnly={!isNewEmp} placeholder={isNewEmp ? 'e.g. Senior Professional' : 'Auto-populated'}
              className={isNewEmp ? inpM : inpR} />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Email ID {isNewEmp && <span className="text-red-500">*</span>}</label>
            <input type="email" value={empEmail} onChange={e => isNewEmp && setEmpEmail(e.target.value)}
              readOnly={!isNewEmp} placeholder={isNewEmp ? 'e.g. name@vthink.co.in' : 'Auto-populated'}
              className={isNewEmp ? inpM : inpR} />
          </div>

          <div>
            <label className={lbl}>Start Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.assignStartDate} onChange={e => set('assignStartDate', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>
              End Date <span className="text-red-500">*</span>
              {form.taskId && tasks.find(t => t.id === form.taskId)?.endDate && (
                <span className="ml-2 text-xs font-normal text-indigo-500">
                  ← max: {fmtDate(tasks.find(t => t.id === form.taskId)?.endDate)}
                </span>
              )}
            </label>
            <input type="date" value={form.assignEndDate} onChange={e => set('assignEndDate', e.target.value)} className={inp}
              max={tasks.find(t => t.id === form.taskId)?.endDate?.slice(0, 10) || undefined} />
          </div>

          <div>
            <label className={lbl}>Allocation % <span className="text-red-500">*</span></label>
            <input type="number" min={0} max={100} value={form.allocationPercentage} onChange={e => set('allocationPercentage', Number(e.target.value))} className={inp} />
            <div className="mt-1.5 bg-slate-200 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${form.allocationPercentage}%` }} />
            </div>
          </div>
          <div>
            <label className={lbl}>Role on Task</label>
            <input value={form.roleOnTask} onChange={e => set('roleOnTask', e.target.value)} placeholder="e.g. Lead Developer" className={inp} />
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button onClick={handleSubmit} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Assigning...' : 'Assign Task'}
          </button>
          <button onClick={() => { setForm({ projectId: '', taskId: '', assignStartDate: '', assignEndDate: '', allocationPercentage: 100, roleOnTask: '' }); clearEmployee(); }}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors">
            Reset
          </button>
          <button onClick={cancelForm} className="ml-auto border border-slate-200 hover:bg-slate-50 text-slate-500 px-5 py-2 rounded-lg text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // ── VIEW: Edit Assignment ─────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl">
      <button onClick={cancelForm} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Assignments
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400 mb-1">Management › Assign Task › <span className="text-slate-600">Edit Assignment</span></div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit Assignment</h1>
          <p className="text-slate-500 text-sm mt-1">
            <strong>{editAsgn?.employeeName || editAsgn?.employee?.name}</strong> → <strong>{editAsgn?.task?.name}</strong>
          </p>
        </div>
      </div>

      {/* Task end-date constraint warning on edit */}
      {(() => {
        const task = tasks.find(t => t.id === form.taskId) || editAsgn?.task;
        if (!task?.endDate) return null;
        const expired = isExpired(task.endDate);
        return (
          <div className={`flex items-start gap-3 p-4 rounded-xl mb-5 ${expired ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${expired ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${expired ? 'text-red-800' : 'text-amber-800'}`}>
                Task end date: <strong>{fmtDate(task.endDate)}</strong>{expired ? ' — EXPIRED' : ''}
              </p>
              <p className={`text-sm mt-0.5 ${expired ? 'text-red-700' : 'text-amber-700'}`}>
                {expired
                  ? 'The task has expired. Go to Add Task to extend the task end date first, then update this assignment.'
                  : 'Assignment end date cannot exceed the task end date. To extend further, first update the task end date in Add Task.'}
              </p>
            </div>
          </div>
        );
      })()}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Read-only context fields */}
          <div>
            <label className={lbl}>Project</label>
            <input readOnly value={editAsgn?.task?.project?.code + ' — ' + editAsgn?.task?.project?.name || ''} className={inpR} />
          </div>
          <div>
            <label className={lbl}>Task</label>
            <input readOnly value={editAsgn?.task?.name || ''} className={inpR} />
          </div>

          {renderEmpCombo(true)}

          <div>
            <label className={lbl}>Start Date</label>
            <input type="date" readOnly value={form.assignStartDate} className={inpR} />
          </div>
          <div>
            <label className={lbl}>
              End Date <span className="text-red-500">*</span>
              {(() => {
                const task = tasks.find(t => t.id === form.taskId) || editAsgn?.task;
                if (task?.endDate) return (
                  <span className="ml-2 text-xs font-normal text-indigo-500">← extend here if needed (max: {fmtDate(task.endDate)})</span>
                );
                return null;
              })()}
            </label>
            <input type="date" value={form.assignEndDate} onChange={e => set('assignEndDate', e.target.value)} className={inp}
              max={(tasks.find(t => t.id === form.taskId) || editAsgn?.task)?.endDate?.slice(0, 10) || undefined} />
          </div>

          <div>
            <label className={lbl}>Allocation %</label>
            <input type="number" min={0} max={100} value={form.allocationPercentage} onChange={e => set('allocationPercentage', Number(e.target.value))} className={inp} />
            <div className="mt-1.5 bg-slate-200 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${form.allocationPercentage}%` }} />
            </div>
          </div>
          <div>
            <label className={lbl}>Role on Task</label>
            <input value={form.roleOnTask} onChange={e => set('roleOnTask', e.target.value)} placeholder="e.g. Lead Developer" className={inp} />
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button onClick={handleSaveEdit} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={cancelForm} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
