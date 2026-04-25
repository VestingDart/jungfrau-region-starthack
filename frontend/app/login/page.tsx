'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">JP</span>
          </div>
          <span className="text-lg font-semibold text-gray-800">JungfrauPass</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tab toggle */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'text-gray-900 border-b-2 border-emerald-600 bg-white'
                  : 'text-gray-400 hover:text-gray-600 bg-gray-50'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'text-gray-900 border-b-2 border-emerald-600 bg-white'
                  : 'text-gray-400 hover:text-gray-600 bg-gray-50'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={submit} className="px-6 py-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. anna"
                autoComplete="username"
                required
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          JungfrauPass · Jungfrau Region Hackathon
        </p>
      </div>
    </div>
  );
}
