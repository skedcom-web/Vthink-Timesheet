import { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Clock, Users, BarChart3, CheckCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { authApi, usersApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type View = 'login' | 'forgot' | 'reset' | 'done';

function getResetParamsFromUrl(): { token: string; userId: string } | null {
  try {
    const p = new URLSearchParams(window.location.search);
    const token = p.get('token'), userId = p.get('userId');
    if (token && userId) return { token, userId };
  } catch {}
  return null;
}

// ── LEFT PANEL — defined OUTSIDE component so it never remounts ───────────────
function LeftPanel() {
  return (
    <div className="login-marketing-panel hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden">
      <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.10)' }} />
      <div style={{ position:'absolute', bottom:-120, left:-60, width:400, height:400, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.10)' }} />
      <div style={{ position:'absolute', top:'40%', left:'60%', width:10, height:10, borderRadius:'50%', background:'rgba(255,255,255,0.20)' }} />
      <div style={{ position:'absolute', top:'25%', left:'80%', width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />
      <div style={{ position:'absolute', top:'65%', left:'85%', width:8, height:8, borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />

      <div>
        <div style={{ display:'flex', alignItems:'baseline' }}>
          <span style={{ fontSize:24, fontWeight:700, color:'#F87171' }}>v</span>
          <span style={{ fontSize:24, fontWeight:700, color:'#fff' }}>Think</span>
          <span style={{ fontSize:14, fontWeight:700, color:'#F87171', marginLeft:2 }}>*</span>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginLeft:2 }}>®</span>
        </div>
        <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginTop:4 }}>Timesheet Management System</p>
      </div>

      <div style={{ position:'relative', zIndex:10, marginTop:-32 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', background:'rgba(255,255,255,0.10)', borderRadius:99, marginBottom:24 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ADE80', display:'inline-block' }} />
          <span style={{ fontSize:12, color:'#fff' }}>All Systems Operational</span>
        </div>
        <h1 style={{ fontSize:36, fontWeight:500, color:'#fff', lineHeight:1.3, margin:'0 0 16px' }}>
          Streamline your<br /><span style={{ opacity:0.85 }}>timesheet workflow</span>
        </h1>
        <p style={{ fontSize:13, color:'#C7D2FF', lineHeight:1.7, maxWidth:380, margin:'0 0 32px' }}>
          Unified timesheet management, role-based access, and real-time approvals — all in one platform built for vThink.
        </p>
        <div style={{ background:'rgba(255,255,255,0.10)', backdropFilter:'blur(8px)', borderRadius:16, padding:20, maxWidth:420, border:'1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ display:'flex', gap:6, marginBottom:16 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(248,113,113,0.8)' }} />
            <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(251,191,36,0.8)' }} />
            <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(74,222,128,0.8)' }} />
            <div style={{ flex:1 }} />
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.15)', borderRadius:99, padding:'4px 10px' }}>
              <CheckCircle style={{ width:12, height:12, color:'#86EFAC' }} />
              <span style={{ fontSize:11, color:'#fff' }}>Tasks Done</span>
              <span style={{ fontSize:13, fontWeight:600, color:'#fff' }}>156</span>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {[
              { icon: BarChart3, label:'Timesheets', value:'24', delta:'+3' },
              { icon: Users,     label:'Team Members', value:'128', delta:'+12' },
              { icon: Clock,     label:'Hours Logged', value:'87%', delta:'+5%' },
            ].map(({ icon: Icon, label, value, delta }) => (
              <div key={label} style={{ background:'rgba(255,255,255,0.10)', borderRadius:10, padding:12, border:'1px solid rgba(255,255,255,0.10)' }}>
                <Icon style={{ width:16, height:16, color:'rgba(255,255,255,0.6)', marginBottom:8 }} />
                <p style={{ fontSize:15, fontWeight:600, color:'#fff', margin:'0 0 2px' }}>{value}</p>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>{label}</span>
                  <span style={{ fontSize:10, color:'#86EFAC' }}>{delta}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(255,255,255,0.10)', borderRadius:10, padding:12, border:'1px solid rgba(255,255,255,0.10)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              <BarChart3 style={{ width:12, height:12, color:'rgba(255,255,255,0.6)' }} />
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>Weekly Hours Overview</span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:48 }}>
              {[40,55,45,60,50,70,65,75,55,80,70,85].map((h, i) => (
                <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.25)', borderRadius:3, height:`${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.10)', borderRadius:10, padding:'8px 14px', border:'1px solid rgba(255,255,255,0.12)' }}>
          <Clock style={{ width:16, height:16, color:'#FCD34D' }} />
          <div>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.6)', margin:0 }}>Hours Logged This Month</p>
            <p style={{ fontSize:14, fontWeight:600, color:'#fff', margin:0 }}>2,847</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RIGHT PANEL SHELL — defined OUTSIDE component so it never remounts ────────
function RightShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--page-bg)', padding:24 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'baseline' }}>
            <span style={{ fontSize:28, fontWeight:700, color:'#EF4444' }}>v</span>
            <span style={{ fontSize:28, fontWeight:700, color:'var(--text-1)' }}>Think</span>
            <span style={{ fontSize:16, fontWeight:700, color:'#EF4444', marginLeft:2 }}>*</span>
          </div>
        </div>
        {children}
        <p style={{ textAlign:'center', fontSize:12, color:'var(--text-3)', marginTop:20 }}>
          Contact your administrator if you need access
        </p>
      </div>
    </div>
  );
}

