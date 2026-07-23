import { and, count, desc, eq } from 'drizzle-orm';
import {
  auditLogs,
  newId,
  volunteerOpportunities,
  volunteerSignups,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { VolunteerOpportunityInput, VolunteerSignupInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

/** Signup counts per opportunity for one org, as a Map. */
async function signupCounts(tx: Tx, organizationId: string): Promise<Map<string, number>> {
  const rows = await tx
    .select({ opportunityId: volunteerSignups.opportunityId, count: count() })
    .from(volunteerSignups)
    .where(eq(volunteerSignups.organizationId, organizationId))
    .groupBy(volunteerSignups.opportunityId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.opportunityId, r.count);
  return map;
}

export function createVolunteerRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async listOpportunities(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [rows, counts] = await Promise.all([
          tx
            .select()
            .from(volunteerOpportunities)
            .where(eq(volunteerOpportunities.organizationId, ctx.organizationId))
            .orderBy(desc(volunteerOpportunities.createdAt)),
          signupCounts(tx, ctx.organizationId),
        ]);
        return rows.map((o) => ({ ...o, signupCount: counts.get(o.id) ?? 0 }));
      });
    },

    async findOpportunity(ctx: TenantContext, opportunityId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(volunteerOpportunities)
          .where(eq(volunteerOpportunities.id, opportunityId))
          .limit(1);
        if (!row) return null;
        const [c] = await tx
          .select({ value: count() })
          .from(volunteerSignups)
          .where(eq(volunteerSignups.opportunityId, opportunityId));
        return { ...row, signupCount: c?.value ?? 0 };
      });
    },

    async listSignups(ctx: TenantContext, opportunityId: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(volunteerSignups)
          .where(eq(volunteerSignups.opportunityId, opportunityId))
          .orderBy(desc(volunteerSignups.createdAt)),
      );
    },

    async createOpportunity(ctx: TenantContext, input: VolunteerOpportunityInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(volunteerOpportunities)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            title: input.title,
            description: input.description ?? null,
            servingOn: input.servingOn ?? null,
            slotsNeeded: input.slotsNeeded,
          })
          .returning();
        if (!row) throw new Error('opportunity insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'volunteer_opportunity.created',
          entityType: 'volunteer_opportunity',
          entityId: row.id,
          after: { title: row.title },
        });
        return row;
      });
    },

    async setStatus(ctx: TenantContext, opportunityId: string, status: 'open' | 'closed') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(volunteerOpportunities)
          .set({ status })
          .where(eq(volunteerOpportunities.id, opportunityId))
          .returning();
        return updated ?? null;
      });
    },

    // ---- Public flow (org-scoped, no user) ----
    async listOpen(organizationId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [rows, counts] = await Promise.all([
          tx
            .select()
            .from(volunteerOpportunities)
            .where(
              and(
                eq(volunteerOpportunities.organizationId, organizationId),
                eq(volunteerOpportunities.status, 'open'),
              ),
            )
            .orderBy(desc(volunteerOpportunities.createdAt)),
          signupCounts(tx, organizationId),
        ]);
        return rows.map((o) => ({ ...o, signupCount: counts.get(o.id) ?? 0 }));
      });
    },

    /** Confirms the opportunity is open before inserting the sign-up. */
    async signUp(organizationId: string, input: VolunteerSignupInput) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [opportunity] = await tx
          .select({ status: volunteerOpportunities.status })
          .from(volunteerOpportunities)
          .where(
            and(
              eq(volunteerOpportunities.id, input.opportunityId),
              eq(volunteerOpportunities.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (!opportunity) return { kind: 'not_found' as const };
        if (opportunity.status !== 'open') return { kind: 'closed' as const };

        const [row] = await tx
          .insert(volunteerSignups)
          .values({
            id: newId(),
            organizationId,
            opportunityId: input.opportunityId,
            name: input.name,
            phone: input.phone ?? null,
            email: input.email ?? null,
            note: input.note ?? null,
          })
          .returning();
        if (!row) throw new Error('signup insert returned no row');
        return { kind: 'ok' as const, signup: row };
      });
    },
  };
}

export type VolunteerRepository = ReturnType<typeof createVolunteerRepository>;
