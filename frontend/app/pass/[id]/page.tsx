import { notFound } from 'next/navigation';
import { getPassById } from '@/lib/seedData';
import PassView from './PassView';

export default async function PassPage(props: PageProps<'/pass/[id]'>) {
  const { id } = await props.params;
  const data = getPassById(id);

  if (!data) notFound();

  return <PassView data={data} />;
}
