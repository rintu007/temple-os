import { requireTenantContext } from '@/lib/session';
import { meetingService } from '@/lib/services';

/** Meetings register CSV download. Auth + governance:read enforced in the service. */
export async function GET() {
  const { ctx } = await requireTenantContext('community');
  const result = await meetingService().exportCsv(ctx);
  if (!result.ok) {
    return new Response(result.error.message, {
      status: result.error.code === 'FORBIDDEN' ? 403 : 400,
    });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(result.value, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="meetings-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