// ── Shared card wrapper ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background:'var(--card-bg)', borderRadius:20, padding:32,
  border:'1px solid var(--border)', boxShadow:'var(--shadow-card)'
};

const spinStyle = `@keyframes spin { to { transform: rotate(360deg); } }`;

// ── Main component ────────────────────────────────────────────────────────────
export default function Login() {
  const { setAuth } = useAuthStore();
  const resetParams = getResetParamsFromUrl();

  const [view,       setView]       = useState<View>(resetParams ? 'reset' : 'login');
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const [forgotId,   setForgotId]   = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [resetToken] = useState(resetParams?.token  || '');
  const [resetUser]  = useState(resetParams?.userId || '');

  useEffect(() => {
    if (resetParams) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const doLogin = async () => {
    if (!identifier || !password) { setError('Please enter your Employee ID / Email and password.'); return; }
    setLoading(true); setError('');
    try {
      const data = await authApi.login(identifier, password);
      if (!data?.accessToken || !data?.user) { setError('Unexpected response from server. Please try again.'); return; }
      setAuth(data.user, data.accessToken, data.mustChangePassword ?? false);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Cannot connect to server. Please ensure the backend is running.');
    } finally { setLoading(false); }
  };

  const doForgot = async () => {
    if (!forgotId.trim()) { setError('Please enter your Employee ID or Email.'); return; }
    setLoading(true); setError('');
    try {
      await usersApi.forgotPassword(forgotId.trim());
      setForgotSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally { setLoading(false); }
  };

  const doReset = async () => {
    if (newPw.length < 8)    { setError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await usersApi.setPasswordViaToken(resetUser, resetToken, newPw);
      setView('done');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally { setLoading(false); }
  };

  const pwStrength = (() => {
    if (!newPw) return { score:0, color:'', label:'' };
    let s = 0;
    if (newPw.length >= 8)          s++;
    if (/[A-Z]/.test(newPw))        s++;
    if (/[0-9]/.test(newPw))        s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return { score:s, color:['','#DC2626','#F59E0B','#3B82F6','#16A34A'][s], label:['','Weak','Fair','Good','Strong'][s] };
  })();

  const errBox = error ? (
    <div style={{ marginBottom:16, padding:'10px 14px', background:'var(--danger-tint)', border:'1px solid var(--danger)', borderRadius:10, fontSize:13, color:'var(--danger)', fontWeight:500 }}>
      {error}
    </div>
  ) : null;

  const iconBtn: React.CSSProperties = { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)' };
  const iconLeft: React.CSSProperties = { position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:16, height:16, color:'var(--text-3)' };

  // ── VIEW: Login ─────────────────────────────────────────────────────────────
  if (view === 'login') return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Inter',system-ui,sans-serif", background:'var(--page-bg)' }}>
      <LeftPanel />
      <RightShell>
        <h2 style={{ fontSize:22, fontWeight:500, color:'var(--text-1)', textAlign:'center', marginBottom:4 }}>Welcome back</h2>
        <p style={{ fontSize:13, color:'var(--text-2)', textAlign:'center', marginBottom:28 }}>Sign in to your account to continue</p>
        <div style={cardStyle}>
          {errBox}
          <div style={{ marginBottom:20 }}>
            <label className="label">Employee ID or Email</label>
            <div style={{ position:'relative' }}>
              <Mail style={iconLeft} />
              <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()}
                placeholder="VT001 or you@vthink.co.in"
                className="input" style={{ paddingLeft:38 }} />
            </div>
          </div>
          <div style={{ marginBottom:24 }}>
            <div style={{ marginBottom:6 }}>
              <label className="label" style={{ margin:0 }}>Password</label>
            </div>
            <div style={{ position:'relative' }}>
              <Lock style={iconLeft} />
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()}
                placeholder="Enter your password"
                className="input" style={{ paddingLeft:38, paddingRight:38 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={iconBtn}>
                {showPw ? <EyeOff style={{ width:16, height:16 }} /> : <Eye style={{ width:16, height:16 }} />}
              </button>
            </div>
          </div>
          <button onClick={doLogin} disabled={loading || !identifier || !password}
            className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px 16px', borderRadius:12, fontSize:14 }}>
            {loading
              ? <><Loader2 style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> Signing in...</>
              : <><span>Sign in</span><ArrowRight style={{ width:16, height:16 }} /></>}
          </button>

          {/* Forgot / Reset Password — below Sign in, standard IT practice */}
          <div style={{ textAlign:'center', marginTop:16 }}>
            <button type="button"
              onClick={() => { setError(''); setForgotId(''); setForgotSent(false); setView('forgot'); }}
              style={{ fontSize:13, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration='underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration='none')}>
              Forgot Password / Reset Password
            </button>
          </div>
        </div>
      </RightShell>
      <style>{spinStyle}</style>
    </div>
  );

  // ── VIEW: Forgot Password ───────────────────────────────────────────────────
  if (view === 'forgot') return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Inter',system-ui,sans-serif", background:'var(--page-bg)' }}>
      <LeftPanel />
      <RightShell>
        <div style={cardStyle}>
          <button onClick={() => { setError(''); setView('login'); }}
            style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', fontWeight:500, marginBottom:20, padding:0 }}>
            <ArrowLeft style={{ width:15, height:15 }} /> Back to Sign in
          </button>
          {!forgotSent ? (
            <>
              <h2 style={{ fontSize:20, fontWeight:600, color:'var(--text-1)', margin:'0 0 6px' }}>Reset your password</h2>
              <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 24px', lineHeight:1.6 }}>
                Enter your Employee ID or Email and we'll send you a link to reset your password.
              </p>
              {errBox}
              <div style={{ marginBottom:20 }}>
                <label className="label">Employee ID or Email</label>
                <div style={{ position:'relative' }}>
                  <Mail style={iconLeft} />
                  <input type="text" value={forgotId} onChange={e => setForgotId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doForgot()}
                    placeholder="VT001 or you@vthink.co.in"
                    className="input" style={{ paddingLeft:38 }} />
                </div>
              </div>
              <button onClick={doForgot} disabled={loading || !forgotId.trim()}
                className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px 16px', borderRadius:12, fontSize:14 }}>
                {loading
                  ? <><Loader2 style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> Sending...</>
                  : <><span>Send Reset Link</span><ArrowRight style={{ width:16, height:16 }} /></>}
              </button>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'8px 0' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'#F0FDF4', border:'2px solid #86EFAC', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <CheckCircle2 style={{ width:28, height:28, color:'#16A34A' }} />
              </div>
              <h2 style={{ fontSize:20, fontWeight:600, color:'var(--text-1)', margin:'0 0 8px' }}>Check your email</h2>
              <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 6px', lineHeight:1.6 }}>
                If an account exists for <strong>{forgotId}</strong>, a reset link has been sent.
              </p>
              <p style={{ fontSize:12, color:'var(--text-3)', margin:'0 0 24px' }}>Link expires in 1 hour. Check spam if you don't see it.</p>
              <button onClick={() => { setError(''); setView('login'); }}
                style={{ fontSize:13, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
                Back to Sign in
              </button>
            </div>
          )}
        </div>
      </RightShell>
      <style>{spinStyle}</style>
    </div>
  );

  // ── VIEW: Set New Password ──────────────────────────────────────────────────
  if (view === 'reset') return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Inter',system-ui,sans-serif", background:'var(--page-bg)' }}>
      <LeftPanel />
      <RightShell>
        <div style={cardStyle}>
          <h2 style={{ fontSize:20, fontWeight:600, color:'var(--text-1)', margin:'0 0 6px' }}>Set new password</h2>
          <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 24px' }}>Enter and confirm your new password below.</p>
          {errBox}
          <div style={{ marginBottom:20 }}>
            <label className="label">New Password</label>
            <div style={{ position:'relative' }}>
              <Lock style={iconLeft} />
              <input type={showNewPw ? 'text' : 'password'} value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min 8 characters"
                className="input" style={{ paddingLeft:38, paddingRight:38 }} />
              <button type="button" onClick={() => setShowNewPw(v => !v)} style={iconBtn}>
                {showNewPw ? <EyeOff style={{ width:16, height:16 }} /> : <Eye style={{ width:16, height:16 }} />}
              </button>
            </div>
            {newPw && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:99, background: i<=pwStrength.score ? pwStrength.color : 'var(--border)' }} />
                  ))}
                </div>
                <p style={{ fontSize:11, color:pwStrength.color, margin:0 }}>{pwStrength.label}</p>
              </div>
            )}
          </div>
          <div style={{ marginBottom:24 }}>
            <label className="label">Confirm New Password</label>
            <div style={{ position:'relative' }}>
              <Lock style={iconLeft} />
              <input type="password" value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doReset()}
                placeholder="Re-enter new password"
                className="input" style={{ paddingLeft:38 }} />
            </div>
            {confirmPw && confirmPw !== newPw && (
              <p style={{ fontSize:11, color:'#DC2626', margin:'4px 0 0' }}>Passwords do not match</p>
            )}
          </div>
          <button onClick={doReset} disabled={loading || newPw.length < 8 || newPw !== confirmPw}
            className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px 16px', borderRadius:12, fontSize:14 }}>
            {loading
              ? <><Loader2 style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> Saving...</>
              : <><span>Set New Password</span><ArrowRight style={{ width:16, height:16 }} /></>}
          </button>
        </div>
      </RightShell>
      <style>{spinStyle}</style>
    </div>
  );

  // ── VIEW: Done ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Inter',system-ui,sans-serif", background:'var(--page-bg)' }}>
      <LeftPanel />
      <RightShell>
        <div style={{ ...cardStyle, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'#F0FDF4', border:'2px solid #86EFAC', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <CheckCircle2 style={{ width:28, height:28, color:'#16A34A' }} />
          </div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'var(--text-1)', margin:'0 0 8px' }}>Password updated!</h2>
          <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 24px', lineHeight:1.6 }}>
            Your password has been set. You can now sign in with your new password.
          </p>
          <button onClick={() => { setView('login'); setNewPw(''); setConfirmPw(''); setError(''); }}
            className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px 16px', borderRadius:12, fontSize:14 }}>
            <span>Sign in now</span><ArrowRight style={{ width:16, height:16 }} />
          </button>
        </div>
      </RightShell>
      <style>{spinStyle}</style>
    </div>
  );
}
