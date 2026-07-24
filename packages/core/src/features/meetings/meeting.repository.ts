import { and, desc, eq } from 'drizzle-orm';
import { auditLogs, meetings, newId, withTenantContext, type Db } from '@templeos/db';
import type { MeetingInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

export function createMeetingRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext, status: 'scheduled' | 'held' | 'cancelled' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where =
          status === 'all'
            ? eq(meetings.organizationId, ctx.organizationId)
            : and(eq(meetings.organizationId, ctx.organizationId), eq(meetings.status, status));
        return tx
          .select()
          .from(meetings)
          .where(where)
          .orderBy(desc(meetings.meetingOn), desc(meetings.createdAt));
      });
    },

    async findById(ctx: TenantContext, meetingId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
        return row ?? null;
      });
    },

    async create(ctx: TenantContext, input: MeetingInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(meetings)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            title: input.title,
            body: input.body ?? null,
            meetingOn: input.meetingOn,
            location: input.location ?? null,
            attendees: input.attendees ?? null,
            agenda: input.agenda ?? null,
            minutes: input.minutes ?? null,
            decisions: input.decisions ?? null,
            status: input.status,
            recordedByUserId: ctx.userId,
          })
          .returning();
        if (!row) throw new Error('meeting insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'meeting.created',
          entityType: 'meeting',
          entityId: row.id,
          after: { title: row.title, meetingOn: row.meetingOn, status: row.status },
        });
        return row;
      });
    },

    async update(ctx: TenantContext, meetingId: string, input: MeetingInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existing] = await tx
          .select()
          .from(meetings)
          .where(eq(meetings.id, meetingId))
          .limit(1);
        if (!existing) return null;

        const [updated] = await tx
          .update(meetings)
          .set({
            title: input.title,
            body: input.body ?? null,
            meetingOn: input.meetingOn,
            location: input.location ?? null,
            attendees: input.attendees ?? null,
            agenda: input.agenda ?? null,
            minutes: input.minutes ?? null,
            decisions: input.decisions ?? null,
            status: input.status,
          })
          .where(eq(meetings.id, meetingId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'meeting.updated',
          entityType: 'meeting',
          entityId: meetingId,
          before: { status: existing.status },
          after: { title: updated.title, status: updated.status },
        });
        return updated;
      });
    },
  };
}

export type MeetingRepository = ReturnType<typeof createMeetingRepository>;
