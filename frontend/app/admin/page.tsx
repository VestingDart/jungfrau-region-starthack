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

  const inputStyle = { width: '100%', padding: '.68rem .9rem', border: '1px solid var(--line)', borderRadius: 9, fontSize: '.875rem', color: 'var(--text)', background: 'var(--sand)', fontFamily: 'inherit' };
  const labelStyle = { display: 'block' as const, fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.07em', color: 'var(--sub)', marginBottom: '.35rem' };

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo">Jungfrau<em style={{ color: 'var(--blue)' }}>.</em>Admin</div>
        <div className="nav-right">
          <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.65)', fontWeight: 500 }}>{session?.name}</span>
          <button
            onClick={signOut}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.2)', color: 'rgba(255,255,255,.7)', padding: '.38rem .85rem', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ position: 'relative', height: 220, backgroundImage: "url('https://picsum.photos/seed/swiss-finance-bank/1920/400')", backgroundSize: 'cover', backgroundPosition: 'center 35%', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ content: '', position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,28,46,.95) 0%, rgba(14,28,46,.5) 55%, rgba(14,28,46,.18) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, color: '#fff', padding: '1.75rem 2.5rem', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-.02em', marginBottom: '.2rem' }}>Admin Console</h1>
          <p style={{ fontSize: '.875rem', opacity: .65 }}>Manage partners, run settlements, and generate ISO 20022 payment batches.</p>
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 2rem 3.5rem' }}>

        {/* Partners section */}
        <div className="card mb-card" style={{ animationDelay: '.04s' }}>
          <div className="card-head">
            <h2>Partners</h2>
            <button
              onClick={() => { setShowAddPartner(true); setAddError(''); }}
              style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '.45rem 1rem', borderRadius: 8, fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Add Partner
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', minWidth: 600 }}>
                <thead>
                  <tr>
                    {['Name', 'Username', 'Password', 'Category', 'Flask API Key', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '.65rem .85rem', textAlign: 'left', fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sub)', background: 'var(--sand)', borderBottom: '2px solid var(--line)' }}>{h}</th>
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
                      <td style={{ padding: '.72rem .85rem', fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: '.72rem .85rem', fontFamily: 'ui-monospace,monospace', fontSize: '.78rem', color: 'var(--sub)' }}>{p.username}</td>
                      <td style={{ padding: '.72rem .85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                          <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.78rem', color: 'var(--sub)', letterSpacing: pwVisible ? 0 : '.08em' }}>
                            {pwVisible ? p.password : '••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(p.id)}
                            title={pwVisible ? 'Hide password' : 'Show password'}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '.1rem .25rem', color: 'var(--sub)', fontSize: '.75rem', lineHeight: 1 }}
                          >
                            {pwVisible ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '.72rem .85rem' }}>{CATEGORY_LABELS[p.category] || p.category}</td>
                      <td style={{ padding: '.72rem .85rem' }}><code style={{ fontSize: '.72rem', color: 'var(--sub)' }}>{p.flaskApiKey}</code></td>
                      <td style={{ padding: '.72rem .85rem' }}><span className={`pill pill-${p.status}`}>{p.status}</span></td>
                      <td style={{ padding: '.72rem .85rem' }}>
                        <button onClick={() => handleDeletePartner(p.id, p.name)} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.3)', padding: '.25rem .6rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pending Offers section */}
        <div className="card mb-card" style={{ animationDelay: '.07s' }}>
          <div className="card-head">
            <h2>
              Pending Offers
              {pendingOffers.length > 0 && (
                <span style={{ marginLeft: '.6rem', background: 'var(--danger)', color: '#fff', borderRadius: 20, padding: '.1rem .55rem', fontSize: '.62rem', fontWeight: 800, verticalAlign: 'middle' }}>
                  {pendingOffers.length}
                </span>
              )}
            </h2>
            <button className="btn btn-outline btn-sm" onClick={loadPendingOffers}>Refresh</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', minWidth: 600 }}>
                <thead>
                  <tr>
                    {['Partner', 'Title', 'Type', 'Payout', 'Submitted', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '.65rem .85rem', textAlign: 'left', fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sub)', background: 'var(--sand)', borderBottom: '2px solid var(--line)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingOffers.length === 0 ? (
                    <tr><td colSpan={6} className="empty-msg">No offers pending approval</td></tr>
                  ) : pendingOffers.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '.72rem .85rem', fontWeight: 700 }}>{o.partner_name}</td>
                      <td style={{ padding: '.72rem .85rem' }}>
                        <div style={{ fontWeight: 600 }}>{o.title}</div>
                        {o.description && <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.15rem' }}>{o.description}</div>}
                      </td>
                      <td style={{ padding: '.72rem .85rem' }}><span className="pill pill-draft">{o.type}</span></td>
                      <td style={{ padding: '.72rem .85rem', fontWeight: 700 }}>CHF {(o.partner_payout_rappen / 100).toFixed(2)}</td>
                      <td style={{ padding: '.72rem .85rem', fontSize: '.75rem', color: 'var(--sub)' }}>{new Date(o.created_at).toLocaleString('en-CH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ padding: '.72rem .85rem' }}>
                        <div style={{ display: 'flex', gap: '.4rem' }}>
                          <button onClick={() => approveOffer(o.id, o.title)} style={{ background: 'var(--pine)', color: '#fff', border: 'none', padding: '.28rem .7rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Approve</button>
                          <button onClick={() => rejectOffer(o.id, o.title)} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(197,32,46,.3)', padding: '.28rem .7rem', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'start' }}>

          <div className="card" style={{ animationDelay: '.09s' }}>
            <div className="card-head"><h2>Admin Key</h2></div>
            <div className="card-body">
              <input
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                spellCheck={false}
                style={{ width: '100%', padding: '.68rem .9rem', border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'ui-monospace,monospace', fontSize: '.82rem', color: 'var(--text)', background: 'var(--sand)' }}
              />
              <div style={{ fontSize: '.74rem', color: 'var(--sub)', marginTop: '.45rem' }}>Required for all admin endpoints. Default: <code>admin-dev-key</code></div>
            </div>
          </div>

          <div className="card" style={{ animationDelay: '.14s' }}>
            <div className="card-head"><h2>Settlement Actions</h2></div>
            <div className="card-body">
              <div style={{ fontSize: '.85rem', color: 'var(--sub)', lineHeight: 1.65, marginBottom: '1.35rem' }}>
                Aggregates all <strong style={{ color: 'var(--text)', fontWeight: 700 }}>pending</strong> merchant ledger entries into per-partner batches
                and generates a real ISO 20022 <code>pain.001.001.09</code> XML file ready for your bank.
              </div>
              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={runSettlement}>Run Settlement</button>
                <button className="btn btn-ghost" onClick={reseed}>Reset &amp; Reseed</button>
              </div>
              {settlementResult && (
                <div style={{ marginTop: '1rem', padding: '.9rem 1.1rem', borderRadius: 9, fontSize: '.875rem', animation: 'rise .2s var(--ease)', ...(settlementResult.ok ? { background: '#e8f5ee', borderLeft: '4px solid var(--pine)' } : { color: 'var(--sub)' }) }}>
                  {settlementResult.ok
                    ? <><strong style={{ display: 'block', fontWeight: 700, color: 'var(--pine)', marginBottom: '.2rem' }}>Success</strong>{settlementResult.msg}</>
                    : settlementResult.msg}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card mb-card" style={{ animationDelay: '.19s' }}>
          <div className="card-head">
            <h2>Settlement Batches</h2>
            <button className="btn btn-outline btn-sm" onClick={loadBatches}>Refresh</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', minWidth: 700 }}>
                <thead>
                  <tr>
                    {['Partner', 'Period', 'Total', 'Count', 'Reference', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '.65rem .85rem', textAlign: 'left', fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sub)', background: 'var(--sand)', borderBottom: '2px solid var(--line)' }}>{h}</th>
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
                        <td style={{ padding: '.72rem .85rem', verticalAlign: 'middle' }}>
                          <strong style={{ display: 'block', fontWeight: 700, fontSize: '.88rem' }}>{b.partner_name}</strong>
                          <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: '.1rem' }}>{date}</div>
                        </td>
                        <td style={{ padding: '.72rem .85rem', verticalAlign: 'middle', fontSize: '.75rem', color: 'var(--sub)', lineHeight: 1.6 }}>
                          {b.period_start.substring(0, 10)}<br />→ {b.period_end.substring(0, 10)}
                        </td>
                        <td style={{ padding: '.72rem .85rem', verticalAlign: 'middle', fontWeight: 800 }}>CHF {chf}</td>
                        <td style={{ padding: '.72rem .85rem', verticalAlign: 'middle' }}>{b.redemption_count}</td>
                        <td style={{ padding: '.72rem .85rem', verticalAlign: 'middle' }}><code style={{ fontSize: '.68rem' }}>{esc(b.payment_reference)}</code></td>
                        <td style={{ padding: '.72rem .85rem', verticalAlign: 'middle' }}><span className={`pill pill-${b.status}`}>{b.status}</span></td>
                        <td style={{ padding: '.72rem .85rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            {b.pain001_file_path && <button className="btn btn-outline btn-sm" onClick={() => viewPain001(b.id, esc(b.payment_reference))}>View XML</button>}
                            {canConfirm && <button className="btn btn-pine btn-sm" onClick={() => confirmBatch(b.id)}>Mark paid</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card" style={{ animationDelay: '.24s' }}>
          <div className="card-head">
            <h2>pain.001 File Preview</h2>
            <span style={{ background: 'rgba(45,83,150,.12)', color: 'var(--blue)', padding: '.15rem .5rem', borderRadius: 4, fontSize: '.65rem', fontWeight: 700 }}>ISO 20022 · pain.001.001.09</span>
          </div>
          <div style={{ padding: 0 }}>
            <div style={{ padding: '.7rem 1.5rem', background: 'rgba(14,28,46,.04)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        </div>

      </main>

      {/* Add Partner Modal */}
      {showAddPartner && (
        <div onClick={() => setShowAddPartner(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: '2rem', maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(14,28,46,.25)', animation: 'rise .25s var(--ease)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--night)' }}>Add New Partner</h2>
              <button onClick={() => setShowAddPartner(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--sand)', border: 'none', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sub)' }}>&#x2715;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
              <div>
                <label style={labelStyle}>Partner Name</label>
                <input style={inputStyle} value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Grindelwald Ski School" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input style={inputStyle} value={addUsername} onChange={e => setAddUsername(e.target.value)} placeholder="e.g. grindelski" />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" style={inputStyle} value={addPassword} onChange={e => setAddPassword(e.target.value)} placeholder="Min. 6 characters" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={addCategory} onChange={e => setAddCategory(e.target.value)}>
                    <option value="mountain_railway">Mountain Railway</option>
                    <option value="activity">Activity</option>
                    <option value="transport">Transport</option>
                    <option value="cruise">Cruise</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Flask API Key</label>
                  <input style={inputStyle} value={addFlaskKey} onChange={e => setAddFlaskKey(e.target.value)} placeholder="key-grindelski (auto)" />
                </div>
              </div>
              {addError && (
                <div style={{ padding: '.65rem .9rem', background: '#fdecef', borderLeft: '3px solid var(--danger)', borderRadius: '0 8px 8px 0', fontSize: '.82rem', color: 'var(--danger)' }}>
                  {addError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '.65rem', justifyContent: 'flex-end', marginTop: '.25rem' }}>
                <button onClick={() => setShowAddPartner(false)} style={{ background: 'var(--sand)', color: 'var(--sub)', border: 'none', padding: '.65rem 1.25rem', borderRadius: 9, fontWeight: 600, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleAddPartner} style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '.65rem 1.5rem', borderRadius: 9, fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>Add Partner</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>

      <style>{`
        @media(max-width:900px){
          main { padding: 1.25rem 1rem 2.5rem !important; }
        }
      `}</style>
    </>
  );
}
