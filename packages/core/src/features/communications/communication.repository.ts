import { and, count, desc, eq, isNotNull, ne, inArray } from 'drizzle-orm';
import {
  auditLogs,
  broadcasts,
  devotees,
  donations,
  membershipSubscriptions,
  newId,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { BroadcastChannel, BroadcastSegment } from '@templeos/validators';
import type { TenantContext } from '../../shared';

export function createCommunicationRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  /** Base predicate: an active devotee we can actually reach on this channel. */
  const contactable = (organizationId: string, channel: BroadcastChannel) => {
    const field = channel === 'email' ? devotees.email : devotees.phone;
    return and(
      eq(devotees.organizationId, organizationId),
      eq(devotees.status, 'active'),
      isNotNull(field),
      ne(field, ''),
    );
  };

  const segmentFilter = (
    ctx: TenantContext,
    segment: BroadcastSegment,
    channel: BroadcastChannel,
    tx: Tx,
  ) => {
    if (segment === 'donors') {
      const donorIds = tx
        .select({ id: donations.devoteeId })
        .from(donations)
        .where(
          and(
            eq(donations.organizationId, ctx.organizationId),
            eq(donations.status, 'recorded'),
            isNotNull(donations.devoteeId),
          ),
        );
      return and(contactable(ctx.organizationId, channel), inArray(devotees.id, donorIds));
    }
    if (segment === 'members') {
      const memberIds = tx
        .select({ id: membershipSubscriptions.devoteeId })
        .from(membershipSubscriptions)
        .where(
          and(
            eq(membershipSubscriptions.organizationId, ctx.organizationId),
            eq(membershipSubscriptions.status, 'active'),
            isNotNull(membershipSubscriptions.devoteeId),
          ),
        );
      return and(contactable(ctx.organizationId, channel), inArray(devotees.id, memberIds));
    }
    return contactable(ctx.organizationId, channel);
  };

  return {
    async recipients(ctx: TenantContext, segment: BroadcastSegment, channel: BroadcastChannel) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({ name: devotees.fullName, email: devotees.email, phone: devotees.phone })
          .from(devotees)
          .where(segmentFilter(ctx, segment, channel, tx))
          .orderBy(devotees.fullName),
      );
    },

    async segmentCounts(ctx: TenantContext, channel: BroadcastChannel) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const countFor = async (segment: BroadcastSegment) => {
          const [row] = await tx
            .select({ value: count() })
            .from(devotees)
            .where(segmentFilter(ctx, segment, channel, tx));
          return row?.value ?? 0;
        };
        const [all, donors, members] = await Promise.all([
          countFor('all'),
          countFor('donors'),
          countFor('members'),
        ]);
        return { all, donors, members };
      });
    },

    async insert(
      ctx: TenantContext,
      values: {
        subject: string;
        message: string;
        segment: BroadcastSegment;
        channel: BroadcastChannel;
        recipientCount: number;
        sentCount: number;
        failedCount: number;
        status: 'sent' | 'partial' | 'failed';
      },
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(broadcasts)
          .values({ id: newId(), organizationId: ctx.organizationId, sentByUserId: ctx.userId, ...values })
          .returning();
        if (!row) throw new Error('broadcast insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'broadcast.sent',
          entityType: 'broadcast',
          entityId: row.id,
          after: {
            subject: values.subject,
            segment: values.segment,
            channel: values.channel,
            sentCount: values.sentCount,
            failedCount: values.failedCount,
          },
        });
        return row;
      });
    },

    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(broadcasts)
          .where(eq(broadcasts.organizationId, ctx.organizationId))
          .orderBy(desc(broadcasts.createdAt))
          .limit(100),
      );
    },
  };
}

export type CommunicationRepository = ReturnType<typeof createCommunicationRepository>;
