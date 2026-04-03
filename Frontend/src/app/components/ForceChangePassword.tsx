import { useState, useCallback } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, BarChart3, Users, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { usersApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from './ui/Toast';

// ── CRITICAL: PwField MUST be defined OUTSIDE the parent component.
// If defined inside, React recreates the component on every state change,
// unmounting the input and losing focus after every keystroke.
interface PwFieldProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
}
function PwField({ id, value, onChange, show, onToggleShow, placeholder }: PwFieldProps) {
  return (
    <div style={{ position: 'relative' }}>
      <Lock style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', width:16, height:16, color:'var(--text-3)', pointerEvents:'none' }} />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={id === 'cur-pw' ? 'current-password' : 'new-password'}
        style={{
          width:'100%', padding:'12px 44px', border:'1.5px solid var(--border-mid)', borderRadius:10,
          fontSize:15, color:'var(--text-1)', background:'var(--card-bg)', outline:'none',
          fontFamily:"'Inter',system-ui,sans-serif", transition:'border-color 0.15s',
          boxSizing:'border-box',
        }}
        onFocus={e  => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onBlur={e   => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', padding:4, display:'flex' }}
      >
        {show ? <EyeOff style={{ width:16, height:16 }} /> : <Eye style={{ width:16, height:16 }} />}
      </button>
    </div>
  );
}

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

  // Stable callbacks — won't cause PwField re-renders
  const toggleCur = useCallback(() => setShowCur(v => !v), []);
  const toggleNew = useCallback(() => setShowNew(v => !v), []);
  const toggleCon = useCallback(() => setShowCon(v => !v), []);

  const strength = (() => {
    if (!newPw) return { score: 0, label: '', color: '' };
    let s = 0;
    if (newPw.length >= 8)          s++;
    if (/[A-Z]/.test(newPw))        s++;
    if (/[0-9]/.test(newPw))        s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return {
      score: s,
      label: ['', 'Weak', 'Fair', 'Good', 'Strong'][s],
      color: ['', '#E02424', '#C27803', '#3B82F6', '#0E9F6E'][s],
    };
  })();

  const handleSubmit = async () => {
    setError('');
    if (!currentPw)                       { setError('Please enter your current (temporary) password'); return; }
    if (newPw.length < 8)                 { setError('New password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(newPw))             { setError('New password must contain at least one uppercase letter'); return; }
    if (!/[0-9]/.test(newPw))             { setError('New password must contain at least one number'); return; }
    if (!/[^A-Za-z0-9]/.test(newPw))     { setError('New password must contain at least one special character'); return; }
    if (newPw !== confirmPw)              { setError('Passwords do not match'); return; }
    if (newPw === currentPw)              { setError('New password must be different from your temporary password'); return; }

    setLoading(true);
    try {
      await usersApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      toast.success('Password changed successfully!');
      setMustChange(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to change password');
    } finally { setLoading(false); }
  };

  const requirements = [
    { ok: newPw.length >= 8,           label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(newPw),         label: 'At least one uppercase letter' },
    { ok: /[0-9]/.test(newPw),         label: 'At least one number' },
    { ok: /[^A-Za-z0-9]/.test(newPw),  label: 'At least one special character' },
  ];

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Inter',system-ui,sans-serif", background:'var(--page-bg)' }}>

      {/* ── Left panel — same branding as Login ── */}
      <div
        className="login-marketing-panel hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden"
      >
        {/* Decorative circles */}
        <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.10)' }} />
        <div style={{ position:'absolute', bottom:-120, left:-60, width:400, height:400, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.10)' }} />
        <div style={{ position:'absolute', top:'40%', left:'60%', width:10, height:10, borderRadius:'50%', background:'rgba(255,255,255,0.20)' }} />
        <div style={{ position:'absolute', top:'25%', left:'80%', width:7,  height:7,  borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />
        <div style={{ position:'absolute', top:'65%', left:'85%', width:8,  height:8,  borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />

        {/* Logo */}
        <div>
          <div style={{ display:'flex', alignItems:'baseline' }}>
            <span style={{ fontSize:24, fontWeight:700, color:'#F87171' }}>v</span>
            <span style={{ fontSize:24, fontWeight:700, color:'#fff' }}>Think</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#F87171', marginLeft:2 }}>*</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginLeft:2 }}>®</span>
          </div>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginTop:4 }}>Timesheet Management System</p>
        </div>

        {/* Hero content */}
        <div style={{ position:'relative', zIndex:10 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', background:'rgba(255,255,255,0.10)', borderRadius:99, marginBottom:24 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ADE80', display:'inline-block' }} />
            <span style={{ fontSize:12, color:'#fff' }}>All Systems Operational</span>
          </div>
          <h1 style={{ fontSize:34, fontWeight:600, color:'#fff', lineHeight:1.3, margin:'0 0 16px' }}>
            Almost there!<br />
            <span style={{ opacity:0.85 }}>Set your new password</span>
          </h1>
          <p style={{ fontSize:13, color:'#C7D2FF', lineHeight:1.7, maxWidth:360, margin:'0 0 32px' }}>
            For your security, you need to set a new password before accessing vThink Timesheet.
            Choose something strong that you'll remember.
          </p>

          {/* Requirement preview card */}
          <div style={{ background:'rgba(255,255,255,0.10)', backdropFilter:'blur(8px)', borderRadius:16, padding:20, maxWidth:380, border:'1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14 }}>
              <ShieldCheck style={{ width:16, height:16, color:'#86EFAC' }} />
              <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.8)' }}>Password Requirements</span>
            </div>
            {[
              'At least 8 characters long',
              'One uppercase letter (A-Z)',
              'One number (0-9)',
              'One special character (@#$! etc.)',
            ].map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:16, height:16, borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>✓</span>
                </div>
                <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.10)', borderRadius:10, padding:'8px 14px', border:'1px solid rgba(255,255,255,0.12)' }}>
            <Clock style={{ width:16, height:16, color:'#FCD34D' }} />
            <div>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.6)', margin:0 }}>One-time action</p>
              <p style={{ fontSize:14, fontWeight:600, color:'#fff', margin:0 }}>First login password change</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — password change form ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--page-bg)', padding:24, overflowY:'auto' }}>
        <div style={{ width:'100%', maxWidth:420 }}>

          {/* Logo (right panel) */}
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ display:'inline-flex', alignItems:'baseline' }}>
              <span style={{ fontSize:28, fontWeight:700, color:'var(--danger)' }}>v</span>
              <span style={{ fontSize:28, fontWeight:700, color:'var(--text-1)' }}>Think</span>
              <span style={{ fontSize:16, fontWeight:700, color:'var(--danger)', marginLeft:2 }}>*</span>
            </div>
          </div>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--warning-tint)', border:'2px solid var(--border-mid)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <ShieldCheck style={{ width:22, height:22, color:'var(--warning)' }} />
            </div>
            <h2 style={{ fontSize:22, fontWeight:600, color:'var(--text-1)', margin:'0 0 4px' }}>Set New Password</h2>
            <p style={{ fontSize:14, color:'var(--text-2)', margin:0 }}>Required before you can continue</p>
          </div>

          {/* Warning banner */}
          <div style={{ background:'var(--warning-tint)', border:'1px solid var(--border-mid)', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:13, color:'var(--text-1)' }}>
            Your account was created with a temporary password. Please set a new secure password to proceed.
          </div>

          {/* Error */}
          {error && (
            <div style={{ background:'var(--danger-tint)', border:'1px solid var(--danger)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'var(--danger)', display:'flex', gap:8 }}>
              <span style={{ flexShrink:0 }}>⚠</span><span>{error}</span>
            </div>
          )}

          {/* Form card */}
          <div style={{ background:'var(--card-bg)', borderRadius:16, padding:28, border:'1px solid var(--border)', boxShadow:'var(--shadow-card)' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

              {/* Temporary password */}
              <div>
                <label htmlFor="cur-pw" style={{ display:'block', fontSize:14, fontWeight:500, color:'var(--text-1)', marginBottom:6 }}>
                  Temporary Password
                </label>
                <PwField
                  id="cur-pw"
                  value={currentPw}
                  onChange={setCurrentPw}
                  show={showCur}
                  onToggleShow={toggleCur}
                  placeholder="Enter your temporary password"
                />
              </div>

              {/* New password */}
              <div>
                <label htmlFor="new-pw" style={{ display:'block', fontSize:14, fontWeight:500, color:'var(--text-1)', marginBottom:6 }}>
                  New Password
                </label>
                <PwField
                  id="new-pw"
                  value={newPw}
                  onChange={setNewPw}
                  show={showNew}
                  onToggleShow={toggleNew}
                  placeholder="Min 8 chars, uppercase, number, special"
                />
                {/* Strength bar */}
                {newPw && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex:1, height:4, borderRadius:99, background: i <= strength.score ? strength.color : 'var(--border)', transition:'background 0.2s' }} />
                      ))}
                    </div>
                    {strength.label && <p style={{ fontSize:12, color:strength.color, margin:0 }}>{strength.label}</p>}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="con-pw" style={{ display:'block', fontSize:14, fontWeight:500, color:'var(--text-1)', marginBottom:6 }}>
                  Confirm New Password
                </label>
                <PwField
                  id="con-pw"
                  value={confirmPw}
                  onChange={setConfirmPw}
                  show={showCon}
                  onToggleShow={toggleCon}
                  placeholder="Re-enter new password"
                />
                {confirmPw && confirmPw !== newPw && (
                  <p style={{ fontSize:12, color:'var(--danger)', margin:'4px 0 0' }}>Passwords do not match</p>
                )}
              </div>

              {/* Requirements checklist */}
              <div style={{ background:'var(--nav-hover-bg)', borderRadius:10, padding:'12px 14px' }}>
                <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 8px' }}>Requirements</p>
                {requirements.map(r => (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ width:16, height:16, borderRadius:'50%', background: r.ok ? 'var(--success-tint)' : 'var(--card-bg)', border: r.ok ? 'none' : '1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {r.ok && <span style={{ color:'var(--success)', fontSize:9, fontWeight:700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize:12, color: r.ok ? 'var(--success)' : 'var(--text-3)' }}>{r.label}</span>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'13px 16px', borderRadius:12, border:'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'var(--border-mid)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                  color:'#fff', fontSize:15, fontWeight:600, transition:'opacity 0.15s',
                  fontFamily:"'Inter',system-ui,sans-serif",
                }}
              >
                {loading
                  ? <><Loader2 style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> Updating...</>
                  : <><span>Set New Password</span><ArrowRight style={{ width:16, height:16 }} /></>
                }
              </button>
            </div>
          </div>

          <button
            onClick={logout}
            style={{ display:'block', margin:'16px auto 0', background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--text-3)', textAlign:'center' }}
          >
            Sign out instead
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
