import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, RotateCcw, Pencil, X,
  CheckCircle2, PauseCircle, XCircle, ChevronDown, Search, Check,
  AlertTriangle, Timer, CalendarX, Filter,
} from 'lucide-react';
import { tasksApi, projectsApi, projectConfigApi } from '../../services/api';
import { toast } from './ui/Toast';

// ── Constants ─────────────────────────────────────────────────────────────────
const TASK_TYPES    = ['DEVELOPMENT','DESIGN','TESTING','MANAGEMENT','SUPPORT','DOCUMENTATION','MEETING'];
const PRIORITIES    = ['LOW','MEDIUM','HIGH','CRITICAL'];
const TASK_STATUSES = ['ACTIVE','ON_HOLD','COMPLETED','CANCELLED'];

const LS_KEY = 'vthink_task_name_pool';
const DEFAULT_TASK_NAMES = [
  'Sprint Planning','Backlog Grooming','UI Design Review','Database Schema Design',
  'API Integration','Code Review','Unit Testing','Regression Testing','Bug Fix',
  'Deployment Setup','Documentation','Client Meeting','Daily Standup',
  'Performance Optimisation','Security Audit',
];
function loadTaskNames(): string[] {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [...DEFAULT_TASK_NAMES];
}
function saveTaskNames(names: string[]) { localStorage.setItem(LS_KEY, JSON.stringify(names)); }

