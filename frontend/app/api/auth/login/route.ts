import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { findUser } from '@/lib/users';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 });
  }

  const user = findUser(username);

  if (!user || user.password !== password) {
    return Response.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const jar = await cookies();
  jar.set('session', user.username, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });

  return Response.json({ ok: true });
}
