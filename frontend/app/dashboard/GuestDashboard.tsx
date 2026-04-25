'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import QRCode from 'qrcode';
import { useT, type Lang } from '@/lib/i18n';
import { GUEST, TRANSACTIONS, BENEFITS, type Benefit, type BenefitTab } from '@/lib/seedData';
import type { FlaskWallet } from '@/shared/types';

const CHECKIN = { check_in: '2026-04-25', check_out: '2026-04-29' };

function MountainSVG() {
  return (
    <svg viewBox="0 0 1280 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" className="w-full h-full">
      <defs>
        <linearGradient id="gSkyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7F7F8" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1280" height="180" fill="url(#gSkyG)" />
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
        <button key={l} onClick={() => onSet(l)}
          className={`text-xs font-medium px-1.5 py-0.5 rounded-full transition-all ${lang === l ? 'text-[#E2001A] bg-white' : 'text-white/70 hover:text-white'}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function QrModal({ token, title, onClose, t }: { token: string; title: string; onClose: () => void; t: (k: string) => string }) {
  const [dataUrl, setDataUrl] = useState('');
  const [secs, setSecs] = useState(900);
  const expired = secs <= 0;
  useEffect(() => { QRCode.toDataURL(token, { width: 280, margin: 2 }).then(setDataUrl); }, [token]);
  useEffect(() => { const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(id); }, []);
  const mins = String(Math.floor(secs / 60)).padStart(2, '0');
  const sec = String(secs % 60).padStart(2, '0');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E7]">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[#A0A0A5]">JungfrauPass</p>
            <p className="text-base font-semibold text-[#1A1A1A] mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="text-[#A0A0A5] hover:text-[#1A1A1A] text-xl leading-none">✕</button>
        </div>
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <div className={`rounded-xl p-3 border-2 ${expired ? 'border-[#E5E5E7] opacity-40 grayscale' : 'border-[#E5E5E7]'}`}>
            {dataUrl ? <img src={dataUrl} width={240} height={240} alt="QR" className="block rounded" /> : <div className="w-60 h-60 bg-[#F7F7F8] rounded animate-pulse" />}
          </div>
          <div className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl ${expired ? 'bg-red-50 border border-red-200' : 'bg-[#F7F7F8] border border-[#E5E5E7]'}`}>
            <p className={`text-xs font-medium ${expired ? 'text-red-600' : 'text-[#6B6B6B]'}`}>{expired ? 'QR-Code abgelaufen' : t('guest.showQr')}</p>
            <span className={`font-mono text-sm font-bold tabular ${expired ? 'text-red-600' : 'text-[#1A1A1A]'}`}>{mins}:{sec}</span>
          </div>
          <div className="w-full">
            <p className="text-xs text-[#A0A0A5] mb-1 uppercase tracking-wide font-medium">Token ID</p>
            <p className="font-mono text-xs text-[#6B6B6B] bg-[#F7F7F8] rounded-xl px-3 py-2 break-all border border-[#E5E5E7]">{token.slice(0, 24)}…</p>
          </div>
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose} className="w-full border border-[#E5E5E7] rounded-xl py-2.5 text-sm font-medium text-[#6B6B6B] hover:bg-[#F7F7F8]">{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

function PayModal({ type, message, onClose }: { type: 'apple' | 'google'; message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${type === 'apple' ? 'bg-black' : 'bg-white border-2 border-[#E5E5E7]'}`}>
          {type === 'apple'
            ? <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.41c1.39.08 2.35.77 3.16.8 1.21-.24 2.37-.96 3.67-.82 1.56.18 2.74.82 3.48 2.09-3.19 1.91-2.5 6.15.83 7.26-.69 1.87-1.6 3.7-3.14 4.54zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
            : <span className="text-xl font-bold">G</span>}
        </div>
        <p className="text-sm text-[#1A1A1A] font-medium leading-relaxed">{message}</p>
        <button onClick={onClose} className="mt-4 w-full bg-[#1A1A1A] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#333]">OK</button>
      </div>
    </div>
  );
}

function TopUpModal({ guestId, onClose, onSuccess }: { guestId: string; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  async function pay() {
    setLoading(true);
    try {
      const r = await fetch(`/api/wallet/${guestId}/topup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `topup-${Date.now()}` }, body: JSON.stringify({ amount_chf: parseFloat(amount), payment_method: 'twint' }) });
      const data = await r.json();
      if (r.ok && data.checkout_url) { window.open(data.checkout_url, '_blank', 'width=480,height=420'); onClose(); setTimeout(onSuccess, 3000); }
    } finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4"><p className="text-base font-semibold text-[#1A1A1A]">Wallet aufladen</p><p className="text-sm text-[#6B6B6B] mt-1">Betrag wählen und via TWINT bezahlen.</p></div>
        <div className="px-6 pb-4">
          <div className="flex gap-2 mb-3">{['50', '100', '200'].map((v) => (<button key={v} onClick={() => setAmount(v)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${amount === v ? 'bg-[#E2001A] text-white border-[#E2001A]' : 'border-[#E5E5E7] text-[#1A1A1A] hover:bg-[#F7F7F8]'}`}>CHF {v}</button>))}</div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="10" step="10" className="w-full border border-[#E5E5E7] rounded-xl px-3.5 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#E2001A] focus:border-transparent" />
        </div>
        <div className="px-6 pb-6 flex gap-2.5">
          <button onClick={onClose} className="flex-1 border border-[#E5E5E7] rounded-xl py-2.5 text-sm font-medium text-[#6B6B6B] hover:bg-[#F7F7F8]">Abbrechen</button>
          <button onClick={pay} disabled={loading || !amount} className="flex-1 bg-[#E2001A] hover:bg-[#B50015] disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium">{loading ? 'Öffnet…' : 'Via TWINT bezahlen'}</button>
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ b, onRedeem, t, redeemed }: { b: Benefit; onRedeem: (b: Benefit) => void; t: (k: string) => string; redeemed: boolean }) {
  return (
    <div className={`rounded-2xl border border-[#E5E5E7] overflow-hidden flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${redeemed ? 'opacity-50' : ''}`} style={{ minHeight: 200 }}>
      <div className="relative h-24 flex items-center justify-center" style={{ backgroundColor: b.color + '22' }}>
        <span className="text-xs font-semibold text-center px-3" style={{ color: b.color }}>{b.partner}</span>
        {b.once && <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider bg-white text-[#6B6B6B] px-2 py-0.5 rounded-full border border-[#E5E5E7]">{t('guest.once')}</span>}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-sm font-semibold text-[#1A1A1A] leading-snug">{b.title}</p>
        <p className="text-xs text-[#6B6B6B] mt-1 flex-1">{b.subtitle}</p>
        {!redeemed && <button onClick={() => onRedeem(b)} className="mt-3 w-full bg-[#E2001A] hover:bg-[#B50015] text-white text-sm font-medium py-2 rounded-xl">{t('guest.redeem')}</button>}
      </div>
    </div>
  );
}

function PartnersMap() {
  return (
    <svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <defs><linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#BFDBFE" /><stop offset="100%" stopColor="#93C5FD" /></linearGradient></defs>
      <rect width="560" height="300" fill="#F0EFF3" rx="12" />
      <ellipse cx="115" cy="190" rx="80" ry="28" fill="url(#waterG)" opacity="0.85" />
      <text x="115" y="194" textAnchor="middle" fontSize="8" fill="#3B82F6" fontWeight="500">Thunersee</text>
      <ellipse cx="420" cy="185" rx="85" ry="26" fill="url(#waterG)" opacity="0.85" />
      <text x="420" y="189" textAnchor="middle" fontSize="8" fill="#3B82F6" fontWeight="500">Brienzersee</text>
      <ellipse cx="262" cy="188" rx="30" ry="15" fill="#E8E7EC" opacity="0.9" />
      <text x="262" y="192" textAnchor="middle" fontSize="8" fill="#6B6B6B" fontWeight="600">Interlaken</text>
      <polygon points="120,140 170,85 220,120" fill="#D5D4D8" opacity="0.6" />
      <polygon points="200,135 265,60 320,100" fill="#DCDCDF" opacity="0.6" />
      <polygon points="300,130 380,45 450,90" fill="#D0CDD4" opacity="0.6" />
      <polygon points="170,85 190,100 155,100" fill="white" opacity="0.7" />
      <polygon points="265,60 285,80 248,80" fill="white" opacity="0.75" />
      <polygon points="380,45 400,68 363,68" fill="white" opacity="0.8" />
      <text x="170" y="82" textAnchor="middle" fontSize="7" fill="#6B6B6B">Eiger</text>
      <text x="265" y="57" textAnchor="middle" fontSize="7" fill="#6B6B6B">Mönch</text>
      <text x="380" y="42" textAnchor="middle" fontSize="7" fill="#6B6B6B">Jungfrau</text>
      <line x1="195" y1="188" x2="330" y2="188" stroke="#C8C7CC" strokeWidth="2" />
      <circle cx="220" cy="155" r="7" fill="#E2001A" /><text x="220" y="143" textAnchor="middle" fontSize="7" fill="#1A1A1A" fontWeight="500">Harder Kulm</text>
      <circle cx="340" cy="100" r="7" fill="#E2001A" /><text x="340" y="88" textAnchor="middle" fontSize="7" fill="#1A1A1A" fontWeight="500">Jungfraujoch</text>
      <circle cx="260" cy="200" r="6" fill="#E2001A" /><text x="260" y="215" textAnchor="middle" fontSize="7" fill="#1A1A1A">BOB Bahn</text>
      <circle cx="130" cy="178" r="6" fill="#E2001A" /><text x="130" y="168" textAnchor="middle" fontSize="7" fill="#1A1A1A">Rundfahrt</text>
      <circle cx="430" cy="110" r="6" fill="#E2001A" /><text x="450" y="108" fontSize="7" fill="#1A1A1A">First Walk</text>
      <circle cx="255" cy="182" r="5" fill="#E2001A" />
      <circle cx="275" cy="195" r="5" fill="#E2001A" />
      <circle cx="360" cy="148" r="5" fill="#E2001A" />
    </svg>
  );
}

export default function GuestDashboard({ username, guestCardId }: { username: string; guestCardId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDemo = pathname === '/demo';
  const { t, lang, setLanguage } = useT();
  const [wallet, setWallet] = useState<FlaskWallet | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [flaskError, setFlaskError] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [payModal, setPayModal] = useState<'apple' | 'google' | null>(null);
  const [qrState, setQrState] = useState<{ token: string; title: string } | null>(null);
  const [benefitTab, setBenefitTab] = useState<BenefitTab>('active');
  const [showAllTx, setShowAllTx] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const loadWallet = useCallback(async (id: string) => {
    const r = await fetch(`/api/wallet/${id}`);
    if (r.ok) setWallet(await r.json());
  }, []);

  useEffect(() => {
    if (!guestCardId) return;
    (async () => {
      try {
        const r = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_card_id: guestCardId, ...CHECKIN }) });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const id = data.guest.id as string;
        setGuestId(id);
        await loadWallet(id);
      } catch { setFlaskError(true); }
    })();
  }, [guestCardId, loadWallet]);

  async function generateQR(benefitId: string, benefitTitle: string) {
    const fakeToken = `JFP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    if (!guestId) { setQrState({ token: fakeToken, title: benefitTitle }); return; }
    try {
      const r = await fetch('/api/qr/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_id: guestId, entitlement_id: benefitId }) });
      if (!r.ok) { setQrState({ token: fakeToken, title: benefitTitle }); return; }
      const data = await r.json();
      setQrState({ token: data.qr_token, title: benefitTitle });
    } catch { setQrState({ token: fakeToken, title: benefitTitle }); }
  }

  async function logout() {
    if (isDemo) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const balance = wallet ? wallet.balance_chf : GUEST.balance;
  const activeBenefits = BENEFITS.filter((b) => b.tab === 'active');
  const alwaysBenefits = BENEFITS.filter((b) => b.tab === 'alwayson');
  const redeemedBenefits = BENEFITS.filter((b) => b.tab === 'redeemed');
  const visibleTx = showAllTx ? TRANSACTIONS : TRANSACTIONS.slice(0, 3);

  return (
    <div className="min-h-screen bg-white">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#0E8A4F] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg slide-down">{toast}</div>}

      <div className="relative h-[180px] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"><MountainSVG /></div>
        <div className="absolute top-4 left-4 md:left-6"><span className="text-[18px] font-bold leading-none"><span className="text-[#E2001A]">Jungfrau</span><span className="text-[#1A1A1A]">Pass</span></span></div>
        <div className="absolute top-4 right-4 md:right-6"><LangSwitcher lang={lang} onSet={setLanguage} /></div>
        {!isDemo && <div className="absolute top-4 right-28 md:right-32"><button onClick={logout} className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] border border-[#E5E5E7] bg-white/80 rounded-full px-3 py-1">{t('common.logout')}</button></div>}
        <div className="absolute inset-0 flex flex-col items-center justify-center mt-4">
          <p className="text-2xl font-bold text-[#1A1A1A]">{username} {GUEST.flag}</p>
          <div className="flex items-center gap-2 mt-2"><span className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-[#dcfce7] text-[#0E8A4F] border border-[#bbf7d0]">{t('status.active')}</span></div>
          <p className="text-xs text-[#6B6B6B] mt-1.5">{t('guest.validUntil')}</p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[480px] bg-[#0A0A0A] rounded-2xl p-6 text-white shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-bold tracking-widest text-white/60">JUNGFRAUPASS</span>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white/50"><path d="M1 9l2 2c2.76-2.76 6.57-4.01 10.28-3.74l1.42-1.42C9.84 5.15 4.93 6.54 1 9zm22 0c-3.93-2.46-8.84-3.85-14.7-3.16L9.72 7.26C14.43 6.99 18.24 8.24 21 11l2-2z" /></svg>
            </div>
            <div className="text-center">
              <p className="text-5xl font-bold tabular tracking-tight">CHF {balance.toFixed(2)}</p>
              <p className="text-sm text-white/50 mt-1">{t('guest.available')}</p>
            </div>
            {guestCardId && <p className="text-[10px] font-mono text-white/30 text-center mt-4">{guestCardId}</p>}
          </div>
          <div className="w-full max-w-[480px] flex gap-3 mt-4">
            <button onClick={() => setPayModal('apple')} className="flex-1 h-11 bg-[#0A0A0A] hover:bg-[#222] text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.41c1.39.08 2.35.77 3.16.8 1.21-.24 2.37-.96 3.67-.82 1.56.18 2.74.82 3.48 2.09-3.19 1.91-2.5 6.15.83 7.26-.69 1.87-1.6 3.7-3.14 4.54zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
              Pay
            </button>
            <button onClick={() => setPayModal('google')} className="flex-1 h-11 bg-[#0A0A0A] hover:bg-[#222] text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium"><span className="font-semibold">G</span> Pay</button>
          </div>
          <p className="text-xs text-[#A0A0A5] text-center mt-2 max-w-[480px]">{t('guest.payHold')}</p>
          <button onClick={() => guestId ? setShowTopUp(true) : showToast('Backend nicht erreichbar')} className="text-sm text-[#E2001A] font-medium mt-2 hover:underline">+ {t('guest.topup')}</button>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F7F7F8]"><h2 className="text-base font-semibold text-[#1A1A1A]">{t('guest.transactions')}</h2></div>
          <div className="divide-y divide-[#F7F7F8]">
            {visibleTx.map((tx) => (
              <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between h-14">
                <p className="text-sm font-medium text-[#1A1A1A]">{tx.label}</p>
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular ${tx.amount < 0 ? 'text-[#E2001A]' : 'text-[#0E8A4F]'}`}>{tx.amount > 0 ? '+' : ''}CHF {Math.abs(tx.amount).toFixed(2)}</p>
                  <p className="text-xs text-[#A0A0A5]">{tx.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-[#F7F7F8]"><button onClick={() => setShowAllTx(!showAllTx)} className="text-sm text-[#E2001A] font-medium hover:underline">{showAllTx ? t('guest.showLess') : t('guest.showAll')}</button></div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 pt-6 pb-4"><h2 className="text-base font-semibold text-[#1A1A1A]">{t('guest.benefits')}</h2></div>
          <div className="px-6 flex gap-0 border-b border-[#E5E5E7]">
            {([{ key: 'active' as BenefitTab, label: t('guest.tab.active'), count: activeBenefits.length }, { key: 'alwayson' as BenefitTab, label: t('guest.tab.alwayson'), count: alwaysBenefits.length }, { key: 'redeemed' as BenefitTab, label: t('guest.tab.redeemed'), count: redeemedBenefits.length }]).map((tab) => (
              <button key={tab.key} onClick={() => setBenefitTab(tab.key)} className={`pb-3 pt-1 mr-6 text-sm font-medium border-b-2 transition-colors ${benefitTab === tab.key ? 'border-[#E2001A] text-[#E2001A]' : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'}`}>{tab.label} ({tab.count})</button>
            ))}
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(benefitTab === 'active' ? activeBenefits : benefitTab === 'alwayson' ? alwaysBenefits : redeemedBenefits).map((b) => (
                <BenefitCard key={b.id} b={b} onRedeem={(b) => generateQR(b.id, b.title)} t={t} redeemed={b.tab === 'redeemed'} />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F7F7F8]"><h2 className="text-base font-semibold text-[#1A1A1A]">{t('guest.nearby')}</h2></div>
          <div className="p-4"><PartnersMap /></div>
          <div className="px-6 py-3 border-t border-[#F7F7F8]"><p className="text-sm text-[#6B6B6B]">{t('guest.nearbyCount')}</p></div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#0E8A4F]"><path d="M17 8C8 10 5.9 16.17 3.82 21.34.95 17.26 2 13.34 4.22 10.52 6 8.34 9.5 7 12 7c-1.65-1.65-4.35-2.02-7.41-1.39l3.03-3.03c4.28-.31 8.75 1.64 10.14 6.63C14.05 7.49 10.6 6 8 6c-.12 1.28 1.26 3.28 4 4 1.18.3 2.5.67 3.87 1.27C17.37 12.1 18 13 18 14c0 2.76-3.58 5-8 5-2.32 0-4.24-.64-5.62-1.68C5.5 18.62 7.63 20 10 20c3.69 0 7-2.19 7-6 0-2.39-1.08-4.48-2.74-5.85L17 8z" /></svg>
            <h2 className="text-base font-semibold text-[#1A1A1A]">{t('guest.sustainability')}</h2>
          </div>
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium uppercase tracking-widest text-[#6B6B6B]">{t('guest.sustainPoints')}</span><span className="text-sm font-semibold text-[#0E8A4F]">142 / 200</span></div>
          <div className="w-full bg-[#F7F7F8] rounded-full h-2.5 mb-3"><div className="bg-[#0E8A4F] h-2.5 rounded-full" style={{ width: '71%' }} /></div>
          <p className="text-xs text-[#6B6B6B] leading-relaxed">{t('guest.sustainTip')}</p>
        </div>

        {flaskError && <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-xl px-5 py-3"><p className="text-sm text-[#92400E]">Demo-Modus: Flask-Backend nicht erreichbar. Seed-Daten werden angezeigt.</p></div>}
      </div>

      {qrState && <QrModal token={qrState.token} title={qrState.title} onClose={() => { setQrState(null); showToast(`✓ QR für ${qrState.title} generiert`); }} t={t} />}
      {payModal && <PayModal type={payModal} message={t(payModal === 'apple' ? 'pay.apple.confirm' : 'pay.google.confirm')} onClose={() => setPayModal(null)} />}
      {showTopUp && guestId && <TopUpModal guestId={guestId} onClose={() => setShowTopUp(false)} onSuccess={() => { setShowTopUp(false); loadWallet(guestId); }} />}
    </div>
  );
}
