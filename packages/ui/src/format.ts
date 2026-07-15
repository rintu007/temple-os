const MONEY_LOCALES: Record<string, string> = { INR: 'en-IN', BDT: 'en-BD' };

/** '1601.50' + 'INR' → '₹1,601.50' (Indian digit grouping for INR) */
export function formatMoney(amount: string | number, currency: string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return new Intl.NumberFormat(MONEY_LOCALES[currency] ?? 'en', {
    style: 'currency',
    currency,
  }).format(Number.isFinite(value) ? value : 0);
}

/** '05:30:00' (Postgres time) → '5:30 AM' */
export function formatTime(time: string): string {
  const [h = '0', m = '00'] = time.split(':');
  const hours = Number(h);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${m} ${suffix}`;
}
