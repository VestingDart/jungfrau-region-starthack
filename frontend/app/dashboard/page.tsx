import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPassById } from '@/lib/seedData';
import PassView from './PassView';

export default async function DashboardPage() {
  const jar = await cookies();
  const username = jar.get('session')?.value;

  if (!username) redirect('/login');

  // TODO: look up pass by logged-in user once backend is ready
  const data = getPassById('demo-anna')!;

  return <PassView data={data} username={username} />;
}
