'use server';

import { formatMoney } from '@templeos/ui';
import {
  devoteeService,
  donationService,
  eventService,
  expenseService,
  vendorService,
} from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export interface SearchResultItem {
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

export interface SearchResultGroup {
  category: string;
  items: SearchResultItem[];
}

const RESULTS_PER_CATEGORY = 5;

export async function globalSearchAction(rawQuery: string): Promise<SearchResultGroup[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const { ctx } = await requireTenantContext();

  const [devotees, donations, expenses, vendors, events] = await Promise.all([
    devoteeService().listDevotees(ctx, { search: query, pageSize: RESULTS_PER_CATEGORY }),
    donationService().listDonations(ctx, { search: query, pageSize: RESULTS_PER_CATEGORY }),
    expenseService().listExpenses(ctx, { search: query, pageSize: RESULTS_PER_CATEGORY }),
    vendorService().listVendors(ctx, { search: query }),
    eventService().listEvents(ctx, { search: query, scope: 'upcoming', pageSize: RESULTS_PER_CATEGORY }),
  ]);

  const groups: SearchResultGroup[] = [];

  if (devotees.ok && devotees.value.items.length > 0) {
    groups.push({
      category: 'Devotees',
      items: devotees.value.items.map((d) => ({
        id: d.id,
        label: d.fullName,
        sublabel: d.phone ?? d.email ?? '',
        href: `/devotees/${d.id}`,
      })),
    });
  }

  if (donations.ok && donations.value.items.length > 0) {
    groups.push({
      category: 'Donations',
      items: donations.value.items.map((d) => ({
        id: d.id,
        label: `${d.receiptNumber} — ${d.donorName}`,
        sublabel: formatMoney(d.amount, d.currency),
        href: `/donations/${d.id}`,
      })),
    });
  }

  if (expenses.ok && expenses.value.items.length > 0) {
    groups.push({
      category: 'Expenses',
      items: expenses.value.items.map((e) => ({
        id: e.id,
        label: `${e.voucherNumber} — ${e.paidTo}`,
        sublabel: formatMoney(e.amount, e.currency),
        href: `/expenses/${e.id}`,
      })),
    });
  }

  if (vendors.ok && vendors.value.length > 0) {
    groups.push({
      category: 'Vendors',
      items: vendors.value.slice(0, RESULTS_PER_CATEGORY).map((v) => ({
        id: v.id,
        label: v.name,
        sublabel: v.category ?? v.phone ?? '',
        href: `/vendors/${v.id}`,
      })),
    });
  }

  if (events.ok && events.value.items.length > 0) {
    groups.push({
      category: 'Events',
      items: events.value.items.map((e) => ({
        id: e.id,
        label: e.title,
        sublabel: e.startsAt.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        href: `/events/${e.id}`,
      })),
    });
  }

  return groups;
}
