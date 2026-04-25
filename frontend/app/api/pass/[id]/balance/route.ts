import type { NextRequest } from 'next/server';
import { getSimulatedBalance } from '@/lib/seedData';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/pass/[id]/balance'>) {
  const { id } = await ctx.params;
  const data = getSimulatedBalance(id);

  if (!data) {
    return Response.json({ error: 'Pass not found' }, { status: 404 });
  }

  return Response.json(data);
}
