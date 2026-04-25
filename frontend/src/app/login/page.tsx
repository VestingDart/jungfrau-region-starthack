'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginGuest, loginPartner, loginAdmin, getSession } from '@/lib/auth';

type Tab = 'guest' | 'partner' | 'admin';

const TAB_LABELS: Record<Tab, string> = { guest: 'Guest', partner: 'Partner', admin: 'Admin' };

const DEMO: Record<Tab, string> = {
  guest:   'anna_tokyo / welcome1 · james_ldn / welcome2\nmarie_paris / welcome3 · lucas_berlin / welcome4',
  partner: 'harderkulm / partner123\nthuncruise / partner456 · bobrailway / partner789',
  admin:   'admin / admin123',
};

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

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('guest');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) router.replace(`/${session.role}`);
  }, [router]);

  function handleTabChange(t: Tab) {
    setTab(t); setUsername(''); setPassword(''); setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      let session;
      if (tab === 'guest')   session = loginGuest(username, password);
      else if (tab === 'partner') session = loginPartner(username, password);
      else                   session = loginAdmin(username, password);

      if (!session) { setError('Invalid username or password.'); setLoading(false); return; }
      router.push(`/${session.role}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '-apple-system,system-ui,"Segoe UI",sans-serif' }}>

      {/* ── Hero ── */}
      <div style={{ flex: '0 0 50%', position: 'relative', backgroundImage: 'url(/images/jungfrau-panorama.jpg)', backgroundSize: 'cover', backgroundPosition: 'center 30%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

        {/* dark overlay for contrast */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(170deg, rgba(14,28,46,.75) 0%, rgba(27,50,89,.55) 50%, rgba(14,28,46,.65) 100%)' }} />

        {/* bottom fade into mountain silhouette */}
        <svg viewBox="0 0 500 220" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', opacity: .22, zIndex: 1 }}>
          <path d="M0,220 L90,95 L150,145 L210,55 L270,108 L335,38 L395,82 L500,50 L500,220 Z" fill="white" />
        </svg>

        {/* top logo */}
        <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 2 }}>
          <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>
            Jungfrau<em style={{ color: '#C4950E', fontStyle: 'normal' }}>.</em>Pass
          </span>
        </div>

        {/* hero headline */}
        <div style={{ textAlign: 'center', maxWidth: 380, position: 'relative', zIndex: 2, padding: '0 2.5rem' }}>
          <p style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C4950E', margin: '0 0 .85rem', textShadow: '0 1px 6px rgba(0,0,0,.5)' }}>
            Jungfrau Region
          </p>
          <h2 style={{ fontSize: '2.6rem', fontWeight: 900, color: '#fff', lineHeight: 1.12, letterSpacing: '-.025em', margin: '0 0 1.1rem', textShadow: '0 2px 24px rgba(14,28,46,.6)' }}>
            The Alps.<br />All in one pass.
          </h2>
          <p style={{ color: 'rgba(255,255,255,.78)', fontSize: '.92rem', lineHeight: 1.75, margin: 0, textShadow: '0 1px 10px rgba(14,28,46,.5)' }}>
            Your digital guest pass to Jungfrau Region — skip queues, unlock partner perks, and make every alpine moment count.
          </p>
        </div>

        {/* bottom attribution */}
        <div style={{ position: 'absolute', bottom: '1.25rem', right: '1.25rem', zIndex: 2 }}>
          <p style={{ color: 'rgba(255,255,255,.28)', fontSize: '.62rem', margin: 0 }}>
            © Murray Foubister / CC BY-SA 2.0
          </p>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div style={{ flex: '0 0 50%', background: 'var(--sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.025em', marginBottom: '.3rem' }}>Welcome back</h1>
            <p style={{ color: 'var(--sub)', fontSize: '.875rem' }}>Sign in to your JungfrauPass account</p>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(14,28,46,.12)', padding: '2rem' }}>

            {/* tabs */}
            <div style={{ display: 'flex', background: 'var(--sand)', borderRadius: 10, padding: 4, marginBottom: '1.5rem' }}>
              {(['guest', 'partner', 'admin'] as Tab[]).map(t => (
                <button key={t} onClick={() => handleTabChange(t)} style={{
                  flex: 1, padding: '.55rem .4rem', border: 'none', cursor: 'pointer', borderRadius: 7,
                  fontWeight: 600, fontSize: '.82rem', fontFamily: 'inherit', transition: 'all .2s',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? 'var(--navy)' : 'var(--sub)',
                  boxShadow: tab === t ? '0 1px 6px rgba(14,28,46,.1)' : 'none',
                }}>
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text" value={username} onChange={e => setUsername(e.target.value)} required
                    placeholder={tab === 'admin' ? 'admin' : tab === 'partner' ? 'e.g. harderkulm' : 'e.g. anna_tokyo'}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                  />
                </div>

                {error && (
                  <div style={{ padding: '.7rem 1rem', background: '#fdecef', borderLeft: '3px solid var(--danger)', borderRadius: '0 8px 8px 0', fontSize: '.82rem', color: 'var(--danger)', animation: 'rise .2s var(--ease)' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  style={{ width: '100%', padding: '.8rem', border: 'none', borderRadius: 10, background: loading ? 'var(--sub)' : 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: '.9rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background .2s, transform .15s' }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = 'var(--blue)'); }}
                  onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = 'var(--navy)'); }}
                >
                  {loading ? 'Signing in…' : `Sign in as ${TAB_LABELS[tab]}`}
                </button>

              </div>
            </form>

            {tab === 'guest' && (
              <div style={{ marginTop: '1.25rem', padding: '.9rem 1rem', background: 'var(--sand)', borderRadius: 10, textAlign: 'center' }}>
                <p style={{ fontSize: '.78rem', color: 'var(--sub)', marginBottom: '.4rem' }}>New guest? Use your hotel invite code</p>
                <Link href="/register" style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--navy)', textDecoration: 'none' }}>
                  Register with invite code →
                </Link>
              </div>
            )}
          </div>

          {/* demo box */}
          <div style={{ marginTop: '1.25rem', padding: '.9rem 1.1rem', background: 'rgba(45,83,150,.07)', borderRadius: 12, border: '1px solid rgba(45,83,150,.14)' }}>
            <p style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--blue)', marginBottom: '.4rem' }}>Demo credentials</p>
            <pre style={{ fontSize: '.76rem', color: 'var(--sub)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{DEMO[tab]}</pre>
          </div>

        </div>
      </div>

      <style>{`
        @media(max-width:768px){
          .auth-split { flex-direction: column !important; }
          .auth-hero { flex: 0 0 220px !important; }
          .auth-form { flex: 1 !important; }
        }
      `}</style>
    </div>
  );
}
