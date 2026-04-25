'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <button
      onClick={logout}
      className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
    >
      Sign out
    </button>
  );
}
