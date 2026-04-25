import { cookies } from 'next/headers';
import { findUser, type User } from './users';

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const username = jar.get('session')?.value;
  if (!username) return null;
  return findUser(username);
}
