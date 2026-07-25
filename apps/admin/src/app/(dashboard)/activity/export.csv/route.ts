import type { NextRequest } from 'next/server';
import { requireTenantContext } from '@/lib/session';
import { auditService } from '@/lib/services';

/** Activity log CSV download. Auth + governance:read enforced in the service. */
export async function GET(request: NextRequest) {
  const { ctx } = await requireTenantContext();
  const sp = request.nextUrl.searchParams;
  const result = await auditService().exportCsv(ctx, {
    entityType: sp.get('entityType') ?? '',
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
  });
  if (!result.ok) {
    return new Response(result.error.message, {
      status: result.error.code === 'FORBIDDEN' ? 403 : 400,
    });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="activity-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
