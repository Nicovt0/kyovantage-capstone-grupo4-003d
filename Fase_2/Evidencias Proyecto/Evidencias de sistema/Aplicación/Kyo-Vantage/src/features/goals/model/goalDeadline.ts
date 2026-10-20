/** Deadline values are calendar dates, even when stored with a timestamp suffix. */
export function getGoalDaysRemaining(deadline: string, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(deadline);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  if (target.getUTCFullYear() !== year || target.getUTCMonth() !== month - 1 || target.getUTCDate() !== day) return null;
  // UTC ordinals of local calendar components avoid 23/25-hour DST days.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today) / 86400000);
}

export function formatGoalDeadline(days: number | null): string {
  if (days === null) return 'Sin fecha';
  if (days < 0) return 'Vencida';
  if (days === 0) return 'Vence hoy';
  return `${days} día${days === 1 ? '' : 's'}`;
}
