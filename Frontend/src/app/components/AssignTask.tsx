import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, X, UserPlus } from 'lucide-react';
import { assignmentsApi, projectsApi, tasksApi } from '../../services/api';
import { employeeConfigApi } from '../../services/api';
import { toast } from './ui/Toast';

interface EmpOption { id?: string; employeeNo: string; name: string; designation: string; email: string; }

export default function AssignTask({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {
  const [projects,   setProjects]   = useState<any[]>([]);
  const [tasks,      setTasks]      = useState<any[]>([]);
  const [empOptions, setEmpOptions] = useState<EmpOption[]>([]);
  const [form, setForm] = useState({ projectId:'', taskId:'', assignStartDate:'', assignEndDate:'', allocationPercentage:100, roleOnTask:'' });

  const [empName,        setEmpName]        = useState('');
  const [empNo,          setEmpNo]          = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empEmail,       setEmpEmail]       = useState('');
  const [isNewEmp,       setIsNewEmp]       = useState(false);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [filteredEmps,   setFilteredEmps]   = useState<EmpOption[]>([]);
  const [loading,        setLoading]        = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(()=>{});
    employeeConfigApi.getAll().then(setEmpOptions).catch(()=>{});
  }, []);

  useEffect(() => {
    if (form.projectId) { tasksApi.getAll(form.projectId).then(setTasks).catch(()=>{}); }
    else { setTasks([]); }
    setForm(f => ({...f, taskId:''}));
  }, [form.projectId]);

  useEffect(() => {
    if (!empName.trim()) { setFilteredEmps(empOptions.slice(0,50)); return; }
    const q = empName.toLowerCase();
    setFilteredEmps(empOptions.filter(e => e.name.toLowerCase().includes(q) || e.employeeNo.toLowerCase().includes(q)).slice(0,50));
  }, [empName, empOptions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (k: string, v: any) => setForm(f => ({...f,[k]:v}));

  const selectEmployee = (emp: EmpOption) => { setEmpName(emp.name); setEmpNo(emp.employeeNo); setEmpDesignation(emp.designation||''); setEmpEmail(emp.email||''); setIsNewEmp(false); setShowDropdown(false); };
  const clearEmployee  = () => { setEmpName(''); setEmpNo(''); setEmpDesignation(''); setEmpEmail(''); setIsNewEmp(false); };

  const handleNameBlur = async () => {
    if (!empName.trim()) return;
    const match = empOptions.find(e => e.name.toLowerCase() === empName.trim().toLowerCase());
    if (match) { selectEmployee(match); }
    else {
      try {
        const found = await employeeConfigApi.lookupByName(empName.trim());
        if (found) { selectEmployee(found); employeeConfigApi.getAll().then(setEmpOptions).catch(()=>{}); }
        else { setIsNewEmp(true); setEmpNo(''); setEmpDesignation(''); setEmpEmail(''); }
      } catch { setIsNewEmp(true); }
    }
    setShowDropdown(false);
  };

  const handleSubmit = async () => {
    if (!form.projectId || !form.taskId) { toast.error('Please select Project and Task'); return; }
    if (!empName.trim()) { toast.error('Please enter Employee Name'); return; }
    if (!form.assignStartDate || !form.assignEndDate) { toast.error('Please enter Start and End Dates'); return; }
    if (isNewEmp) {
      if (!empNo.trim() || !empDesignation.trim() || !empEmail.trim()) { toast.error('Employee No, Designation and Email are mandatory for new employees'); return; }
      try {
        await employeeConfigApi.addOne({ employeeNo:empNo.trim(), name:empName.trim(), designation:empDesignation.trim(), email:empEmail.trim() });
        employeeConfigApi.getAll().then(setEmpOptions).catch(()=>{});
        toast.success(`New employee "${empName}" saved`);
      } catch (e: any) { toast.error(e?.response?.data?.message||'Failed to save new employee'); return; }
    }
    setLoading(true);
    try {
      await assignmentsApi.create({ taskId:form.taskId, employeeNo:empNo||undefined, employeeName:empName||undefined, assignStartDate:form.assignStartDate, assignEndDate:form.assignEndDate, allocationPercentage:form.allocationPercentage, roleOnTask:form.roleOnTask||undefined });
      toast.success('Task assigned successfully');
      onDataChanged?.();
      setForm({projectId:'',taskId:'',assignStartDate:'',assignEndDate:'',allocationPercentage:100,roleOnTask:''});
      clearEmployee();
    } catch (e: any) { toast.error(e?.response?.data?.error?.message||e?.response?.data?.message||'Failed to assign task'); }
    finally { setLoading(false); }
  };

  // OMS-aligned styles
  const inp  = { width:'100%', border:'1px solid var(--border-mid)', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', background:'#fff', fontFamily:"'Inter',system-ui,sans-serif" } as React.CSSProperties;
  const inpR = { ...inp, background:'var(--border)', color:'var(--text-2)', cursor:'not-allowed' } as React.CSSProperties;
  const inpM = { ...inp, border:'1px solid #F59E0B', background:'#FFFBEB' } as React.CSSProperties;

  return (
    <div style={{ padding:24, background:'var(--page-bg)', minHeight:'100%', maxWidth:680 }}>
      {/* Back */}
      <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', marginBottom:16 }}>
        <ArrowLeft style={{ width:15, height:15 }} /> Back to Overview
      </button>

      {/* Page header */}
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:6 }}>Management › <span style={{ color:'var(--text-2)', fontWeight:500 }}>Assign Task</span></div>
      <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:'0 0 4px' }}>Assign Task</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 20px' }}>Assign a task to an employee with allocation details</p>

      {/* Form card */}
      <div className="card" style={{ padding:24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* Project */}
          <div>
            <label className="label">Project <span style={{ color:'#DC2626' }}>*</span></label>
            <select value={form.projectId} onChange={e => set('projectId',e.target.value)} style={inp}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>

          {/* Task */}
          <div>
            <label className="label">Task <span style={{ color:'#DC2626' }}>*</span></label>
            <select value={form.taskId} onChange={e => set('taskId',e.target.value)} disabled={!form.projectId} style={{ ...inp, opacity:form.projectId?1:0.5 }}>
              <option value="">Select task...</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Employee name combo */}
          <div style={{ gridColumn:'1/-1' }}>
            <label className="label">
              Employee Name <span style={{ color:'#DC2626' }}>*</span>
              {isNewEmp && (
                <span style={{ marginLeft:8, fontSize:11, fontWeight:600, color:'#B45309', background:'#FFFBEB', border:'1px solid #FDE68A', padding:'2px 8px', borderRadius:99, display:'inline-flex', alignItems:'center', gap:4 }}>
                  <UserPlus style={{ width:11, height:11 }} /> New employee — fill details below
                </span>
              )}
            </label>
            <div style={{ position:'relative' }} ref={dropdownRef}>
              <div style={{ position:'relative' }}>
                <input type="text" value={empName}
                  onChange={e => { setEmpName(e.target.value); setShowDropdown(true); setIsNewEmp(false); setEmpNo(''); setEmpDesignation(''); setEmpEmail(''); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={handleNameBlur}
                  placeholder="Type or select employee name..."
                  style={{ ...inp, paddingRight:64 }} />
                <div style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', display:'flex', alignItems:'center', gap:4 }}>
                  {empName && (
                    <button type="button" onMouseDown={e => { e.preventDefault(); clearEmployee(); }}
                      style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-3)' }}>
                      <X style={{ width:13, height:13 }} />
                    </button>
                  )}
                  <button type="button" onMouseDown={e => { e.preventDefault(); setShowDropdown(v => !v); }}
                    style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-3)' }}>
                    <ChevronDown style={{ width:15, height:15 }} />
                  </button>
                </div>
              </div>
              {showDropdown && (
                <div style={{ position:'absolute', zIndex:50, width:'100%', marginTop:4, background:'#fff', border:'1px solid var(--border-mid)', borderRadius:8, boxShadow:'var(--shadow-card-hover)', maxHeight:220, overflowY:'auto' }}>
                  {filteredEmps.length === 0 ? (
                    <div style={{ padding:'12px 16px', fontSize:12, color:'var(--text-3)', fontStyle:'italic' }}>No match — type a name and fill details below to add new employee</div>
                  ) : filteredEmps.map((emp, i) => (
                    <button key={emp.employeeNo+i} type="button"
                      onMouseDown={e => { e.preventDefault(); selectEmployee(emp); }}
                      style={{ width:'100%', textAlign:'left', padding:'10px 16px', border:'none', borderBottom:'1px solid var(--border)', background:'none', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--primary-tint)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)' }}>{emp.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{emp.employeeNo}{emp.designation?` · ${emp.designation}`:''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Employee No */}
          <div>
            <label className="label">Employee No {isNewEmp && <span style={{ color:'#DC2626' }}>*</span>}</label>
            <input type="text" value={empNo} onChange={e => isNewEmp && setEmpNo(e.target.value)} readOnly={!isNewEmp}
              placeholder={isNewEmp?'e.g. VT001':'Auto-populated'} style={isNewEmp?inpM:inpR} />
          </div>

          {/* Designation */}
          <div>
            <label className="label">Designation {isNewEmp && <span style={{ color:'#DC2626' }}>*</span>}</label>
            <input type="text" value={empDesignation} onChange={e => isNewEmp && setEmpDesignation(e.target.value)} readOnly={!isNewEmp}
              placeholder={isNewEmp?'e.g. Senior Developer':'Auto-populated'} style={isNewEmp?inpM:inpR} />
          </div>

          {/* Email */}
          <div style={{ gridColumn:'1/-1' }}>
            <label className="label">Email ID {isNewEmp && <span style={{ color:'#DC2626' }}>*</span>}</label>
            <input type="email" value={empEmail} onChange={e => isNewEmp && setEmpEmail(e.target.value)} readOnly={!isNewEmp}
              placeholder={isNewEmp?'e.g. name@vthink.co.in':'Auto-populated'} style={isNewEmp?inpM:inpR} />
          </div>

          {/* Dates */}
          <div>
            <label className="label">Start Date <span style={{ color:'#DC2626' }}>*</span></label>
            <input type="date" value={form.assignStartDate} onChange={e => set('assignStartDate',e.target.value)} style={inp} />
          </div>
          <div>
            <label className="label">End Date <span style={{ color:'#DC2626' }}>*</span></label>
            <input type="date" value={form.assignEndDate} onChange={e => set('assignEndDate',e.target.value)} style={inp} />
          </div>

          {/* Allocation */}
          <div>
            <label className="label">Allocation % <span style={{ color:'#DC2626' }}>*</span></label>
            <input type="number" min={0} max={100} value={form.allocationPercentage} onChange={e => set('allocationPercentage',Number(e.target.value))} style={inp} />
            <div className="progress-bar" style={{ marginTop:8 }}>
              <div className="progress-fill" style={{ width:`${form.allocationPercentage}%` }} />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="label">Role on Task</label>
            <input value={form.roleOnTask} onChange={e => set('roleOnTask',e.target.value)} placeholder="e.g. Lead Developer" style={inp} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? 'Assigning...' : 'Assign Task'}
          </button>
          <button onClick={() => { setForm({projectId:'',taskId:'',assignStartDate:'',assignEndDate:'',allocationPercentage:100,roleOnTask:''}); clearEmployee(); }} className="btn-secondary">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
