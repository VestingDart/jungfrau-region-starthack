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
    clearSession('guest');
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

  function closeModal() {
    setQrOpen(false);
    if (tickerRef.current) clearInterval(tickerRef.current);
    loadWallet();
  }

  function copyToken() {
    navigator.clipboard.writeText(qrToken).then(() => showToast('Token copied'));
  }

  useEffect(() => {
    const s = getSession('guest');
    if (!s) { router.replace('/login'); return; }
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
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
        .offer-card {
          transition: transform .28s var(--ease), box-shadow .28s var(--ease);
          will-change: transform;
        }
        .offer-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 56px rgba(14,28,46,.18) !important;
        }
        .offer-card .card-img {
          transition: transform .5s var(--ease);
        }
        .offer-card:hover .card-img {
          transform: scale(1.06);
        }
        .use-btn { transition: background .2s, transform .15s var(--ease) !important; }
        .use-btn:not(:disabled):hover {
          background: var(--blue) !important;
          transform: translateY(-1px);
        }
        .stat-chip {
          transition: transform .22s var(--ease), box-shadow .22s var(--ease);
          cursor: default;
        }
        .stat-chip:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 32px rgba(14,28,46,.13) !important;
        }
        .topup-preset { transition: background .15s, border-color .15s, color .15s; }
        .topup-preset:hover { border-color: var(--gold) !important; }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
        <div className="nav-logo">
          Jungfrau<em style={{ color: 'var(--gold)' }}>.</em>Pass
        </div>
        <div className="nav-sep" />
        <div className="nav-right">
          <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>
            Hi, {session?.name}
          </span>
          <button
            onClick={() => setWalletOpen(o => !o)}
            style={{ background: 'var(--gold)', color: '#fff', border: 'none', padding: '.42rem 1.1rem', borderRadius: 22, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 14px rgba(196,149,14,.4)', letterSpacing: '.01em' }}
          >
            {wallet ? `CHF ${(wallet.balance_chf ?? 0).toFixed(2)}` : 'My Wallet'}
          </button>
          <button
            onClick={signOut}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.65)', padding: '.38rem .85rem', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', height: '90vh', minHeight: 560, backgroundImage: "url('/images/jungfrau-panorama.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 28%', backgroundAttachment: 'fixed', marginTop: 64 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(175deg, rgba(14,28,46,.84) 0%, rgba(27,50,89,.6) 42%, rgba(14,28,46,.78) 100%)' }} />

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', zIndex: 2 }}>
          <div style={{ animation: 'fadeUp .65s var(--ease) both', animationDelay: '.08s' }}>
            <span style={{ display: 'inline-block', background: 'var(--gold)', color: '#fff', padding: '.22rem .9rem', borderRadius: 24, fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.16em', marginBottom: '1.35rem', boxShadow: '0 3px 18px rgba(196,149,14,.45)' }}>
              Welcome, {session?.name}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.6rem,6.5vw,4.6rem)', fontWeight: 900, color: '#fff', lineHeight: 1.04, letterSpacing: '-.04em', textShadow: '0 4px 36px rgba(14,28,46,.7)', maxWidth: 660, margin: 0, animation: 'fadeUp .7s var(--ease) both', animationDelay: '.18s' }}>
            Your Alpine<br />Adventure Awaits
          </h1>

          <p style={{ color: 'rgba(255,255,255,.76)', fontSize: '1.05rem', lineHeight: 1.72, marginTop: '1.1rem', maxWidth: 480, textShadow: '0 1px 12px rgba(14,28,46,.5)', animation: 'fadeUp .7s var(--ease) both', animationDelay: '.3s' }}>
            Digital guest pass to Jungfrau Region — skip queues, unlock partner perks, and make every alpine moment count.
          </p>

          {wallet && (
            <div style={{ marginTop: '2.25rem', display: 'inline-flex', alignItems: 'center', gap: '.9rem', background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', padding: '.8rem 1.6rem', borderRadius: 50, border: '1px solid rgba(255,255,255,.18)', animation: 'fadeUp .7s var(--ease) both', animationDelay: '.42s' }}>
              <span style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.55)', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Wallet</span>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', letterSpacing: '-.025em' }}>CHF {(wallet.balance_chf ?? 0).toFixed(2)}</span>
              <button onClick={() => setWalletOpen(true)} style={{ background: 'var(--gold)', color: '#fff', border: 'none', padding: '.32rem .9rem', borderRadius: 20, fontWeight: 700, fontSize: '.7rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.04em', boxShadow: '0 2px 10px rgba(196,149,14,.4)' }}>
                Top up →
              </button>
            </div>
          )}
        </div>

        {/* Mountain silhouette blending into page */}
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', zIndex: 3 }}>
          <path d="M0,100 L160,46 L260,76 L380,22 L500,60 L620,14 L740,52 L860,18 L980,58 L1100,26 L1220,64 L1340,38 L1440,54 L1440,100 Z" fill="#F2EFE8" />
        </svg>

        <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', zIndex: 2 }}>
          <p style={{ color: 'rgba(255,255,255,.2)', fontSize: '.58rem', margin: 0 }}>© Murray Foubister / CC BY-SA 2.0</p>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ background: '#F2EFE8', padding: '0 2rem 3.5rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '1rem' }}>
          {[
            { label: 'Elevation', value: '3,454 m', sub: 'Jungfraujoch' },
            { label: 'Ski terrain', value: '213 km', sub: 'of pistes' },
            { label: 'Experiences', value: `${(wallet?.entitlements?.length || 0) + (wallet?.available_priced_offers?.length || 0)}`, sub: 'available for you' },
            { label: 'Your stay', value: wallet?.guest ? `${fmt(wallet.guest.check_in)} – ${fmt(wallet.guest.check_out)}` : '…', sub: '2026' },
          ].map((s, i) => (
            <div key={s.label} className="stat-chip" style={{ background: '#fff', borderRadius: 16, padding: '1.25rem 1.5rem', boxShadow: '0 2px 16px rgba(14,28,46,.07)', animation: 'rise .5s var(--ease) both', animationDelay: `${i * .09}s` }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: '.3rem' }}>{s.label} · {s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem 5rem' }}>

        {/* Included perks */}
        <section style={{ marginBottom: '4.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--gold)', marginBottom: '.35rem' }}>Bundled with your booking</div>
              <h2 style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1 }}>Your Included Perks</h2>
              <p style={{ fontSize: '.875rem', color: 'var(--sub)', marginTop: '.35rem', lineHeight: 1.6 }}>Tap any card to activate — no payment needed.</p>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--line)', marginBottom: '1.6rem' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: '1.5rem' }}>
            {!wallet
              ? [0, 1, 2].map(i => (
                  <div key={i} style={{ height: 380, background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .5s var(--ease) both', animationDelay: `${i * .1}s` }}>
                    <div style={{ height: 205, background: 'linear-gradient(90deg, var(--sand) 0%, #e8e3d9 50%, var(--sand) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite' }} />
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                      <div style={{ height: 9, background: 'var(--line)', borderRadius: 5, width: '42%' }} />
                      <div style={{ height: 16, background: 'var(--line)', borderRadius: 5, width: '78%' }} />
                      <div style={{ height: 9, background: 'var(--line)', borderRadius: 5, width: '60%' }} />
                    </div>
                  </div>
                ))
              : !wallet.entitlements?.length
              ? <p style={{ color: 'var(--sub)', fontSize: '.875rem', padding: '1rem 0' }}>All entitlements used.</p>
              : wallet.entitlements.map((e, i) => {
                const val = ((e.original_price_rappen || e.partner_payout_rappen || 0) / 100).toFixed(2);
                return (
                  <div key={e.id} className="offer-card" style={{ background: 'var(--white)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', animation: 'rise .52s var(--ease) both', animationDelay: `${i * .08}s`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', height: 205, overflow: 'hidden', background: 'var(--sand)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={offerImg(e.title, e.image_hint)} alt={esc(e.title)} loading="lazy" className="card-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,28,46,.38) 0%, transparent 55%)' }} />
                      <span style={{ position: 'absolute', top: '.75rem', left: '.75rem', background: 'var(--gold)', color: '#fff', padding: '.22rem .65rem', borderRadius: 20, fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', boxShadow: '0 2px 10px rgba(196,149,14,.35)' }}>Included</span>
                      <span style={{ position: 'absolute', top: '.75rem', right: '.75rem', background: 'var(--pine)', color: '#fff', padding: '.22rem .6rem', borderRadius: 20, fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>FREE</span>
                    </div>
                    <div style={{ padding: '1.2rem 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gold)', marginBottom: '.3rem' }}>{e.partner_name}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--night)', lineHeight: 1.3, marginBottom: '.4rem' }}>{e.title}</div>
                      <div style={{ fontSize: '.82rem', color: 'var(--sub)', lineHeight: 1.6, marginBottom: '1rem', flex: 1 }}>{e.description || ''}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '.9rem' }}>
                        <span style={{ fontSize: '.78rem', color: 'var(--sub)', textDecoration: 'line-through' }}>CHF {val} value</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--pine)', letterSpacing: '-.01em' }}>FREE</span>
                      </div>
                      <button className="use-btn" onClick={() => generateQR(e.id, null)} style={{ width: '100%', border: 'none', borderRadius: 9, padding: '.7rem 1rem', fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', background: 'var(--navy)', color: '#fff', fontFamily: 'inherit' }}>
                        Use Now →
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Exclusive experiences */}
        <section style={{ marginBottom: '4.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--blue)', marginBottom: '.35rem' }}>Pay directly from wallet</div>
              <h2 style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1 }}>Exclusive Experiences</h2>
              <p style={{ fontSize: '.875rem', color: 'var(--sub)', marginTop: '.35rem', lineHeight: 1.6 }}>No card needed at the venue — book and go.</p>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--line)', marginBottom: '1.6rem' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: '1.5rem' }}>
            {!wallet
              ? [0, 1, 2].map(i => (
                  <div key={i} style={{ height: 380, background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .5s var(--ease) both', animationDelay: `${i * .1}s` }}>
                    <div style={{ height: 205, background: 'linear-gradient(90deg, var(--sand) 0%, #e8e3d9 50%, var(--sand) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite' }} />
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                      <div style={{ height: 9, background: 'var(--line)', borderRadius: 5, width: '42%' }} />
                      <div style={{ height: 16, background: 'var(--line)', borderRadius: 5, width: '78%' }} />
                      <div style={{ height: 9, background: 'var(--line)', borderRadius: 5, width: '60%' }} />
                    </div>
                  </div>
                ))
              : !wallet.available_priced_offers?.length
              ? <p style={{ color: 'var(--sub)', fontSize: '.875rem', padding: '1rem 0' }}>No experiences available.</p>
              : wallet.available_priced_offers.map((o, i) => {
                const chf = (o.partner_payout_rappen / 100).toFixed(2);
                const ok = (wallet.balance_chf ?? 0) >= o.partner_payout_rappen / 100;
                const orig = o.original_price_rappen;
                const disc = orig && orig > o.partner_payout_rappen ? Math.round((1 - o.partner_payout_rappen / orig) * 100) : 0;
                return (
                  <div key={o.id} className="offer-card" style={{ background: 'var(--white)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', animation: 'rise .52s var(--ease) both', animationDelay: `${i * .08}s`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', height: 205, overflow: 'hidden', background: 'var(--sand)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={offerImg(o.title, o.image_hint)} alt={esc(o.title)} loading="lazy" className="card-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: ok ? 'none' : 'grayscale(45%)' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,28,46,.38) 0%, transparent 55%)' }} />
                      <span style={{ position: 'absolute', top: '.75rem', left: '.75rem', background: 'rgba(14,28,46,.72)', backdropFilter: 'blur(6px)', color: '#fff', padding: '.22rem .6rem', borderRadius: 20, fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Wallet</span>
                      {disc > 0 && <span style={{ position: 'absolute', top: '.75rem', right: '.75rem', background: 'var(--gold)', color: '#fff', padding: '.22rem .6rem', borderRadius: 20, fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', boxShadow: '0 2px 10px rgba(196,149,14,.35)' }}>{disc}% OFF</span>}
                    </div>
                    <div style={{ padding: '1.2rem 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--blue)', marginBottom: '.3rem' }}>{o.partner_name}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--night)', lineHeight: 1.3, marginBottom: '.4rem' }}>{o.title}</div>
                      <div style={{ fontSize: '.82rem', color: 'var(--sub)', lineHeight: 1.6, marginBottom: '1rem', flex: 1 }}>{o.description || ''}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '.9rem' }}>
                        {orig && disc ? <span style={{ fontSize: '.78rem', color: 'var(--sub)', textDecoration: 'line-through' }}>CHF {(orig / 100).toFixed(2)}</span> : null}
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: ok ? 'var(--night)' : 'var(--sub)', letterSpacing: '-.01em' }}>CHF {chf}</span>
                      </div>
                      <button className="use-btn" onClick={() => ok ? generateQR(null, o.id) : undefined} disabled={!ok} style={{ width: '100%', border: 'none', borderRadius: 9, padding: '.7rem 1rem', fontWeight: 700, fontSize: '.875rem', cursor: ok ? 'pointer' : 'not-allowed', background: ok ? 'var(--navy)' : 'var(--line)', color: ok ? '#fff' : 'var(--sub)', fontFamily: 'inherit' }}>
                        {ok ? 'Book with Wallet →' : 'Insufficient Balance'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Transaction history */}
        <section>
          <div style={{ background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--night)' }}>
              <div>
                <div style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(255,255,255,.38)', marginBottom: '.15rem' }}>My wallet</div>
                <h2 style={{ fontSize: '.82rem', fontWeight: 700, color: '#fff' }}>Transaction History</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => loadWallet()} style={{ color: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.14)' }}>Refresh</button>
            </div>
            <div style={{ padding: '.35rem 1.5rem' }}>
              {!wallet?.recent_transactions?.length
                ? <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--sub)', fontSize: '.875rem' }}>No transactions yet</div>
                : wallet.recent_transactions.slice(0, 10).map((t, i) => {
                  const a = t.amount_rappen / 100;
                  const s = a >= 0 ? '+' : '';
                  const d = new Date(t.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' });
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.78rem 0', borderBottom: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: a >= 0 ? 'var(--pine)' : 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '.85rem', textTransform: 'capitalize', color: 'var(--text)' }}>{t.type}</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.1rem' }}>{d}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '.92rem', color: a >= 0 ? 'var(--pine)' : 'var(--danger)' }}>{s}CHF {Math.abs(a).toFixed(2)}</div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </section>
      </main>

      {/* ── Wallet drawer ── */}
      {walletOpen && <div onClick={() => setWalletOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.5)', zIndex: 60, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />}
      <div style={{ position: 'fixed', top: 0, right: walletOpen ? 0 : -420, width: 390, height: '100vh', background: 'var(--white)', boxShadow: '-8px 0 64px rgba(14,28,46,.28)', zIndex: 61, transition: 'right .38s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ background: 'linear-gradient(160deg, var(--night) 0%, #1B3259 100%)', padding: '1.5rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.35rem' }}>
            <div>
              <div style={{ fontSize: '.58rem', textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(255,255,255,.38)', fontWeight: 700, marginBottom: '.2rem' }}>My Wallet</div>
              <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'rgba(255,255,255,.82)' }}>{session?.name}</div>
            </div>
            <button onClick={() => setWalletOpen(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(255,255,255,.38)', marginBottom: '.3rem' }}>Available Balance</div>
          <div style={{ fontSize: '2.7rem', fontWeight: 900, letterSpacing: '-.045em', color: '#fff', lineHeight: 1 }}>
            CHF {(wallet?.balance_chf ?? 0).toFixed(2)}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--sub)', marginBottom: '.65rem' }}>Top up via TWINT</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.4rem', marginBottom: '.75rem' }}>
              {[50, 100, 200, 500].map(v => (
                <button key={v} className="topup-preset" onClick={() => setTopupAmount(v)} style={{ background: topupAmount === v ? 'var(--navy)' : 'var(--sand)', border: `1.5px solid ${topupAmount === v ? 'var(--navy)' : 'var(--line)'}`, borderRadius: 8, padding: '.5rem 0', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', color: topupAmount === v ? '#fff' : 'var(--text)', fontFamily: 'inherit' }}>+{v}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input type="number" value={topupAmount} min={10} step={10} onChange={e => setTopupAmount(Number(e.target.value))} style={{ flex: 1, padding: '.62rem .75rem', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: '.875rem', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={topup} style={{ background: 'var(--gold)', color: '#fff', border: 'none', padding: '.62rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(196,149,14,.35)' }}>Top up</button>
            </div>
          </div>

          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--sub)', marginBottom: '.9rem' }}>My Card</div>
            <div onClick={() => setCardFlipped(f => !f)} style={{ perspective: 1100, height: 190, cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform .68s cubic-bezier(.4,0,.2,1)', transformStyle: 'preserve-3d', transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', backfaceVisibility: 'hidden', boxShadow: '0 10px 40px rgba(14,28,46,.32)', background: 'var(--navy)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/jungfrau-panorama.jpg" alt="Jungfrau" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', opacity: .42 }} />
                  <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: '1.1rem 1.3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(140deg, rgba(14,28,46,.75) 0%, rgba(14,28,46,.15) 100%)', color: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '.56rem', fontWeight: 900, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .75 }}>Jungfrau Region</div>
                      <div style={{ fontSize: '.65rem', fontWeight: 900, color: 'var(--gold)', letterSpacing: '.05em' }}>JFR</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.12rem', fontWeight: 900, letterSpacing: '.02em', marginBottom: '.2rem' }}>Guest Pass</div>
                      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.68rem', opacity: .58, letterSpacing: '.1em' }}>{cardNumber}</div>
                    </div>
                  </div>
                </div>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', backfaceVisibility: 'hidden', boxShadow: '0 10px 40px rgba(14,28,46,.32)', transform: 'rotateY(180deg)', background: 'linear-gradient(150deg, #0a1625 0%, #1B3259 100%)' }}>
                  <div style={{ height: 38, background: 'rgba(0,0,0,.45)', marginTop: 30 }} />
                  <div style={{ padding: '.8rem 1.3rem', display: 'flex', flexDirection: 'column', gap: '.35rem', color: '#fff' }}>
                    <div style={{ fontSize: '.92rem', fontWeight: 700 }}>{cbName}</div>
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
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--sub)', marginBottom: '.75rem' }}>Recent Activity</div>
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

      {/* ── QR modal ── */}
      {qrOpen && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 24, padding: '2rem', textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)', animation: 'rise .25s var(--ease)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '.3rem', color: 'var(--text)' }}>{qrTitle}</div>
            <div style={{ fontSize: '.85rem', color: 'var(--sub)' }}>
              Expires in <span style={{ color: countdown < 15 ? 'var(--danger)' : 'var(--pine)', fontWeight: 800 }}>{countdown}</span>s
            </div>
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
