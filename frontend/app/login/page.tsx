'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function MountainSVG() {
  return (
    <svg viewBox="0 0 800 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" className="w-full h-full">
      <defs>
        <linearGradient id="lSkyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7F7F8" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="800" height="120" fill="url(#lSkyG)" />
      <polygon points="80,120 140,60 170,76 185,62 205,80 235,120" fill="#D5D4D8" />
      <polygon points="140,60 170,76 185,62 163,50" fill="white" opacity="0.75" />
      <polygon points="290,120 360,42 395,62 415,46 440,70 475,120" fill="#DCDCDF" />
      <polygon points="360,42 395,62 415,46 390,30" fill="white" opacity="0.80" />
      <polygon points="510,120 595,22 635,44 658,28 685,55 720,120" fill="#D0CDD4" />
      <polygon points="595,22 635,44 658,28 658,20 630,8 603,21" fill="white" opacity="0.88" />
      <path d="M0,120 Q200,105 400,110 Q600,105 800,108 L800,120 Z" fill="#F0EFF3" opacity="0.55" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
    router.push('/dashboard');
  }

  const inputCls = 'w-full border border-[#E5E5E7] rounded-xl px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#A0A0A5] focus:outline-none focus:ring-2 focus:ring-[#E2001A] focus:border-transparent transition';

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col">
      <div className="relative h-[140px] overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none"><MountainSVG /></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">
            <span className="text-[#E2001A]">Jungfrau</span><span className="text-[#1A1A1A]">Pass</span>
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex border-b border-[#E5E5E7]">
              {([['login', 'Anmelden'], ['register', 'Registrieren']] as const).map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setError(''); }}
                  className={`flex-1 py-3.5 text-sm font-medium transition-colors ${mode === m ? 'text-[#1A1A1A] border-b-2 border-[#E2001A]' : 'text-[#A0A0A5] hover:text-[#6B6B6B] bg-[#F7F7F8]'}`}>
                  {label}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Benutzername</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="z.B. anna" autoComplete="username" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Passwort</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required className={inputCls} />
              </div>
              {error && <p className="text-xs text-[#E2001A] bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-[#E2001A] hover:bg-[#B50015] disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                {loading ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-[#A0A0A5] mt-5">JungfrauPass · START Hack Tour Interlaken 2026</p>
        </div>
      </div>
    </div>
  );
}
