import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import GuestDashboard from './GuestDashboard';
import PartnerDashboard from './PartnerDashboard';
import AdminDashboard from './AdminDashboard';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/api/auth/logout');

  if (user.role === 'partner') {
    return <PartnerDashboard username={user.username} partnerName={user.partnerName ?? user.username} apiKey={user.apiKey ?? ''} />;
  }
  if (user.role === 'admin') {
    return <AdminDashboard username={user.username} />;
  }
  return <GuestDashboard username={user.username} guestCardId={user.guestCardId ?? null} />;
}
