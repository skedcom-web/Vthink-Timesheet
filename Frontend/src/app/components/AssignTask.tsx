import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, X, UserPlus } from 'lucide-react';
import { assignmentsApi, projectsApi, tasksApi } from '../../services/api';
import { employeeConfigApi } from '../../services/api';
import { toast } from './ui/Toast';

interface EmpOption { id?: string; employeeNo: string; name: string; designation: string; email: string; }

export default function AssignTask({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {
  const [projects,    setProjects]    = useState<any[]>([]);
  const [tasks,       setTasks]       = useState<any[]>([]);
  const [empOptions,  setEmpOptions]  = useState<EmpOption[]>([]);
  const [form, setForm] = useState({
    projectId: '', taskId: '',
    assignStartDate: '', assignEndDate: '',
    allocationPercentage: 100, roleOnTask: '',
  });

  // Employee name combo state
  const [empName,        setEmpName]        = useState('');
  const [empNo,          setEmpNo]          = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empEmail,       setEmpEmail]       = useState('');
  const [isNewEmp,       setIsNewEmp]       = useState(false);  // true = name typed manually, not found in list
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [filteredEmps,   setFilteredEmps]   = useState<EmpOption[]>([]);
  const [loading,        setLoading]        = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(() => {});
    employeeConfigApi.getAll().then(setEmpOptions).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.projectId) {
      tasksApi.getAll(form.projectId).then(setTasks).catch(() => {});
    } else { setTasks([]); }
    setForm(f => ({ ...f, taskId: '' }));
  }, [form.projectId]);

  // Filter dropdown as user types
  useEffect(() => {
    if (!empName.trim()) { setFilteredEmps(empOptions.slice(0, 50)); return; }
    const q = empName.toLowerCase();
    setFilteredEmps(empOptions.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.employeeNo.toLowerCase().includes(q)
    ).slice(0, 50));
  }, [empName, empOptions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // When user selects from dropdown
  const selectEmployee = (emp: EmpOption) => {
    setEmpName(emp.name);
    setEmpNo(emp.employeeNo);
    setEmpDesignation(emp.designation || '');
    setEmpEmail(emp.email || '');
    setIsNewEmp(false);
    setShowDropdown(false);
  };

  // When user clears the name field
  const clearEmployee = () => {
    setEmpName(''); setEmpNo(''); setEmpDesignation(''); setEmpEmail('');
    setIsNewEmp(false);
  };

  // When user finishes typing a name (on blur) — check if it's in the list
  const handleNameBlur = async () => {
    if (!empName.trim()) return;
    const match = empOptions.find(e => e.name.toLowerCase() === empName.trim().toLowerCase());
    if (match) {
      selectEmployee(match);
    } else {
      // New name — server lookup as fallback, then mark as new
      try {
        const found = await employeeConfigApi.lookupByName(empName.trim());
        if (found) {
          selectEmployee(found);
          // Refresh local options list
          employeeConfigApi.getAll().then(setEmpOptions).catch(() => {});
        } else {
          setIsNewEmp(true);
          setEmpNo(''); setEmpDesignation(''); setEmpEmail('');
        }
      } catch {
        setIsNewEmp(true);
      }
    }
    setShowDropdown(false);
  };

  const handleSubmit = async () => {
    if (!form.projectId || !form.taskId) { toast.error('Please select Project and Task'); return; }
    if (!empName.trim())                  { toast.error('Please enter Employee Name'); return; }
    if (!form.assignStartDate || !form.assignEndDate) { toast.error('Please enter Start and End Dates'); return; }

    // If new employee, validate mandatory fields and save to DB first
    if (isNewEmp) {
      if (!empNo.trim() || !empDesignation.trim() || !empEmail.trim()) {
        toast.error('Employee No, Designation and Email are mandatory for new employees');
        return;
      }
      try {
        const saved = await employeeConfigApi.addOne({
          employeeNo:  empNo.trim(),
          name:        empName.trim(),
          designation: empDesignation.trim(),
          email:       empEmail.trim(),
        });
        // Refresh dropdown list so next manager sees this employee
        employeeConfigApi.getAll().then(setEmpOptions).catch(() => {});
        toast.success(`New employee "${empName}" saved to the system`);
        // Use saved record's id for assignment if needed
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to save new employee');
        return;
      }
    }

    setLoading(true);
    try {
      // Send only DTO-valid fields — projectId is frontend-only for task filtering
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
      // Reset form
      setForm({ projectId: '', taskId: '', assignStartDate: '', assignEndDate: '', allocationPercentage: 100, roleOnTask: '' });
      clearEmployee();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Failed to assign task');
    } finally { setLoading(false); }
  };

  const lbl  = 'block text-sm font-medium text-slate-700 mb-1';
  const inp  = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50';
  const inpR = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-600 cursor-not-allowed';
  const inpM = 'w-full border border-amber-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50';

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Assign Task</h1>
      <p className="text-slate-500 text-sm mb-6">Assign a task to an employee with allocation details</p>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Project */}
          <div>
            <label className={lbl}>Project <span className="text-red-500">*</span></label>
            <select value={form.projectId} onChange={e => set('projectId', e.target.value)} className={inp}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>

          {/* Task */}
          <div>
            <label className={lbl}>Task <span className="text-red-500">*</span></label>
            <select value={form.taskId} onChange={e => set('taskId', e.target.value)} disabled={!form.projectId} className={inp + ' disabled:opacity-50'}>
              <option value="">Select task...</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* ── Employee Name — combo: text + dropdown ── */}
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
                <input
                  type="text"
                  value={empName}
                  onChange={e => { setEmpName(e.target.value); setShowDropdown(true); setIsNewEmp(false); setEmpNo(''); setEmpDesignation(''); setEmpEmail(''); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={handleNameBlur}
                  placeholder="Type or select employee name..."
                  className={inp + ' pr-16'}
                />
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
              </div>

              {/* Dropdown list */}
              {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {filteredEmps.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400 italic">
                      No match — type a name and fill details below to add new employee
                    </div>
                  ) : (
                    filteredEmps.map((emp, i) => (
                      <button
                        key={emp.employeeNo + i}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); selectEmployee(emp); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div className="text-sm font-medium text-slate-800">{emp.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {emp.employeeNo}{emp.designation ? ` · ${emp.designation}` : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Employee No — auto-populated, editable only for new */}
          <div>
            <label className={lbl}>
              Employee No {isNewEmp && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={empNo}
              onChange={e => isNewEmp && setEmpNo(e.target.value)}
              readOnly={!isNewEmp}
              placeholder={isNewEmp ? 'e.g. VT001' : 'Auto-populated'}
              className={isNewEmp ? inpM : inpR}
            />
          </div>

          {/* Designation — auto-populated, editable only for new */}
          <div>
            <label className={lbl}>
              Designation {isNewEmp && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={empDesignation}
              onChange={e => isNewEmp && setEmpDesignation(e.target.value)}
              readOnly={!isNewEmp}
              placeholder={isNewEmp ? 'e.g. Senior Professional' : 'Auto-populated'}
              className={isNewEmp ? inpM : inpR}
            />
          </div>

          {/* Email — auto-populated, editable only for new */}
          <div className="md:col-span-2">
            <label className={lbl}>
              Email ID {isNewEmp && <span className="text-red-500">*</span>}
            </label>
            <input
              type="email"
              value={empEmail}
              onChange={e => isNewEmp && setEmpEmail(e.target.value)}
              readOnly={!isNewEmp}
              placeholder={isNewEmp ? 'e.g. name@vthink.co.in' : 'Auto-populated'}
              className={isNewEmp ? inpM : inpR}
            />
          </div>

          {/* Dates */}
          <div>
            <label className={lbl}>Start Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.assignStartDate} onChange={e => set('assignStartDate', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>End Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.assignEndDate} onChange={e => set('assignEndDate', e.target.value)} className={inp} />
          </div>

          {/* Allocation */}
          <div>
            <label className={lbl}>Allocation % <span className="text-red-500">*</span></label>
            <input type="number" min={0} max={100} value={form.allocationPercentage} onChange={e => set('allocationPercentage', Number(e.target.value))} className={inp} />
            <div className="mt-1.5 bg-slate-200 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${form.allocationPercentage}%` }} />
            </div>
          </div>

          {/* Role on task */}
          <div>
            <label className={lbl}>Role on Task</label>
            <input value={form.roleOnTask} onChange={e => set('roleOnTask', e.target.value)} placeholder="e.g. Lead Developer" className={inp} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Assigning...' : 'Assign Task'}
          </button>
          <button
            onClick={() => { setForm({ projectId: '', taskId: '', assignStartDate: '', assignEndDate: '', allocationPercentage: 100, roleOnTask: '' }); clearEmployee(); }}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
