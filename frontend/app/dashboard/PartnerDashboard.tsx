'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useT, type Lang } from '@/lib/i18n';
import { RECENT_REDEMPTIONS, PARTNER_WEEK_DATA, type RecentRedemption } from '@/lib/seedData';
import type { FlaskDashboard } from '@/shared/types';

function MountainSVG() {
  return (
    <svg viewBox="0 0 1280 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" className="w-full h-full">
      <defs><linearGradient id="pSkyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F7F7F8" /><stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient></defs>
      <rect width="1280" height="180" fill="url(#pSkyG)" />
      <polygon points="0,180 180,130 350,145 540,115 700,135 900,105 1100,120 1280,110 1280,180" fill="#EAEAEC" opacity="0.4" />
      <polygon points="170,180 240,90 275,110 295,90 330,120 370,180" fill="#D5D4D8" />
      <polygon points="240,90 275,110 295,90 268,78" fill="white" opacity="0.75" />
      <polygon points="470,180 560,65 600,85 628,68 660,100 700,180" fill="#DCDCDF" />
      <polygon points="560,65 600,85 628,68 596,50" fill="white" opacity="0.80" />
      <polygon points="790,180 890,38 930,62 958,44 990,74 1030,180" fill="#D0CDD4" />
      <polygon points="890,38 930,62 958,44 958,36 928,22 896,36" fill="white" opacity="0.88" />
      <path d="M0,180 Q260,158 520,164 Q780,158 1040,163 Q1160,158 1280,162 L1280,180 Z" fill="#F0EFF3" opacity="0.55" />
    </svg>
  );
}