const STATUS_META: Record<string,{label:string;bg:string;text:string;border:string;Icon:any}> = {
  ACTIVE:    {label:'Active',    bg:'#ECFDF5',text:'#065F46',border:'#A7F3D0',Icon:CheckCircle2},
  ON_HOLD:   {label:'On Hold',   bg:'#FFFBEB',text:'#B45309',border:'#FDE68A',Icon:PauseCircle },
  COMPLETED: {label:'Completed', bg:'#EFF6FF',text:'#1D4ED8',border:'#BFDBFE',Icon:CheckCircle2},
  CANCELLED: {label:'Cancelled', bg:'#FEF2F2',text:'#991B1B',border:'#FECACA',Icon:XCircle     },
};
const CREATION_STATUS_META: Record<string,{label:string;bg:string;text:string;border:string;Icon:any}> = {
  ON_TIME_CREATION: {label:'On Time', bg:'#ECFDF5',text:'#065F46',border:'#A7F3D0',Icon:CheckCircle2},
  DELAYED_CREATION: {label:'Delayed', bg:'#FEF2F2',text:'#991B1B',border:'#FECACA',Icon:AlertTriangle},
  NO_END_DATE:      {label:'No End Date',bg:'#FFFBEB',text:'#B45309',border:'#FDE68A',Icon:CalendarX},
};
const PRIORITY_META: Record<string,{bg:string;text:string}> = {
  LOW:{bg:'#ECFDF5',text:'#059669'},MEDIUM:{bg:'#FFFBEB',text:'#B45309'},
  HIGH:{bg:'#FEF2F2',text:'#991B1B'},CRITICAL:{bg:'#FDF4FF',text:'#7E22CE'},
};
const TYPE_LABELS: Record<string,string> = {
  DEVELOPMENT:'Development',DESIGN:'Design',TESTING:'Testing',MANAGEMENT:'Management',
  SUPPORT:'Support',DOCUMENTATION:'Documentation',MEETING:'Meeting',
};
function fmtDate(iso?: string|null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
const emptyForm = {
  projectId:'',name:'',description:'',taskType:'DEVELOPMENT',
  priority:'MEDIUM',startDate:'',endDate:'',billable:true,status:'ACTIVE',
};

// ── Task Name Combo (defined outside to avoid remount on keystroke) ─────────────
function TaskNameCombo({value,onChange,taskNamePool,onAddName,disabled=false}:{
  value:string;onChange:(v:string)=>void;taskNamePool:string[];onAddName:(n:string)=>void;disabled?:boolean;
}) {
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const wrapRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(wrapRef.current&&!wrapRef.current.contains(e.target as Node))setOpen(false);};
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);
  },[]);
  const filtered=taskNamePool.filter(n=>n.toLowerCase().includes(search.toLowerCase()));
  const isNew=search.trim()!==''&&!taskNamePool.some(n=>n.toLowerCase()===search.trim().toLowerCase());
  const selectOption=(name:string)=>{onChange(name);setSearch('');setOpen(false);};
  const addNew=()=>{const t=search.trim();if(!t)return;onAddName(t);onChange(t);setSearch('');setOpen(false);};
  const base="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50";
  return (
    <div ref={wrapRef} className="relative">
      <div className={base+' flex items-center justify-between cursor-pointer gap-2 '+(disabled?'opacity-60 cursor-not-allowed':'')}
        onClick={()=>{if(!disabled){setOpen(o=>!o);setTimeout(()=>inputRef.current?.focus(),50);}}}>
        <span className={value?'text-slate-800':'text-slate-400'}>{value||'Select or type a task name...'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open?'rotate-180':''}`} />
      </div>
      {open&&!disabled&&(
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input ref={inputRef} value={search} onChange={e=>setSearch(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){isNew?addNew():(filtered[0]&&selectOption(filtered[0]));}if(e.key==='Escape')setOpen(false);}}
              placeholder="Search or type a new task name..." className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"/>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length===0&&!isNew&&<div className="px-4 py-3 text-sm text-slate-400 italic">No matches found</div>}
            {filtered.map(name=>(
              <button key={name} onClick={()=>selectOption(name)}
                className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                {value===name?<><Check className="w-3.5 h-3.5 text-indigo-600 shrink-0"/><span className="font-medium text-indigo-700">{name}</span></>
                  :<><span className="w-3.5 h-3.5 shrink-0"/><span className="text-slate-700">{name}</span></>}
              </button>
            ))}
            {isNew&&(
              <button onClick={addNew}
                className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors border-t border-indigo-100">
                <Plus className="w-3.5 h-3.5 shrink-0"/>
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
export default function AddTask({
  onBack,
  onDataChanged,
  refreshKey = 0,
}: {
  onBack: () => void;
  onDataChanged?: () => void;
  /** Incremented after admin uploads so project / task-name dropdowns refetch */
  refreshKey?: number;
}) {
  // ── View state: 'list' | 'new' | 'edit' ─────────────────────────────────────
  const [view,       setView]       = useState<'list'|'new'|'edit'>('list');
  const [projects,   setProjects]   = useState<any[]>([]);
  const [allTasks,   setAllTasks]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [listLoading,setListLoading]= useState(true);
  const [taskNamePool, setTaskNamePool] = useState<string[]>(loadTaskNames);
  const [filterProject, setFilterProject] = useState('');

  // Edit state
  const [editTask, setEditTask] = useState<any>(null);
  const [form,     setForm]     = useState({...emptyForm});

  // ── Load projects and all tasks on mount ─────────────────────────────────────
  useEffect(()=>{
    projectConfigApi.getAll()
      .then(configs=>{if(configs&&configs.length>0)setProjects(configs);else projectsApi.getAll().then(setProjects).catch(()=>{});})
      .catch(()=>projectsApi.getAll().then(setProjects).catch(()=>{}));
  },[refreshKey]);

  const loadTasks = () => {
    setListLoading(true);
    tasksApi.getAll(filterProject||undefined)
      .then(setAllTasks)
      .catch(()=>toast.error('Failed to load tasks'))
      .finally(()=>setListLoading(false));
  };

  useEffect(()=>{ loadTasks(); },[filterProject]);

  // ── Pre-load ALL uploaded task names on mount ─────────────────────────────────
  useEffect(()=>{
    projectConfigApi.getAllTaskNames()
      .then((names:string[])=>{
        if(names&&names.length>0){
          setTaskNamePool(prev=>{
            const merged=Array.from(new Set([...names,...prev]));
            saveTaskNames(merged);return merged;
          });
        }
      }).catch(()=>{});
  },[refreshKey]);

  // ── When project changes in form, also load that project's task names ─────────
  useEffect(()=>{
    if(!form.projectId)return;
    projectConfigApi.getTaskNames(form.projectId)
      .then((names:{id:string;name:string}[])=>{
        if(names&&names.length>0){
          const ns=names.map(n=>n.name);
          setTaskNamePool(prev=>{const merged=Array.from(new Set([...ns,...prev]));saveTaskNames(merged);return merged;});
        }
      }).catch(()=>{});
  },[form.projectId]);

  const set=(k:string,v:any)=>setForm(f=>({...f,[k]:v}));

  const handleAddTaskName=(name:string)=>{
    setTaskNamePool(prev=>{const merged=Array.from(new Set([name,...prev]));saveTaskNames(merged);return merged;});
    toast.success(`"${name}" saved — will appear in the dropdown next time`);
  };

  // ── Create new task ───────────────────────────────────────────────────────────
  const handleCreate=async()=>{
    if(!form.projectId||!form.name){toast.error('Project and Task Name are required');return;}
    setLoading(true);
    try{
      await tasksApi.create({
        projectId:form.projectId,name:form.name,description:form.description||undefined,
        taskType:form.taskType,priority:form.priority,
        startDate:form.startDate||undefined,endDate:form.endDate||undefined,
        billable:form.billable,
      });
      toast.success(`Task "${form.name}" created!`);
      onDataChanged?.();
      setForm({...emptyForm});
      setView('list');
      loadTasks();
    }catch(e:any){toast.error(e?.response?.data?.error?.message||e?.response?.data?.message||'Failed to create task');}
    finally{setLoading(false);}
  };

  // ── Save edit ─────────────────────────────────────────────────────────────────
  const handleSaveEdit=async()=>{
    if(!editTask||!form.name){toast.error('Task Name is required');return;}
    setLoading(true);
    try{
      await tasksApi.update(editTask.id,{
        name:form.name,description:form.description||undefined,
        taskType:form.taskType,priority:form.priority,
        startDate:form.startDate||undefined,endDate:form.endDate||undefined,
        billable:form.billable,status:form.status,
      });
      toast.success('Task updated!');
      onDataChanged?.();
      setView('list');
      setEditTask(null);
      loadTasks();
    }catch(e:any){toast.error(e?.response?.data?.error?.message||e?.response?.data?.message||'Failed to update task');}
    finally{setLoading(false);}
  };

  const openEdit=(task:any)=>{
    setEditTask(task);
    setForm({
      projectId:task.projectId,name:task.name,description:task.description||'',
      taskType:task.taskType,priority:task.priority,
      startDate:task.startDate?task.startDate.slice(0,10):'',
      endDate:task.endDate?task.endDate.slice(0,10):'',
      billable:task.billable,status:task.status,
    });
    setView('edit');
  };

  const cancelForm=()=>{setView('list');setEditTask(null);setForm({...emptyForm});};

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const labelCls ="block text-sm font-medium text-slate-700 mb-1.5";
  const inputCls ="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const isEdit   = view==='edit';

  // ── Form fields (shared between new and edit) ─────────────────────────────────
  const renderFormFields=()=>(
    <div className="space-y-5">
      {/* Row 1: Project + Task Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Project <span className="text-red-500">*</span></label>
          <select value={form.projectId} onChange={e=>set('projectId',e.target.value)} disabled={isEdit} className={inputCls+(isEdit?' opacity-60':'')}>
            <option value="">Select project...</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Task Type</label>
          <select value={form.taskType} onChange={e=>set('taskType',e.target.value)} className={inputCls}>
            {TASK_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Task Name combo */}
      <div>
        <label className={labelCls}>
          Task Name <span className="text-red-500">*</span>
          <span className="ml-2 text-xs font-normal text-slate-400">— pre-loaded from upload · type a new name to add & save it</span>
        </label>
        <TaskNameCombo value={form.name} onChange={v=>set('name',v)}
          taskNamePool={taskNamePool} onAddName={handleAddTaskName}/>
      </div>

      {/* Row 3: Priority + Status(edit only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Priority</label>
          <select value={form.priority} onChange={e=>set('priority',e.target.value)} className={inputCls}>
            {PRIORITIES.map(p=><option key={p} value={p}>{p.charAt(0)+p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        {isEdit&&(
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)} className={inputCls}>
              {TASK_STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Row 4: Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Start Date {!isEdit&&<span className="text-red-500">*</span>}</label>
          <input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} className={inputCls} required={!isEdit}/>
        </div>
        <div>
          <label className={labelCls}>
            End Date
            {isEdit&&<span className="ml-2 text-xs font-normal text-indigo-600">← extend here if task needs more time</span>}
          </label>
          <input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} className={inputCls}/>
        </div>
      </div>

      {/* Row 5: Billable + Description */}
      <div className="flex items-center gap-3">
        <input type="checkbox" id="billable" checked={form.billable} onChange={e=>set('billable',e.target.checked)}
          className="w-4 h-4 accent-indigo-600 rounded"/>
        <label htmlFor="billable" className="text-sm font-medium text-slate-700">Billable</label>
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3}
          placeholder="Optional description..." className={inputCls+' resize-none'}/>
      </div>
    </div>
  );

  // ── Filtered task list ────────────────────────────────────────────────────────
  const displayedTasks = filterProject
    ? allTasks.filter(t=>t.projectId===filterProject||t.project?.id===filterProject)
    : allTasks;

  // ── VIEW: List (default landing page) ────────────────────────────────────────
  if(view==='list') return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4"/> Back to Overview
      </button>

      {/* Page header with "+ New Task" button top right */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400 mb-1">Management › <span className="text-slate-600">Tasks</span></div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage project tasks</p>
        </div>
        <button onClick={()=>{setForm({...emptyForm});setView('new');}}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-200 transition-colors">
          <Plus className="w-4 h-4"/> New Task
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Filter className="w-4 h-4"/>
          <span className="font-medium">Filter by project:</span>
        </div>
        <select value={filterProject} onChange={e=>setFilterProject(e.target.value)}
          className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]">
          <option value="">All Projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{displayedTasks.length} task{displayedTasks.length!==1?'s':''}</span>
      </div>

      {/* Task table */}
      {listLoading?(
        <div className="space-y-2">
          {[1,2,3,4].map(i=><div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse"/>)}
        </div>
      ):displayedTasks.length===0?(
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-slate-400"/>
          </div>
          <div className="text-slate-700 font-medium mb-1">No tasks yet</div>
          <div className="text-slate-400 text-sm mb-4">
            {filterProject?'No tasks for this project.':'Create your first task to get started.'}
          </div>
          <button onClick={()=>{setForm({...emptyForm});setView('new');}}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/> New Task
          </button>
        </div>
      ):(
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Task Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Project</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">Start</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase text-xs tracking-wide">End</th>
                <th className="px-4 py-3 w-10"/>
              </tr>
            </thead>
            <tbody>
              {displayedTasks.map(task=>{
                const sm=STATUS_META[task.status]||STATUS_META.ACTIVE;
                const StatusIcon=sm.Icon;
                const pm=PRIORITY_META[task.priority]||PRIORITY_META.MEDIUM;
                const today=new Date();today.setHours(0,0,0,0);
                const isExpired=task.endDate&&new Date(task.endDate)<today;
                return(
                  <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{task.name}</div>
                      {task.description&&<div className="text-xs text-slate-400 truncate max-w-[240px] mt-0.5">{task.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {task.project?.code||'—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{TYPE_LABELS[task.taskType]||task.taskType}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{background:sm.bg,color:sm.text,border:`1px solid ${sm.border}`}}>
                        <StatusIcon className="w-3 h-3"/>{sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.startDate ? (
                        <span className="text-xs font-medium text-slate-500">{fmtDate(task.startDate)}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.endDate?(
                        <span className={`text-xs font-medium ${isExpired?'text-red-500':'text-slate-500'}`}>
                          {isExpired&&'⚠ '}{fmtDate(task.endDate)}
                        </span>
                      ):<span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={()=>openEdit(task)}
                        className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                        title="Edit task / extend end date">
                        <Pencil className="w-3.5 h-3.5"/>
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

  // ── VIEW: New Task form ────────────────────────────────────────────────────────
  if(view==='new') return (
    <div className="p-6 max-w-3xl">
      <button onClick={cancelForm} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4"/> Back to Tasks
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400 mb-1">Management › Tasks › <span className="text-slate-600">New Task</span></div>
          <h1 className="text-2xl font-semibold text-slate-900">New Task</h1>
        </div>
        <button onClick={cancelForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-5 h-5"/>
        </button>
      </div>
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 space-y-5">
        {renderFormFields()}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button onClick={handleCreate} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4"/>{loading?'Creating...':'Create Task'}
          </button>
          <button onClick={()=>setForm({...emptyForm})}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5"/>Reset
          </button>
          <button onClick={cancelForm}
            className="ml-auto border border-slate-200 hover:bg-slate-50 text-slate-500 px-5 py-2 rounded-lg text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // ── VIEW: Edit Task ───────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl">
      <button onClick={cancelForm} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4"/> Back to Tasks
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400 mb-1">Management › Tasks › <span className="text-slate-600">Edit</span></div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit Task</h1>
          <p className="text-slate-500 text-sm mt-1">Editing: <span className="text-indigo-600 font-medium">{editTask?.name}</span></p>
        </div>
        <button onClick={cancelForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-5 h-5"/>
        </button>
      </div>

      {/* Expired end-date warning with quick action hint */}
      {editTask?.endDate&&(()=>{
        const today=new Date();today.setHours(0,0,0,0);
        const end=new Date(editTask.endDate);end.setHours(0,0,0,0);
        if(end<today) return(
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-semibold text-amber-800">This task's end date has passed ({fmtDate(editTask.endDate)})</p>
              <p className="text-sm text-amber-700 mt-0.5">Team members cannot log hours against it. Update the End Date below to extend it.</p>
            </div>
          </div>
        );
        return null;
      })()}

      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 space-y-5">
        {renderFormFields()}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button onClick={handleSaveEdit} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {loading?'Saving...':'Save Changes'}
          </button>
          <button onClick={cancelForm}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
