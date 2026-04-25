'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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

function esc(s: string | null | undefined) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('admin-dev-key');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [settlementResult, setSettlementResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [xmlFileName, setXmlFileName] = useState('No file loaded');
  const [xmlContent, setXmlContent] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
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

  useEffect(() => { loadBatches(); }, []);

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo">Jungfrau<em style={{ color: 'var(--blue)' }}>.</em>Admin</div>
        <span className="nav-badge" style={{ background: 'var(--blue)', color: '#fff' }}>Demo</span>
        <div className="nav-right">
          <Link className="nav-link" href="/guest">Guest</Link>
          <Link className="nav-link" href="/partner">Partner</Link>
        </div>
      </nav>

      <div style={{ position: 'relative', height: 220, backgroundImage: "url('https://picsum.photos/seed/swiss-finance-bank/1920/400')", backgroundSize: 'cover', backgroundPosition: 'center 35%', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ content: '', position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,28,46,.95) 0%, rgba(14,28,46,.5) 55%, rgba(14,28,46,.18) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, color: '#fff', padding: '1.75rem 2.5rem', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-.02em', marginBottom: '.2rem' }}>Settlement Console</h1>
          <p style={{ fontSize: '.875rem', opacity: .65 }}>Generate ISO 20022 payment batches, confirm partner payouts, and manage demo data.</p>
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 2rem 3.5rem' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'start' }}>

          <div className="card" style={{ animationDelay: '.04s' }}>
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

          <div className="card" style={{ animationDelay: '.09s' }}>
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

        <div className="card mb-card" style={{ animationDelay: '.14s' }}>
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

        <div className="card" style={{ animationDelay: '.19s' }}>
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

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>

      <style>{`
        @media(max-width:900px){
          .top-row { grid-template-columns: 1fr !important; }
          main { padding: 1.25rem 1rem 2.5rem !important; }
        }
      `}</style>
    </>
  );
}
