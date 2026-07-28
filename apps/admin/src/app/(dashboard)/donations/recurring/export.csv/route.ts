import { requireTenantContext } from '@/lib/session';
import { recurringDonationService } from '@/lib/services';

/** Recurring-donation register CSV. Auth + donations:read enforced in the service. */
export async function GET() {
  const { ctx } = await requireTenantContext();
  const result = await recurringDonationService().exportCsv(ctx);
  if (!result.ok) {
    return new Response(result.error.message, {
      status: result.error.code === 'FORBIDDEN' ? 403 : 400,
    });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="recurring-donations-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
