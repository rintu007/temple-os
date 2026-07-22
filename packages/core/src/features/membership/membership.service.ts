import type { Db } from '@templeos/db';
import {
  confirmDonationOrderSchema,
  joinMembershipSchema,
  membershipPlanSchema,
} from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { razorpayFromEnv } from '../payments/razorpay';
import { createMembershipRepository, type RosterStatus } from './membership.repository';
import type {
  ConfirmedJoin,
  JoinOrder,
  MembershipPlanSummary,
  PublicMembershipPlan,
  SubscriptionPage,
  SubscriptionSummary,
} from './membership.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createMembershipService({ db }: { db: Db }) {
  const repo = createMembershipRepository(db);

  const toPlanSummary = (p: {
    id: string;
    name: string;
    description: string | null;
    price: string;
    currency: 'INR' | 'BDT';
    durationMonths: number;
    isActive: boolean;
  }): MembershipPlanSummary => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    durationMonths: p.durationMonths,
    isActive: p.isActive,
  });

  const toSubscriptionSummary = (s: {
    id: string;
    planName: string;
    memberName: string;
    email: string | null;
    phone: string | null;
    amount: string;
    currency: 'INR' | 'BDT';
    startsOn: string | null;
    expiresOn: string | null;
    status: 'pending' | 'active' | 'cancelled';
    createdAt: Date;
  }): SubscriptionSummary => ({
    id: s.id,
    planName: s.planName,
    memberName: s.memberName,
    email: s.email,
    phone: s.phone,
    amount: s.amount,
    currency: s.currency,
    startsOn: s.startsOn,
    expiresOn: s.expiresOn,
    status: s.status,
    isExpired:
      s.status === 'active' &&
      s.expiresOn !== null &&
      s.expiresOn < new Date().toISOString().slice(0, 10),
    createdAt: s.createdAt,
  });

  return {
    // ---- Admin: plan management ----
    async listPlans(ctx: TenantContext): Promise<Result<MembershipPlanSummary[]>> {
      const auth = authorize(ctx, 'membership:read');
      if (!auth.ok) return auth;
      const rows = await repo.listPlans(ctx);
      return ok(rows.map(toPlanSummary));
    },

    async getPlan(ctx: TenantContext, planId: string): Promise<Result<MembershipPlanSummary>> {
      const auth = authorize(ctx, 'membership:read');
      if (!auth.ok) return auth;
      const row = await repo.findPlan(ctx, planId);
      if (!row) return err(notFound('Plan'));
      return ok(toPlanSummary(row));
    },

    async createPlan(ctx: TenantContext, rawInput: unknown): Promise<Result<MembershipPlanSummary>> {
      const auth = authorize(ctx, 'membership:write');
      if (!auth.ok) return auth;
      const parsed = membershipPlanSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const plan = await repo.createPlan(ctx, parsed.data);
      return ok(toPlanSummary(plan));
    },

    async updatePlan(
      ctx: TenantContext,
      planId: string,
      rawInput: unknown,
    ): Promise<Result<MembershipPlanSummary>> {
      const auth = authorize(ctx, 'membership:write');
      if (!auth.ok) return auth;
      const parsed = membershipPlanSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const updated = await repo.updatePlan(ctx, planId, parsed.data);
      if (!updated) return err(notFound('Plan'));
      return ok(toPlanSummary(updated));
    },

    async deletePlan(ctx: TenantContext, planId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'membership:write');
      if (!auth.ok) return auth;
      const removed = await repo.deletePlan(ctx, planId);
      if (!removed) return err(notFound('Plan'));
      return ok(null);
    },

    // ---- Admin: roster ----
    async listMembers(ctx: TenantContext, rawQuery: unknown): Promise<Result<SubscriptionPage>> {
      const auth = authorize(ctx, 'membership:read');
      if (!auth.ok) return auth;
      const q = (rawQuery ?? {}) as { status?: string; page?: number; pageSize?: number };
      const status: RosterStatus =
        q.status === 'expired' || q.status === 'cancelled' || q.status === 'all'
          ? q.status
          : 'active';
      const page = Math.max(1, Number(q.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));

      const { items, total } = await repo.listSubscriptions(ctx, { status, page, pageSize });
      return ok({ items: items.map(toSubscriptionSummary), total, page, pageSize });
    },

    async cancelMembership(ctx: TenantContext, subscriptionId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'membership:write');
      if (!auth.ok) return auth;
      const updated = await repo.cancelSubscription(ctx, subscriptionId);
      if (!updated) return err(notFound('Membership'));
      return ok(null);
    },

    // ---- Public: plans + join checkout ----
    async listPublicPlans(organizationId: string): Promise<PublicMembershipPlan[]> {
      const rows = await repo.listPublicPlans(organizationId);
      return rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        durationMonths: p.durationMonths,
      }));
    },

    async createJoinOrder(
      organizationId: string,
      organizationCurrency: 'INR' | 'BDT',
      rawInput: unknown,
    ): Promise<Result<JoinOrder>> {
      const razorpay = razorpayFromEnv();
      if (!razorpay) return err(domainError('VALIDATION', 'Online membership is not configured'));
      if (organizationCurrency !== 'INR') {
        return err(
          domainError('VALIDATION', 'Online membership is not yet available for this currency'),
        );
      }
      const parsed = joinMembershipSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const input = parsed.data;

      const plan = await repo.findPublicPlan(organizationId, input.planId);
      if (!plan) return err(notFound('Plan'));

      const amountPaise = Math.round(Number(plan.price) * 100);
      const order = await razorpay.createOrder({
        amountPaise,
        currency: 'INR',
        notes: { organizationId, planId: plan.id },
      });

      await repo.createPendingSubscription(organizationId, {
        planId: plan.id,
        planName: plan.name,
        memberName: input.memberName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        amount: plan.price,
        currency: 'INR',
        providerOrderId: order.id,
      });

      return ok({
        orderId: order.id,
        amountPaise,
        currency: 'INR' as const,
        keyId: razorpay.keyId,
        planName: plan.name,
      });
    },

    async confirmJoin(organizationId: string, rawInput: unknown): Promise<Result<ConfirmedJoin>> {
      const razorpay = razorpayFromEnv();
      if (!razorpay) return err(domainError('VALIDATION', 'Online membership is not configured'));
      const parsed = confirmDonationOrderSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const { providerOrderId, providerPaymentId, signature } = parsed.data;

      const validSignature = razorpay.verifyPaymentSignature({
        orderId: providerOrderId,
        paymentId: providerPaymentId,
        signature,
      });
      if (!validSignature) return err(domainError('FORBIDDEN', 'Payment could not be verified'));

      const result = await repo.confirmSubscriptionPaid(
        organizationId,
        providerOrderId,
        providerPaymentId,
      );
      if (result.kind === 'subscription_not_found') return err(notFound('Membership'));

      return ok({
        receiptNumber: result.donation.receiptNumber,
        planName: result.subscription.planName,
        memberName: result.subscription.memberName,
        amount: result.donation.amount,
        currency: result.donation.currency,
        expiresOn: result.subscription.expiresOn,
      });
    },
  };
}

export type MembershipService = ReturnType<typeof createMembershipService>;
