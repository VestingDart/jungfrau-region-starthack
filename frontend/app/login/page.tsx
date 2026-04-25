'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginGuest, loginPartner, loginAdmin } from '@/lib/auth';

type Tab = 'guest' | 'partner' | 'admin';

const TAB_LABELS: Record<Tab, string> = { guest: 'Guest', partner: 'Partner', admin: 'Admin' };

const QUICK_LOGINS: Record<Tab, { label: string; sub: string; username: string; password: string }[]> = {
  guest: [
    { label: 'Anna Müller',    sub: 'Booking JFR-2026-A0001', username: 'anna_tokyo',   password: 'welcome1' },
    { label: 'James Chen',     sub: 'Booking JFR-2026-A0002', username: 'james_ldn',    password: 'welcome2' },
    { label: 'Marie Dubois',   sub: 'Booking JFR-2026-A0001', username: 'marie_paris',  password: 'welcome3' },
    { label: 'Lucas Weber',    sub: 'Booking JFR-2026-A0002', username: 'lucas_berlin', password: 'welcome4' },
  ],
  partner: [
    { label: 'Harder Kulm Mountain Railway', sub: 'Mountain railway · key-jungfraubahnen', username: 'harderkulm', password: 'partner123' },
    { label: 'Lake Thun Cruise',             sub: 'Cruise · key-outdoor',                  username: 'thuncruise',  password: 'partner456' },
    { label: 'BOB Railway',                  sub: 'Transport · key-skirental',              username: 'bobrailway',  password: 'partner789' },
  ],
  admin: [
    { label: 'Administrator', sub: 'Full settlement access', username: 'admin', password: 'admin123' },
  ],
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

  function handleTabChange(t: Tab) {
    setTab(t); setUsername(''); setPassword(''); setError('');
  }

  async function doLogin(u: string, p: string, t: Tab) {
    setLoading(true); setError('');
    try {
      let session;
      if (t === 'guest')        session = loginGuest(u, p);
      else if (t === 'partner') session = loginPartner(u, p);
      else                      session = loginAdmin(u, p);
      if (!session) { setError('Invalid username or password.'); setLoading(false); return; }
      router.push(`/${session.role}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doLogin(username, password, tab);
  }

  function quickLogin(u: string, p: string) {
    setUsername(u); setPassword(p);
    doLogin(u, p, tab);
  }

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', fontFamily: '-apple-system,system-ui,"Segoe UI",sans-serif', backgroundImage: 'url(/images/jungfrau-panorama.jpg)', backgroundSize: 'cover', backgroundPosition: 'center 30%' }}>

      {/* Dark overlay only on the left so hero text is readable — fades to fully transparent on the right */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(14,28,46,.85) 0%, rgba(14,28,46,.60) 30%, rgba(14,28,46,.12) 52%, transparent 68%)' }} />

      {/* ── Hero (left half) ── */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '52%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 3.5rem', zIndex: 2 }}>

        {/* top logo */}
        <div style={{ position: 'absolute', top: '2rem', left: '2.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.5)' }}>
            Jungfrau<em style={{ color: '#C4950E', fontStyle: 'normal' }}>.</em>Pass
          </span>
        </div>

        {/* hero headline */}
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C4950E', margin: '0 0 .85rem', textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>
            Jungfrau Region
          </p>
          <h2 style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-.025em', margin: '0 0 1.1rem', textShadow: '0 2px 28px rgba(14,28,46,.7)' }}>
            The Alps.<br />All in one pass.
          </h2>
          <p style={{ color: 'rgba(255,255,255,.75)', fontSize: '.92rem', lineHeight: 1.75, margin: '0 0 2rem', textShadow: '0 1px 10px rgba(14,28,46,.5)' }}>
            Your digital guest pass to Jungfrau Region — skip queues, unlock partner perks, and make every alpine moment count.
          </p>
        </div>

        {/* Demo tip */}
        <div style={{ maxWidth: 360, background: 'rgba(255,255,255,.07)', borderRadius: 14, padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(10px)' }}>
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: '.78rem', fontWeight: 700, marginBottom: '.3rem' }}>Demo tip</p>
          <p style={{ color: 'rgba(255,255,255,.48)', fontSize: '.75rem', lineHeight: 1.65, margin: 0 }}>
            Open three browser tabs — one per role. Sessions are isolated so guest, partner, and admin stay logged in simultaneously.
          </p>
        </div>

        {/* photo attribution */}
        <div style={{ position: 'absolute', bottom: '1rem', left: '2.5rem' }}>
          <p style={{ color: 'rgba(255,255,255,.2)', fontSize: '.58rem', margin: 0 }}>© Murray Foubister / CC BY-SA 2.0</p>
        </div>
      </div>

      {/* ── Form panel (right half) ── */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '48%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto', zIndex: 2 }}>
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

            {/* Quick demo login buttons */}
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--sub)', marginBottom: '.6rem' }}>
                Quick demo login
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
                {QUICK_LOGINS[tab].map(q => (
                  <button
                    key={q.username}
                    onClick={() => quickLogin(q.username, q.password)}
                    disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '.65rem .9rem', border: '1.5px solid var(--line)', borderRadius: 10,
                      background: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'border-color .15s, background .15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'rgba(196,149,14,.04)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = '#fff'; }}
                  >
                    <span>
                      <span style={{ display: 'block', fontSize: '.85rem', fontWeight: 700, color: 'var(--night)' }}>{q.label}</span>
                      <span style={{ display: 'block', fontSize: '.72rem', color: 'var(--sub)', marginTop: '.1rem' }}>{q.sub}</span>
                    </span>
                    <span style={{ fontSize: '.72rem', color: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '.75rem' }}>
                      One click →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span style={{ fontSize: '.72rem', color: 'var(--sub)', fontWeight: 600 }}>or enter manually</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
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
                  <div style={{ padding: '.7rem 1rem', background: '#fdecef', borderLeft: '3px solid var(--danger)', borderRadius: '0 8px 8px 0', fontSize: '.82rem', color: 'var(--danger)' }}>
                    {error}
                  </div>
                )}
                <button
                  type="submit" disabled={loading}
                  style={{ width: '100%', padding: '.8rem', border: 'none', borderRadius: 10, background: loading ? 'var(--sub)' : 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: '.9rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background .2s' }}
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
        </div>
      </div>

      <style>{`
        @media(max-width:768px){
          .login-hero { display: none !important; }
          .login-form { width: 100% !important; left: 0 !important; padding: 1.5rem !important; }
        }
      `}</style>
    </div>
  );
}
