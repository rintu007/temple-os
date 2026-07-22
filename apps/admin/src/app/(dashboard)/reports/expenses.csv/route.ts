import { requireTenantContext } from '@/lib/session';
import { expenseService } from '@/lib/services';

/** Voucher-book CSV download. Auth + reports:read enforced like every service call. */
export async function GET(request: Request) {
  const { ctx } = await requireTenantContext();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  const result = await expenseService().exportCsv(ctx, { from, to });
  if (!result.ok) {
    const status = result.error.code === 'FORBIDDEN' ? 403 : 400;
    return new Response(result.error.message, { status });
  }

  const stamp = [from || 'all', to || 'now'].join('_to_');
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="expenses-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
