'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';
import type { Session } from '@/lib/auth';

interface Guest {
  id: string;
  guest_card_id: string;
  email: string | null;
  check_in: string;
  check_out: string;
}

interface Entitlement {
  id: string;
  title: string;
  description: string | null;
  partner_name: string;
  original_price_rappen: number | null;
  partner_payout_rappen: number;
  image_hint: string | null;
}

interface PricedOffer {
  id: string;
  title: string;
  description: string | null;
  partner_name: string;
  partner_payout_rappen: number;
  original_price_rappen: number | null;
  image_hint: string | null;
}

interface Transaction {
  type: string;
  amount_rappen: number;
  created_at: string;
}

interface Wallet {
  balance_chf: number;
  guest: Guest;
  entitlements: Entitlement[];
  available_priced_offers: PricedOffer[];
  recent_transactions: Transaction[];
}

function esc(s: string | null | undefined) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function offerImg(title: string, hint: string | null) {
  const seed = hint || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `https://picsum.photos/seed/${seed}/600/400`;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-CH', { month: 'short', day: 'numeric' });
}

export default function GuestPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [guestId, setGuestId] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [topupAmount, setTopupAmount] = useState(200);
  const [toast, setToast] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [qrTitle, setQrTitle] = useState('');
  const [qrImg, setQrImg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  function signOut() {
    clearSession();
    router.push('/login');
  }

  async function apiFetch(path: string, opts: RequestInit = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.headers) Object.assign(headers, opts.headers);
    const res = await fetch(path, { ...opts, headers });
    if (!res.ok) { const t = await res.text(); throw new Error(`${res.status}: ${t}`); }
    return res.json();
  }

  async function loadWallet(id?: string) {
    const gid = id || guestId;
    if (!gid) return;
    try {
      const w: Wallet = await apiFetch(`/api/wallet/${gid}`);
      setWallet(w);
    } catch (e: unknown) {
      showToast('Failed to load wallet: ' + (e as Error).message);
    }
  }

  async function topup() {
    if (!topupAmount || topupAmount <= 0) return showToast('Invalid amount');
    try {
      const r = await apiFetch(`/api/wallet/${guestId}/topup`, {
        method: 'POST',
        headers: { 'Idempotency-Key': 'topup-' + Date.now() },
        body: JSON.stringify({ amount_chf: topupAmount, payment_method: 'twint' }),
      });
      window.open(r.checkout_url, '_blank', 'width=480,height=400');
      showToast('Complete payment in the popup, then refresh');
    } catch (e: unknown) {
      showToast('Top-up failed: ' + (e as Error).message);
    }
  }

  async function generateQR(eid: string | null, oid: string | null) {
    try {
      const body = eid ? { guest_id: guestId, entitlement_id: eid } : { guest_id: guestId, offer_id: oid };
      const r = await apiFetch('/api/qr/generate', { method: 'POST', body: JSON.stringify(body) });
      showQR(r.qr_token, r.expires_in_seconds);
    } catch (e: unknown) {
      showToast('QR gen failed: ' + (e as Error).message);
    }
  }

  function showQR(token: string, ttl: number) {
    setQrToken(token);
    setQrTitle('Show this to the partner');
    setQrImg(`https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encodeURIComponent(token)}`);
    setCountdown(ttl);
    setQrOpen(true);
    if (tickerRef.current) clearInterval(tickerRef.current);
    let s = ttl;
    tickerRef.current = setInterval(() => {
      s--;
      setCountdown(s);
      if (s <= 0) {
        if (tickerRef.current) clearInterval(tickerRef.current);
        setQrOpen(false);
        showToast('QR expired — generate a new one');
        loadWallet();
      }
    }, 1000);
  }

  function downloadPass() {
    if (!guestId) return showToast('Still loading — try again in a moment');
    const name = encodeURIComponent(session?.name || 'Guest');
    const a = document.createElement('a');
    a.href = `/api/wallet/${guestId}/pass.pkpass?name=${name}`;
    a.download = 'jungfrau-guest-card.pkpass';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function closeModal() {
    setQrOpen(false);
    if (tickerRef.current) clearInterval(tickerRef.current);
    loadWallet();
  }

  function copyToken() {
    navigator.clipboard.writeText(qrToken).then(() => showToast('Token copied'));
  }

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== 'guest') { router.replace('/login'); return; }
    setSession(s);
    setAuthChecking(false);
    fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_card_id: s.cardId, check_in: '2026-04-25', check_out: '2026-04-29' }),
    })
      .then(async r => {
        const text = await r.text();
        try { return JSON.parse(text); } catch { return {}; }
      })
      .then(d => setGuestId(d.guest?.id || ''))
      .catch(err => console.error('Checkin failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (guestId) loadWallet(guestId); }, [guestId]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data === 'topup_complete') loadWallet();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);

  if (authChecking) return null;

  const g = wallet?.guest;
  const cardNumber = g?.guest_card_id || session?.cardId || 'JFR-2026-A0001';
  const cbName = session?.name || 'Guest';
  const cbValidity = g ? `Valid: ${fmt(g.check_in)} – ${fmt(g.check_out)}, 2026` : 'Valid: —';

  return (
    <>
      <nav className="navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
        <div className="nav-logo">Jungfrau<em style={{ color: 'var(--gold)' }}>.</em>Wallet</div>
        <div className="nav-sep" />
        <div className="nav-right">
          <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.65)', fontWeight: 500 }}>Hi, {session?.name}</span>
          <button
            onClick={() => setWalletOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: 'var(--gold)', color: '#fff', border: 'none', padding: '.42rem 1rem .42rem .75rem', borderRadius: 22, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', letterSpacing: '.01em', fontFamily: 'inherit' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17, flexShrink: 0 }}>
              <rect x="2" y="7" width="20" height="14" rx="2.5" /><path d="M16 7V5a2 2 0 0 0-4 0v2" /><circle cx="16" cy="14" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            mywallet
          </button>
          <button
            onClick={signOut}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.2)', color: 'rgba(255,255,255,.7)', padding: '.38rem .85rem', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <section style={{ position: 'relative', height: '85vh', minHeight: 500, backgroundImage: "url('https://picsum.photos/seed/swiss-alps-three-peaks/1920/1080')", backgroundSize: 'cover', backgroundPosition: 'top center', backgroundAttachment: 'fixed', marginTop: 64 }}>
        <div style={{ content: '', position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 38%, rgba(242,239,232,.55) 65%, rgba(242,239,232,.88) 82%, #F2EFE8 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '2.5rem 2.5rem 3.5rem', color: '#fff' }}>
          <div style={{ display: 'inline-block', background: 'var(--gold)', color: '#fff', padding: '.18rem .65rem', borderRadius: 4, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: '.85rem' }}>Welcome</div>
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.06, marginBottom: '.6rem', textShadow: '0 2px 20px rgba(0,0,0,.35)' }}>Welcome to the<br />Jungfrau Region</h1>
          <p style={{ fontSize: '1rem', opacity: .82, maxWidth: 460, lineHeight: 1.65, textShadow: '0 1px 8px rgba(0,0,0,.3)' }}>Your digital guest wallet — exclusive alpine perks, seamless payments, one card.</p>
        </div>
      </section>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>

        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.01em' }}>Included in Your Stay</h2>
            <p style={{ fontSize: '.875rem', color: 'var(--sub)', marginTop: '.3rem' }}>These perks are bundled with your booking — activate each one with a single tap.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: '1.5rem' }}>
            {!wallet
              ? <div style={{ color: 'var(--sub)', fontSize: '.875rem', padding: '1rem' }}>Loading...</div>
              : !wallet.entitlements?.length
              ? <p style={{ color: 'var(--sub)', fontSize: '.875rem', padding: '1rem 0' }}>All entitlements used.</p>
              : wallet.entitlements.map((e, i) => {
                const val = ((e.original_price_rappen || e.partner_payout_rappen || 0) / 100).toFixed(2);
                return (
                  <div key={e.id} style={{ background: 'var(--white)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', animation: 'rise .5s var(--ease) both', animationDelay: `${i * .07}s`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: 'var(--sand)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={offerImg(e.title, e.image_hint)} alt={esc(e.title)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <span style={{ position: 'absolute', top: '.75rem', left: '.75rem', background: 'rgba(14,28,46,.7)', backdropFilter: 'blur(6px)', color: '#fff', padding: '.2rem .55rem', borderRadius: 5, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em' }}>Included</span>
                      <span style={{ position: 'absolute', top: '.75rem', right: '.75rem', background: 'var(--pine)', color: '#fff', padding: '.2rem .55rem', borderRadius: 5, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em' }}>FREE</span>
                    </div>
                    <div style={{ padding: '1.2rem 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--sub)', marginBottom: '.35rem' }}>{e.partner_name}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: '.42rem' }}>{e.title}</div>
                      <div style={{ fontSize: '.82rem', color: 'var(--sub)', lineHeight: 1.55, marginBottom: '1rem', flex: 1 }}>{e.description || ''}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '.8rem', color: 'var(--sub)', textDecoration: 'line-through' }}>CHF {val} value</span>
                        <span style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--pine)', letterSpacing: '-.01em' }}>FREE</span>
                      </div>
                      <button onClick={() => generateQR(e.id, null)} style={{ width: '100%', border: 'none', borderRadius: 9, padding: '.68rem 1rem', fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', background: 'var(--navy)', color: '#fff', fontFamily: 'inherit' }}>Use Now</button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.01em' }}>Exclusive Experiences</h2>
            <p style={{ fontSize: '.875rem', color: 'var(--sub)', marginTop: '.3rem' }}>Pay directly from your wallet — no card needed at the venue.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: '1.5rem' }}>
            {!wallet
              ? <div style={{ color: 'var(--sub)', fontSize: '.875rem', padding: '1rem' }}>Loading...</div>
              : !wallet.available_priced_offers?.length
              ? <p style={{ color: 'var(--sub)', fontSize: '.875rem', padding: '1rem 0' }}>No experiences available.</p>
              : wallet.available_priced_offers.map((o, i) => {
                const chf = (o.partner_payout_rappen / 100).toFixed(2);
                const ok = (wallet.balance_chf ?? 0) >= o.partner_payout_rappen / 100;
                const orig = o.original_price_rappen;
                const disc = orig && orig > o.partner_payout_rappen ? Math.round((1 - o.partner_payout_rappen / orig) * 100) : 0;
                return (
                  <div key={o.id} style={{ background: 'var(--white)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', animation: 'rise .5s var(--ease) both', animationDelay: `${i * .07}s`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: 'var(--sand)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={offerImg(o.title, o.image_hint)} alt={esc(o.title)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <span style={{ position: 'absolute', top: '.75rem', left: '.75rem', background: 'rgba(14,28,46,.7)', backdropFilter: 'blur(6px)', color: '#fff', padding: '.2rem .55rem', borderRadius: 5, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em' }}>Wallet</span>
                      {disc ? <span style={{ position: 'absolute', top: '.75rem', right: '.75rem', background: 'var(--gold)', color: '#fff', padding: '.2rem .55rem', borderRadius: 5, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em' }}>{disc}% OFF</span> : null}
                    </div>
                    <div style={{ padding: '1.2rem 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--sub)', marginBottom: '.35rem' }}>{o.partner_name}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: '.42rem' }}>{o.title}</div>
                      <div style={{ fontSize: '.82rem', color: 'var(--sub)', lineHeight: 1.55, marginBottom: '1rem', flex: 1 }}>{o.description || ''}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '1rem' }}>
                        {orig && disc ? <span style={{ fontSize: '.8rem', color: 'var(--sub)', textDecoration: 'line-through' }}>CHF {(orig / 100).toFixed(2)}</span> : null}
                        <span style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.01em' }}>CHF {chf}</span>
                      </div>
                      <button onClick={() => ok ? generateQR(null, o.id) : undefined} disabled={!ok} style={{ width: '100%', border: 'none', borderRadius: 9, padding: '.68rem 1rem', fontWeight: 700, fontSize: '.875rem', cursor: ok ? 'pointer' : 'not-allowed', background: ok ? 'var(--navy)' : 'var(--sub)', color: '#fff', opacity: ok ? 1 : .45, fontFamily: 'inherit' }}>
                        {ok ? 'Book with Wallet' : 'Insufficient Balance'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section>
          <div style={{ background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sub)' }}>Transaction History</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => loadWallet()}>Refresh</button>
            </div>
            <div style={{ padding: '.25rem 1.5rem' }}>
              {!wallet?.recent_transactions?.length
                ? <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--sub)', fontSize: '.875rem' }}>No transactions yet</div>
                : wallet.recent_transactions.slice(0, 10).map((t, i) => {
                  const a = t.amount_rappen / 100;
                  const s = a >= 0 ? '+' : '';
                  const d = new Date(t.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' });
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.72rem 0', borderBottom: '1px solid var(--line)', fontSize: '.84rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t.type}</div>
                        <div style={{ fontSize: '.73rem', color: 'var(--sub)' }}>{d}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: a >= 0 ? 'var(--pine)' : 'var(--danger)' }}>{s}CHF {Math.abs(a).toFixed(2)}</div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </section>
      </main>

      {walletOpen && <div onClick={() => setWalletOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.45)', zIndex: 60 }} />}
      <div style={{ position: 'fixed', top: 0, right: walletOpen ? 0 : -420, width: 390, height: '100vh', background: 'var(--white)', boxShadow: '-4px 0 56px rgba(14,28,46,.22)', zIndex: 61, transition: 'right .38s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'var(--night)', padding: '1.25rem 1.5rem 1.35rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.15rem' }}>
            <span style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.45)', fontWeight: 700 }}>My Wallet</span>
            <button onClick={() => setWalletOpen(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#x2715;</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: '.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--sub)', marginBottom: '.85rem' }}>Available Balance</div>
            <div style={{ fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-.04em', color: 'var(--night)', lineHeight: 1, marginBottom: '1.25rem' }}>CHF {(wallet?.balance_chf ?? 0).toFixed(2)}</div>
            <div style={{ fontSize: '.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--sub)', marginBottom: '.6rem' }}>Top up via TWINT</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.4rem', marginBottom: '.75rem' }}>
              {[50, 100, 200, 500].map(v => (
                <button key={v} onClick={() => setTopupAmount(v)} style={{ background: topupAmount === v ? 'var(--navy)' : 'var(--sand)', border: `1px solid ${topupAmount === v ? 'var(--navy)' : 'var(--line)'}`, borderRadius: 8, padding: '.48rem 0', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', color: topupAmount === v ? '#fff' : 'var(--text)', fontFamily: 'inherit' }}>+{v}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input type="number" value={topupAmount} min={10} step={10} onChange={e => setTopupAmount(Number(e.target.value))} style={{ flex: 1, padding: '.62rem .75rem', border: '1px solid var(--line)', borderRadius: 8, fontSize: '.875rem', color: 'var(--text)', fontFamily: 'inherit' }} />
              <button onClick={topup} style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '.62rem 1rem', borderRadius: 8, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Top up</button>
            </div>
          </div>

          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: '.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--sub)', marginBottom: '.9rem' }}>My Card</div>
            <div onClick={() => setCardFlipped(f => !f)} style={{ perspective: 1100, height: 190, cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform .68s cubic-bezier(.4,0,.2,1)', transformStyle: 'preserve-3d', transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', backfaceVisibility: 'hidden', boxShadow: '0 10px 36px rgba(14,28,46,.3)', background: 'var(--navy)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://picsum.photos/seed/alpine-peaks-summit/600/380" alt="Jungfrau peaks" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .55 }} />
                  <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: '1.1rem 1.3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(140deg, rgba(14,28,46,.72) 0%, rgba(14,28,46,.18) 100%)', color: '#fff' }}>
                    <div style={{ fontSize: '.62rem', fontWeight: 900, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .85 }}>Jungfrau Region</div>
                    <div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '.04em' }}>Guest Pass</div>
                      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.7rem', opacity: .65, letterSpacing: '.1em' }}>{cardNumber}</div>
                    </div>
                  </div>
                </div>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', backfaceVisibility: 'hidden', boxShadow: '0 10px 36px rgba(14,28,46,.3)', transform: 'rotateY(180deg)', background: 'linear-gradient(150deg, #0a1625 0%, #1B3259 100%)' }}>
                  <div style={{ height: 38, background: 'rgba(0,0,0,.45)', marginTop: 30 }} />
                  <div style={{ padding: '.8rem 1.3rem', display: 'flex', flexDirection: 'column', gap: '.35rem', color: '#fff' }}>
                    <div style={{ fontSize: '.92rem', fontWeight: 700, letterSpacing: '.02em' }}>{cbName}</div>
                    <div style={{ fontSize: '.68rem', opacity: .5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{cbValidity}</div>
                    <div style={{ background: '#fff', display: 'inline-block', padding: 4, borderRadius: 6, marginTop: '.3rem', lineHeight: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=66x66&data=${encodeURIComponent(cardNumber)}`} alt="Card QR" style={{ width: 66, height: 66, display: 'block' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '.7rem', color: 'var(--sub)', marginTop: '.55rem', letterSpacing: '.05em' }}>Tap card to flip</div>
            <button
              onClick={downloadPass}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem',
                width: '100%', marginTop: '1rem', padding: '.7rem 1rem',
                background: '#000', color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit',
                letterSpacing: '.01em',
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
                <path d="M19.5 3.75H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V6a2.25 2.25 0 0 0-2.25-2.25ZM4.5 5.25h15a.75.75 0 0 1 .75.75v1.5H3.75V6a.75.75 0 0 1 .75-.75Zm15 13.5H4.5a.75.75 0 0 1-.75-.75V9.75h16.5V18a.75.75 0 0 1-.75.75ZM6 14.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm0 2.25a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 16.5Z"/>
              </svg>
              Add to Wallet
            </button>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--sub)', marginBottom: '.75rem' }}>Recent Activity</div>
            {!wallet?.recent_transactions?.length
              ? <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--sub)', fontSize: '.875rem' }}>No activity yet</div>
              : wallet.recent_transactions.slice(0, 8).map((t, i) => {
                const a = t.amount_rappen / 100;
                const s = a >= 0 ? '+' : '';
                const d = new Date(t.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' });
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem 0', borderBottom: '1px solid var(--line)', fontSize: '.82rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t.type}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--sub)' }}>{d}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: a >= 0 ? 'var(--pine)' : 'var(--danger)' }}>{s}CHF {Math.abs(a).toFixed(2)}</div>
                  </div>
                );
              })
            }
          </div>
        </div>
      </div>

      {qrOpen && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(5px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)', animation: 'rise .25s var(--ease)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '.3rem', color: 'var(--text)' }}>{qrTitle}</div>
            <div style={{ fontSize: '.85rem', color: 'var(--sub)' }}>Expires in <span style={{ color: 'var(--danger)', fontWeight: 800 }}>{countdown}</span>s</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImg} alt="QR code" style={{ width: 210, height: 210, margin: '1.25rem auto', border: '10px solid var(--sand)', borderRadius: 10, display: 'block' }} />
            <p style={{ fontSize: '.72rem', color: 'var(--sub)' }}>Or copy the token (demo without a camera):</p>
            <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.62rem', background: 'var(--sand)', padding: '.5rem', borderRadius: 6, wordBreak: 'break-all', maxHeight: 54, overflow: 'auto', color: 'var(--sub)', marginTop: '.75rem', textAlign: 'left' }}>{qrToken}</div>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', justifyContent: 'center' }}>
              <button onClick={copyToken} className="btn btn-ghost" style={{ padding: '.58rem 1.1rem', fontSize: '.875rem' }}>Copy token</button>
              <button onClick={closeModal} className="btn btn-primary" style={{ padding: '.58rem 1.1rem', fontSize: '.875rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}
