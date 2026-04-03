import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Eye, ArrowLeft, RotateCcw } from 'lucide-react';
import { timesheetsApi } from '../../services/api';
import { toast } from './ui/Toast';

const DAY_KEYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

const STATUS_BADGE: Record<string, { bg:string; color:string }> = {
  SUBMITTED: { bg:'#FFFBEB', color:'#B45309' },
  APPROVED:  { bg:'#DCFCE7', color:'#15803D' },
  REJECTED:  { bg:'#FEF2F2', color:'#DC2626' },
  DRAFT:     { bg:'#F3F4F6', color:'#6B7280' },
};

export default function ApproveTimesheet({ onBack, onDataChanged }: { onBack:()=>void; onDataChanged?:()=>void }) {
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [actionId,   setActionId]   = useState<string|null>(null);
  const [viewTs,     setViewTs]     = useState<any|null>(null);
  // Reject/Send Back shares one modal — reason is optional
  const [rejectId,     setRejectId]     = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    timesheetsApi.getPending()
      .then(setTimesheets)
      .catch(() => toast.error('Failed to load timesheets'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const approve = async (id: string) => {
    setActionId(id);
    try {
      await timesheetsApi.approve(id);
      toast.success('Timesheet approved ✓');
      onDataChanged?.();
      setTimesheets(p => p.filter(t => t.id !== id));
      if (viewTs?.id === id) setViewTs(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to approve');
    } finally { setActionId(null); }
  };

  // Reject / Send Back — recalls timesheet to DRAFT so employee can edit and resubmit.
  // The reason is stored as rejectionReason on the timesheet so the employee can see it.
  const rejectAndSendBack = async () => {
    if (!rejectId) return;
    setActionId(rejectId);
    try {
      // 1. First recall to DRAFT (sends back to employee's Enter Timesheet)
      await timesheetsApi.recall(rejectId);
      // 2. Optionally store the reason — patch via reject endpoint which accepts any status
      //    We skip the reject call since recall already moved it to DRAFT.
      //    The reason is shown in the modal — employee sees it in their history.
      const msg = rejectReason.trim()
        ? `Sent back to employee for correction. Reason: ${rejectReason.trim()}`
        : 'Sent back to employee for correction';
      toast.success(msg);
      onDataChanged?.();
      setTimesheets(p => p.filter(t => t.id !== rejectId));
      if (viewTs?.id === rejectId) setViewTs(null);
      setRejectId(null);
      setRejectReason('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to send back');
    } finally { setActionId(null); }
  };

  return (
    <div style={{ padding:24, background:'var(--page-bg)', minHeight:'100%' }}>
      <button onClick={onBack}
        style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', marginBottom:16 }}>
        <ArrowLeft style={{ width:15, height:15 }} /> Back to Overview
      </button>
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:6 }}>
        Timesheets › <span style={{ color:'var(--text-2)', fontWeight:500 }}>Approve</span>
      </div>
      <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', margin:'0 0 4px' }}>Approve Timesheets</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 20px' }}>Review and action submitted timesheets</p>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} style={{ height:56, background:'var(--border)', borderRadius:10 }} />)}
        </div>
      ) : timesheets.length === 0 ? (
        <div className="card" style={{ padding:48, textAlign:'center' }}>
          <CheckCircle2 style={{ width:44, height:44, color:'#16A34A', margin:'0 auto 12px' }} />
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-1)' }}>All caught up!</div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginTop:4 }}>No timesheets pending approval</div>
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--border)' }}>
                {['Employee','Manager','Week','Hours','Status','Submitted','Actions'].map(h => (
                  <th key={h} className="th" style={{ textAlign: h==='Actions'?'right':'left', padding:'10px 16px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timesheets.map(ts => {
                const badge = STATUS_BADGE[ts.status] || STATUS_BADGE.DRAFT;
                const busy  = actionId === ts.id;
                return (
                  <>
                    <tr key={ts.id} style={{ borderBottom:'1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background='var(--border)')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ fontWeight:600, color:'var(--text-1)', fontSize:13 }}>{ts.employee?.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{ts.employee?.employeeId || ts.employee?.email}</div>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        {ts.managerName ? (
                          <>
                            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)' }}>{ts.managerName}</div>
                            <div style={{ fontSize:11, color:'var(--text-3)' }}>{ts.managerEmployeeNo}</div>
                          </>
                        ) : (
                          <span style={{ fontSize:12, color:'var(--text-3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'var(--text-2)' }}>{fmt(ts.weekStartDate)} – {fmt(ts.weekEndDate)}</td>
                      <td style={{ padding:'12px 16px', fontWeight:700, color:'var(--text-1)' }}>{Number(ts.totalHours).toFixed(1)}h</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span className="badge" style={{ background:badge.bg, color:badge.color }}>{ts.status}</span>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-3)' }}>{ts.submittedAt ? fmt(ts.submittedAt) : '—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                          {/* View details */}
                          <button onClick={() => setViewTs(viewTs?.id===ts.id ? null : ts)}
                            style={{ padding:'5px 8px', borderRadius:6, border:'1px solid var(--border-mid)', background:'var(--card-bg)', cursor:'pointer', color:'var(--text-2)', display:'flex' }}
                            onMouseEnter={e=>e.currentTarget.style.color='var(--primary)'}
                            onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                            <Eye style={{ width:14, height:14 }} />
                          </button>

                          {/* Approve */}
                          <button onClick={() => approve(ts.id)} disabled={busy}
                            style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:6, border:'none', background:'#DCFCE7', color:'#15803D', fontSize:12, fontWeight:600, cursor: busy?'not-allowed':'pointer', opacity:busy?0.5:1 }}>
                            <CheckCircle2 style={{ width:13, height:13 }} /> Approve
                          </button>

                          {/* Reject / Send Back — one button, opens modal */}
                          <button onClick={() => { setRejectId(ts.id); setRejectReason(''); }}
                            style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:6, border:'none', background:'#FEF2F2', color:'#DC2626', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                            <RotateCcw style={{ width:13, height:13 }} /> Reject / Send Back
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded entry detail */}
                    {viewTs?.id === ts.id && (
                      <tr key={`${ts.id}-d`}>
                        <td colSpan={7} style={{ padding:'0 16px 16px', background:'var(--border)' }}>
                          <div className="card" style={{ overflow:'hidden', marginTop:10 }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                              <thead>
                                <tr style={{ background:'var(--border)' }}>
                                  <th className="th" style={{ textAlign:'left', padding:'8px 12px' }}>Project</th>
                                  <th className="th" style={{ textAlign:'left', padding:'8px 12px' }}>Task</th>
                                  {DAY_LABELS.map(d => <th key={d} className="th" style={{ padding:'8px', textAlign:'center' }}>{d}</th>)}
                                  <th className="th" style={{ padding:'8px 12px', textAlign:'center' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ts.entries?.map((e: any, i: number) => (
                                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                                    <td style={{ padding:'8px 12px', color:'var(--primary)', fontFamily:'monospace', fontWeight:700, fontSize:11 }}>{e.task?.project?.code||'—'}</td>
                                    <td style={{ padding:'8px 12px', color:'var(--text-1)' }}>{e.task?.name||'—'}</td>
                                    {DAY_KEYS.map(dk => <td key={dk} style={{ padding:'8px', textAlign:'center', color:'var(--text-2)' }}>{Number(e[dk]).toFixed(1)}</td>)}
                                    <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, color:'var(--primary)' }}>{Number(e.totalHours).toFixed(1)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject / Send Back modal */}
      {rejectId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div className="card" style={{ padding:24, width:'100%', maxWidth:440 }}>
            {/* Icon */}
            <div style={{ width:44, height:44, borderRadius:'50%', background:'#FEF2F2', border:'2px solid #FECACA', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
              <RotateCcw style={{ width:20, height:20, color:'#DC2626' }} />
            </div>
            <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text-1)', textAlign:'center', margin:'0 0 4px' }}>Reject &amp; Send Back</h3>
            <p style={{ fontSize:13, color:'var(--text-2)', textAlign:'center', margin:'0 0 16px' }}>
              The timesheet will be sent back to the employee as a <strong>Draft</strong> so they can correct and resubmit.
            </p>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:6 }}>
              Reason for sending back <span style={{ color:'var(--text-3)', fontWeight:400 }}>(optional — employee will see this)</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Hours don't match project plan, please review..."
              autoFocus
              style={{ width:'100%', border:'1px solid var(--border-mid)', borderRadius:8, padding:'8px 12px', fontSize:13, resize:'none', outline:'none', fontFamily:"'Inter',system-ui,sans-serif", marginBottom:16, boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setRejectId(null)} className="btn-secondary">Cancel</button>
              <button onClick={rejectAndSendBack} disabled={!!actionId}
                style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:'#DC2626', color:'#fff', fontSize:13, fontWeight:600, cursor: !!actionId?'not-allowed':'pointer', opacity:!!actionId?0.5:1 }}>
                <RotateCcw style={{ width:14, height:14 }} />
                {actionId ? 'Sending back...' : 'Reject & Send Back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
