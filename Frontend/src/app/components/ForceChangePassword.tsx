import { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { usersApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from './ui/Toast';

export default function ForceChangePassword() {
  const { setMustChange, logout } = useAuthStore();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCur,   setShowCur]   = useState(false);
  const [showNew,   setShowNew]   = useState(false);
  const [showCon,   setShowCon]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Password strength checker
  const strength = (() => {
    if (!newPw) return { score: 0, label: '', color: '' };
    let s = 0;
    if (newPw.length >= 8)  s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
    return { score: s, label: labels[s], color: colors[s] };
  })();

  const handleSubmit = async () => {
    setError('');
    if (!currentPw) { setError('Please enter your current (temporary) password'); return; }
    if (newPw.length < 8)  { setError('New password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(newPw)) { setError('New password must contain at least one uppercase letter'); return; }
    if (!/[0-9]/.test(newPw)) { setError('New password must contain at least one number'); return; }
    if (!/[^A-Za-z0-9]/.test(newPw)) { setError('New password must contain at least one special character (@#$! etc.)'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }
    if (newPw === currentPw) { setError('New password must be different from your temporary password'); return; }

    setLoading(true);
    try {
      await usersApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      toast.success('Password changed successfully! Redirecting…');
      setMustChange(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to change password');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full pl-10 pr-10 py-3 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none';
  const inputStyle: React.CSSProperties = { background: '#F8FAFC', border: '1.5px solid #E2E8F0' };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#EEF2FF 0%,#E0E7FF 30%,#C7D2FE 60%,#E0F2FE 100%)' }}>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
            <span style={{ color: '#EF4444' }}>v</span><span style={{ color: '#1E293B' }}>Think</span>
          </h1>
        </div>

        <div className="rounded-2xl p-8 shadow-xl" style={{ background: '#FFFFFF', border: '1px solid rgba(99,102,241,0.1)' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Set New Password</h2>
              <p className="text-xs text-slate-500">Required before you can continue</p>
            </div>
          </div>

          {/* Warning banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-amber-800 text-sm">
            Your account was created with a temporary password. You must set a new secure password to proceed.
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-600 text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠</span><span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Current (temp) password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Temporary Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showCur ? 'text' : 'password'} value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Enter your temporary password"
                  className={inputCls + ' pr-10'} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#6366F1')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                <button type="button" onClick={() => setShowCur(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showNew ? 'text' : 'password'} value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min 8 chars, upper, number, special"
                  className={inputCls + ' pr-10'} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#6366F1')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {newPw && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                        style={{ background: i <= strength.score ? strength.color : '#E2E8F0' }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showCon ? 'text' : 'password'} value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="Re-enter new password"
                  className={inputCls + ' pr-10'}
                  style={{ ...inputStyle, borderColor: confirmPw && confirmPw !== newPw ? '#EF4444' : inputStyle.border as string }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#6366F1')}
                  onBlur={e  => (e.currentTarget.style.borderColor = confirmPw && confirmPw !== newPw ? '#EF4444' : '#E2E8F0')} />
                <button type="button" onClick={() => setShowCon(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCon ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPw && confirmPw !== newPw && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Requirements */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Requirements</p>
              {[
                { ok: newPw.length >= 8,           label: 'At least 8 characters' },
                { ok: /[A-Z]/.test(newPw),         label: 'At least one uppercase letter' },
                { ok: /[0-9]/.test(newPw),         label: 'At least one number' },
                { ok: /[^A-Za-z0-9]/.test(newPw),  label: 'At least one special character' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: r.ok ? '#D1FAE5' : '#F1F5F9' }}>
                    {r.ok
                      ? <span style={{ color: '#059669', fontSize: 10 }}>✓</span>
                      : <span style={{ color: '#94A3B8', fontSize: 10 }}>○</span>}
                  </div>
                  <span className="text-xs" style={{ color: r.ok ? '#059669' : '#94A3B8' }}>{r.label}</span>
                </div>
              ))}
            </div>

            <button onClick={handleSubmit} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all"
              style={{
                background: loading ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1 0%,#7C3AED 100%)',
                boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
              }}>
              {loading ? 'Updating…' : <><span>Set New Password</span><ArrowRight className="w-4 h-4" /></>}
            </button>

            <button onClick={logout} className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors pt-1">
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
