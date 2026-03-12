import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { timesheetsApi, projectsApi, tasksApi } from '../../services/api';
import { toast } from './ui/Toast';

const DAYS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getWeekStart(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmt(d: Date) { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }

interface Entry { projectId: string; taskId: string; tasks: any[]; hours: Record<string, number>; }

export default function EnterTimesheet({ onBack }: { onBack: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [projects, setProjects]     = useState<any[]>([]);
  const [entries, setEntries]       = useState<Entry[]>([{ projectId: '', taskId: '', tasks: [], hours: {} }]);
  const [savedId, setSavedId]       = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [fetching, setFetching]     = useState(false);

  const weekStart = getWeekStart(weekOffset);
  const weekEnd   = addDays(weekStart, 6);

  useEffect(() => { projectsApi.getAll().then(setProjects).catch(() => {}); }, []);

  useEffect(() => {
    setFetching(true);
    timesheetsApi.getMyWeek(weekStart.toISOString().split('T')[0])
      .then(ts => {
        if (ts) {
          setSavedId(ts.id);
          setEntries(ts.entries.map((e: any) => ({
            projectId: e.task?.project?.id || '',
            taskId: e.taskId, tasks: [],
            hours: Object.fromEntries(DAY_KEYS.map(k => [k, Number(e[k])])),
          })));
        } else {
          setSavedId(null);
          setEntries([{ projectId: '', taskId: '', tasks: [], hours: {} }]);
        }
      })
      .catch(() => { setSavedId(null); setEntries([{ projectId: '', taskId: '', tasks: [], hours: {} }]); })
      .finally(() => setFetching(false));
  }, [weekOffset]);

  const updateProject = async (idx: number, projectId: string) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], projectId, taskId: '', tasks: [] };
    setEntries(updated);
    if (projectId) {
      const t = await tasksApi.getActive(projectId).catch(() => []);
      updated[idx].tasks = t;
      setEntries([...updated]);
    }
  };

  const updateHour = (idx: number, day: string, val: string) => {
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
      projectId: e.projectId, taskId: e.taskId,
      ...Object.fromEntries(DAY_KEYS.map(k => [k, e.hours[k] || 0])),
    })),
  });

  const save = async () => {
    if (!entries.some(e => e.taskId)) { toast.error('Add at least one task'); return; }
    setLoading(true);
    try {
      const ts = await timesheetsApi.save(payload());
      setSavedId(ts.id);
      toast.success('Timesheet saved as draft');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const submit = async () => {
    if (!savedId) { toast.error('Save the timesheet first'); return; }
    setLoading(true);
    try {
      await timesheetsApi.submit(savedId);
      toast.success('Timesheet submitted for approval!');
      setSavedId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to submit');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Enter Timesheet</h1>
      <p className="text-slate-500 text-sm mb-6">Log your work hours for the week</p>

      {/* Week Navigator */}
      <div className="flex items-center justify-between mb-5 bg-white border border-slate-200 rounded-xl p-4">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="text-center">
          <div className="text-sm font-medium text-slate-900">
            Week of {fmt(weekStart)} – {fmt(weekEnd)}
          </div>
          <div className="text-xs text-slate-400">{weekOffset === 0 ? 'Current Week' : weekOffset < 0 ? `${Math.abs(weekOffset)} week(s) ago` : `${weekOffset} week(s) ahead`}</div>
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
        {fetching ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading timesheet...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-48">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-48">Task</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className={`px-2 py-3 font-medium text-slate-600 text-center w-16 ${i >= 5 ? 'text-slate-400' : ''}`}>
                      <div>{d}</div>
                      <div className="text-xs font-normal text-slate-400">{fmt(addDays(weekStart, i))}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium text-slate-600 text-center w-16">Total</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <select value={entry.projectId} onChange={e => updateProject(idx, e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="">Select project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={entry.taskId} onChange={e => setEntries(prev => { const u = [...prev]; u[idx] = { ...u[idx], taskId: e.target.value }; return u; })}
                        disabled={!entry.projectId}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50">
                        <option value="">Select task</option>
                        {entry.tasks.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    {DAY_KEYS.map((dk, di) => (
                      <td key={dk} className="px-1 py-2">
                        <input type="number" min={0} max={24} step={0.5}
                          value={entry.hours[dk] || ''}
                          onChange={e => updateHour(idx, dk, e.target.value)}
                          className={`w-14 text-center border rounded-lg px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${di >= 5 ? 'bg-slate-50 border-slate-100' : 'border-slate-200 bg-white'}`}
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-semibold ${rowTotal(entry) > 8 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {rowTotal(entry).toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => setEntries(e => e.filter((_, i) => i !== idx))} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50">
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-indigo-700">Weekly Total</td>
                  {DAY_KEYS.map(dk => (
                    <td key={dk} className="px-1 py-3 text-center text-xs font-semibold text-indigo-700">
                      {entries.reduce((s, e) => s + (e.hours[dk] || 0), 0).toFixed(1)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center text-xs font-bold text-indigo-700">{weekTotal.toFixed(1)}h</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setEntries(e => [...e, { projectId: '', taskId: '', tasks: [], hours: {} }])}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Row
        </button>
        <div className="flex gap-3">
          <button onClick={save} disabled={loading}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={submit} disabled={loading || !savedId}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            Submit for Approval
          </button>
        </div>
      </div>
      {savedId && <p className="text-xs text-emerald-600 mt-2 text-right">✓ Draft saved — click Submit when ready</p>}
    </div>
  );
}
