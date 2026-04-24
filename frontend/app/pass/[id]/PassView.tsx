'use client';

import { useState, useEffect } from 'react';
import type { PassResponse, Benefit, PassStatus } from '@/shared/types';
import QRCode from 'qrcode';

// ─── Constants & helpers ──────────────────────────────────────────────────────

const EXPIRY_MS = 15 * 60 * 1000;

type ActiveRedemption = { benefitId: string; token: string; expiresAt: number };

function generateToken(prefix: string): string {
  const chars = 'ABCDEF0123456789';
  const rand = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${rand(4)}-${rand(6)}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function daysRemaining(validUntil: string): number {
  return Math.max(0, Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86_400_000));
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusConfig(status: PassStatus) {
  if (status === 'active')
    return { dot: 'bg-brand', text: 'text-brand', bg: 'bg-brand-light border-brand-border', label: 'Active' };
  if (status === 'provisioned')
    return { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', label: 'Provisioned' };
  return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Expired' };
}

function useCountdown(expiresAt: number) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    setSecs(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    const id = setInterval(() => setSecs(Math.max(0, Math.round((expiresAt - Date.now()) / 1000))), 500);
    return () => clearInterval(id);
  }, [expiresAt]);
  return secs;
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} title="Copy token"
      className="px-3 py-2 border-l border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded-r shrink-0">
      {copied ? (
        <svg className="w-4 h-4 text-brand" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
        </svg>
      )}
    </button>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ConfirmModal({ benefit, onConfirm, onClose }: { benefit: Benefit; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4">
          <div className="w-10 h-10 bg-brand-light rounded-full flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-brand" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-900">Activate redemption code?</p>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            A QR code for <span className="font-medium text-gray-700">{benefit.partnerName}</span> will be generated.
            It is valid for <span className="font-medium text-gray-700">15 minutes</span> and can only be scanned once.
          </p>
        </div>
        <div className="mx-6 mb-4 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 leading-relaxed">
            Only activate when you are at the partner location and ready to show the code.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-2.5">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-brand hover:bg-brand-dark text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
            Generate code
          </button>
        </div>
      </div>
    </div>
  );
}

