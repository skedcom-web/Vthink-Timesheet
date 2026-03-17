import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Clock, Users, BarChart3, CheckCircle, Loader2 } from 'lucide-react';
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

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Left panel — branding ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4F38F6 0%, #432DD7 50%, #5D0EC0 100%)' }}
      >
        {/* Decorative circles */}
        <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.10)' }} />
        <div style={{ position:'absolute', bottom:-120, left:-60, width:400, height:400, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.10)' }} />
        <div style={{ position:'absolute', top:'40%', left:'60%', width:10, height:10, borderRadius:'50%', background:'rgba(255,255,255,0.20)' }} />
        <div style={{ position:'absolute', top:'25%', left:'80%', width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />
        <div style={{ position:'absolute', top:'65%', left:'85%', width:8, height:8, borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />

        {/* Logo */}
        <div>
          <div style={{ display:'flex', alignItems:'baseline', gap:0 }}>
            <span style={{ fontSize:24, fontWeight:700, color:'#F87171' }}>v</span>
            <span style={{ fontSize:24, fontWeight:700, color:'#fff' }}>Think</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#F87171', marginLeft:2 }}>*</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginLeft:2, marginTop:-8 }}>®</span>
          </div>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginTop:4 }}>Timesheet Management System</p>
        </div>

        {/* Hero text */}
        <div style={{ position:'relative', zIndex:10, marginTop:-32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', background:'rgba(255,255,255,0.10)', borderRadius:99, marginBottom:24 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ADE80', display:'inline-block' }} />
            <span style={{ fontSize:12, color:'#fff' }}>All Systems Operational</span>
          </div>

          <h1 style={{ fontSize:36, fontWeight:500, color:'#fff', lineHeight:1.3, marginBottom:16, margin:'0 0 16px' }}>
            Streamline your<br />
            <span style={{ opacity:0.85 }}>timesheet workflow</span>
          </h1>
          <p style={{ fontSize:13, color:'#C7D2FF', lineHeight:1.7, maxWidth:380, margin:'0 0 32px' }}>
            Unified timesheet management, role-based access, and real-time approvals — all in one platform built for vThink.
          </p>

          {/* Mock dashboard card */}
          <div style={{ background:'rgba(255,255,255,0.10)', backdropFilter:'blur(8px)', borderRadius:16, padding:20, maxWidth:420, border:'1px solid rgba(255,255,255,0.12)' }}>
            {/* Window dots */}
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

            {/* Stat mini-cards */}
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

            {/* Mini bar chart */}
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

        {/* Bottom badge */}
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

      {/* ── Right panel — form ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#F9FAFB', padding:24 }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          {/* Logo (mobile / right panel) */}
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ display:'inline-flex', alignItems:'baseline' }}>
              <span style={{ fontSize:28, fontWeight:700, color:'#EF4444' }}>v</span>
              <span style={{ fontSize:28, fontWeight:700, color:'#111827' }}>Think</span>
              <span style={{ fontSize:16, fontWeight:700, color:'#EF4444', marginLeft:2 }}>*</span>
            </div>
          </div>

          <h2 style={{ fontSize:22, fontWeight:500, color:'#111827', textAlign:'center', marginBottom:4 }}>Welcome back</h2>
          <p style={{ fontSize:13, color:'#6B7280', textAlign:'center', marginBottom:28 }}>Sign in to your account to continue</p>

          {/* Form card */}
          <div style={{ background:'#fff', borderRadius:20, padding:32, border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            {error && (
              <div style={{ marginBottom:20, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, fontSize:13, color:'#DC2626', fontWeight:500 }}>
                {error}
              </div>
            )}

            {/* Employee ID */}
            <div style={{ marginBottom:20 }}>
              <label className="label">Employee ID or Email</label>
              <div style={{ position:'relative' }}>
                <Mail style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:16, height:16, color:'#9CA3AF' }} />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin(identifier, password)}
                  placeholder="VT001 or you@vthink.co.in"
                  className="input"
                  style={{ paddingLeft:38 }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom:24 }}>
              <label className="label">Password</label>
              <div style={{ position:'relative' }}>
                <Lock style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:16, height:16, color:'#9CA3AF' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin(identifier, password)}
                  placeholder="Enter your password"
                  className="input"
                  style={{ paddingLeft:38, paddingRight:38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF' }}
                >
                  {showPw ? <EyeOff style={{ width:16, height:16 }} /> : <Eye style={{ width:16, height:16 }} />}
                </button>
              </div>
            </div>

            {/* Sign in */}
            <button
              onClick={() => doLogin(identifier, password)}
              disabled={loading || !identifier || !password}
              className="btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'11px 16px', borderRadius:12, fontSize:14 }}
            >
              {loading
                ? <><Loader2 style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> Signing in...</>
                : <><span>Sign in</span><ArrowRight style={{ width:16, height:16 }} /></>
              }
            </button>
          </div>

          <p style={{ textAlign:'center', fontSize:12, color:'#9CA3AF', marginTop:20 }}>
            Contact your administrator if you need access
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
