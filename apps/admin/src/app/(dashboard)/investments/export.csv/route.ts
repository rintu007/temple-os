import { requireTenantContext } from '@/lib/session';
import { investmentService } from '@/lib/services';

/** Investment register CSV. Auth + investments:read enforced in the service. */
export async function GET() {
  const { ctx } = await requireTenantContext();
  const result = await investmentService().exportCsv(ctx);
  if (!result.ok) {
    return new Response(result.error.message, {
      status: result.error.code === 'FORBIDDEN' ? 403 : 400,
    });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="investments-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
