/** '05:30:00' (Postgres time) → '5:30 AM' */
export function formatTime(time: string): string {
  const [h = '0', m = '00'] = time.split(':');
  const hours = Number(h);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${m} ${suffix}`;
}
