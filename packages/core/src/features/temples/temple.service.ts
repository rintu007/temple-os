import type { Db } from '@templeos/db';
import { scheduleItemSchema, templeSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createTempleRepository } from './temple.repository';
import type { PublicTemple, ScheduleItem, TempleSummary } from './temple.types';

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63) || 'temple'
  );
}

function validationError(issues: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', issues.issues[0]?.message ?? 'Invalid input');
}

export function createTempleService({ db }: { db: Db }) {
  const repo = createTempleRepository(db);

  const toSummary = (t: {
    id: string;
    name: string;
    slug: string;
    deity: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
  }): TempleSummary => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    deity: t.deity,
    addressLine1: t.addressLine1,
    addressLine2: t.addressLine2,
    city: t.city,
    state: t.state,
    postalCode: t.postalCode,
    phone: t.phone,
    email: t.email,
  });

  const toScheduleItem = (s: {
    id: string;
    templeId: string;
    title: string;
    startTime: string;
    endTime: string | null;
    description: string | null;
  }): ScheduleItem => ({
    id: s.id,
    templeId: s.templeId,
    title: s.title,
    startTime: s.startTime,
    endTime: s.endTime,
    description: s.description,
  });

  return {
    async listTemples(ctx: TenantContext): Promise<Result<TempleSummary[]>> {
      const auth = authorize(ctx, 'temples:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(rows.map(toSummary));
    },

    async getTemple(ctx: TenantContext, templeId: string): Promise<Result<TempleSummary>> {
      const auth = authorize(ctx, 'temples:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, templeId);
      if (!row) return err(notFound('Temple'));
      return ok(toSummary(row));
    },

    async createTemple(ctx: TenantContext, rawInput: unknown): Promise<Result<TempleSummary>> {
      const auth = authorize(ctx, 'temples:write');
      if (!auth.ok) return auth;

      const parsed = templeSchema.safeParse(rawInput);
      if (!parsed.success) return err(validationError(parsed.error));

      const base = slugify(parsed.data.name);
      const taken = new Set(await repo.listSlugsLike(ctx, base));
      let slug = base;
      for (let n = 2; taken.has(slug); n += 1) {
        slug = `${base}-${n}`;
      }

      const temple = await repo.create(ctx, { ...parsed.data, slug });
      return ok(toSummary(temple));
    },

    async updateTemple(
      ctx: TenantContext,
      templeId: string,
      rawInput: unknown,
    ): Promise<Result<TempleSummary>> {
      const auth = authorize(ctx, 'temples:write');
      if (!auth.ok) return auth;

      const parsed = templeSchema.safeParse(rawInput);
      if (!parsed.success) return err(validationError(parsed.error));

      const updated = await repo.update(ctx, templeId, parsed.data);
      if (!updated) return err(notFound('Temple'));
      return ok(toSummary(updated));
    },

    async listSchedule(ctx: TenantContext, templeId: string): Promise<Result<ScheduleItem[]>> {
      const auth = authorize(ctx, 'temples:read');
      if (!auth.ok) return auth;
      const rows = await repo.listSchedule(ctx, templeId);
      return ok(rows.map(toScheduleItem));
    },

    async addScheduleItem(
      ctx: TenantContext,
      templeId: string,
      rawInput: unknown,
    ): Promise<Result<ScheduleItem>> {
      const auth = authorize(ctx, 'schedules:write');
      if (!auth.ok) return auth;

      const parsed = scheduleItemSchema.safeParse(rawInput);
      if (!parsed.success) return err(validationError(parsed.error));

      const temple = await repo.findById(ctx, templeId);
      if (!temple) return err(notFound('Temple'));

      const item = await repo.addScheduleItem(ctx, templeId, parsed.data);
      return ok(toScheduleItem(item));
    },

    async removeScheduleItem(ctx: TenantContext, itemId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'schedules:write');
      if (!auth.ok) return auth;
      const removed = await repo.removeScheduleItem(ctx, itemId);
      if (!removed) return err(notFound('Schedule item'));
      return ok(null);
    },

    /** Public tenant site: temples with their daily schedules. */
    async listPublicTemples(organizationId: string): Promise<PublicTemple[]> {
      const { templeRows, scheduleRows } = await repo.listPublic(organizationId);
      return templeRows.map((t) => ({
        id: t.id,
        name: t.name,
        deity: t.deity,
        city: t.city,
        schedule: scheduleRows
          .filter((s) => s.templeId === t.id)
          .map((s) => ({
            id: s.id,
            title: s.title,
            startTime: s.startTime,
            endTime: s.endTime,
            description: s.description,
          })),
      }));
    },
  };
}

export type TempleService = ReturnType<typeof createTempleService>;
