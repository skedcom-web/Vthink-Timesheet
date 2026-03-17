import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Pencil, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { tasksApi, projectsApi, projectConfigApi } from '../../services/api';
import { toast } from './ui/Toast';

const TASK_TYPES     = ['DEVELOPMENT','DESIGN','TESTING','MANAGEMENT','SUPPORT','DOCUMENTATION','MEETING'];
const PRIORITIES     = ['LOW','MEDIUM','HIGH','CRITICAL'];
const STATUSES       = ['ACTIVE','ON_HOLD','COMPLETED','CANCELLED'];
const STATUS_META: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg:'#DCFCE7', color:'#15803D' },
  ON_HOLD:   { bg:'#FFFBEB', color:'#B45309' },
  COMPLETED: { bg:'#DBEAFE', color:'#1D4ED8' },
  CANCELLED: { bg:'#F3F4F6', color:'#6B7280' },
};
const PRIORITY_META: Record<string, { bg: string; color: string }> = {
  LOW:      { bg:'#F3F4F6', color:'#6B7280' },
  MEDIUM:   { bg:'#DBEAFE', color:'#1D4ED8' },
  HIGH:     { bg:'#FFFBEB', color:'#B45309' },
  CRITICAL: { bg:'#FEF2F2', color:'#DC2626' },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

export default function AddTask({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {
  const [projects, setProjects]     = useState<any[]>([]);
  const [tasks,    setTasks]        = useState<any[]>([]);
  const [loading,  setLoading]      = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [editTask, setEditTask]     = useState<any|null>(null);
  const [projFilter, setProjFilter] = useState('');
  const [form, setForm] = useState({ projectId:'', name:'', taskType:'DEVELOPMENT', priority:'MEDIUM', startDate:'', endDate:'', billable:true, status:'ACTIVE', description:'' });

  useEffect(() => {
    Promise.allSettled([
      projectConfigApi.getAll().then(r => r||[]),
      projectsApi.getAll().then(r => r||[]),
    ]).then(([pc,p]) => {
      const seen = new Set<string>(); const merged: any[] = [];
      [...(pc.status==='fulfilled'?pc.value||[]:[]),(p.status==='fulfilled'?p.value||[]:[])].forEach(pr => { if (!seen.has(pr.id)){seen.add(pr.id);merged.push(pr);} });
      setProjects(merged);
    }).catch(()=>{});
    loadTasks();
  }, []);

  const loadTasks = () => {
    tasksApi.getAll().then(setTasks).catch(()=>{});
  };

  const set = (k: string, v: any) => setForm(f => ({...f,[k]:v}));

  const openAdd  = () => { setForm({projectId:'',name:'',taskType:'DEVELOPMENT',priority:'MEDIUM',startDate:'',endDate:'',billable:true,status:'ACTIVE',description:''}); setEditTask(null); setShowForm(true); };
  const openEdit = (t: any) => { setForm({projectId:t.projectId||t.project?.id||'',name:t.name||'',taskType:t.taskType||'DEVELOPMENT',priority:t.priority||'MEDIUM',startDate:t.startDate?t.startDate.split('T')[0]:'',endDate:t.endDate?t.endDate.split('T')[0]:'',billable:t.billable??true,status:t.status||'ACTIVE',description:t.description||''}); setEditTask(t); setShowForm(true); };

  const handleSubmit = async () => {
    if (!form.projectId || !form.name.trim()) { toast.error('Project and Task Name are required'); return; }
    setLoading(true);
    try {
      if (editTask) { await tasksApi.update(editTask.id, form); toast.success('Task updated'); }
      else          { await tasksApi.create(form);              toast.success('Task created'); }
      onDataChanged?.(); loadTasks(); setShowForm(false);
    } catch (e: any) { toast.error(e?.response?.data?.message||e?.response?.data?.error?.message||'Failed to save task'); }
    finally { setLoading(false); }
  };

  const filtered = projFilter ? tasks.filter(t => t.projectId===projFilter||t.project?.id===projFilter) : tasks;

  const inp   = { width:'100%', border:'1px solid var(--border-mid)', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', background:'#fff', fontFamily:"'Inter',system-ui,sans-serif" };
  const inpSm = { ...inp, padding:'7px 10px', fontSize:12 };

  return (
    <div style={{ padding:24, background:'var(--page-bg)', minHeight:'100%' }}>
      <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', marginBottom:16 }}>
        <ArrowLeft style={{ width:15, height:15 }} /> Back to Overview
      </button>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:6 }}>Management › <span style={{ color:'var(--text-2)', fontWeight:500 }}>Add Task</span></div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:0 }}>Tasks</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', margin:'4px 0 0' }}>Create and manage project tasks</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus style={{ width:15, height:15 }} /> New Task</button>
      </div>

      {/* Filter */}
      <div className="card" style={{ padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
        <label style={{ fontSize:12, fontWeight:500, color:'var(--text-2)', whiteSpace:'nowrap' }}>Filter by project:</label>
        <select value={projFilter} onChange={e => setProjFilter(e.target.value)}
          style={{ ...inpSm, flex:1, maxWidth:280 }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
      </div>

      {/* Task table */}
      <div className="card" style={{ overflow:'hidden' }}>
        {tasks.length === 0 ? (
          <div style={{ padding:48, textAlign:'center' }}>
            <AlertCircle style={{ width:36, height:36, color:'var(--text-3)', margin:'0 auto 12px' }} />
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-1)' }}>No tasks yet</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginTop:4 }}>Click "New Task" to create one</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--border)' }}>
                  {['Task Name','Project','Type','Priority','Status','Start','End',''].map(h => (
                    <th key={h} className="th" style={{ textAlign:'left', padding:'10px 14px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} style={{ borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background='var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontWeight:600, color:'var(--text-1)' }}>{t.name}</div>
                      {t.description && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{t.description.slice(0,60)}{t.description.length>60?'…':''}</div>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, padding:'2px 7px', borderRadius:4, background:'var(--primary-tint)', color:'var(--primary)' }}>
                        {t.project?.code||'—'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-2)' }}>{(t.taskType||'').replace('_',' ')}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span className="badge" style={{ background:(PRIORITY_META[t.priority]||PRIORITY_META.MEDIUM).bg, color:(PRIORITY_META[t.priority]||PRIORITY_META.MEDIUM).color }}>{t.priority}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span className="badge" style={{ background:(STATUS_META[t.status]||STATUS_META.ACTIVE).bg, color:(STATUS_META[t.status]||STATUS_META.ACTIVE).color }}>{t.status}</span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-2)' }}>{t.startDate?fmt(t.startDate):'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-2)' }}>{t.endDate?fmt(t.endDate):'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => openEdit(t)}
                        style={{ padding:'5px 8px', borderRadius:6, border:'1px solid var(--border-mid)', background:'#fff', cursor:'pointer', color:'var(--text-2)' }}
                        onMouseEnter={e => e.currentTarget.style.color='var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-2)'}>
                        <Pencil style={{ width:13, height:13 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div className="card" style={{ padding:28, width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text-1)', margin:0 }}>{editTask?'Edit Task':'New Task'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', padding:4 }}>
                <X style={{ width:18, height:18 }} />
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Project <span style={{ color:'#DC2626' }}>*</span></label>
                <select value={form.projectId} onChange={e=>set('projectId',e.target.value)} style={inp}>
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Task Name <span style={{ color:'#DC2626' }}>*</span></label>
                <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. API Development" style={inp} />
              </div>
              <div>
                <label className="label">Task Type</label>
                <select value={form.taskType} onChange={e=>set('taskType',e.target.value)} style={inp}>
                  {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select value={form.priority} onChange={e=>set('priority',e.target.value)} style={inp}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} style={inp} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} style={inp} />
              </div>
              <div>
                <label className="label">Status</label>
                <select value={form.status} onChange={e=>set('status',e.target.value)} style={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:24 }}>
                <input type="checkbox" id="billable" checked={form.billable} onChange={e=>set('billable',e.target.checked)}
                  style={{ width:16, height:16, accentColor:'var(--primary)' }} />
                <label htmlFor="billable" style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', cursor:'pointer' }}>Billable</label>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3}
                  placeholder="Optional description..." style={{ ...inp, resize:'none' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary">
                {loading ? 'Saving...' : editTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
