'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { validateInviteCode, registerGuest, getSession } from '@/lib/auth';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '.72rem .9rem',
  border: '1.5px solid var(--line)', borderRadius: 10,
  fontSize: '.875rem', color: 'var(--text)', fontFamily: 'inherit',
  outline: 'none', background: '#fff', transition: 'border-color .2s',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.07em',
  color: 'var(--sub)', marginBottom: '.4rem',
};

export default function RegisterPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [codeFromUrl, setCodeFromUrl] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'valid' | 'invalid' | 'used'>('idle');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const session = getSession('guest');
    if (session) { router.replace('/guest'); return; }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || '';
    if (code) {
      setInviteCode(code);
      setCodeFromUrl(true);
      checkCode(code);
    }
  }, [router]);

  function checkCode(code: string) {
    const result = validateInviteCode(code.trim().toUpperCase());
    if (!result.valid) { setCodeStatus('invalid'); setGuestName(''); return; }
    if (result.alreadyUsed) { setCodeStatus('used'); setGuestName(result.guestName || ''); return; }
    setCodeStatus('valid');
    setGuestName(result.guestName || '');
  }

  function handleCodeChange(val: string) {
    setInviteCode(val);
    setCodeStatus('idle');
    setGuestName('');
    setError('');
    if (val.length >= 10) checkCode(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (codeStatus !== 'valid') { setError('Please enter a valid invite code.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const result = registerGuest(inviteCode.trim().toUpperCase(), username.trim(), password);
    if (!result.ok) { setError(result.error || 'Registration failed.'); setLoading(false); return; }

    setSuccess(true);
    setTimeout(() => router.push('/guest'), 1200);
  }

  const codeHint = {
    idle:    { color: 'var(--sub)',     text: '' },
    valid:   { color: 'var(--pine)',    text: `✓ Valid — Welcome, ${guestName}!` },
    invalid: { color: 'var(--danger)',  text: '✗ Invite code not found' },
    used:    { color: 'var(--gold)',    text: `⚠ This code was already used${guestName ? ` by ${guestName}` : ''}. Please log in instead.` },
  }[codeStatus];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '-apple-system,system-ui,"Segoe UI",sans-serif' }}>

      {/* ── Hero ── */}
      <div style={{ flex: '0 0 50%', position: 'relative', background: 'linear-gradient(145deg, #0E1C2E 0%, #1B3259 55%, #2D5396 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

        <svg viewBox="0 0 500 220" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', opacity: .11 }}>
          <path d="M0,220 L90,95 L150,145 L210,55 L270,108 L335,38 L395,82 L500,50 L500,220 Z" fill="white" />
        </svg>

        <div style={{ position: 'absolute', top: '2rem', left: '2rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff' }}>
            Jungfrau<em style={{ color: '#C4950E', fontStyle: 'normal' }}>.</em>Pass
          </span>
        </div>

        <div style={{ border: '2px dashed rgba(255,255,255,.18)', borderRadius: 16, padding: '3rem 2.5rem', textAlign: 'center', maxWidth: 320, position: 'relative', zIndex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.4" style={{ width: 52, height: 52, margin: '0 auto .85rem', display: 'block' }}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <p style={{ color: 'rgba(255,255,255,.45)', fontSize: '.82rem', lineHeight: 1.65, margin: 0 }}>
            Replace with Jungfrau hero image<br />
            <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.28)' }}>recommended 1920×1080px</span>
          </p>
        </div>

        <div style={{ position: 'absolute', bottom: '2.5rem', left: '2.5rem', right: '2.5rem', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '.8rem', lineHeight: 1.7, margin: 0 }}>
            Scan the QR code from your hotel<br />confirmation to get started instantly.
          </p>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div style={{ flex: '0 0 50%', background: 'var(--sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.025em', marginBottom: '.3rem' }}>Create your account</h1>
            <p style={{ color: 'var(--sub)', fontSize: '.875rem' }}>Use your hotel invite code to get started</p>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(14,28,46,.12)', padding: '2rem' }}>

            {success ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', animation: 'rise .3s var(--ease)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>✓</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--pine)', marginBottom: '.35rem' }}>Account created!</div>
                <div style={{ fontSize: '.875rem', color: 'var(--sub)' }}>Redirecting to your wallet…</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  <div>
                    <label style={labelStyle}>Invite Code</label>
                    <input
                      type="text" value={inviteCode}
                      onChange={e => handleCodeChange(e.target.value)}
                      readOnly={codeFromUrl}
                      placeholder="JFPASS-XXXX"
                      style={{ ...inputStyle, background: codeFromUrl ? 'var(--sand)' : '#fff', fontFamily: 'ui-monospace,monospace', letterSpacing: '.05em', textTransform: 'uppercase' }}
                      onFocus={e => !codeFromUrl && (e.target.style.borderColor = 'var(--gold)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                    />
                    {codeHint.text && (
                      <div style={{ fontSize: '.75rem', color: codeHint.color, marginTop: '.35rem', fontWeight: 500 }}>{codeHint.text}</div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>Username</label>
                    <input
                      type="text" value={username} onChange={e => setUsername(e.target.value)} required
                      placeholder="Choose a username"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Password</label>
                    <input
                      type="password" value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="Min. 6 characters"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <input
                      type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                      placeholder="Repeat password"
                      style={{ ...inputStyle, borderColor: confirmPassword && password !== confirmPassword ? 'var(--danger)' : 'var(--line)' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                      onBlur={e => (e.target.style.borderColor = confirmPassword && password !== confirmPassword ? 'var(--danger)' : 'var(--line)')}
                    />
                  </div>

                  {error && (
                    <div style={{ padding: '.7rem 1rem', background: '#fdecef', borderLeft: '3px solid var(--danger)', borderRadius: '0 8px 8px 0', fontSize: '.82rem', color: 'var(--danger)', animation: 'rise .2s var(--ease)' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit" disabled={loading || codeStatus === 'used'}
                    style={{ width: '100%', padding: '.8rem', border: 'none', borderRadius: 10, background: loading ? 'var(--sub)' : 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: '.9rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background .2s' }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--blue)'; }}
                    onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--navy)'; }}
                  >
                    {loading ? 'Creating account…' : 'Create account'}
                  </button>

                </div>
              </form>
            )}

            {!success && (
              <div style={{ marginTop: '1.25rem', padding: '.9rem 1rem', background: 'var(--sand)', borderRadius: 10, textAlign: 'center' }}>
                <p style={{ fontSize: '.78rem', color: 'var(--sub)', marginBottom: '.4rem' }}>Already registered?</p>
                <Link href="/login" style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--navy)', textDecoration: 'none' }}>
                  Sign in to your account →
                </Link>
              </div>
            )}
          </div>

          {/* demo invite codes */}
          <div style={{ marginTop: '1.25rem', padding: '.9rem 1.1rem', background: 'rgba(45,83,150,.07)', borderRadius: 12, border: '1px solid rgba(45,83,150,.14)' }}>
            <p style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--blue)', marginBottom: '.4rem' }}>Demo — unused invite codes</p>
            <p style={{ fontSize: '.76rem', color: 'var(--sub)', lineHeight: 1.7, margin: 0 }}>
              Clear localStorage first, then use:<br />
              JFPASS-A1B2 · JFPASS-C3D4 · JFPASS-E5F6
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
