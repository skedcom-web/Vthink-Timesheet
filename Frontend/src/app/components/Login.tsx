import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function Login() {
  const { setAuth } = useAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const doLogin = async (id: string, pw: string) => {
    if (!id || !pw) { setError('Please enter your Employee ID / Email and password.'); return; }
    setLoading(true); setError('');
    try {
      const data = await authApi.login(id, pw);
      if (!data?.accessToken || !data?.user) {
        setError('Unexpected response from server. Please try again.'); return;
      }
      setAuth(data.user, data.accessToken, data.mustChangePassword ?? false);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || 'Cannot connect to server. Please ensure the backend is running.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const inp = {
    base:  'w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none',
    style: { background: '#F8FAFC', border: '1.5px solid #E2E8F0' } as React.CSSProperties,
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#EEF2FF 0%,#E0E7FF 30%,#C7D2FE 60%,#E0F2FE 100%)' }}>

      {/* Background blobs */}
      <div style={{ position:'fixed', top:'-10%', right:'-5%', width:400, height:400, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(99,102,241,0.15) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'-10%', left:'-5%', width:500, height:500, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(139,92,246,0.12) 0%,transparent 70%)', pointerEvents:'none' }} />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold" style={{ letterSpacing:'-0.02em' }}>
            <span style={{ color:'#EF4444' }}>v</span><span style={{ color:'#1E293B' }}>Think</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Timesheet Management System</p>
        </div>

        <div className="rounded-2xl p-8 shadow-xl" style={{ background:'#FFFFFF', border:'1px solid rgba(99,102,241,0.1)' }}>
          <h2 className="text-2xl font-bold text-slate-900 mb-1" style={{ letterSpacing:'-0.01em' }}>Welcome back</h2>
          <p className="text-slate-500 text-sm mb-6">Sign in with your Employee ID or Email</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-600 text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠</span><span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Employee ID / Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee ID or Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder="VT001 or you@vthink.co.in"
                  className={inp.base} style={inp.style}
                  onFocus={e  => (e.currentTarget.style.borderColor = '#6366F1')}
                  onBlur={e   => (e.currentTarget.style.borderColor = '#E2E8F0')}
                  onKeyDown={e => e.key === 'Enter' && doLogin(identifier, password)} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  onKeyDown={e => e.key === 'Enter' && doLogin(identifier, password)}
                  className={inp.base + ' pr-10'} style={inp.style}
                  onFocus={e  => (e.currentTarget.style.borderColor = '#6366F1')}
                  onBlur={e   => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign in button */}
            <button onClick={() => doLogin(identifier, password)}
              disabled={loading || !identifier || !password}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all"
              style={{
                background:  loading || !identifier || !password ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1 0%,#7C3AED 100%)',
                cursor:      loading || !identifier || !password ? 'not-allowed' : 'pointer',
                boxShadow:   '0 4px 14px rgba(99,102,241,0.4)',
              }}>
              {loading ? 'Signing in…' : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>

          {/* Footer note */}
          <p className="text-center text-slate-400 text-xs mt-6">
            Contact your administrator if you need access
          </p>
        </div>
      </div>
    </div>
  );
}
