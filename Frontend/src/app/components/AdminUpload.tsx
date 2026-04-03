import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  RefreshCw, Loader2, CloudUpload, X, Building2, Users, Briefcase,
  Tag, Download,
} from 'lucide-react';
import { projectConfigApi, employeeConfigApi, projectConfigSummaryApi } from '../../services/api';
import { toast } from './ui/Toast';
import { useAuthStore } from '../../store/authStore';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface ProjectSummary  { totalProjects: number; totalTaskNames: number; }
interface EmployeeSummary { total: number; byDesignation: { designation: string; count: number }[]; }

// ── Template download helpers ─────────────────────────────────────────────────

async function downloadProjectTemplate() {
  let XLSX: typeof import('xlsx');
  try {
    XLSX = await import('xlsx');
  } catch {
    toast.error('Could not load template builder. Check your connection and try again.');
    return;
  }
  const wb = XLSX.utils.book_new();

  // Headers matching exactly what the backend parser expects
  const headers = ['Project Name', 'Client', 'Description', 'Task Types'];

  // Sample rows to guide the user
  const sampleRows = [
    ['Mobile App Phase 1', 'GlobalTech Inc', 'Mobile application development', 'UI Design | API Development | Testing | Documentation'],
    ['Website Redesign',   'Acme Corp',      'Full website redesign project',   'Homepage Design | Content Migration | SEO Optimisation'],
    ['Data Migration',     'Pinnacle Ltd',   'Database migration project',       'Schema Analysis | Data Cleansing | ETL Development | UAT'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Column widths
  ws['!cols'] = [
    { wch: 30 },  // Project Name
    { wch: 22 },  // Client
    { wch: 36 },  // Description
    { wch: 60 },  // Task Types
  ];

  // Style header row (bold, background) — basic approach via cell metadata
  const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } } };
  ['A1','B1','C1','D1'].forEach(cell => {
    if (ws[cell]) ws[cell].s = headerStyle;
  });

  // Instructions sheet
  const instrData = [
    ['vThink Timesheet — Project Addition Upload Template'],
    [''],
    ['INSTRUCTIONS'],
    ['1. Fill in the "Projects" sheet starting from row 2 (do not delete the header row).'],
    ['2. Project Name is REQUIRED. All other columns are optional.'],
    ['3. Task Types: separate multiple tasks with a pipe character  |  e.g.  Task A | Task B | Task C'],
    ['4. Save the file as .xlsx and upload it using the Upload button.'],
    ['5. Re-uploading the same project will update it — duplicates are handled automatically.'],
    [''],
    ['COLUMN GUIDE'],
    ['Project Name', 'Required. The full project name.'],
    ['Client',       'Optional. Client or company name.'],
    ['Description',  'Optional. Brief description of the project.'],
    ['Task Types',   'Optional. Pipe-separated list of task names for this project.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 40 }, { wch: 50 }];

  XLSX.utils.book_append_sheet(wb, ws,     'Projects');
  XLSX.utils.book_append_sheet(wb, wsInstr,'Instructions');

  XLSX.writeFile(wb, 'vThink_Project_Upload_Template.xlsx');
  toast.success('Project template downloaded!');
}

async function downloadEmployeeTemplate() {
  let XLSX: typeof import('xlsx');
  try {
    XLSX = await import('xlsx');
  } catch {
    toast.error('Could not load template builder. Check your connection and try again.');
    return;
  }
  const wb = XLSX.utils.book_new();

  // 5 columns — Manager Employee No links employee to their direct manager
  const headers = [
    'Employee Number',
    'Employee Name',
    'Designation',
    'Email',
    'Manager Employee No',
  ];

  // Sample data — VT003 and VT005 are managers (blank Manager col)
  // VT001 & VT002 report to VT003; VT004 & VT006 report to VT005
  const sampleRows = [
    ['VT001', 'Arun Kumar',       'Senior Developer',  'arun.kumar@vthink.co.in',  'VT003'],
    ['VT002', 'Priya Ramasamy',   'UI/UX Designer',    'priya.r@vthink.co.in',     'VT003'],
    ['VT003', 'Mohammed Farhan',  'Project Manager',   'farhan@vthink.co.in',       ''],
    ['VT004', 'Divya Suresh',     'QA Engineer',       'divya.s@vthink.co.in',     'VT005'],
    ['VT005', 'Ramesh Natarajan', 'Project Manager',   'ramesh.n@vthink.co.in',     ''],
    ['VT006', 'Kavitha Anand',    'Business Analyst',  'kavitha.a@vthink.co.in',   'VT005'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  ws['!cols'] = [
    { wch: 20 },  // Employee Number
    { wch: 26 },  // Employee Name
    { wch: 26 },  // Designation
    { wch: 34 },  // Email
    { wch: 24 },  // Manager Employee No
  ];

  const instrData = [
    ['vThink Timesheet — Employee Addition Upload Template'],
    [''],
    ['INSTRUCTIONS'],
    ['1. Fill in the "Employees" sheet from row 2. Do NOT delete the header row.'],
    ['2. Employee Number and Employee Name are REQUIRED.'],
    ['3. Manager Employee No: enter the Employee Number of this person\'s direct manager.'],
    ['   Leave blank for managers / top-level employees (SUPER_ADMIN, COMPANY_ADMIN, PROJECT_MANAGER).'],
    ['4. Re-uploading the same Employee Number will UPDATE the record — including the Manager.'],
    ['   To reassign an employee to a new manager, just change this column and re-upload.'],
    ['5. Save as .xlsx and upload using the Upload button.'],
    [''],
    ['COLUMN GUIDE'],
    ['Employee Number',     'Required. Unique ID e.g. VT001. Auto-generated if blank.'],
    ['Employee Name',       'Required. Full name.'],
    ['Designation',         'Optional. Job title e.g. Senior Developer.'],
    ['Email',               'Optional but recommended. Used for login & notifications.'],
    ['Manager Employee No', 'Optional. Employee Number of this person\'s direct manager.'],
    ['',                    'Example: VT001 reports to VT003 → enter VT003 in this column for VT001.'],
    ['',                    'Leave blank for top-level managers who have no manager above them.'],
    [''],
    ['HOW MANAGER SCOPING WORKS'],
    ['A Project Manager only sees and approves timesheets of employees mapped to them.'],
    ['To change a manager, re-upload this file with the updated Manager Employee No.'],
    ['No need to revoke or recreate accounts when the manager changes.'],
  ];

  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 26 }, { wch: 70 }];

  XLSX.utils.book_append_sheet(wb, ws,     'Employees');
  XLSX.utils.book_append_sheet(wb, wsInstr,'Instructions');

  XLSX.writeFile(wb, 'vThink_Employee_Upload_Template.xlsx');
  toast.success('Employee template downloaded!');
}


function UploadCard({
  title, subtitle, hint,
  onUpload, onDownloadTemplate, templateLabel,
}: {
  title:             string;
  subtitle:          string;
  hint:              React.ReactNode;
  onUpload:          (file: File) => Promise<string>;
  onDownloadTemplate: () => void | Promise<void>;
  templateLabel:     string;
}) {
  const [uploadState,  setUploadState]  = useState<UploadState>('idle');
  const [uploadMsg,    setUploadMsg]    = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileSelect = (file: File | null) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    setSelectedFile(file);
    setUploadState('idle');
    setUploadMsg('');
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('Please select a file first'); return; }
    setUploadState('uploading');
    setUploadMsg('');
    try {
      const msg = await onUpload(selectedFile);
      setUploadState('success');
      setUploadMsg(msg);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      const msg = e?.response?.data?.message ||
                  e?.response?.data?.error?.message ||
                  e?.message || 'Upload failed';
      setUploadState('error');
      setUploadMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6">

      {/* Title row with Download Template button */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        </div>
        <button
          onClick={onDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:shadow-sm shrink-0"
          style={{
            background:  '#F0FDF4',
            borderColor: '#86EFAC',
            color:       '#16A34A',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background   = '#DCFCE7';
            e.currentTarget.style.borderColor  = '#4ADE80';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background   = '#F0FDF4';
            e.currentTarget.style.borderColor  = '#86EFAC';
          }}
        >
          <Download className="w-3.5 h-3.5" />
          {templateLabel}
        </button>
      </div>

      <p className="text-sm text-slate-500 mb-4">{subtitle}</p>

      {/* Format hint */}
      <div className="mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
        {hint}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e  => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); onFileSelect(e.dataTransfer.files?.[0] ?? null); }}
        onClick={() => fileInputRef.current?.click()}
        className="relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4"
        style={{
          borderColor: dragOver ? 'var(--primary)' : selectedFile ? 'var(--primary)' : 'var(--border-mid)',
          background:  dragOver ? 'var(--primary-tint)' : selectedFile ? 'var(--vthink-purple-soft)' : 'var(--nav-hover-bg)',
        }}
      >
        <input
          ref={fileInputRef} type="file" accept=".xlsx,.xls"
          onChange={e => onFileSelect(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
            <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB · Click to change</p>
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <CloudUpload className="w-8 h-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              <span className="text-indigo-600 font-semibold">Click to browse</span> or drag & drop
            </p>
            <p className="text-xs text-slate-400">.xlsx or .xls · Max 10 MB</p>
          </div>
        )}
      </div>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploadState === 'uploading'}
        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: selectedFile ? '#4F46E5' : '#94A3B8' }}
      >
        {uploadState === 'uploading'
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
          : <><Upload className="w-4 h-4" /> Upload & Import</>}
      </button>

      {uploadState === 'success' && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{uploadMsg}</span>
        </div>
      )}
      {uploadState === 'error' && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{uploadMsg}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Upload page ────────────────────────────────────────────────────
export default function AdminUpload({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {
  const { user } = useAuthStore();
  const isAdmin  = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user?.role || '');

  const [projSummary,    setProjSummary]    = useState<ProjectSummary  | null>(null);
  const [empSummary,     setEmpSummary]     = useState<EmployeeSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const fetchSummaries = useCallback(async () => {
    // Guard: only admin roles can call these summary endpoints
    if (!isAdmin) { setLoadingSummary(false); return; }
    setLoadingSummary(true);
    try {
      const [p, e] = await Promise.allSettled([
        projectConfigSummaryApi.getSummary(),
        employeeConfigApi.getSummary(),
      ]);
      if (p.status === 'fulfilled') setProjSummary(p.value);
      if (e.status === 'fulfilled') setEmpSummary(e.value);
    } finally {
      setLoadingSummary(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const handleProjectUpload = async (file: File): Promise<string> => {
    const res = await projectConfigApi.upload(file);
    const msg = res.message || `Imported ${res.projects} project(s) and ${res.taskNames} task name(s)`;
    toast.success(msg);
    onDataChanged?.();
    await fetchSummaries();
    return msg;
  };

  const handleEmployeeUpload = async (file: File): Promise<string> => {
    const res = await employeeConfigApi.upload(file);
    const msg = res.message || `Imported ${res.employees} employee(s)`;
    toast.success(msg);
    onDataChanged?.();
    await fetchSummaries();
    return msg;
  };

  return (
    <div className="p-6 max-w-5xl space-y-8">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Admin — Data Uploads</h1>
        <p className="text-slate-500 text-sm">
          Download a template, fill in your data, and upload it to populate projects, tasks and employees.
        </p>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Projects summary */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Imported Projects</p>
                <p className="text-xs text-slate-400">via Project Addition Upload</p>
              </div>
            </div>
            <button
              onClick={fetchSummaries}
              disabled={loadingSummary}
              title="Refresh"
              className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loadingSummary ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingSummary && !projSummary ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : projSummary && (projSummary.totalProjects > 0 || projSummary.totalTaskNames > 0) ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-700">{projSummary.totalProjects}</p>
                <p className="text-xs text-indigo-500 mt-0.5 flex items-center justify-center gap-1">
                  <Building2 className="w-3 h-3" /> Projects
                </p>
              </div>
              <div className="bg-violet-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-violet-700">{projSummary.totalTaskNames}</p>
                <p className="text-xs text-violet-500 mt-0.5 flex items-center justify-center gap-1">
                  <Tag className="w-3 h-3" /> Task Names
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-1">
              <Building2 className="w-8 h-8 text-slate-200" />
              <p className="text-sm">No projects uploaded yet</p>
              <p className="text-xs">Download the template below, fill it in and upload</p>
            </div>
          )}
        </div>

        {/* Employees summary */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Imported Employees</p>
                <p className="text-xs text-slate-400">via Employee Addition Upload</p>
              </div>
            </div>
          </div>

          {loadingSummary && !empSummary ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : empSummary && empSummary.total > 0 ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{empSummary.total}</p>
                <p className="text-xs text-emerald-500 mt-0.5 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> Total Employees
                </p>
              </div>
              {empSummary.byDesignation.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">By Designation</p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {empSummary.byDesignation.map(d => (
                      <div key={d.designation} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-600 truncate">{d.designation}</span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                          {d.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-1">
              <Users className="w-8 h-8 text-slate-200" />
              <p className="text-sm">No employees uploaded yet</p>
              <p className="text-xs">Download the template below, fill it in and upload</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Project Addition Upload ─────────────────────────────────────────────── */}
      <UploadCard
        title="Project Addition Upload"
        subtitle="Download the template, fill in your project and task data, then upload the completed file."
        hint={
          <>
            <strong>Required columns:</strong>&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Project Name</span>
            &nbsp;·&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Client</span>
            &nbsp;·&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Description</span>
            &nbsp;·&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Task Types</span>
            &nbsp;(pipe-separated: <em>Task A | Task B | Task C</em>)
          </>
        }
        onUpload={handleProjectUpload}
        onDownloadTemplate={downloadProjectTemplate}
        templateLabel="Download Template"
      />

      {/* ── Employee Addition Upload ────────────────────────────────────────────── */}
      <UploadCard
        title="Employee Addition Upload"
        subtitle="Download the template, fill in your employee details, then upload the completed file."
        hint={
          <>
            <strong>Required columns:</strong>&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Employee Number</span>
            &nbsp;·&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Employee Name</span>
            &nbsp;·&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Designation</span>
            &nbsp;·&nbsp;
            <span className="font-mono bg-indigo-100 px-1 rounded">Email</span>
            &nbsp;·&nbsp;
            <span className="font-mono bg-amber-100 px-1 rounded text-amber-800">Manager Employee No</span>
            &nbsp;<span className="text-indigo-500 text-xs">(new — enter manager\'s Employee Number; leave blank for top-level managers)</span>
          </>
        }
        onUpload={handleEmployeeUpload}
        onDownloadTemplate={downloadEmployeeTemplate}
        templateLabel="Download Template"
      />
    </div>
  );
}
