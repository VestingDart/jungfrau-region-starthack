import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { findUser, createUser } from '@/lib/users';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 });
  }

  if (username.length < 3) {
    return Response.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
  }

  if (password.length < 4) {
    return Response.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
  }

  if (findUser(username)) {
    return Response.json({ error: 'Username already taken' }, { status: 409 });
  }

  const user = createUser(username, password);

  const jar = await cookies();
  jar.set('session', user.username, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });

  return Response.json({ ok: true });
}
