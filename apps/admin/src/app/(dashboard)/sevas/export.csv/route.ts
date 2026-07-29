import { requireTenantContext } from '@/lib/session';
import { sevaService } from '@/lib/services';

/** Seva register CSV. Auth + sevas:read enforced in the service. */
export async function GET() {
  const { ctx } = await requireTenantContext('worship');
  const result = await sevaService().exportCsv(ctx);
  if (!result.ok) {
    return new Response(result.error.message, {
      status: result.error.code === 'FORBIDDEN' ? 403 : 400,
    });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sevas-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