function LangSwitcher({ lang, onSet }: { lang: Lang; onSet: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1">
      {(['de', 'en', 'jp'] as Lang[]).map((l) => (
        <button key={l} onClick={() => onSet(l)} className={`text-xs font-medium px-1.5 py-0.5 rounded-full transition-all ${lang === l ? 'text-[#E2001A] bg-white' : 'text-white/70 hover:text-white'}`}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

type ScanResult = { name: string; benefit: string; token: string };

function QrScannerCard({ t }: { t: (k: string) => string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback((token: string) => {
    stopScanner();
    setResult({ name: 'Anna Tanaka', benefit: '20% Rabatt Bergbahn', token });
  }, []); // eslint-disable-line

  async function startScanner() {
    setError(null); setResult(null);
    if (!viewportRef.current) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const qr = new Html5Qrcode('qr-viewport');
      scannerRef.current = qr;
      setScanning(true);
      await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (decoded) => handleSuccess(decoded), () => {});
    } catch { setScanning(false); setError('Kamera nicht verfügbar. Bitte Code manuell eingeben.'); setManualMode(true); }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      const qr = scannerRef.current as { isScanning: boolean; stop: () => Promise<void>; clear: () => void };
      if (qr.isScanning) { await qr.stop().catch(() => {}); qr.clear(); }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  function confirmManual() {
    if (!manualToken.trim()) return;
    handleSuccess(manualToken.trim());
    setManualToken(''); setManualMode(false);
  }

  useEffect(() => () => { stopScanner(); }, []); // eslint-disable-line

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#F7F7F8]"><h2 className="text-base font-semibold text-[#1A1A1A]">{t('partner.scanQr')}</h2></div>
      <div className="p-6">
        {result ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-[#dcfce7] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-[#0E8A4F]"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
            </div>
            <p className="text-xl font-bold text-[#0E8A4F]">{t('partner.redeemed')}</p>
            <div className="text-center">
              <p className="text-base font-semibold text-[#1A1A1A]">{result.name} · {result.benefit}</p>
              <p className="text-xs font-mono text-[#A0A0A5] mt-1">{result.token.slice(0, 32)}{result.token.length > 32 ? '…' : ''}</p>
              <p className="text-xs text-[#A0A0A5] mt-1">{new Date().toLocaleString('de-CH')}</p>
            </div>
            <p className="text-xs text-[#6B6B6B]">{t('partner.once')}</p>
            <button onClick={() => setResult(null)} className="mt-2 bg-[#E2001A] hover:bg-[#B50015] text-white rounded-xl px-8 py-2.5 text-sm font-medium">Nächster Scan</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-80 h-80">
              <div id="qr-viewport" ref={viewportRef} className="w-full h-full bg-[#0A0A0A] rounded-xl overflow-hidden" />
              {!scanning && !manualMode && <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] rounded-xl"><p className="text-white/40 text-sm">{t('partner.scanHint')}</p></div>}
              {scanning && <>
                <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-[#E2001A] rounded-tl pointer-events-none" />
                <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-[#E2001A] rounded-tr pointer-events-none" />
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-[#E2001A] rounded-bl pointer-events-none" />
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-[#E2001A] rounded-br pointer-events-none" />
              </>}
            </div>
            {error && <p className="text-sm text-[#D97706] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-center">{error}</p>}
            {manualMode && (
              <div className="w-full flex gap-2">
                <input value={manualToken} onChange={(e) => setManualToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmManual()} placeholder={t('partner.enterToken')} className="flex-1 border border-[#E5E5E7] rounded-xl px-4 py-2.5 text-sm font-mono text-[#1A1A1A] placeholder-[#A0A0A5] focus:outline-none focus:ring-2 focus:ring-[#E2001A] focus:border-transparent" />
                <button onClick={confirmManual} className="bg-[#E2001A] hover:bg-[#B50015] text-white rounded-xl px-4 py-2.5 text-sm font-medium">{t('partner.confirm')}</button>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <button onClick={scanning ? stopScanner : startScanner} className="flex-1 bg-[#E2001A] hover:bg-[#B50015] text-white rounded-xl py-2.5 text-sm font-medium">{scanning ? t('partner.stopCamera') : t('partner.startCamera')}</button>
              <button onClick={() => { setManualMode(!manualMode); setError(null); }} className="flex-1 border border-[#E5E5E7] text-[#1A1A1A] hover:bg-[#F7F7F8] rounded-xl py-2.5 text-sm font-medium">{t('partner.enterCode')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="bg-white border border-[#E5E5E7] rounded-xl px-3 py-2 shadow-md"><p className="text-xs text-[#6B6B6B]">{label}</p><p className="text-sm font-semibold text-[#1A1A1A]">{payload[0].value} Einlösungen</p></div>;
}

export default function PartnerDashboard({ username, partnerName, apiKey }: { username: string; partnerName: string; apiKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang, setLanguage } = useT();
  const [dashboard, setDashboard] = useState<FlaskDashboard | null>(null);
  const [liveRedemptions, setLiveRedemptions] = useState<RecentRedemption[]>(RECENT_REDEMPTIONS);
  const [flashId, setFlashId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!apiKey) return;
    try { const r = await fetch('/api/partner/dashboard', { headers: { 'X-API-Key': apiKey } }); if (r.ok) setDashboard(await r.json()); } catch { /* seed data */ }
  }, [apiKey]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  function demoBroadcast() {
    const names = ["Liam O'Brien", 'Marco S.', 'Sophie F.', 'Kenji T.'];
    const benefits = ['20% Bergbahn', 'Welcome Drink', 'BOB Tagesticket', 'First Cliff Walk'];
    const newEntry: RecentRedemption = { id: `live-${Date.now()}`, name: names[Math.floor(Math.random() * names.length)], benefit: benefits[Math.floor(Math.random() * benefits.length)], time: 'gerade eben' };
    setLiveRedemptions((prev) => [newEntry, ...prev.slice(0, 9)]);
    setFlashId(newEntry.id);
    setTimeout(() => setFlashId(null), 1200);
  }

  async function logout() {
    if (pathname === '/demo') return;
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      <div className="relative h-[180px] overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none"><MountainSVG /></div>
        <div className="absolute top-4 left-4 md:left-6"><span className="text-[18px] font-bold"><span className="text-[#E2001A]">Jungfrau</span><span className="text-[#1A1A1A]">Pass</span></span></div>
        <div className="absolute top-4 right-4 md:right-6"><LangSwitcher lang={lang} onSet={setLanguage} /></div>
        {pathname !== '/demo' && <div className="absolute top-4 right-28 md:right-32"><button onClick={logout} className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] border border-[#E5E5E7] bg-white/80 rounded-full px-3 py-1">{t('common.logout')}</button></div>}
        <div className="absolute inset-0 flex flex-col items-center justify-center mt-4">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-[#1A1A1A]">{partnerName}</p>
            <span className="text-xs font-medium bg-[#dcfce7] text-[#0E8A4F] border border-[#bbf7d0] px-2.5 py-1 rounded-full">{t('status.online')}</span>
          </div>
          <p className="text-xs text-[#6B6B6B] mt-1.5">{t('partner.loggedAs')}</p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t('partner.todayRedeemed'), value: '47', sub: `↑ 12% ${t('partner.vsYesterday')}`, subColor: '#0E8A4F' },
            { label: t('partner.todayRevenue'), value: "CHF 1'240", sub: `↑ 8% ${t('partner.vsYesterday')}`, subColor: '#0E8A4F' },
            { label: t('partner.feesSaved'), value: 'CHF 24.80', sub: t('partner.thisMonth'), subColor: '#A0A0A5' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-[#A0A0A5]">{card.label}</p>
              <p className="text-4xl font-bold tabular text-[#1A1A1A] mt-3">{card.value}</p>
              <p className="text-xs mt-2" style={{ color: card.subColor }}>{card.sub}</p>
            </div>
          ))}
        </div>

        <QrScannerCard t={t} />

        <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F7F7F8] flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1A1A1A]">{t('partner.recentRedemptions')}</h2>
            <button onClick={demoBroadcast} className="text-xs text-[#A0A0A5] hover:text-[#1A1A1A] border border-[#E5E5E7] rounded-full px-3 py-1">+ Demo Einlösung</button>
          </div>
          <div className="divide-y divide-[#F7F7F8]">
            {liveRedemptions.map((r) => (
              <div key={r.id} className={`px-6 py-3 flex items-center gap-3 h-12 ${r.id === flashId ? 'flash-green' : ''}`}>
                <div className="w-5 h-5 rounded-full bg-[#dcfce7] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-[#0E8A4F]"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                </div>
                <p className="text-sm font-medium text-[#1A1A1A] flex-1">{r.name}</p>
                <p className="text-sm text-[#6B6B6B]">{r.benefit}</p>
                <p className="text-xs text-[#A0A0A5] shrink-0">{r.time}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-5">{t('partner.chart')}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={PARTNER_WEEK_DATA} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#A0A0A5' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#A0A0A5' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F7F7F8' }} />
              <Bar dataKey="count" fill="#E2001A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {dashboard && (
          <div className="bg-white rounded-2xl border border-[#E5E5E7] p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#A0A0A5] mb-4">Auszahlungs-Status</p>
            <div className="grid grid-cols-3 gap-4">
              {[{ label: 'Ausstehend', chf: dashboard.pending_chf, count: dashboard.pending_count }, { label: 'In Abrechnung', chf: dashboard.batched_chf, count: dashboard.batched_count }, { label: 'Bezahlt', chf: dashboard.settled_chf, count: dashboard.settled_count }].map((s) => (
                <div key={s.label}><p className="text-xs text-[#A0A0A5] uppercase tracking-wider">{s.label}</p><p className="text-xl font-bold text-[#1A1A1A] mt-1">CHF {s.chf.toFixed(2)}</p><p className="text-xs text-[#6B6B6B]">{s.count} Einlösungen</p></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
