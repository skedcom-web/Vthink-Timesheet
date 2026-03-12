import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { assignmentsApi, projectsApi, tasksApi, usersApi } from '../../services/api';
import { toast } from './ui/Toast';

export default function AssignTask({ onBack }: { onBack: () => void }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({
    projectId: '', taskId: '', employeeId: '',
    assignStartDate: '', assignEndDate: '', allocationPercentage: 100, roleOnTask: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(() => {});
    usersApi.getAll().then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.projectId) {
      tasksApi.getAll(form.projectId).then(setTasks).catch(() => {});
    } else { setTasks([]); }
    setForm(f => ({ ...f, taskId: '' }));
  }, [form.projectId]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.taskId || !form.employeeId || !form.assignStartDate || !form.assignEndDate) {
      toast.error('Please fill all required fields'); return;
    }
    setLoading(true);
    try {
      await assignmentsApi.create(form);
      toast.success('Task assigned successfully');
      setForm({ projectId: '', taskId: '', employeeId: '', assignStartDate: '', assignEndDate: '', allocationPercentage: 100, roleOnTask: '' });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to assign task');
    } finally { setLoading(false); }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1";
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50";

  return (
    <div className="p-6 max-w-2xl">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Assign Task</h1>
      <p className="text-slate-500 text-sm mb-6">Assign a task to an employee with allocation details</p>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Project <span className="text-red-500">*</span></label>
            <select value={form.projectId} onChange={e => set('projectId', e.target.value)} className={inputCls}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Task <span className="text-red-500">*</span></label>
            <select value={form.taskId} onChange={e => set('taskId', e.target.value)} disabled={!form.projectId} className={inputCls + ' disabled:opacity-50'}>
              <option value="">Select task...</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Employee <span className="text-red-500">*</span></label>
            <select value={form.employeeId} onChange={e => set('employeeId', e.target.value)} className={inputCls}>
              <option value="">Select employee...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.employeeId ? `${e.employeeId} — ` : ''}{e.name} ({e.role.replace('_', ' ')})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Start Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.assignStartDate} onChange={e => set('assignStartDate', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.assignEndDate} onChange={e => set('assignEndDate', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Allocation % <span className="text-red-500">*</span></label>
            <input type="number" min={0} max={100} value={form.allocationPercentage} onChange={e => set('allocationPercentage', Number(e.target.value))} className={inputCls} />
            <div className="mt-1.5 bg-slate-200 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${form.allocationPercentage}%` }} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Role on Task</label>
            <input value={form.roleOnTask} onChange={e => set('roleOnTask', e.target.value)} placeholder="e.g. Lead Developer" className={inputCls} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Assigning...' : 'Assign Task'}
          </button>
          <button onClick={() => setForm({ projectId: '', taskId: '', employeeId: '', assignStartDate: '', assignEndDate: '', allocationPercentage: 100, roleOnTask: '' })} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
