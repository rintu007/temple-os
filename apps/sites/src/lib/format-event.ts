export function formatEventWhen(startsAt: Date, endsAt: Date | null, allDay: boolean): string {
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  const start = startsAt.toLocaleDateString('en-IN', dateOpts);
  if (endsAt && endsAt.toDateString() !== startsAt.toDateString()) {
    return `${start} – ${endsAt.toLocaleDateString('en-IN', dateOpts)}`;
  }
  if (allDay) return start;
  const time = startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${start} · ${time}`;
}