function RedemptionModal({ benefit, redemption, onRotate, onClose }: {
  benefit: Benefit;
  redemption: ActiveRedemption;
  onRotate: () => void;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const secs = useCountdown(redemption.expiresAt);
  const expired = secs <= 0;
  const urgent = !expired && secs <= 60;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  useEffect(() => {
    setQrDataUrl('');
    QRCode.toDataURL(redemption.token, { width: 200, margin: 2 }).then(setQrDataUrl);
  }, [redemption.token]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Redeem at</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">{benefit.partnerName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{benefit.title} · {benefit.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors ml-4 mt-0.5">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col items-center gap-4">
          {/* QR code */}
          <div className={`border rounded-xl p-4 transition-all ${expired ? 'opacity-25 grayscale border-gray-200' : 'border-gray-200'}`}>
            {qrDataUrl
              ? <img src={qrDataUrl} alt="Redemption QR code" width={200} height={200} className="block" />
              : <div className="w-[200px] h-[200px] bg-gray-100 rounded-lg animate-pulse" />
            }
          </div>

          {expired ? (
            <div className="w-full text-center space-y-3">
              <p className="text-sm font-medium text-red-600">This code has expired</p>
              <button onClick={onRotate}
                className="w-full bg-brand hover:bg-brand-dark text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
                Generate new code
              </button>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* Token + copy */}
              <div>
                <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Token ID</p>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <p className="font-mono text-sm px-3 py-2.5 text-gray-800 tracking-widest flex-1">{redemption.token}</p>
                  <CopyButton text={redemption.token} />
                </div>
              </div>

              {/* Timer */}
              <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border ${urgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs ${urgent ? 'text-red-600' : 'text-gray-500'}`}>
                  {urgent ? 'Expiring soon — show to partner now' : 'Partner scans this code'}
                </p>
                <span className={`font-mono text-sm font-semibold tabular-nums ${urgent ? 'text-red-600' : 'text-gray-700'}`}>
                  {mm}:{ss}
                </span>
              </div>
            </div>
          )}
        </div>

        {!expired && (
          <div className="px-6 pb-5">
            <button onClick={onClose}
              className="w-full border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function PassView({ data }: { data: PassResponse }) {
  const { pass, benefits } = data;
  const [redemptions, setRedemptions] = useState<Record<string, ActiveRedemption>>({});
  const [modal, setModal] = useState<{ benefitId: string; phase: 'confirm' | 'active' } | null>(null);

  const activeBenefit = modal ? benefits.find((b) => b.id === modal.benefitId) ?? null : null;
  const activeRedemption = modal ? redemptions[modal.benefitId] ?? null : null;

  const oneTimeOffers = benefits.filter((b) => b.redeemableOnce);
  const alwaysActive = benefits.filter((b) => !b.redeemableOnce);
  const availableCount = benefits.filter((b) => b.isRedeemable).length;
  const redeemedCount = benefits.filter((b) => b.redeemedAt !== null).length;
  const days = daysRemaining(pass.validUntil);
  const cfg = statusConfig(pass.status);

  // Sort: available first, redeemed last
  const sortedOneTime = [...oneTimeOffers].sort((a, b) => {
    if (a.redeemedAt && !b.redeemedAt) return 1;
    if (!a.redeemedAt && b.redeemedAt) return -1;
    return 0;
  });

  function openBenefit(benefit: Benefit) {
    const existing = redemptions[benefit.id];
    if (existing && existing.expiresAt > Date.now()) {
      setModal({ benefitId: benefit.id, phase: 'active' });
    } else {
      setModal({ benefitId: benefit.id, phase: 'confirm' });
    }
  }

  function confirmRedemption(benefit: Benefit) {
    const prefix = benefit.redemptionToken.split('-').slice(0, 2).join('-');
    const r: ActiveRedemption = { benefitId: benefit.id, token: generateToken(prefix), expiresAt: Date.now() + EXPIRY_MS };
    setRedemptions((p) => ({ ...p, [benefit.id]: r }));
    setModal({ benefitId: benefit.id, phase: 'active' });
  }

  function rotateToken(benefit: Benefit) {
    const prefix = benefit.redemptionToken.split('-').slice(0, 2).join('-');
    const r: ActiveRedemption = { benefitId: benefit.id, token: generateToken(prefix), expiresAt: Date.now() + EXPIRY_MS };
    setRedemptions((p) => ({ ...p, [benefit.id]: r }));
  }

  return (
    <div className="min-h-screen bg-[#F2F6F4]">

      {/* ── Nav ── */}
      <header className="bg-brand border-b border-brand-dark px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-white/20 rounded flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">JP</span>
          </div>
          <span className="font-semibold text-white text-sm">JungfrauPass</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/70 hidden sm:block">{pass.guestName}</span>
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Hero ── */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-center justify-between gap-6 transition-all duration-200 hover:shadow-md hover:border-brand-border">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-2xl font-semibold text-gray-900">{greeting()}, {pass.guestName.split(' ')[0]}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Your pass is valid until <span className="text-gray-700 font-medium">{fmtDate(pass.validUntil)}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold text-brand tabular-nums">{days}</p>
            <p className="text-xs text-gray-400 mt-0.5">{days === 1 ? 'day' : 'days'} remaining</p>
          </div>
        </div>

        {/* ── Stat row ── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Wallet */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-5 transition-all duration-200 hover:shadow-md hover:border-brand-border hover:-translate-y-0.5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Wallet balance</p>
              <div className="w-7 h-7 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              CHF <span>{pass.walletBalanceChf.toFixed(2)}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Hotel deposit · cashback eligible</p>
            <div className="flex gap-2">
              <button className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Top up
              </button>
              <button className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Transactions
              </button>
            </div>
          </div>

          {/* Benefits summary */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-5 transition-all duration-200 hover:shadow-md hover:border-brand-border hover:-translate-y-0.5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Benefits</p>
              <div className="w-7 h-7 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 10l1.293-1.293zm2.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{availableCount}</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {redeemedCount > 0 ? `${redeemedCount} redeemed · ${alwaysActive.length} always included` : `${alwaysActive.length} always included`}
            </p>
            <div className="space-y-1.5">
              {sortedOneTime.slice(0, 2).map((b) => (
                <div key={b.id} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.redeemedAt ? 'bg-gray-300' : 'bg-brand'}`} />
                  <span className="text-xs text-gray-500 truncate">{b.title}</span>
                </div>
              ))}
              {sortedOneTime.length > 2 && (
                <p className="text-xs text-gray-400 pl-3.5">+{sortedOneTime.length - 2} more below</p>
              )}
            </div>
          </div>

          {/* Sustainability */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-5 transition-all duration-200 hover:shadow-md hover:border-brand-border hover:-translate-y-0.5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Sustainability</p>
              <div className="w-7 h-7 bg-brand-light border border-brand-border rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-brand" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{pass.sustainabilityPoints} <span className="text-base font-normal text-gray-400">pts</span></p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {100 - pass.sustainabilityPoints} more until next reward
            </p>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{pass.sustainabilityPoints} pts</span>
                <span>100 pts</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${pass.sustainabilityPoints}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Earned via BOB train + hiking
              </p>
            </div>
          </div>

        </div>

        {/* ── Benefits ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-brand-border">

          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Your benefits</h2>
            <span className="text-xs text-gray-400">{availableCount} available · {redeemedCount} redeemed</span>
          </div>

          {/* One-time offers */}
          <div>
            <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">One-time offers</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-2.5 uppercase tracking-wide">Benefit</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5 uppercase tracking-wide">Partner</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5 uppercase tracking-wide">Offer</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-6 py-2.5 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedOneTime.map((benefit) => {
                  const isRedeemed = benefit.redeemedAt !== null;
                  const hasActiveCode = redemptions[benefit.id]?.expiresAt > Date.now();
                  return (
                    <tr key={benefit.id} className={`transition-colors ${isRedeemed ? '' : 'hover:bg-gray-50'}`}>
                      <td className={`px-6 py-3.5 font-medium ${isRedeemed ? 'text-gray-400' : 'text-gray-900'}`}>
                        {benefit.title}
                      </td>
                      <td className={`px-4 py-3.5 ${isRedeemed ? 'text-gray-400' : 'text-gray-500'}`}>
                        {benefit.partnerName}
                      </td>
                      <td className={`px-4 py-3.5 ${isRedeemed ? 'text-gray-400' : 'text-gray-500'}`}>
                        {benefit.description}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {isRedeemed ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                            </svg>
                            Redeemed {fmtDate(benefit.redeemedAt!, { day: 'numeric', month: 'short' })}
                          </span>
                        ) : (
                          <button onClick={() => openBenefit(benefit)}
                            className={`text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors ${
                              hasActiveCode
                                ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                                : 'bg-brand hover:bg-brand-dark text-white'
                            }`}>
                            {hasActiveCode ? 'View code' : 'Redeem'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Always included */}
          <div>
            <div className="px-6 py-2.5 bg-gray-50 border-t border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Included with your pass</p>
            </div>
            <div className="divide-y divide-gray-50">
              {alwaysActive.map((benefit) => (
                <div key={benefit.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 bg-brand rounded-full shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{benefit.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{benefit.partnerName} · {benefit.description}</p>
                    </div>
                  </div>
                  <button onClick={() => openBenefit(benefit)}
                    className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-brand-light border border-brand-border text-brand hover:bg-brand-light transition-colors shrink-0 ml-4">
                    Show QR
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}
      {modal?.phase === 'confirm' && activeBenefit && (
        <ConfirmModal
          benefit={activeBenefit}
          onConfirm={() => confirmRedemption(activeBenefit)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.phase === 'active' && activeBenefit && activeRedemption && (
        <RedemptionModal
          benefit={activeBenefit}
          redemption={activeRedemption}
          onRotate={() => rotateToken(activeBenefit)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
