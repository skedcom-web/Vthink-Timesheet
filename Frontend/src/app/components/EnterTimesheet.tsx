import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { timesheetsApi, projectsApi, tasksApi } from '../../services/api';
import { toast } from './ui/Toast';

const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

function getWeekStart(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
  d.setHours(0,0,0,0); return d;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function fmt(d: Date) { return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}); }
interface Entry { projectId: string; taskId: string; tasks: any[]; hours: Record<string,number>; }

// Shared back button
const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', marginBottom:16 }}>
    <ArrowLeft style={{ width:15, height:15 }} /> Back to Overview
  </button>
);

export default function EnterTimesheet({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [projects,   setProjects]   = useState<any[]>([]);
  const [entries,    setEntries]    = useState<Entry[]>([{projectId:'',taskId:'',tasks:[],hours:{}}]);
  const [savedId,    setSavedId]    = useState<string|null>(null);
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(false);

  const weekStart = getWeekStart(weekOffset);
  const weekEnd   = addDays(weekStart, 6);

  useEffect(() => { projectsApi.getAll().then(setProjects).catch(()=>{}); }, []);

  useEffect(() => {
    setFetching(true);
    timesheetsApi.getMyWeek(weekStart.toISOString().split('T')[0])
      .then(ts => {
        if (ts) {
          setSavedId(ts.id);
          setEntries(ts.entries.map((e: any) => ({ projectId:e.task?.project?.id||'', taskId:e.taskId, tasks:[], hours:Object.fromEntries(DAY_KEYS.map(k=>[k,Number(e[k])])) })));
        } else { setSavedId(null); setEntries([{projectId:'',taskId:'',tasks:[],hours:{}}]); }
      })
      .catch(() => { setSavedId(null); setEntries([{projectId:'',taskId:'',tasks:[],hours:{}}]); })
      .finally(() => setFetching(false));
  }, [weekOffset]);

  const updateProject = async (idx: number, projectId: string) => {
    const u = [...entries]; u[idx] = {...u[idx],projectId,taskId:'',tasks:[]}; setEntries(u);
    if (projectId) { const t = await tasksApi.getActive(projectId).catch(()=>[]); u[idx].tasks = t; setEntries([...u]); }
  };
  const updateHour = (idx: number, day: string, val: string) => {
    const u = [...entries]; u[idx].hours = {...u[idx].hours,[day]:Math.max(0,Math.min(24,Number(val)||0))}; setEntries(u);
  };
  const rowTotal  = (e: Entry) => DAY_KEYS.reduce((s,k) => s+(e.hours[k]||0), 0);
  const weekTotal = entries.reduce((s,e) => s+rowTotal(e), 0);

  const payload = () => ({ weekStartDate:weekStart.toISOString().split('T')[0], weekEndDate:weekEnd.toISOString().split('T')[0],
    entries:entries.filter(e=>e.taskId).map(e=>({projectId:e.projectId,taskId:e.taskId,...Object.fromEntries(DAY_KEYS.map(k=>[k,e.hours[k]||0]))})) });

  const save = async () => {
    if (!entries.some(e=>e.taskId)) { toast.error('Add at least one task'); return; }
    setLoading(true);
    try { const ts = await timesheetsApi.save(payload()); setSavedId(ts.id); toast.success('Timesheet saved as draft'); onDataChanged?.(); }
    catch (err: any) { toast.error(err?.response?.data?.error?.message||'Failed to save'); }
    finally { setLoading(false); }
  };
  const submit = async () => {
    if (!savedId) { toast.error('Save the timesheet first'); return; }
    setLoading(true);
    try { await timesheetsApi.submit(savedId); toast.success('Timesheet submitted for approval!'); onDataChanged?.(); setSavedId(null); }
    catch (err: any) { toast.error(err?.response?.data?.error?.message||'Failed to submit'); }
    finally { setLoading(false); }
  };

  const sel = { width:'100%', border:'1px solid var(--border-mid)', borderRadius:6, padding:'5px 8px', fontSize:12, background:'#fff', outline:'none', fontFamily:"'Inter',system-ui,sans-serif" };
  const inp = { width:52, textAlign:'center' as const, border:'1px solid var(--border-mid)', borderRadius:6, padding:'5px 2px', fontSize:12, background:'#fff', outline:'none', fontFamily:"'Inter',system-ui,sans-serif" };

  return (
    <div style={{ padding:24, background:'var(--page-bg)', minHeight:'100%' }}>
      <BackBtn onClick={onBack} />
      <div style={{ marginBottom:6, display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-3)' }}>
        <span>Timesheets</span><span>›</span><span style={{ color:'var(--text-2)', fontWeight:500 }}>Enter Timesheet</span>
      </div>
      <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:'0 0 4px' }}>Enter Timesheet</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 20px' }}>Log your work hours for the week</p>

      {/* Week navigator */}
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', marginBottom:16 }}>
        <button onClick={() => setWeekOffset(w=>w-1)} style={{ padding:'6px 8px', borderRadius:6, border:'1px solid var(--border-mid)', background:'#fff', cursor:'pointer' }}>
          <ChevronLeft style={{ width:15, height:15, color:'var(--text-2)' }} />
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Week of {fmt(weekStart)} – {fmt(weekEnd)}</div>
          <div style={{ fontSize:12, color:'var(--text-3)' }}>{weekOffset===0?'Current Week':weekOffset<0?`${Math.abs(weekOffset)} week(s) ago`:`${weekOffset} week(s) ahead`}</div>
        </div>
        <button onClick={() => setWeekOffset(w=>w+1)} style={{ padding:'6px 8px', borderRadius:6, border:'1px solid var(--border-mid)', background:'#fff', cursor:'pointer' }}>
          <ChevronRight style={{ width:15, height:15, color:'var(--text-2)' }} />
        </button>
      </div>

      {/* Grid */}
      <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
        {fetching ? (
          <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--text-3)' }}>Loading timesheet...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--border)' }}>
                  <th className="th" style={{ textAlign:'left', padding:'10px 14px', width:160 }}>Project</th>
                  <th className="th" style={{ textAlign:'left', padding:'10px 14px', width:160 }}>Task</th>
                  {DAYS.map((d,i) => (
                    <th key={d} className="th" style={{ padding:'10px 8px', textAlign:'center', width:60, color: i>=5 ? 'var(--text-3)' : undefined }}>
                      <div>{d}</div>
                      <div style={{ fontSize:10, fontWeight:400, color:'var(--text-3)' }}>{fmt(addDays(weekStart,i))}</div>
                    </th>
                  ))}
                  <th className="th" style={{ padding:'10px 12px', textAlign:'center', width:60 }}>Total</th>
                  <th style={{ width:36 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={idx} style={{ borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background='#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <td style={{ padding:'8px 10px' }}>
                      <select value={entry.projectId} onChange={e => updateProject(idx, e.target.value)} style={sel}>
                        <option value="">Select project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'8px 10px' }}>
                      <select value={entry.taskId} onChange={e => setEntries(prev => { const u=[...prev]; u[idx]={...u[idx],taskId:e.target.value}; return u; })}
                        disabled={!entry.projectId} style={{...sel, opacity:entry.projectId?1:0.5}}>
                        <option value="">Select task</option>
                        {entry.tasks.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    {DAY_KEYS.map((dk, di) => (
                      <td key={dk} style={{ padding:'8px 4px', textAlign:'center' }}>
                        <input type="number" min={0} max={24} step={0.5}
                          value={entry.hours[dk]||''}
                          onChange={e => updateHour(idx,dk,e.target.value)}
                          style={{...inp, background: di>=5 ? 'var(--border)' : '#fff'}}
                          placeholder="0" />
                      </td>
                    ))}
                    <td style={{ padding:'8px 4px', textAlign:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color: rowTotal(entry)>8 ? '#F59E0B' : 'var(--text-1)' }}>
                        {rowTotal(entry).toFixed(1)}h
                      </span>
                    </td>
                    <td style={{ padding:'8px 4px', textAlign:'center' }}>
                      <button onClick={() => setEntries(e => e.filter((_,i)=>i!==idx))}
                        style={{ padding:5, borderRadius:6, border:'none', background:'none', cursor:'pointer', color:'var(--text-3)' }}
                        onMouseEnter={e => { e.currentTarget.style.background='#FEF2F2'; e.currentTarget.style.color='#DC2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--text-3)'; }}>
                        <Trash2 style={{ width:14, height:14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'var(--primary-tint)' }}>
                  <td colSpan={2} style={{ padding:'10px 14px', fontSize:12, fontWeight:700, color:'var(--primary)' }}>Weekly Total</td>
                  {DAY_KEYS.map(dk => (
                    <td key={dk} style={{ padding:'10px 4px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--primary)' }}>
                      {entries.reduce((s,e) => s+(e.hours[dk]||0), 0).toFixed(1)}
                    </td>
                  ))}
                  <td style={{ padding:'10px 12px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--primary)' }}>{weekTotal.toFixed(1)}h</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => setEntries(e => [...e,{projectId:'',taskId:'',tasks:[],hours:{}}])}
          style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer' }}>
          <Plus style={{ width:15, height:15 }} /> Add Row
        </button>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={save} disabled={loading} className="btn-secondary">
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={submit} disabled={loading||!savedId} className="btn-primary">
            Submit for Approval
          </button>
        </div>
      </div>
      {savedId && <p style={{ fontSize:12, color:'#16A34A', marginTop:8, textAlign:'right' }}>✓ Draft saved — click Submit when ready</p>}
    </div>
  );
}
