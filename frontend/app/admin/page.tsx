'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession, getPartners, addPartner, deletePartner } from '@/lib/auth';
import type { Session, PartnerRecord } from '@/lib/auth';

interface Batch {
  id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_rappen: number;
  redemption_count: number;
  payment_reference: string;
  status: string;
  pain001_file_path: string | null;
  created_at: string;
}

interface PendingOffer {
  id: string;
  partner_name: string;
  title: string;
  description: string | null;
  type: string;
  partner_payout_rappen: number;
  original_price_rappen: number | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  mountain_railway: 'Mountain Railway',
  activity: 'Activity',
  transport: 'Transport',
  cruise: 'Cruise',
};

function esc(s: string | null | undefined) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

export default function AdminPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [adminKey, setAdminKey] = useState('admin-dev-key');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [settlementResult, setSettlementResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [xmlFileName, setXmlFileName] = useState('No file loaded');
  const [xmlContent, setXmlContent] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addCategory, setAddCategory] = useState('mountain_railway');
  const [addFlaskKey, setAddFlaskKey] = useState('');
  const [addError, setAddError] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  function signOut() {
    clearSession('admin');
    router.push('/login');
  }

  function refreshPartners() {
    setPartners(getPartners());
  }

  function handleAddPartner() {
    setAddError('');
    const name = addName.trim();
    const username = addUsername.trim();
    const password = addPassword.trim();
    const flaskApiKey = addFlaskKey.trim() || `key-${username}`;
    if (!name || !username || !password) { setAddError('Name, username, and password are required.'); return; }
    if (username.length < 3) { setAddError('Username must be at least 3 characters.'); return; }
    if (password.length < 6) { setAddError('Password must be at least 6 characters.'); return; }
    addPartner({ name, username, password, category: addCategory, flaskApiKey });
    refreshPartners();
    setShowAddPartner(false);
    setAddName(''); setAddUsername(''); setAddPassword(''); setAddFlaskKey('');
    showToast('Partner added');
  }

  function togglePasswordVisibility(id: string) {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDeletePartner(id: string, name: string) {
    if (!confirm(`Remove partner "${name}"? This cannot be undone.`)) return;
    deletePartner(id);
    refreshPartners();
    showToast('Partner removed');
  }

  async function apiFetch(path: string, opts: RequestInit = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey };
    if (opts.headers) Object.assign(headers, opts.headers);
    const res = await fetch(path, { ...opts, headers });
    const text = await res.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error((data.error as string) || `HTTP ${res.status}`);
    return data;
  }

  async function loadPendingOffers() {
    try {
      const r = await apiFetch('/api/admin/offers/pending') as { offers: PendingOffer[] };
      setPendingOffers(r.offers || []);
    } catch (e: unknown) {
      showToast('Load pending offers failed: ' + (e as Error).message);
    }
  }

  async function approveOffer(id: string, title: string) {
    try {
      await apiFetch(`/api/admin/offers/${id}/approve`, { method: 'POST' });
      showToast(`Approved: ${title}`);
      loadPendingOffers();
    } catch (e: unknown) {
      showToast('Approve failed: ' + (e as Error).message);
    }
  }

  async function rejectOffer(id: string, title: string) {
    if (!confirm(`Reject offer "${title}"?`)) return;
    try {
      await apiFetch(`/api/admin/offers/${id}/reject`, { method: 'POST' });
      showToast(`Rejected: ${title}`);
      loadPendingOffers();
    } catch (e: unknown) {
      showToast('Reject failed: ' + (e as Error).message);
    }
  }

  async function loadBatches() {
    try {
      const r = await apiFetch('/api/admin/settlement/batches') as { batches: Batch[] };
      setBatches(r.batches || []);
    } catch (e: unknown) {
      showToast('Load batches failed: ' + (e as Error).message);
    }
  }

  async function runSettlement() {
    try {
      const r = await apiFetch('/api/admin/settlement/run', {
        method: 'POST',
        body: JSON.stringify({ period_start: '2020-01-01', period_end: '2099-12-31' }),
      }) as { batches: Batch[]; total_chf: number; pain001_file: string };
      if (!r.batches.length) {
        setSettlementResult({ ok: false, msg: 'No pending redemptions to settle.' });
      } else {
        setSettlementResult({ ok: true, msg: `Created ${r.batches.length} batch(es) — CHF ${r.total_chf.toFixed(2)} total · ${r.pain001_file}` });
        loadBatches();
      }
    } catch (e: unknown) {
      showToast('Settlement failed: ' + (e as Error).message);
    }
  }

  async function reseed() {
    if (!confirm('Wipe and reseed all demo data? This cannot be undone.')) return;
    try {
      await apiFetch('/api/admin/seed', { method: 'POST' });
      showToast('Reseeded — refresh other tabs');
      loadBatches();
      setSettlementResult(null);
      setXmlContent('');
      setXmlFileName('No file loaded');
    } catch (e: unknown) {
      showToast('Reseed failed: ' + (e as Error).message);
    }
  }

  async function viewPain001(batchId: string, ref: string) {
    try {
      const res = await fetch(`/api/admin/settlement/pain001/${batchId}`, { headers: { 'X-Admin-Key': adminKey } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      setXmlFileName(ref + '.xml');
      setXmlContent(xml);
    } catch (e: unknown) {
      showToast('Load XML failed: ' + (e as Error).message);
    }
  }

  async function confirmBatch(batchId: string) {
    const ref = prompt('Enter the bank transaction reference:', 'SIC-' + new Date().toISOString().slice(0, 10) + '-' + Math.floor(Math.random() * 10000));
    if (!ref) return;
    try {
      await apiFetch('/api/admin/settlement/confirm', { method: 'POST', body: JSON.stringify({ batch_id: batchId, bank_transaction_ref: ref }) });
      showToast('Confirmed — partners now see settled status');
      loadBatches();
    } catch (e: unknown) {
      showToast('Confirm failed: ' + (e as Error).message);
    }
  }

  useEffect(() => {
    const s = getSession('admin');
    if (!s) { router.replace('/login'); return; }
    setSession(s);
    setAuthChecking(false);
    refreshPartners();
    loadBatches();
    loadPendingOffers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authChecking) return null;

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '.72rem .9rem',
    border: '1.5px solid rgba(255,255,255,.12)', borderRadius: 9,
    fontSize: '.875rem', color: '#fff', fontFamily: 'inherit',
    background: 'rgba(255,255,255,.07)', outline: 'none',
    transition: 'border-color .18s',
  };
  const darkLabel: React.CSSProperties = {
    display: 'block', fontSize: '.65rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.09em',
    color: 'rgba(255,255,255,.4)', marginBottom: '.4rem',
  };

  const thStyle: React.CSSProperties = {
    padding: '.72rem .9rem', textAlign: 'left',
    fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '.1em', color: 'var(--sub)',
    background: 'var(--sand)', borderBottom: '2px solid var(--line)',
  };

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
        .admin-table tbody tr {
          transition: background .14s;
        }
        .admin-table tbody tr:hover {
          background: rgba(14,28,46,.03);
        }
        .action-btn { transition: background .15s, transform .15s var(--ease), box-shadow .15s; }
        .action-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(14,28,46,.18); }
        .approve-btn:hover { background: #2e6247 !important; }
        .xml-btn:hover { background: rgba(45,83,150,.1) !important; }
        .danger-btn:hover { background: rgba(197,32,46,.07) !important; }
        .settle-run:hover { background: var(--blue) !important; transform: translateY(-1px); }
        .settle-reset:hover { border-color: var(--danger) !important; color: var(--danger) !important; }
        .modal-cancel:hover { background: rgba(255,255,255,.1) !important; }
        .modal-confirm:hover { background: #b8860c !important; transform: translateY(-1px); }
        .modal-close:hover { background: rgba(255,255,255,.14) !important; }
        .key-input:focus { border-color: var(--gold) !important; }
        .pill-active   { background: #e2f2e8; color: var(--pine); }
        .pill-rejected { background: #fdecef; color: var(--danger); }
        @media(max-width:900px){
          .admin-top-grid { grid-template-columns: 1fr !important; }
          main { padding: 1.25rem 1rem 2.5rem !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
        <div className="nav-logo">
          Jungfrau<em style={{ color: 'var(--gold)' }}>.</em>Admin
        </div>
        <div className="nav-sep" />
        <div className="nav-right">
          <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>
            {session?.name}
          </span>
          <button
            onClick={signOut}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.65)', padding: '.38rem .85rem', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', background: 'var(--night)', padding: '5.5rem 2rem 4.5rem', marginTop: 64, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/images/jungfrau-panorama.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 38%', opacity: .22 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(14,28,46,.92) 0%, rgba(27,50,89,.72) 100%)' }} />

        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 2 }}>

          <div style={{ animation: 'fadeUp .55s var(--ease) both', animationDelay: '.04s' }}>
            <span style={{ display: 'inline-block', background: 'var(--gold)', color: '#fff', padding: '.22rem .9rem', borderRadius: 24, fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.16em', marginBottom: '1.1rem', boxShadow: '0 3px 18px rgba(196,149,14,.45)' }}>
              Admin Console
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-.035em', lineHeight: 1.05, marginBottom: '.6rem', animation: 'fadeUp .62s var(--ease) both', animationDelay: '.13s' }}>
            Settlement &amp; Partner<br />Management
          </h1>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.92rem', lineHeight: 1.72, maxWidth: 520, animation: 'fadeUp .62s var(--ease) both', animationDelay: '.24s' }}>
            Manage partner accounts, approve offers, run ISO 20022 payment settlements, and generate{' '}
            <code style={{ background: 'rgba(255,255,255,.1)', padding: '.1rem .35rem', borderRadius: 4, fontSize: '.82em' }}>pain.001</code> bank files.
          </p>

          {/* Inline stats */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap', animation: 'fadeUp .62s var(--ease) both', animationDelay: '.34s' }}>
            {[
              { label: 'Partners', value: partners.length, color: 'var(--gold)' },
              { label: 'Pending offers', value: pendingOffers.length, color: 'var(--danger)' },
              { label: 'Settlement batches', value: batches.length, color: 'var(--blue)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '.7rem', background: 'rgba(255,255,255,.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '.62rem 1rem', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color, letterSpacing: '-.02em' }}>{s.value}</span>
                <span style={{ fontSize: '.6rem', color: 'rgba(255,255,255,.48)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mountain silhouette */}
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', zIndex: 3 }}>
          <path d="M0,80 L140,38 L240,62 L360,16 L480,50 L600,8 L720,42 L840,12 L960,46 L1080,20 L1200,52 L1320,28 L1440,44 L1440,80 Z" fill="#F2EFE8" />
        </svg>
      </section>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 2rem 5rem' }}>

        {/* Admin key + Settlement actions */}
        <div className="admin-top-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.65fr', gap: '1.25rem', marginBottom: '2.5rem', alignItems: 'start' }}>

          <div style={{ background: '#fff', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .42s var(--ease) both', animationDelay: '.05s' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--line)', background: 'var(--night)' }}>
              <div style={{ fontSize: '.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(255,255,255,.35)', marginBottom: '.15rem' }}>Authentication</div>
              <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#fff' }}>Admin API Key</div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <input
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                spellCheck={false}
                className="key-input"
                style={{ width: '100%', padding: '.68rem .9rem', border: '1.5px solid var(--line)', borderRadius: 9, fontFamily: 'ui-monospace,monospace', fontSize: '.82rem', color: 'var(--text)', background: 'var(--sand)', outline: 'none', transition: 'border-color .18s' }}
              />
              <div style={{ fontSize: '.74rem', color: 'var(--sub)', marginTop: '.5rem' }}>
                Default: <code style={{ background: 'var(--sand)', padding: '.1rem .3rem', borderRadius: 4, fontSize: '.9em' }}>admin-dev-key</code>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .42s var(--ease) both', animationDelay: '.1s' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--line)', background: 'var(--night)' }}>
              <div style={{ fontSize: '.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(255,255,255,.35)', marginBottom: '.15rem' }}>Finance</div>
              <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#fff' }}>Settlement Actions</div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '.85rem', color: 'var(--sub)', lineHeight: 1.65, marginBottom: '1.35rem' }}>
                Aggregates all <strong style={{ color: 'var(--text)', fontWeight: 700 }}>pending</strong> merchant ledger entries into per-partner batches and generates a real ISO 20022{' '}
                <code style={{ background: 'var(--sand)', padding: '.1rem .3rem', borderRadius: 4, fontSize: '.9em' }}>pain.001.001.09</code> XML file ready for your bank.
              </p>
              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                <button
                  className="settle-run"
                  onClick={runSettlement}
                  style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '.72rem 1.5rem', borderRadius: 9, fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(27,50,89,.3)', transition: 'background .18s, transform .15s var(--ease)' }}
                >
                  Run Settlement
                </button>
                <button
                  className="settle-reset"
                  onClick={reseed}
                  style={{ background: 'transparent', color: 'var(--sub)', border: '1.5px solid var(--line)', padding: '.72rem 1.25rem', borderRadius: 9, fontWeight: 600, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .18s, color .18s' }}
                >
                  Reset &amp; Reseed
                </button>
              </div>
              {settlementResult && (
                <div style={{ marginTop: '1rem', padding: '.9rem 1.1rem', borderRadius: 9, fontSize: '.875rem', animation: 'rise .2s var(--ease)', ...(settlementResult.ok ? { background: '#e8f5ee', borderLeft: '4px solid var(--pine)', color: 'var(--pine)' } : { background: 'var(--sand)', color: 'var(--sub)' }) }}>
                  {settlementResult.ok
                    ? <><strong style={{ display: 'block', fontWeight: 700, marginBottom: '.2rem' }}>Settlement successful</strong>{settlementResult.msg}</>
                    : settlementResult.msg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Partners section ── */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--gold)', marginBottom: '.35rem' }}>Partner Management</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1 }}>Partners</h2>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--line)', marginBottom: '.65rem' }} />
            <button
              onClick={() => { setShowAddPartner(true); setAddError(''); }}
              style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '.52rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.65rem', flexShrink: 0, boxShadow: '0 2px 10px rgba(27,50,89,.28)', transition: 'background .18s, transform .15s var(--ease)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              + Add Partner
            </button>
          </div>

          <div style={{ background: '#fff', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .45s var(--ease) both', animationDelay: '.08s' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', minWidth: 620 }}>
                <thead>
                  <tr>
                    {['Name', 'Username', 'Password', 'Category', 'Flask API Key', 'Status', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partners.length === 0 ? (
                    <tr><td colSpan={7} className="empty-msg">No partners yet</td></tr>
                  ) : partners.map(p => {
                    const pwVisible = visiblePasswords.has(p.id);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '.78rem .9rem', fontWeight: 700, color: 'var(--night)' }}>{p.name}</td>
                        <td style={{ padding: '.78rem .9rem', fontFamily: 'ui-monospace,monospace', fontSize: '.78rem', color: 'var(--sub)' }}>{p.username}</td>
                        <td style={{ padding: '.78rem .9rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.78rem', color: 'var(--sub)', letterSpacing: pwVisible ? 0 : '.08em' }}>
                              {pwVisible ? p.password : '••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(p.id)}
                              title={pwVisible ? 'Hide' : 'Show'}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '.1rem .25rem', color: 'var(--sub)', lineHeight: 1 }}
                            >
                              {pwVisible ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              )}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '.78rem .9rem' }}>{CATEGORY_LABELS[p.category] || p.category}</td>
                        <td style={{ padding: '.78rem .9rem' }}>
                          <code style={{ fontSize: '.72rem', color: 'var(--sub)', background: 'var(--sand)', padding: '.15rem .4rem', borderRadius: 4 }}>{p.flaskApiKey}</code>
                        </td>
                        <td style={{ padding: '.78rem .9rem' }}><span className={`pill pill-${p.status}`}>{p.status}</span></td>
                        <td style={{ padding: '.78rem .9rem' }}>
                          <button
                            onClick={() => handleDeletePartner(p.id, p.name)}
                            className="action-btn danger-btn"
                            style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.28)', padding: '.3rem .72rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Pending Offers ── */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--danger)', marginBottom: '.35rem' }}>Content Moderation</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1 }}>
                Pending Offers
                {pendingOffers.length > 0 && (
                  <span style={{ marginLeft: '.6rem', background: 'var(--danger)', color: '#fff', borderRadius: 20, padding: '.1rem .55rem', fontSize: '.62rem', fontWeight: 800, verticalAlign: 'middle' }}>
                    {pendingOffers.length}
                  </span>
                )}
              </h2>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--line)', marginBottom: '.65rem' }} />
            <button
              onClick={loadPendingOffers}
              style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--sub)', padding: '.38rem .75rem', borderRadius: 7, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.65rem', flexShrink: 0 }}
            >
              Refresh
            </button>
          </div>

          <div style={{ background: '#fff', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .45s var(--ease) both', animationDelay: '.12s' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', minWidth: 600 }}>
                <thead>
                  <tr>
                    {['Partner', 'Title', 'Type', 'Payout', 'Submitted', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingOffers.length === 0 ? (
                    <tr><td colSpan={6} className="empty-msg">No offers pending approval</td></tr>
                  ) : pendingOffers.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '.78rem .9rem', fontWeight: 700, color: 'var(--night)' }}>{o.partner_name}</td>
                      <td style={{ padding: '.78rem .9rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--night)' }}>{o.title}</div>
                        {o.description && <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.15rem' }}>{o.description}</div>}
                      </td>
                      <td style={{ padding: '.78rem .9rem' }}><span className="pill pill-draft">{o.type}</span></td>
                      <td style={{ padding: '.78rem .9rem', fontWeight: 700, color: 'var(--navy)' }}>CHF {(o.partner_payout_rappen / 100).toFixed(2)}</td>
                      <td style={{ padding: '.78rem .9rem', fontSize: '.75rem', color: 'var(--sub)' }}>{new Date(o.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ padding: '.78rem .9rem' }}>
                        <div style={{ display: 'flex', gap: '.4rem' }}>
                          <button
                            onClick={() => approveOffer(o.id, o.title)}
                            className="action-btn approve-btn"
                            style={{ background: 'var(--pine)', color: '#fff', border: 'none', padding: '.3rem .78rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectOffer(o.id, o.title)}
                            className="action-btn danger-btn"
                            style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.28)', padding: '.3rem .78rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Settlement Batches ── */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--blue)', marginBottom: '.35rem' }}>ISO 20022</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1 }}>Settlement Batches</h2>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--line)', marginBottom: '.65rem' }} />
            <button
              onClick={loadBatches}
              style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--sub)', padding: '.38rem .75rem', borderRadius: 7, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.65rem', flexShrink: 0 }}
            >
              Refresh
            </button>
          </div>

          <div style={{ background: '#fff', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .45s var(--ease) both', animationDelay: '.16s' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', minWidth: 700 }}>
                <thead>
                  <tr>
                    {['Partner', 'Period', 'Total', 'Count', 'Reference', 'Status', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr><td colSpan={7} className="empty-msg">No batches yet — run a settlement first</td></tr>
                  ) : batches.map(b => {
                    const chf = (b.total_rappen / 100).toFixed(2);
                    const date = new Date(b.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' });
                    const canConfirm = b.status === 'submitted' || b.status === 'draft';
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '.78rem .9rem', verticalAlign: 'middle' }}>
                          <strong style={{ display: 'block', fontWeight: 700, fontSize: '.88rem', color: 'var(--night)' }}>{b.partner_name}</strong>
                          <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.1rem' }}>{date}</div>
                        </td>
                        <td style={{ padding: '.78rem .9rem', verticalAlign: 'middle', fontSize: '.75rem', color: 'var(--sub)', lineHeight: 1.6 }}>
                          {b.period_start.substring(0, 10)}<br />→ {b.period_end.substring(0, 10)}
                        </td>
                        <td style={{ padding: '.78rem .9rem', verticalAlign: 'middle', fontWeight: 800, color: 'var(--navy)', fontSize: '.88rem' }}>CHF {chf}</td>
                        <td style={{ padding: '.78rem .9rem', verticalAlign: 'middle' }}>{b.redemption_count}</td>
                        <td style={{ padding: '.78rem .9rem', verticalAlign: 'middle' }}>
                          <code style={{ fontSize: '.68rem', background: 'var(--sand)', padding: '.15rem .38rem', borderRadius: 4 }}>{esc(b.payment_reference)}</code>
                        </td>
                        <td style={{ padding: '.78rem .9rem', verticalAlign: 'middle' }}><span className={`pill pill-${b.status}`}>{b.status}</span></td>
                        <td style={{ padding: '.78rem .9rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            {b.pain001_file_path && (
                              <button
                                className="action-btn xml-btn"
                                onClick={() => viewPain001(b.id, esc(b.payment_reference))}
                                style={{ background: 'transparent', color: 'var(--blue)', border: '1px solid rgba(45,83,150,.28)', padding: '.3rem .7rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                View XML
                              </button>
                            )}
                            {canConfirm && (
                              <button
                                className="action-btn approve-btn"
                                onClick={() => confirmBatch(b.id)}
                                style={{ background: 'var(--pine)', color: '#fff', border: 'none', padding: '.3rem .7rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Mark paid
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── pain.001 XML Preview ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--pine)', marginBottom: '.35rem' }}>Payment File</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--night)', letterSpacing: '-.03em', lineHeight: 1 }}>pain.001 Preview</h2>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--line)', marginBottom: '.65rem' }} />
            <span style={{ background: 'rgba(45,83,150,.1)', color: 'var(--blue)', padding: '.22rem .65rem', borderRadius: 5, fontSize: '.62rem', fontWeight: 700, marginBottom: '.65rem', flexShrink: 0 }}>ISO 20022 · pain.001.001.09</span>
          </div>

          <div style={{ background: '#fff', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', animation: 'rise .45s var(--ease) both', animationDelay: '.2s' }}>
            <div style={{ padding: '.72rem 1.5rem', background: 'var(--sand)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.75rem', color: 'var(--sub)' }}>{xmlFileName}</span>
            </div>
            <div style={{ background: '#0d1117', borderRadius: '0 0 var(--r) var(--r)', overflow: 'hidden' }}>
              {xmlContent
                ? <pre style={{ color: '#a6e3a1', padding: '1.35rem 1.5rem', fontSize: '.72rem', maxHeight: 440, overflow: 'auto', fontFamily: 'ui-monospace,"Cascadia Code",monospace', lineHeight: 1.7, margin: 0 }}>{xmlContent}</pre>
                : <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: '.8rem', fontFamily: 'ui-monospace,monospace' }}>Click &quot;View XML&quot; on a batch row to load the payment file here.</div>
              }
            </div>
            <div style={{ padding: '.85rem 1.5rem', fontSize: '.75rem', color: 'var(--sub)', borderTop: '1px solid var(--line)', lineHeight: 1.6 }}>
              This file is uploaded to the bank&apos;s e-banking portal. ISO 20022 pain.001 is accepted by all Swiss banks — PostFinance, UBS, Raiffeisen, ZKB, and others.
            </div>
          </div>
        </section>

      </main>

      {/* ── Add Partner Modal (dark glass) ── */}
      {showAddPartner && (
        <div
          onClick={() => setShowAddPartner(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--night)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 22, padding: '2rem', maxWidth: 480, width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,.5)', animation: 'rise .25s var(--ease)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
              <div>
                <div style={{ fontSize: '.55rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.14em', color: 'rgba(255,255,255,.35)', marginBottom: '.2rem' }}>Partner Management</div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Add New Partner</h2>
              </div>
              <button
                onClick={() => setShowAddPartner(false)}
                className="modal-close"
                style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.55)', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: '.95rem', flexShrink: 0, transition: 'background .15s' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
              <div>
                <label style={darkLabel}>Partner Name</label>
                <input
                  style={darkInput} value={addName} onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Grindelwald Ski School"
                  onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.12)')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
                <div>
                  <label style={darkLabel}>Username</label>
                  <input
                    style={darkInput} value={addUsername} onChange={e => setAddUsername(e.target.value)}
                    placeholder="e.g. grindelski"
                    onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.12)')}
                  />
                </div>
                <div>
                  <label style={darkLabel}>Password</label>
                  <input
                    type="password" style={darkInput} value={addPassword} onChange={e => setAddPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.12)')}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
                <div>
                  <label style={darkLabel}>Category</label>
                  <select
                    style={{ ...darkInput, cursor: 'pointer' }}
                    value={addCategory} onChange={e => setAddCategory(e.target.value)}
                  >
                    <option value="mountain_railway" style={{ background: 'var(--night)' }}>Mountain Railway</option>
                    <option value="activity" style={{ background: 'var(--night)' }}>Activity</option>
                    <option value="transport" style={{ background: 'var(--night)' }}>Transport</option>
                    <option value="cruise" style={{ background: 'var(--night)' }}>Cruise</option>
                  </select>
                </div>
                <div>
                  <label style={darkLabel}>Flask API Key</label>
                  <input
                    style={darkInput} value={addFlaskKey} onChange={e => setAddFlaskKey(e.target.value)}
                    placeholder="key-grindelski (auto)"
                    onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.12)')}
                  />
                </div>
              </div>

              {addError && (
                <div style={{ padding: '.7rem .9rem', background: 'rgba(197,32,46,.12)', borderLeft: '3px solid var(--danger)', borderRadius: '0 8px 8px 0', fontSize: '.82rem', color: '#ff9a9a' }}>
                  {addError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '.65rem', justifyContent: 'flex-end', marginTop: '.25rem' }}>
                <button
                  onClick={() => setShowAddPartner(false)}
                  className="modal-cancel"
                  style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.12)', padding: '.68rem 1.25rem', borderRadius: 9, fontWeight: 600, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPartner}
                  className="modal-confirm"
                  style={{ background: 'var(--gold)', color: '#fff', border: 'none', padding: '.68rem 1.6rem', borderRadius: 9, fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(196,149,14,.4)', transition: 'background .18s, transform .15s var(--ease)' }}
                >
                  Add Partner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}