import type { Db } from '@templeos/db';
import { eventListQuerySchema, eventSchema, type EventInput } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createEventRepository, type EventWriteValues } from './event.repository';
import type { EventPage, EventSummary, PublicEvent } from './event.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

/** Form date/time fields → concrete timestamps. All-day = no start time given. */
function toWriteValues(input: EventInput): EventWriteValues {
  const allDay = !input.startTime;
  const startsAt = new Date(`${input.date}T${input.startTime ?? '00:00'}:00`);
  let endsAt: Date | null = null;
  if (input.endDate) {
    endsAt = new Date(`${input.endDate}T${input.endTime ?? '23:59'}:00`);
  } else if (input.endTime) {
    endsAt = new Date(`${input.date}T${input.endTime}:00`);
  }
  return {
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    startsAt,
    endsAt,
    allDay,
    isPublished: input.isPublished,
  };
}

export function createEventService({ db }: { db: Db }) {
  const repo = createEventRepository(db);

  const toSummary = (e: {
    id: string;
    kind: 'event' | 'festival';
    title: string;
    description: string | null;
    location: string | null;
    startsAt: Date;
    endsAt: Date | null;
    allDay: boolean;
    isPublished: boolean;
  }): EventSummary => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay,
    isPublished: e.isPublished,
  });

  return {
    async listEvents(ctx: TenantContext, rawQuery: unknown): Promise<Result<EventPage>> {
      const auth = authorize(ctx, 'events:read');
      if (!auth.ok) return auth;
      const parsed = eventListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));

      const { items, total } = await repo.list(ctx, parsed.data);
      return ok({
        items: items.map(toSummary),
        total,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      });
    },

    async getEvent(ctx: TenantContext, eventId: string): Promise<Result<EventSummary>> {
      const auth = authorize(ctx, 'events:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, eventId);
      if (!row) return err(notFound('Event'));
      return ok(toSummary(row));
    },

    async createEvent(ctx: TenantContext, rawInput: unknown): Promise<Result<EventSummary>> {
      const auth = authorize(ctx, 'events:write');
      if (!auth.ok) return auth;
      const parsed = eventSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const event = await repo.create(ctx, toWriteValues(parsed.data));
      return ok(toSummary(event));
    },

    async updateEvent(
      ctx: TenantContext,
      eventId: string,
      rawInput: unknown,
    ): Promise<Result<EventSummary>> {
      const auth = authorize(ctx, 'events:write');
      if (!auth.ok) return auth;
      const parsed = eventSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const updated = await repo.update(ctx, eventId, toWriteValues(parsed.data));
      if (!updated) return err(notFound('Event'));
      return ok(toSummary(updated));
    },

    async deleteEvent(ctx: TenantContext, eventId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'events:write');
      if (!auth.ok) return auth;
      const removed = await repo.remove(ctx, eventId);
      if (!removed) return err(notFound('Event'));
      return ok(null);
    },

    /** Public tenant site: published upcoming events and festivals. */
    async listPublicUpcoming(organizationId: string, limit = 10): Promise<PublicEvent[]> {
      const rows = await repo.publicUpcoming(organizationId, limit);
      return rows.map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        description: e.description,
        location: e.location,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        allDay: e.allDay,
      }));
    },
  };
}

export type EventService = ReturnType<typeof createEventService>;
