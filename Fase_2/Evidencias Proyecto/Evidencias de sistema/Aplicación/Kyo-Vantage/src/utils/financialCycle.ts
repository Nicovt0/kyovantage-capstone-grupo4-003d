/** Local calendar dates: date-only values must not shift backwards through UTC. */
export function parseFinancialDate(value: string | Date): Date {
  return value instanceof Date ? new Date(value) : /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
}
export function financialBoundary(year: number, month: number, day = 1): Date {
  const safeDay = Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
  return new Date(year, month, Math.min(safeDay, new Date(year, month + 1, 0).getDate()));
}
/** Month is zero-based and identifies the month in which the financial cycle starts. */
export function financialCycleForMonth(year: number, month: number, day = 1) {
  const start = financialBoundary(year, month, day);
  const nextStart = financialBoundary(year, month + 1, day);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end, nextStart };
}
export function getFinancialCycle(date = new Date(), day = 1) {
  const candidate = financialCycleForMonth(date.getFullYear(), date.getMonth(), day);
  return date < candidate.start ? financialCycleForMonth(date.getFullYear(), date.getMonth() - 1, day) : candidate;
}
export function isInFinancialCycle(value: string | Date, cycle: { start: Date; nextStart: Date }) {
  const date = parseFinancialDate(value);
  return date >= cycle.start && date < cycle.nextStart;
}
export function financialCycleLabel(cycle: { start: Date; end: Date }) {
  const format = (date: Date, showYear: boolean) => date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', ...(showYear ? { year: 'numeric' as const } : {}) });
  return `${format(cycle.start, cycle.start.getFullYear() !== cycle.end.getFullYear())} – ${format(cycle.end, true)}`;
}
export function cycleDays(cycle: { start: Date; nextStart: Date }): Date[] {
  const days: Date[] = [];
  for (const date = new Date(cycle.start); date < cycle.nextStart; date.setDate(date.getDate() + 1)) days.push(new Date(date));
  return days;
}
