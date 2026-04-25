'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Offer {
  id: string;
  title: string;
  description: string | null;
  type: string;
  partner_payout_rappen: number;
  original_price_rappen: number | null;
  image_hint: string | null;
  active: boolean;
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

const PARTNERS = [
  { value: 'key-jungfraubahnen', label: 'Jungfraubahnen' },
  { value: 'key-baeckerei', label: 'Bäckerei Müller Grindelwald' },
  { value: 'key-outdoor', label: 'Outdoor Interlaken' },
  { value: 'key-skirental', label: 'Wengen Ski Rental' },
  { value: 'key-bergblick', label: 'Restaurant Bergblick Mürren' },
];

function esc(s: string | null | undefined) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function offerImg(title: string, hint: string | null) {
  const seed = hint || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `https://picsum.photos/seed/${seed}/600/400`;
}

export default function PartnerPage() {
  const [partnerKey, setPartnerKey] = useState('key-jungfraubahnen');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; msg: string; sub?: string } | null>(null);
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

  async function apiFetch(path: string, opts: RequestInit = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-API-Key': partnerKey };
    if (opts.headers) Object.assign(headers, opts.headers);
    const res = await fetch(path, { ...opts, headers });
    const text = await res.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!res.ok) throw new Error((data.error as string) || `HTTP ${res.status}`);
    return data;
  }

  async function loadDashboard() {
    try {
      const d = await apiFetch('/api/partner/dashboard') as unknown as Dashboard;
      setDashboard(d);
    } catch (e: unknown) {
      showToast('Dashboard failed: ' + (e as Error).message);
    }
  }

  async function loadOffers() {
    try {
      const d = await apiFetch('/api/partner/offers') as unknown as { offers: Offer[] };
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
    loadDashboard();
    loadOffers();
  }, [partnerKey]);

  const inputStyle = { width: '100%', padding: '.62rem .8rem', border: '1px solid var(--line)', borderRadius: 9, fontSize: '.875rem', color: 'var(--text)', background: 'var(--sand)', fontFamily: 'inherit' };
  const labelStyle = { display: 'block' as const, fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.07em', color: 'var(--sub)', marginBottom: '.35rem' };

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo">Jungfrau<em style={{ color: 'var(--gold)' }}>.</em>Partner</div>
        <span className="nav-badge" style={{ background: 'var(--gold)', color: '#fff' }}>Demo</span>
        <div className="nav-right">
          <Link className="nav-link" href="/guest">Guest</Link>
          <Link className="nav-link" href="/admin">Admin</Link>
        </div>
      </nav>

      <div style={{ background: 'var(--night)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '.85rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.4)', fontWeight: 700, whiteSpace: 'nowrap' }}>Signed in as</span>
        <select
          value={partnerKey}
          onChange={e => setPartnerKey(e.target.value)}
          style={{ padding: '.45rem 1rem', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, color: '#fff', fontSize: '.875rem', fontWeight: 600, cursor: 'pointer', minWidth: 220, fontFamily: 'inherit' }}
        >
          {PARTNERS.map(p => <option key={p.value} value={p.value} style={{ background: '#1a2330' }}>{p.label}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--night)', padding: '3rem 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ content: '', position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 50%, rgba(45,83,150,.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.6rem' }}>Partner Console</div>
          <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, letterSpacing: '-.02em', color: '#fff', marginBottom: '.4rem' }}>Scan &amp; Redeem</h1>
          <p style={{ fontSize: '.9rem', color: 'rgba(255,255,255,.55)', marginBottom: '1.75rem' }}>Paste or scan a guest QR token below to approve a redemption instantly.</p>

          <textarea
            value={qrInput}
            onChange={e => setQrInput(e.target.value)}
            placeholder="Paste the JWT token from the guest's wallet here…"
            rows={4}
            style={{ background: 'rgba(255,255,255,.06)', border: '1.5px solid rgba(255,255,255,.14)', borderRadius: 12, width: '100%', minHeight: 100, padding: '.85rem 1rem', fontSize: '.75rem', color: '#fff', resize: 'vertical', fontFamily: 'inherit' }}
          />

          <div style={{ display: 'flex', gap: '.65rem', marginTop: '.85rem' }}>
            <button onClick={redeem} style={{ background: 'var(--pine)', color: '#fff', border: 'none', padding: '.72rem 1.75rem', borderRadius: 9, fontWeight: 800, fontSize: '.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>Redeem</button>
            <button onClick={() => setQrInput('')} style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.13)', padding: '.72rem 1.1rem', borderRadius: 9, fontWeight: 600, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
          </div>

          {redeemResult && (
            <div style={{ borderRadius: 10, padding: '.9rem 1.1rem', marginTop: '.9rem', borderLeft: `4px solid ${redeemResult.ok ? 'var(--pine)' : 'var(--danger)'}`, background: redeemResult.ok ? 'rgba(61,114,82,.12)' : 'rgba(197,32,46,.1)', animation: 'rise .2s var(--ease)' }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#fff' }}>{redeemResult.msg}</div>
              {redeemResult.sub && <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.55)', marginTop: '.3rem' }}>{redeemResult.sub}</div>}
            </div>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2rem 3.5rem' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { key: 'pending', label: 'Pending', chf: dashboard?.pending_chf ?? 0, count: dashboard?.pending_count ?? 0, color: 'var(--danger)' },
            { key: 'batched', label: 'Batched', chf: dashboard?.batched_chf ?? 0, count: dashboard?.batched_count ?? 0, color: 'var(--gold)' },
            { key: 'settled', label: 'Settled', chf: dashboard?.settled_chf ?? 0, count: dashboard?.settled_count ?? 0, color: 'var(--pine)' },
          ].map((s, i) => (
            <div key={s.key} className="card" style={{ animationDelay: `${i * .05 + .04}s`, borderTop: `3px solid ${s.color}` }}>
              <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--sub)' }}>{s.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-.03em', marginTop: '.25rem', color: s.color }}>CHF {s.chf.toFixed(2)}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.1rem' }}>{s.count} redemption(s)</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card mb-card" style={{ animationDelay: '.09s' }}>
          <div className="card-head">
            <h2>My Offers</h2>
            <button className="btn-ghost btn-sm" onClick={loadOffers}>Refresh</button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: '1.25rem' }}>
              {offers.length === 0
                ? <div className="empty-msg" style={{ gridColumn: '1/-1' }}>No offers added yet.</div>
                : offers.map(o => {
                  const payout = (o.partner_payout_rappen / 100).toFixed(2);
                  const orig = o.original_price_rappen;
                  const disc = orig && orig > o.partner_payout_rappen ? Math.round((1 - o.partner_payout_rappen / orig) * 100) : 0;
                  return (
                    <div key={o.id} style={{ background: 'var(--white)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ position: 'relative', height: 170, overflow: 'hidden', background: 'var(--sand)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={offerImg(o.title, o.image_hint)} alt={esc(o.title)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <span style={{ position: 'absolute', top: '.65rem', left: '.65rem', background: 'rgba(14,28,46,.7)', backdropFilter: 'blur(4px)', color: '#fff', padding: '.2rem .55rem', borderRadius: 5, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{o.type === 'entitlement' ? 'Included' : 'Wallet'}</span>
                        <span style={{ position: 'absolute', top: '.65rem', right: '.65rem', background: o.active ? 'var(--pine)' : 'var(--sub)', color: '#fff', padding: '.2rem .55rem', borderRadius: 5, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{o.active ? 'active' : 'inactive'}</span>
                      </div>
                      <div style={{ padding: '1rem 1.1rem 1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: '.35rem' }}>{o.title}</div>
                        <div style={{ fontSize: '.78rem', color: 'var(--sub)', lineHeight: 1.5, flex: 1, marginBottom: '.85rem' }}>{o.description || '—'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '.75rem', borderTop: '1px solid var(--line)' }}>
                          <div style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--navy)' }}>
                            CHF {payout}
                            {disc ? <span style={{ fontSize: '.68rem', fontWeight: 500, color: 'var(--sub)' }}>&nbsp;vs CHF {orig ? (orig / 100).toFixed(2) : ''}</span> : null}
                          </div>
                          {o.active && <button onClick={() => removeOffer(o.id)} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.3)', padding: '.28rem .7rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>}
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>

            <div style={{ height: 1, background: 'var(--line)', margin: '1.5rem 0' }} />

            <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--sub)', marginBottom: '1.1rem' }}>Add New Offer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input style={inputStyle} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Paragliding adventure" />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={newType} onChange={e => setNewType(e.target.value)}>
                  <option value="priced">Priced (wallet spend)</option>
                  <option value="entitlement">Entitlement (free / included)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Price (CHF)</label>
                <input style={inputStyle} type="number" min="0" step="0.5" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="e.g. 95.00" />
              </div>
              <div>
                <label style={labelStyle}>Original price (CHF, optional)</label>
                <input style={inputStyle} type="number" min="0" step="0.5" value={newOrigPrice} onChange={e => setNewOrigPrice(e.target.value)} placeholder="e.g. 115.00" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, resize: 'none', height: 68 }} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Short description guests will see on the offer card…" />
              </div>
              <div>
                <label style={labelStyle}>Image hint (optional)</label>
                <input style={inputStyle} value={newHint} onChange={e => setNewHint(e.target.value)} placeholder="e.g. paragliding-alps" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={addOffer} style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '.68rem 1.5rem', borderRadius: 9, fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>Add offer</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ animationDelay: '.14s' }}>
          <div className="card-head">
            <h2>Recent Redemptions</h2>
            <button className="btn-ghost btn-sm" onClick={loadDashboard}>Refresh</button>
          </div>
          <div className="card-body" style={{ paddingTop: '.5rem', paddingBottom: '.5rem' }}>
            {!dashboard?.recent_redemptions?.length
              ? <div className="empty-msg">No redemptions yet</div>
              : dashboard.recent_redemptions.map(r => {
                const status = r.reversed ? 'reversed' : (r.settlement_status || 'pending');
                const date = new Date(r.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' });
                const chf = (r.amount_rappen / 100).toFixed(2);
                const canRefund = !r.reversed && status === 'pending';
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.72rem 0', borderBottom: '1px solid var(--line)', gap: '.6rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{r.offer_title}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.08rem' }}>{date} · {r.type} · CHF {chf}</div>
                    </div>
                    <span className={`pill pill-${status}`}>{status}</span>
                    {canRefund && <button onClick={() => refund(r.id)} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.3)', padding: '.25rem .6rem', borderRadius: 6, fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Refund</button>}
                  </div>
                );
              })
            }
          </div>
        </div>

      </main>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}
