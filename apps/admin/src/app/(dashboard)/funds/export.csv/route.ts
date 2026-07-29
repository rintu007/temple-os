import { requireTenantContext } from '@/lib/session';
import { fundService } from '@/lib/services';

/** Fund balances CSV download. Auth + funds:read enforced in the service. */
export async function GET() {
  const { ctx } = await requireTenantContext('accounting');
  const result = await fundService().exportCsv(ctx);
  if (!result.ok) {
    return new Response(result.error.message, {
      status: result.error.code === 'FORBIDDEN' ? 403 : 400,
    });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="funds-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
