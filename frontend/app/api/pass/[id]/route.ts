import type { NextRequest } from 'next/server';
import { getPassById } from '@/lib/seedData';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/pass/[id]'>) {
  const { id } = await ctx.params;
  const data = getPassById(id);

  if (!data) {
    return Response.json({ error: 'Pass not found' }, { status: 404 });
  }

  return Response.json(data);
}
