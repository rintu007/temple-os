import { and, count, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  auditLogs,
  campaigns,
  donations,
  events,
  expenses,
  facilityBookings,
  membershipSubscriptions,
  organizations,
  pujaBookings,
  volunteerOpportunities,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { TenantContext } from '../../shared';
import type { ActivityItem, Overview, TrendPoint, UpcomingItem } from './overview.types';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** paise/poisha to avoid float drift on 2-decimal money. */
function toMinor(amount: string): number {
  return Math.round(Number.parseFloat(amount || '0') * 100);
}
function fromMinor(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** The last `n` months (oldest first) as { month:'YYYY-MM', label:'Jul' }. */
function monthWindow(n: number, from: Date): { month: string; label: string }[] {
  const out: { month: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1));
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    out.push({ month: `${d.getUTCFullYear()}-${mm}`, label: MONTH_LABELS[d.getUTCMonth()]! });
  }
  return out;
}

export function createOverviewRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async getOverview(ctx: TenantContext): Promise<Overview> {
      return withTenantContext(db, guc(ctx), async (tx: Tx) => {
        const orgId = ctx.organizationId;
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
        const todayIso = now.toISOString().slice(0, 10);
        const window = monthWindow(6, now);

        const donationRecorded = and(
          eq(donations.organizationId, orgId),
          eq(donations.status, 'recorded'),
        );
        const expenseRecorded = and(
          eq(expenses.organizationId, orgId),
          eq(expenses.status, 'recorded'),
        );

        const [
          org,
          donAllTime,
          donMonth,
          expMonth,
          donTrend,
          expTrend,
          activeCampaigns,
          campaignRaised,
          upcomingEvents,
          upcomingPujas,
          upcomingFacilities,
          requestedFacilities,
          pendingPujas,
          openVolunteers,
          membershipsDue,
          recentActivity,
        ] = await Promise.all([
          tx
            .select({ currency: organizations.currency })
            .from(organizations)
            .where(eq(organizations.id, orgId))
            .limit(1),
          tx
            .select({ total: sql<string>`coalesce(sum(${donations.amount}), '0.00')` })
            .from(donations)
            .where(donationRecorded),
          tx
            .select({
              total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
              count: count(),
            })
            .from(donations)
            .where(and(donationRecorded, gte(donations.donatedAt, monthStart))),
          tx
            .select({
              total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')`,
              count: count(),
            })
            .from(expenses)
            .where(and(expenseRecorded, gte(expenses.spentAt, monthStart))),
          tx
            .select({
              month: sql<string>`to_char(${donations.donatedAt}, 'YYYY-MM')`,
              total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
            })
            .from(donations)
            .where(and(donationRecorded, gte(donations.donatedAt, windowStart)))
            .groupBy(sql`to_char(${donations.donatedAt}, 'YYYY-MM')`),
          tx
            .select({
              month: sql<string>`to_char(${expenses.spentAt}, 'YYYY-MM')`,
              total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')`,
            })
            .from(expenses)
            .where(and(expenseRecorded, gte(expenses.spentAt, windowStart)))
            .groupBy(sql`to_char(${expenses.spentAt}, 'YYYY-MM')`),
          tx
            .select({
              id: campaigns.id,
              title: campaigns.title,
              goalAmount: campaigns.goalAmount,
            })
            .from(campaigns)
            .where(and(eq(campaigns.organizationId, orgId), eq(campaigns.status, 'active')))
            .orderBy(desc(campaigns.createdAt))
            .limit(3),
          tx
            .select({
              campaignId: donations.campaignId,
              total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
              count: count(),
            })
            .from(donations)
            .where(and(donationRecorded, isNotNull(donations.campaignId)))
            .groupBy(donations.campaignId),
          tx
            .select({ title: events.title, startsAt: events.startsAt })
            .from(events)
            .where(
              and(
                eq(events.organizationId, orgId),
                eq(events.isPublished, true),
                gte(events.startsAt, now),
              ),
            )
            .orderBy(events.startsAt)
            .limit(6),
          tx
            .select({
              pujaName: pujaBookings.pujaName,
              devoteeName: pujaBookings.devoteeName,
              scheduledOn: pujaBookings.scheduledOn,
              scheduledTime: pujaBookings.scheduledTime,
            })
            .from(pujaBookings)
            .where(
              and(
                eq(pujaBookings.organizationId, orgId),
                isNotNull(pujaBookings.scheduledOn),
                gte(pujaBookings.scheduledOn, todayIso),
                inArray(pujaBookings.status, ['confirmed', 'completed']),
              ),
            )
            .orderBy(pujaBookings.scheduledOn)
            .limit(6),
          tx
            .select({
              facilityName: facilityBookings.facilityName,
              bookerName: facilityBookings.bookerName,
              eventDate: facilityBookings.eventDate,
            })
            .from(facilityBookings)
            .where(
              and(
                eq(facilityBookings.organizationId, orgId),
                eq(facilityBookings.status, 'confirmed'),
                gte(facilityBookings.eventDate, todayIso),
              ),
            )
            .orderBy(facilityBookings.eventDate)
            .limit(6),
          tx
            .select({ n: count() })
            .from(facilityBookings)
            .where(
              and(
                eq(facilityBookings.organizationId, orgId),
                eq(facilityBookings.status, 'requested'),
              ),
            ),
          tx
            .select({ n: count() })
            .from(pujaBookings)
            .where(and(eq(pujaBookings.organizationId, orgId), eq(pujaBookings.status, 'pending'))),
          tx
            .select({ n: count() })
            .from(volunteerOpportunities)
            .where(
              and(
                eq(volunteerOpportunities.organizationId, orgId),
                eq(volunteerOpportunities.status, 'open'),
              ),
            ),
          tx
            .select({ n: count() })
            .from(membershipSubscriptions)
            .where(
              and(
                eq(membershipSubscriptions.organizationId, orgId),
                eq(membershipSubscriptions.status, 'active'),
                isNotNull(membershipSubscriptions.expiresOn),
                sql`${membershipSubscriptions.expiresOn} <= CURRENT_DATE + 30`,
              ),
            ),
          tx
            .select({
              action: auditLogs.action,
              entityType: auditLogs.entityType,
              createdAt: auditLogs.createdAt,
            })
            .from(auditLogs)
            .where(eq(auditLogs.organizationId, orgId))
            .orderBy(desc(auditLogs.createdAt))
            .limit(8),
        ]);

        const currency = org[0]?.currency ?? 'INR';

        const donByMonth = new Map(donTrend.map((r) => [r.month, r.total]));
        const expByMonth = new Map(expTrend.map((r) => [r.month, r.total]));
        const trend: TrendPoint[] = window.map(({ month, label }) => ({
          month,
          label,
          donations: donByMonth.get(month) ?? '0.00',
          expenses: expByMonth.get(month) ?? '0.00',
        }));

        const raisedMap = new Map(
          campaignRaised
            .filter((r) => r.campaignId)
            .map((r) => [r.campaignId as string, { total: r.total, count: r.count }]),
        );
        const overviewCampaigns = activeCampaigns.map((c) => {
          const r = raisedMap.get(c.id);
          return {
            id: c.id,
            title: c.title,
            goalAmount: c.goalAmount,
            raisedAmount: r?.total ?? '0.00',
            donationCount: r?.count ?? 0,
          };
        });

        const schedule: UpcomingItem[] = [
          ...upcomingEvents.map((e): UpcomingItem => {
            const iso = e.startsAt.toISOString();
            return {
              kind: 'event',
              date: iso.slice(0, 10),
              time: iso.slice(11, 16),
              title: e.title,
              subtitle: null,
            };
          }),
          ...upcomingPujas.map(
            (p): UpcomingItem => ({
              kind: 'puja',
              date: p.scheduledOn!,
              time: p.scheduledTime ? p.scheduledTime.slice(0, 5) : null,
              title: p.pujaName,
              subtitle: p.devoteeName,
            }),
          ),
          ...upcomingFacilities.map(
            (f): UpcomingItem => ({
              kind: 'facility',
              date: f.eventDate,
              time: null,
              title: f.facilityName,
              subtitle: f.bookerName,
            }),
          ),
        ]
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
          .slice(0, 6);

        const monthTotalDon = donMonth[0]?.total ?? '0.00';
        const monthTotalExp = expMonth[0]?.total ?? '0.00';

        const activity: ActivityItem[] = recentActivity.map((a) => ({
          action: a.action,
          entityType: a.entityType,
          createdAt: a.createdAt,
        }));

        return {
          currency,
          donations: {
            monthTotal: monthTotalDon,
            monthCount: donMonth[0]?.count ?? 0,
            allTimeTotal: donAllTime[0]?.total ?? '0.00',
          },
          expenses: {
            monthTotal: monthTotalExp,
            monthCount: expMonth[0]?.count ?? 0,
          },
          netThisMonth: fromMinor(toMinor(monthTotalDon) - toMinor(monthTotalExp)),
          trend,
          campaigns: overviewCampaigns,
          schedule,
          attention: {
            requestedFacilityBookings: requestedFacilities[0]?.n ?? 0,
            pendingPujaBookings: pendingPujas[0]?.n ?? 0,
            openVolunteerOpportunities: openVolunteers[0]?.n ?? 0,
            membershipsDueRenewal: membershipsDue[0]?.n ?? 0,
          },
          activity,
        };
      });
    },
  };
}

export type OverviewRepository = ReturnType<typeof createOverviewRepository>;
