'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';
import type { Session } from '@/lib/auth';

interface Offer {
  id: string;
  title: string;
  description: string | null;
  type: string;
  partner_payout_rappen: number;
  original_price_rappen: number | null;
  image_hint: string | null;
  active: boolean;
  status: string;
}

interface Redemption {
  id: string;
  offer_title: string;
  created_at: string;
  amount_rappen: number;
  type: string;
  reversed: boolean;
  settlement_status: string | null;
}

interface Dashboard {
  pending_chf: number;
  pending_count: number;
  batched_chf: number;
  batched_count: number;
  settled_chf: number;
  settled_count: number;
  recent_redemptions: Redemption[];
}

function esc(s: string | null | undefined) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function offerImg(title: string, hint: string | null) {
  const seed = hint || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `https://picsum.photos/seed/${seed}/600/400`;
}

export default function PartnerPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [partnerKey, setPartnerKey] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; msg: string; sub?: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('priced');
  const [newPrice, setNewPrice] = useState('');
  const [newOrigPrice, setNewOrigPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newHint, setNewHint] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  function signOut() {
    clearSession('partner');
    router.push('/login');
  }

  async function apiFetch(path: string, opts: RequestInit = {}, key?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-API-Key': key ?? partnerKey };
    if (opts.headers) Object.assign(headers, opts.headers);
    const res = await fetch(path, { ...opts, headers });
    const text = await res.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!res.ok) throw new Error((data.error as string) || `HTTP ${res.status}`);
    return data;
  }

  async function loadDashboard(key?: string) {
    try {
      const d = await apiFetch('/api/partner/dashboard', {}, key) as unknown as Dashboard;
      setDashboard(d);
    } catch (e: unknown) {
      showToast('Dashboard failed: ' + (e as Error).message);
    }
  }

  async function loadOffers(key?: string) {
    try {
      const d = await apiFetch('/api/partner/offers', {}, key) as unknown as { offers: Offer[] };
      setOffers(d.offers || []);
    } catch (e: unknown) {
      showToast('Offers failed: ' + (e as Error).message);
    }
  }

  async function redeem() {
    const token = qrInput.trim();
    if (!token) return showToast('Paste a QR token first');
    try {
      const r = await apiFetch('/api/redeem', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'redeem-' + Date.now() + '-' + Math.random() },
        body: JSON.stringify({ qr_token: token }),
      }) as { message: string; redemption_id: string };
      setRedeemResult({ ok: true, msg: 'Approved: ' + r.message, sub: 'Redemption ID: ' + r.redemption_id });
      setQrInput('');
      loadDashboard();
    } catch (e: unknown) {
      setRedeemResult({ ok: false, msg: 'Rejected', sub: (e as Error).message });
    }
  }

  async function refund(id: string) {
    if (!confirm('Reverse this redemption?')) return;
    try {
      await apiFetch('/api/partner/refund', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'refund-' + Date.now() },
        body: JSON.stringify({ redemption_id: id, reason: 'manual refund (demo)' }),
      });
      showToast('Refunded');
      loadDashboard();
    } catch (e: unknown) {
      showToast('Refund failed: ' + (e as Error).message);
    }
  }

  async function addOffer() {
    const title = newTitle.trim();
    if (!title) return showToast('Title is required');
    const price = parseFloat(newPrice) || 0;
    const orig = parseFloat(newOrigPrice) || null;
    const desc = newDesc.trim() || null;
    const hint = newHint.trim() || null;
    try {
      await apiFetch('/api/partner/offers', {
        method: 'POST',
        body: JSON.stringify({ title, type: newType, price_chf: price, original_price_chf: orig, description: desc, image_hint: hint }),
      });
      showToast('Offer added');
      setNewTitle(''); setNewPrice(''); setNewOrigPrice(''); setNewDesc(''); setNewHint('');
      loadOffers();
    } catch (e: unknown) {
      showToast('Failed: ' + (e as Error).message);
    }
  }

  async function removeOffer(id: string) {
    if (!confirm('Remove this offer? Guests will no longer see it.')) return;
    try {
      await apiFetch(`/api/partner/offers/${id}`, { method: 'DELETE' });
      showToast('Offer removed');
      loadOffers();
    } catch (e: unknown) {
      showToast('Failed: ' + (e as Error).message);
    }
  }

  useEffect(() => {
    const s = getSession('partner');
    if (!s) { router.replace('/login'); return; }
    setSession(s);
    setAuthChecking(false);
    const key = s.flaskApiKey || '';
    setPartnerKey(key);
    loadDashboard(key);
    loadOffers(key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authChecking) return null;

  const inputStyle = { width: '100%', padding: '.62rem .85rem', border: '1.5px solid var(--line)', borderRadius: 9, fontSize: '.875rem', color: 'var(--text)', background: '#fff', fontFamily: 'inherit', transition: 'border-color .18s' };
  const labelStyle = { display: 'block' as const, fontSize: '.65rem', fontWeight: 700 as const, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: 'var(--sub)', marginBottom: '.35rem' };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
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
        .stat-card {
          transition: transform .22s var(--ease), box-shadow .22s var(--ease);
        }
        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(14,28,46,.13) !important;
        }
        .token-box:focus-within {
          border-color: rgba(196,149,14,.5) !important;
          box-shadow: 0 0 0 3px rgba(196,149,14,.08);
        }
        .form-input:focus {
          outline: none;
          border-color: var(--navy) !important;
        }
        .redeem-btn { transition: background .18s, transform .15s var(--ease); }
        .redeem-btn:hover { background: #2e6247 !important; transform: translateY(-1px); }
        .remove-btn:hover { background: rgba(197,32,46,.07) !important; }
        @keyframes scan {
          0%   { top: 6%; }
          50%  { top: 86%; }
          100% { top: 6%; }
        }
        .qr-scanner {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          max-width: 240px;
          background: rgba(255,255,255,.04);
          border-radius: 18px;
          overflow: hidden;
        }
        .qr-corner {
          position: absolute;
          width: 28px;
          height: 28px;
        }
        .qr-corner-tl { top: 14px; left: 14px; border-top: 3px solid var(--gold); border-left: 3px solid var(--gold); border-radius: 4px 0 0 0; }
        .qr-corner-tr { top: 14px; right: 14px; border-top: 3px solid var(--gold); border-right: 3px solid var(--gold); border-radius: 0 4px 0 0; }
        .qr-corner-bl { bottom: 14px; left: 14px; border-bottom: 3px solid var(--gold); border-left: 3px solid var(--gold); border-radius: 0 0 0 4px; }
        .qr-corner-br { bottom: 14px; right: 14px; border-bottom: 3px solid var(--gold); border-right: 3px solid var(--gold); border-radius: 0 0 4px 0; }
        .qr-scanline {
          position: absolute;
          left: 14px; right: 14px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
          animation: scan 2.4s cubic-bezier(.4,0,.6,1) infinite;
          box-shadow: 0 0 8px rgba(196,149,14,.6);
        }
        .qr-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.72);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 200;
          animation: fadeUp .22s var(--ease);
        }
        .qr-modal-card {
          background: var(--night);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 22px;
          padding: 2rem;
          width: min(360px,90vw);
          box-shadow: 0 32px 80px rgba(0,0,0,.5);
        }
        .scan-btn { transition: background .18s, transform .15s; }
        .scan-btn:hover { background: rgba(196,149,14,.22) !important; transform: translateY(-1px); }
        .close-btn:hover { background: rgba(255,255,255,.12) !important; }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
        <div className="nav-logo">Jungfrau<em style={{ color: 'var(--gold)' }}>.</em>Partner</div>
        <div className="nav-right">
          <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>{session?.name}</span>
          <button
            onClick={signOut}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.65)', padding: '.38rem .85rem', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Hero / Scan & Redeem ── */}
      <section style={{ position: 'relative', background: 'var(--night)', padding: '5.5rem 2rem 4.5rem', marginTop: 64, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/images/jungfrau-panorama.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 38%', opacity: .28 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(14,28,46,.82) 0%, rgba(27,50,89,.65) 100%)' }} />

        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 2, animation: 'fadeUp .6s var(--ease) both' }}>

          <span style={{ display: 'inline-block', background: 'var(--gold)', color: '#fff', padding: '.22rem .9rem', borderRadius: 24, fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.16em', marginBottom: '1.1rem', boxShadow: '0 3px 18px rgba(196,149,14,.45)' }}>
            Partner Console
          </span>
          <h1 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.7rem)', fontWeight: 900, color: '#fff', letterSpacing: '-.035em', lineHeight: 1.05, marginBottom: '.5rem' }}>
            Scan &amp; Redeem
          </h1>
          <p style={{ color: 'rgba(255,255,255,.52)', fontSize: '.92rem', lineHeight: 1.72, marginBottom: '2rem' }}>
            Paste a guest QR token or open the scanner to approve a redemption instantly.
          </p>

          {/* Token input */}
          <div className="token-box" style={{ background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 14, overflow: 'hidden', marginBottom: '.9rem', transition: 'border-color .18s, box-shadow .18s' }}>
            <div style={{ padding: '.55rem 1rem', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.03)' }}>
              <span style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.12em', color: 'rgba(255,255,255,.38)' }}>Guest Token</span>
              <button
                onClick={() => navigator.clipboard.readText().then(t => setQrInput(t)).catch(() => showToast('Clipboard access denied'))}
                style={{ background: 'rgba(196,149,14,.14)', border: '1px solid rgba(196,149,14,.28)', color: 'var(--gold)', padding: '.2rem .65rem', borderRadius: 6, fontSize: '.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.04em' }}
              >
                Paste
              </button>
            </div>
            <input
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiJ9…"
              style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', padding: '.85rem 1rem', fontSize: '.82rem', color: '#fff', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' as const }}
            />
            {qrInput.length > 0 && (
              <div style={{ padding: '.3rem 1rem .45rem', fontSize: '.62rem', color: 'rgba(255,255,255,.25)', fontFamily: 'monospace', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                {qrInput.length} chars · {qrInput.slice(0, 10)}…{qrInput.slice(-8)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '.65rem', flexWrap: 'wrap' as const }}>
            <button className="redeem-btn" onClick={redeem} style={{ background: 'var(--pine)', color: '#fff', border: 'none', padding: '.75rem 1.85rem', borderRadius: 9, fontWeight: 800, fontSize: '.9rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 18px rgba(61,114,82,.38)' }}>
              Redeem
            </button>
            <button className="scan-btn" onClick={() => setShowScanner(true)} style={{ background: 'rgba(196,149,14,.12)', color: 'var(--gold)', border: '1px solid rgba(196,149,14,.28)', padding: '.75rem 1.25rem', borderRadius: 9, fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Scan QR
            </button>
            <button onClick={() => { setQrInput(''); setRedeemResult(null); }} style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.12)', padding: '.75rem 1.1rem', borderRadius: 9, fontWeight: 600, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear
            </button>
          </div>

          {redeemResult && (
            <div style={{ borderRadius: 10, padding: '.9rem 1.15rem', marginTop: '.9rem', borderLeft: `3px solid ${redeemResult.ok ? 'var(--pine)' : 'var(--danger)'}`, background: redeemResult.ok ? 'rgba(61,114,82,.12)' : 'rgba(197,32,46,.10)', animation: 'rise .22s var(--ease)' }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#fff' }}>{redeemResult.msg}</div>
              {redeemResult.sub && <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.5)', marginTop: '.3rem' }}>{redeemResult.sub}</div>}
            </div>
          )}

        </div>

        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', zIndex: 3 }}>
          <path d="M0,80 L140,38 L240,62 L360,16 L480,50 L600,8 L720,42 L840,12 L960,46 L1080,20 L1200,52 L1320,28 L1440,44 L1440,80 Z" fill="#F2EFE8" />
        </svg>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ background: '#F2EFE8', padding: '0 2rem 2.75rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
          {[
            { key: 'pending', label: 'Pending Payout', chf: dashboard?.pending_chf ?? 0, count: dashboard?.pending_count ?? 0, accent: 'var(--danger)' },
            { key: 'batched', label: 'Batched', chf: dashboard?.batched_chf ?? 0, count: dashboard?.batched_count ?? 0, accent: 'var(--gold)' },
            { key: 'settled', label: 'Settled', chf: dashboard?.settled_chf ?? 0, count: dashboard?.settled_count ?? 0, accent: 'var(--pine)' },
          ].map((s, i) => (
            <div key={s.key} className="stat-card" style={{ background: '#fff', borderRadius: 16, padding: '1.35rem 1.5rem', boxShadow: '0 2px 16px rgba(14,28,46,.07)', borderTop: `3px solid ${s.accent}`, animation: 'rise .5s var(--ease) both', animationDelay: `${i * .08}s` }}>
              <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--sub)' }}>{s.label}</div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-.03em', color: s.accent, marginTop: '.3rem', lineHeight: 1 }}>CHF {s.chf.toFixed(2)}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.3rem' }}>{s.count} redemption{s.count !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 5rem' }}>

        {/* My Offers */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--gold)', marginBottom: '.35rem' }}>Active listing</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1 }}>My Offers</h2>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--line)', marginBottom: '.75rem' }} />
            <button onClick={() => loadOffers()} style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--sub)', padding: '.32rem .75rem', borderRadius: 7, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.75rem', flexShrink: 0 }}>Refresh</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1.4rem', marginBottom: '2.5rem' }}>
            {offers.length === 0
              ? <p style={{ color: 'var(--sub)', fontSize: '.875rem', padding: '1rem 0' }}>No offers added yet.</p>
              : offers.map((o, i) => {
                const payout = (o.partner_payout_rappen / 100).toFixed(2);
                const orig = o.original_price_rappen;
                const disc = orig && orig > o.partner_payout_rappen ? Math.round((1 - o.partner_payout_rappen / orig) * 100) : 0;
                const accentColor = o.status === 'active' ? 'var(--pine)' : o.status === 'pending' ? 'var(--gold)' : 'var(--danger)';
                return (
                  <div key={o.id} className="offer-card" style={{ background: 'var(--white)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', animation: 'rise .5s var(--ease) both', animationDelay: `${i * .07}s`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', height: 175, overflow: 'hidden', background: 'var(--sand)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={offerImg(o.title, o.image_hint)} alt={esc(o.title)} loading="lazy" className="card-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,28,46,.3) 0%, transparent 55%)' }} />
                      <span style={{ position: 'absolute', top: '.7rem', left: '.7rem', background: 'rgba(14,28,46,.7)', backdropFilter: 'blur(6px)', color: '#fff', padding: '.2rem .62rem', borderRadius: 20, fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                        {o.type === 'entitlement' ? 'Included' : 'Wallet'}
                      </span>
                      <span style={{ position: 'absolute', top: '.7rem', right: '.7rem', background: accentColor, color: '#fff', padding: '.2rem .62rem', borderRadius: 20, fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                        {o.status === 'active' ? 'Active' : o.status === 'pending' ? 'Pending' : 'Rejected'}
                      </span>
                    </div>
                    <div style={{ padding: '1.1rem 1.2rem 1.3rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--night)', lineHeight: 1.3, marginBottom: '.3rem' }}>{o.title}</div>
                      <div style={{ fontSize: '.8rem', color: 'var(--sub)', lineHeight: 1.55, flex: 1, marginBottom: '.85rem' }}>{o.description || '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '.75rem', borderTop: '1px solid var(--line)' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy)', letterSpacing: '-.01em' }}>
                          CHF {payout}
                          {disc ? <span style={{ fontSize: '.68rem', fontWeight: 500, color: 'var(--sub)' }}>&nbsp;· {disc}% off</span> : null}
                        </div>
                        {o.status !== 'pending' && (
                          <button className="remove-btn" onClick={() => removeOffer(o.id)} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.25)', padding: '.28rem .7rem', borderRadius: 6, fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* Add New Offer */}
          <div style={{ background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--line)', background: 'var(--night)' }}>
              <div style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(255,255,255,.38)', marginBottom: '.15rem' }}>Listing</div>
              <h2 style={{ fontSize: '.9rem', fontWeight: 700, color: '#fff' }}>Add New Offer</h2>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label style={labelStyle}>Title</label>
                  <input className="form-input" style={inputStyle} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Paragliding adventure" />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select className="form-input" style={inputStyle} value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="priced">Priced (wallet spend)</option>
                    <option value="entitlement">Entitlement (free / included)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Price (CHF)</label>
                  <input className="form-input" style={inputStyle} type="number" min="0" step="0.5" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="e.g. 95.00" />
                </div>
                <div>
                  <label style={labelStyle}>Original price (CHF, optional)</label>
                  <input className="form-input" style={inputStyle} type="number" min="0" step="0.5" value={newOrigPrice} onChange={e => setNewOrigPrice(e.target.value)} placeholder="e.g. 115.00" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Description</label>
                  <textarea className="form-input" style={{ ...inputStyle, resize: 'none', height: 68 }} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Short description guests will see on the offer card…" />
                </div>
                <div>
                  <label style={labelStyle}>Image hint (optional)</label>
                  <input className="form-input" style={inputStyle} value={newHint} onChange={e => setNewHint(e.target.value)} placeholder="e.g. paragliding-alps" />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={addOffer} style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '.7rem 1.5rem', borderRadius: 9, fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Add offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Redemptions */}
        <section>
          <div style={{ background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--night)' }}>
              <div>
                <div style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(255,255,255,.38)', marginBottom: '.15rem' }}>Activity</div>
                <h2 style={{ fontSize: '.9rem', fontWeight: 700, color: '#fff' }}>Recent Redemptions</h2>
              </div>
              <button onClick={() => loadDashboard()} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.14)', color: 'rgba(255,255,255,.52)', padding: '.32rem .75rem', borderRadius: 7, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Refresh</button>
            </div>
            <div style={{ padding: '.35rem 1.5rem' }}>
              {!dashboard?.recent_redemptions?.length
                ? <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--sub)', fontSize: '.875rem' }}>No redemptions yet</div>
                : dashboard.recent_redemptions.map(r => {
                  const status = r.reversed ? 'reversed' : (r.settlement_status || 'pending');
                  const date = new Date(r.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' });
                  const chf = (r.amount_rappen / 100).toFixed(2);
                  const canRefund = !r.reversed && status === 'pending';
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.78rem 0', borderBottom: '1px solid var(--line)', gap: '.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.87rem', color: 'var(--text)' }}>{r.offer_title}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.1rem' }}>{date} · {r.type} · CHF {chf}</div>
                      </div>
                      <span className={`pill pill-${status}`}>{status}</span>
                      {canRefund && (
                        <button className="remove-btn" onClick={() => refund(r.id)} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.25)', padding: '.25rem .65rem', borderRadius: 6, fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'background .15s' }}>
                          Refund
                        </button>
                      )}
                    </div>
                  );
                })
              }
            </div>
          </div>
        </section>

      </main>

      {showScanner && (
        <div className="qr-modal-overlay" onClick={() => setShowScanner(false)}>
          <div className="qr-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '.55rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.14em', color: 'rgba(255,255,255,.32)', marginBottom: '.2rem' }}>Guest QR</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Scan Code</div>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowScanner(false)}
                style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.55)', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: '.95rem', flexShrink: 0, transition: 'background .15s' }}
              >
                ✕
              </button>
            </div>
            <div className="qr-scanner" style={{ maxWidth: 260, margin: '0 auto' }}>
              <div className="qr-corner qr-corner-tl" />
              <div className="qr-corner qr-corner-tr" />
              <div className="qr-corner qr-corner-bl" />
              <div className="qr-corner qr-corner-br" />
              <div className="qr-scanline" />
              <div style={{ position: 'absolute', inset: 30, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(7,1fr)', gap: 3, opacity: .18 }}>
                {Array.from({ length: 49 }).map((_, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,.9)', borderRadius: 1 }} />
                ))}
              </div>
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.32)', fontSize: '.72rem', marginTop: '1.25rem', lineHeight: 1.65, margin: '1.25rem 0 0' }}>
              Point the guest&apos;s phone at the scanner.<br />Token will populate automatically.
            </p>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}
