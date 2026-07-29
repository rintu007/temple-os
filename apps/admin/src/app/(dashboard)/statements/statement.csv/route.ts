import type { NextRequest } from 'next/server';
import { requireTenantContext } from '@/lib/session';
import { statementService } from '@/lib/services';

/** Income & Expenditure statement CSV. Auth + reports:read enforced in the service. */
export async function GET(request: NextRequest) {
  const { ctx } = await requireTenantContext('accounting');
  const { searchParams } = new URL(request.url);
  const range = { from: searchParams.get('from') ?? '', to: searchParams.get('to') ?? '' };

  const result = await statementService().exportCsv(ctx, range);
  if (!result.ok) {
    return new Response(result.error.message, {
      status: result.error.code === 'FORBIDDEN' ? 403 : 400,
    });
  }
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="statement-${range.from}-to-${range.to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
