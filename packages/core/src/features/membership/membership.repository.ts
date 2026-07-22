import { and, asc, count, desc, eq, gte, isNull, lt, sql, type SQL } from 'drizzle-orm';
import {
  auditLogs,
  donations,
  membershipPlans,
  membershipSubscriptions,
  newId,
  organizations,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { MembershipPlanInput } from '@templeos/validators';
import { allocateReceiptNumber, findOrCreateCategory } from '../donations/donation.repository';
import type { TenantContext } from '../../shared';

const planNotDeleted = isNull(membershipPlans.deletedAt);
const today = () => sql`CURRENT_DATE`;

/** ISO date `months` months from the given ISO date (UTC arithmetic, overflow-safe). */
export function addMonths(isoDate: string, months: number): string {
  const [y = 1970, m = 1, d = 1] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

export type RosterStatus = 'active' | 'expired' | 'cancelled' | 'all';

function rosterFilter(status: RosterStatus): SQL | undefined {
  switch (status) {
    case 'active':
      return and(
        eq(membershipSubscriptions.status, 'active'),
        gte(membershipSubscriptions.expiresOn, today()),
      );
    case 'expired':
      return and(
        eq(membershipSubscriptions.status, 'active'),
        lt(membershipSubscriptions.expiresOn, today()),
      );
    case 'cancelled':
      return eq(membershipSubscriptions.status, 'cancelled');
    case 'all':
      return undefined;
  }
}

export function createMembershipRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    // ---- Plans (admin) ----
    async listPlans(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(membershipPlans)
          .where(and(eq(membershipPlans.organizationId, ctx.organizationId), planNotDeleted))
          .orderBy(asc(membershipPlans.createdAt)),
      );
    },

    async findPlan(ctx: TenantContext, planId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(membershipPlans)
          .where(and(eq(membershipPlans.id, planId), planNotDeleted))
          .limit(1);
        return row ?? null;
      });
    },

    async createPlan(ctx: TenantContext, input: MembershipPlanInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [plan] = await tx
          .insert(membershipPlans)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            description: input.description ?? null,
            price: input.price.toFixed(2),
            currency: org.currency,
            durationMonths: input.durationMonths,
            isActive: input.isActive,
          })
          .returning();
        if (!plan) throw new Error('plan insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'membership_plan.created',
          entityType: 'membership_plan',
          entityId: plan.id,
          after: { name: plan.name, price: plan.price, durationMonths: plan.durationMonths },
        });
        return plan;
      });
    },

    async updatePlan(ctx: TenantContext, planId: string, input: MembershipPlanInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existing] = await tx
          .select()
          .from(membershipPlans)
          .where(and(eq(membershipPlans.id, planId), planNotDeleted))
          .limit(1);
        if (!existing) return null;

        const [updated] = await tx
          .update(membershipPlans)
          .set({
            name: input.name,
            description: input.description ?? null,
            price: input.price.toFixed(2),
            durationMonths: input.durationMonths,
            isActive: input.isActive,
          })
          .where(eq(membershipPlans.id, planId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'membership_plan.updated',
          entityType: 'membership_plan',
          entityId: planId,
          before: { name: existing.name, price: existing.price },
          after: { name: updated.name, price: updated.price },
        });
        return updated;
      });
    },

    async deletePlan(ctx: TenantContext, planId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [removed] = await tx
          .update(membershipPlans)
          .set({ deletedAt: new Date() })
          .where(and(eq(membershipPlans.id, planId), planNotDeleted))
          .returning();
        if (!removed) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'membership_plan.deleted',
          entityType: 'membership_plan',
          entityId: planId,
          before: { name: removed.name },
        });
        return removed;
      });
    },

    // ---- Roster (admin) ----
    async listSubscriptions(
      ctx: TenantContext,
      query: { status: RosterStatus; page: number; pageSize: number },
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const where = and(
          eq(membershipSubscriptions.organizationId, ctx.organizationId),
          rosterFilter(query.status),
        );
        const [items, [totalRow]] = await Promise.all([
          tx
            .select()
            .from(membershipSubscriptions)
            .where(where)
            .orderBy(desc(membershipSubscriptions.createdAt))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(membershipSubscriptions).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    async cancelSubscription(ctx: TenantContext, subscriptionId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(membershipSubscriptions)
          .set({ status: 'cancelled' })
          .where(eq(membershipSubscriptions.id, subscriptionId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'membership.cancelled',
          entityType: 'membership_subscription',
          entityId: subscriptionId,
          before: { memberName: updated.memberName, planName: updated.planName },
        });
        return updated;
      });
    },

    // ---- Public join flow (org-scoped, no user) ----
    async listPublicPlans(organizationId: string) {
      return withTenantContext(db, { organizationId }, (tx) =>
        tx
          .select()
          .from(membershipPlans)
          .where(
            and(
              eq(membershipPlans.organizationId, organizationId),
              eq(membershipPlans.isActive, true),
              planNotDeleted,
            ),
          )
          .orderBy(asc(membershipPlans.price)),
      );
    },

    async findPublicPlan(organizationId: string, planId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [row] = await tx
          .select()
          .from(membershipPlans)
          .where(
            and(
              eq(membershipPlans.id, planId),
              eq(membershipPlans.organizationId, organizationId),
              eq(membershipPlans.isActive, true),
              planNotDeleted,
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    async createPendingSubscription(
      organizationId: string,
      values: {
        planId: string;
        planName: string;
        memberName: string;
        email: string | null;
        phone: string | null;
        amount: string;
        currency: 'INR' | 'BDT';
        providerOrderId: string;
      },
    ) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [subscription] = await tx
          .insert(membershipSubscriptions)
          .values({
            id: newId(),
            organizationId,
            planId: values.planId,
            planName: values.planName,
            memberName: values.memberName,
            email: values.email,
            phone: values.phone,
            amount: values.amount,
            currency: values.currency,
            status: 'pending',
            provider: 'razorpay',
            providerOrderId: values.providerOrderId,
          })
          .returning();
        if (!subscription) throw new Error('subscription insert returned no row');
        return subscription;
      });
    },

    /**
     * Confirms a paid join: locks the row, and unless already active, records
     * a donation (income + receipt), stamps startsOn/expiresOn from the plan
     * duration (read in the same transaction), and activates the
     * subscription. Idempotent.
     */
    async confirmSubscriptionPaid(
      organizationId: string,
      providerOrderId: string,
      providerPaymentId: string,
    ) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [subscription] = await tx
          .select()
          .from(membershipSubscriptions)
          .where(
            and(
              eq(membershipSubscriptions.organizationId, organizationId),
              eq(membershipSubscriptions.providerOrderId, providerOrderId),
            ),
          )
          .for('update')
          .limit(1);
        if (!subscription) return { kind: 'subscription_not_found' as const };

        // Duration from the plan the subscription was created for; 12 months
        // if the plan row has since been hard-removed (should not happen —
        // plans are soft-deleted).
        let durationMonths = 12;
        if (subscription.planId) {
          const [plan] = await tx
            .select({ durationMonths: membershipPlans.durationMonths })
            .from(membershipPlans)
            .where(eq(membershipPlans.id, subscription.planId))
            .limit(1);
          if (plan) durationMonths = plan.durationMonths;
        }

        if (subscription.status !== 'pending') {
          const [existing] = await tx
            .select()
            .from(donations)
            .where(eq(donations.reference, providerPaymentId))
            .limit(1);
          if (existing) {
            return { kind: 'ok' as const, subscription, donation: existing, alreadyPaid: true };
          }
        }

        const categoryId = await findOrCreateCategory(
          tx,
          organizationId,
          `Membership: ${subscription.planName}`,
        );
        const receiptNumber = await allocateReceiptNumber(
          tx,
          organizationId,
          new Date().getFullYear(),
        );

        const [donation] = await tx
          .insert(donations)
          .values({
            id: newId(),
            organizationId,
            categoryId,
            donorName: subscription.memberName,
            amount: subscription.amount,
            currency: subscription.currency,
            method: 'online',
            reference: providerPaymentId,
            note: `Membership: ${subscription.planName}`,
            receiptNumber,
            donatedAt: new Date(),
          })
          .returning();
        if (!donation) throw new Error('donation insert returned no row');

        const startsOn = new Date().toISOString().slice(0, 10);
        const expiresOn = addMonths(startsOn, durationMonths);
        const [activated] = await tx
          .update(membershipSubscriptions)
          .set({ status: 'active', providerPaymentId, startsOn, expiresOn })
          .where(eq(membershipSubscriptions.id, subscription.id))
          .returning();

        await tx.insert(auditLogs).values({
          organizationId,
          action: 'membership.activated',
          entityType: 'membership_subscription',
          entityId: subscription.id,
          after: {
            planName: subscription.planName,
            receiptNumber: donation.receiptNumber,
            expiresOn,
          },
        });

        return { kind: 'ok' as const, subscription: activated ?? subscription, donation, alreadyPaid: false };
      });
    },
  };
}

export type MembershipRepository = ReturnType<typeof createMembershipRepository>;
