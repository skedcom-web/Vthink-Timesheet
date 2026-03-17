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

  const strength = (() => {
    if (!newPw) return { score: 0, label: '', color: '' };
    let s = 0;
    if (newPw.length >= 8)         s++;
    if (/[A-Z]/.test(newPw))       s++;
    if (/[0-9]/.test(newPw))       s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return {
      score: s,
      label: ['', 'Weak', 'Fair', 'Good', 'Strong'][s],
      color: ['', '#DC2626', '#F59E0B', '#3B82F6', '#16A34A'][s],
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
    { ok: newPw.length >= 8,          label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(newPw),        label: 'At least one uppercase letter' },
    { ok: /[0-9]/.test(newPw),        label: 'At least one number' },
    { ok: /[^A-Za-z0-9]/.test(newPw), label: 'At least one special character' },
  ];

  const PwField = ({ val, setVal, show, setShow, placeholder }: any) => (
    <div style={{ position:'relative' }}>
      <Lock style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:15, height:15, color:'#9CA3AF' }} />
      <input
        type={show ? 'text' : 'password'}
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={placeholder}
        className="input"
        style={{ paddingLeft:36, paddingRight:36 }}
      />
      <button type="button" onClick={() => setShow((v: boolean) => !v)}
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF' }}>
        {show ? <EyeOff style={{ width:15, height:15 }} /> : <Eye style={{ width:15, height:15 }} />}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'#F9FAFB' }}>
      <div style={{ width:'100%', maxWidth:440 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ display:'inline-flex', alignItems:'baseline' }}>
            <span style={{ fontSize:26, fontWeight:700, color:'#EF4444' }}>v</span>
            <span style={{ fontSize:26, fontWeight:700, color:'#111827' }}>Think</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#EF4444', marginLeft:2 }}>*</span>
          </div>
        </div>

        <div className="card" style={{ padding:32 }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'#FFFBEB', border:'1px solid #FDE68A', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ShieldCheck style={{ width:20, height:20, color:'#D97706' }} />
            </div>
            <div>
              <h2 style={{ fontSize:18, fontWeight:600, color:'var(--text-1)', margin:0 }}>Set New Password</h2>
              <p style={{ fontSize:12, color:'var(--text-2)', margin:0 }}>Required before you can continue</p>
            </div>
          </div>

          {/* Warning */}
          <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'10px 14px', marginBottom:20, fontSize:13, color:'#92400E' }}>
            Your account was created with a temporary password. Please set a new secure password to proceed.
          </div>

          {error && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#DC2626', display:'flex', gap:8 }}>
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label className="label">Temporary Password</label>
              <PwField val={currentPw} setVal={setCurrentPw} show={showCur} setShow={setShowCur} placeholder="Enter your temporary password" />
            </div>

            <div>
              <label className="label">New Password</label>
              <PwField val={newPw} setVal={setNewPw} show={showNew} setShow={setShowNew} placeholder="Min 8 chars, upper, number, special" />
              {newPw && (
                <div style={{ marginTop:8 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex:1, height:4, borderRadius:99, background: i <= strength.score ? strength.color : 'var(--border-mid)', transition:'background 0.2s' }} />
                    ))}
                  </div>
                  <p style={{ fontSize:11, color: strength.color, margin:0 }}>{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <PwField val={confirmPw} setVal={setConfirmPw} show={showCon} setShow={setShowCon} placeholder="Re-enter new password" />
              {confirmPw && confirmPw !== newPw && (
                <p style={{ fontSize:11, color:'#DC2626', marginTop:4 }}>Passwords do not match</p>
              )}
            </div>

            {/* Requirements */}
            <div style={{ background:'var(--border)', borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
              <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>Requirements</p>
              {requirements.map(r => (
                <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', background: r.ok ? '#DCFCE7' : '#fff', border: r.ok ? 'none' : '1px solid var(--border-mid)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {r.ok && <span style={{ color:'#16A34A', fontSize:9, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:12, color: r.ok ? '#16A34A' : 'var(--text-3)' }}>{r.label}</span>
                </div>
              ))}
            </div>

            <button onClick={handleSubmit} disabled={loading} className="btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'11px 16px', borderRadius:10, fontSize:14 }}>
              {loading ? 'Updating…' : <><span>Set New Password</span><ArrowRight style={{ width:16, height:16 }} /></>}
            </button>

            <button onClick={logout} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--text-3)', textAlign:'center' }}>
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
