import type { Db } from '@templeos/db';
import {
  composeBroadcastSchema,
  type BroadcastChannel,
  type BroadcastSegment,
  type ComposeBroadcastInput,
} from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createCommunicationRepository } from './communication.repository';
import type {
  BroadcastRecipient,
  BroadcastSummary,
  BroadcastTally,
  SegmentCounts,
} from './communication.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

/**
 * Dedupe by the channel's contact field (lowercased email, or phone as
 * stored) so a shared family address/number is contacted once.
 */
function dedupe(
  rows: Array<{ name: string; email: string | null; phone: string | null }>,
  channel: BroadcastChannel,
): BroadcastRecipient[] {
  const seen = new Set<string>();
  const out: BroadcastRecipient[] = [];
  for (const row of rows) {
    const raw = channel === 'email' ? row.email : row.phone;
    if (!raw) continue;
    const key = channel === 'email' ? raw.trim().toLowerCase() : raw.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: row.name, email: row.email?.trim() ?? null, phone: row.phone?.trim() ?? null });
  }
  return out;
}

export function createCommunicationService({ db }: { db: Db }) {
  const repo = createCommunicationRepository(db);

  return {
    /** Live per-segment reach for the compose screen, for the given channel. */
    async getSegmentCounts(
      ctx: TenantContext,
      channel: BroadcastChannel = 'email',
    ): Promise<Result<SegmentCounts>> {
      const auth = authorize(ctx, 'communications:read');
      if (!auth.ok) return auth;
      return ok(await repo.segmentCounts(ctx, channel));
    },

    /**
     * The deduped recipient list for a segment/channel. Write-gated because it
     * exposes devotee contact details and is the precursor to actually sending.
     */
    async getRecipients(
      ctx: TenantContext,
      segment: BroadcastSegment,
      channel: BroadcastChannel = 'email',
    ): Promise<Result<BroadcastRecipient[]>> {
      const auth = authorize(ctx, 'communications:write');
      if (!auth.ok) return auth;
      const rows = await repo.recipients(ctx, segment, channel);
      return ok(dedupe(rows, channel));
    },

    /**
     * Persists the record of a broadcast after the app layer has done the
     * sending. Status is derived from the tally: all delivered → sent, none →
     * failed, otherwise partial.
     */
    async recordBroadcast(
      ctx: TenantContext,
      rawInput: unknown,
      tally: BroadcastTally,
    ): Promise<Result<BroadcastSummary>> {
      const auth = authorize(ctx, 'communications:write');
      if (!auth.ok) return auth;
      const parsed = composeBroadcastSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const input: ComposeBroadcastInput = parsed.data;

      const status =
        tally.sentCount === 0
          ? 'failed'
          : tally.failedCount > 0
            ? 'partial'
            : 'sent';

      const row = await repo.insert(ctx, {
        subject: input.subject,
        message: input.message,
        segment: input.segment,
        channel: input.channel,
        recipientCount: tally.recipientCount,
        sentCount: tally.sentCount,
        failedCount: tally.failedCount,
        status,
      });

      return ok({
        id: row.id,
        subject: row.subject,
        segment: row.segment,
        channel: row.channel,
        recipientCount: row.recipientCount,
        sentCount: row.sentCount,
        failedCount: row.failedCount,
        status: row.status,
        sentAt: row.createdAt,
      });
    },

    async listBroadcasts(ctx: TenantContext): Promise<Result<BroadcastSummary[]>> {
      const auth = authorize(ctx, 'communications:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(
        rows.map((row) => ({
          id: row.id,
          subject: row.subject,
          segment: row.segment,
          channel: row.channel,
          recipientCount: row.recipientCount,
          sentCount: row.sentCount,
          failedCount: row.failedCount,
          status: row.status,
          sentAt: row.createdAt,
        })),
      );
    },
  };
}

export type CommunicationService = ReturnType<typeof createCommunicationService>;
