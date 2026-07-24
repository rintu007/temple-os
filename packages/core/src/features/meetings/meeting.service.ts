import type { Db } from '@templeos/db';
import { meetingSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createMeetingRepository } from './meeting.repository';
import type { MeetingStatus, MeetingSummary } from './meeting.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSummary(row: {
  id: string;
  title: string;
  body: string | null;
  meetingOn: string;
  location: string | null;
  attendees: string | null;
  agenda: string | null;
  minutes: string | null;
  decisions: string | null;
  status: MeetingStatus;
  createdAt: Date;
}): MeetingSummary {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    meetingOn: row.meetingOn,
    location: row.location,
    attendees: row.attendees,
    agenda: row.agenda,
    minutes: row.minutes,
    decisions: row.decisions,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function createMeetingService({ db }: { db: Db }) {
  const repo = createMeetingRepository(db);

  return {
    async listMeetings(
      ctx: TenantContext,
      status: MeetingStatus | 'all' = 'all',
    ): Promise<Result<MeetingSummary[]>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, status);
      return ok(rows.map(toSummary));
    },

    async getMeeting(ctx: TenantContext, meetingId: string): Promise<Result<MeetingSummary>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, meetingId);
      if (!row) return err(notFound('Meeting'));
      return ok(toSummary(row));
    },

    async createMeeting(ctx: TenantContext, rawInput: unknown): Promise<Result<MeetingSummary>> {
      const auth = authorize(ctx, 'governance:write');
      if (!auth.ok) return auth;
      const parsed = meetingSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.create(ctx, parsed.data);
      return ok(toSummary(row));
    },

    async updateMeeting(
      ctx: TenantContext,
      meetingId: string,
      rawInput: unknown,
    ): Promise<Result<MeetingSummary>> {
      const auth = authorize(ctx, 'governance:write');
      if (!auth.ok) return auth;
      const parsed = meetingSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const updated = await repo.update(ctx, meetingId, parsed.data);
      if (!updated) return err(notFound('Meeting'));
      return ok(toSummary(updated));
    },
  };
}

export type MeetingService = ReturnType<typeof createMeetingService>;
