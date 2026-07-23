import type { Db } from '@templeos/db';
import { volunteerOpportunitySchema, volunteerSignupSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createVolunteerRepository } from './volunteer.repository';
import type {
  OpportunitySummary,
  PublicOpportunity,
  SignupSummary,
} from './volunteer.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toOpportunity(row: {
  id: string;
  title: string;
  description: string | null;
  servingOn: string | null;
  slotsNeeded: number;
  signupCount: number;
  status: 'open' | 'closed';
  createdAt: Date;
}): OpportunitySummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    servingOn: row.servingOn,
    slotsNeeded: row.slotsNeeded,
    signupCount: row.signupCount,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function createVolunteerService({ db }: { db: Db }) {
  const repo = createVolunteerRepository(db);

  return {
    async listOpportunities(ctx: TenantContext): Promise<Result<OpportunitySummary[]>> {
      const auth = authorize(ctx, 'volunteers:read');
      if (!auth.ok) return auth;
      const rows = await repo.listOpportunities(ctx);
      return ok(rows.map(toOpportunity));
    },

    async getOpportunity(
      ctx: TenantContext,
      opportunityId: string,
    ): Promise<Result<{ opportunity: OpportunitySummary; signups: SignupSummary[] }>> {
      const auth = authorize(ctx, 'volunteers:read');
      if (!auth.ok) return auth;
      const row = await repo.findOpportunity(ctx, opportunityId);
      if (!row) return err(notFound('Opportunity'));
      const signups = await repo.listSignups(ctx, opportunityId);
      return ok({
        opportunity: toOpportunity(row),
        signups: signups.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          note: s.note,
          createdAt: s.createdAt,
        })),
      });
    },

    async createOpportunity(
      ctx: TenantContext,
      rawInput: unknown,
    ): Promise<Result<OpportunitySummary>> {
      const auth = authorize(ctx, 'volunteers:write');
      if (!auth.ok) return auth;
      const parsed = volunteerOpportunitySchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.createOpportunity(ctx, parsed.data);
      return ok(toOpportunity({ ...row, signupCount: 0 }));
    },

    async setOpportunityStatus(
      ctx: TenantContext,
      opportunityId: string,
      status: 'open' | 'closed',
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'volunteers:write');
      if (!auth.ok) return auth;
      const updated = await repo.setStatus(ctx, opportunityId, status);
      if (!updated) return err(notFound('Opportunity'));
      return ok(null);
    },

    // ---- Public ----
    async listOpenOpportunities(organizationId: string): Promise<PublicOpportunity[]> {
      const rows = await repo.listOpen(organizationId);
      return rows.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        servingOn: o.servingOn,
        slotsNeeded: o.slotsNeeded,
        signupCount: o.signupCount,
        full: o.slotsNeeded > 0 && o.signupCount >= o.slotsNeeded,
      }));
    },

    async signUp(organizationId: string, rawInput: unknown): Promise<Result<{ name: string }>> {
      const parsed = volunteerSignupSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.signUp(organizationId, parsed.data);
      if (result.kind === 'not_found') return err(notFound('Opportunity'));
      if (result.kind === 'closed') {
        return err(domainError('CONFLICT', 'This opportunity is no longer accepting sign-ups'));
      }
      return ok({ name: result.signup.name });
    },
  };
}

export type VolunteerService = ReturnType<typeof createVolunteerService>;
