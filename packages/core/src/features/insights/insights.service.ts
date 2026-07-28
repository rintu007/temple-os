import type { Db } from '@templeos/db';
import { authorize, ok, type Result, type TenantContext } from '../../shared';
import { computeNextDue } from '../recurring-expenses/recurring-expense.service';
import { financialYearOf, financialYearRange } from '../statements/statement.service';
import { createInsightsRepository } from './insights.repository';
import type { Insights, ReminderItem } from './insights.types';

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

export function createInsightsService({ db }: { db: Db }) {
  const repo = createInsightsRepository(db);

  return {
    /** Reminders + financial-year analytics for the insights surface. */
    async getInsights(ctx: TenantContext): Promise<Result<Insights>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;

      const today = new Date().toISOString().slice(0, 10);
      const horizonDate = new Date();
      horizonDate.setUTCDate(horizonDate.getUTCDate() + 30);
      const horizon = horizonDate.toISOString().slice(0, 10);
      const fy = financialYearRange(financialYearOf(new Date()));

      const [currency, candidates, analytics] = await Promise.all([
        repo.currency(ctx),
        repo.reminderCandidates(ctx),
        repo.analytics(ctx, fy.from, fy.to),
      ]);

      const reminders: ReminderItem[] = [];
      const push = (r: ReminderItem, keep = true) => {
        if (keep && r.dueDate) reminders.push(r);
      };

      for (const p of candidates.pledgeRows) {
        const outstanding = paise(p.amount) - paise(p.received);
        push(
          {
            kind: 'pledge',
            id: p.id,
            title: p.donorName,
            subtitle: 'Pledge outstanding',
            dueDate: p.dueDate!,
            amount: money(outstanding),
            overdue: p.dueDate! < today,
          },
          outstanding > 0,
        );
      }
      for (const b of candidates.billRows) {
        const outstanding = paise(b.amount) - paise(b.paid);
        push(
          {
            kind: 'vendor_bill',
            id: b.id,
            title: b.vendorName ?? 'Vendor',
            subtitle: `Bill ${b.billNumber}`,
            dueDate: b.dueDate!,
            amount: money(outstanding),
            overdue: b.dueDate! < today,
          },
          outstanding > 0,
        );
      }
      for (const l of candidates.loanRows) {
        const outstanding = paise(l.principal) - paise(l.repaid);
        push(
          {
            kind: 'loan',
            id: l.id,
            title: l.counterparty,
            subtitle:
              l.direction === 'given' ? 'Loan given — repayment due' : 'Loan taken — repayment due',
            dueDate: l.dueDate!,
            amount: money(outstanding),
            overdue: l.dueDate! < today,
          },
          outstanding > 0,
        );
      }
      for (const i of candidates.investmentRows) {
        push({
          kind: 'investment',
          id: i.id,
          title: i.institution,
          subtitle: 'Investment matures',
          dueDate: i.dueDate!,
          amount: Number(i.maturityValue ?? i.principal).toFixed(2),
          overdue: i.dueDate! < today,
        });
      }
      for (const m of candidates.membershipRows) {
        push({
          kind: 'membership',
          id: m.id,
          title: m.memberName,
          subtitle: `${m.planName} membership expires`,
          dueDate: m.dueDate!,
          amount: Number(m.amount).toFixed(2),
          overdue: m.dueDate! < today,
        });
      }

      for (const r of candidates.recurringRows) {
        const nextDue = computeNextDue(r.frequency, r.startDate, r.endDate, 'active');
        if (!nextDue || nextDue > horizon) continue;
        push({
          kind: 'recurring_expense',
          id: r.id,
          title: r.payee,
          subtitle: r.description ?? 'Recurring payment due',
          dueDate: nextDue,
          amount: Number(r.amount).toFixed(2),
          overdue: nextDue < today,
        });
      }
      for (const r of candidates.recurringDonationRows) {
        const nextDue = computeNextDue(r.frequency, r.startDate, r.endDate, 'active');
        if (!nextDue || nextDue > horizon) continue;
        push({
          kind: 'recurring_donation',
          id: r.id,
          title: r.donorName,
          subtitle: 'Recurring gift due',
          dueDate: nextDue,
          amount: Number(r.amount).toFixed(2),
          overdue: nextDue < today,
        });
      }

      // Overdue first, then soonest due.
      reminders.sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
      });

      const income = paise(analytics.income);
      const expenditure = paise(analytics.expenditure);

      return ok({
        currency,
        financialYear: fy.label,
        reminders,
        reminderCounts: {
          total: reminders.length,
          overdue: reminders.filter((r) => r.overdue).length,
        },
        income: money(income),
        expenditure: money(expenditure),
        net: money(income - expenditure),
        topDonors: analytics.topDonors.map((d) => ({
          label: d.label,
          total: Number(d.total).toFixed(2),
        })),
        givingByCategory: analytics.givingByCategory.map((d) => ({
          label: d.label,
          total: Number(d.total).toFixed(2),
        })),
        topExpenseCategories: analytics.topExpenseCategories.map((d) => ({
          label: d.label,
          total: Number(d.total).toFixed(2),
        })),
      });
    },
  };
}

export type InsightsService = ReturnType<typeof createInsightsService>;
