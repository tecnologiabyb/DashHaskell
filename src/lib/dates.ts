import type { DateRange } from './types';

const DAY = 86_400_000;

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISO(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function daysBetween(r: DateRange): number {
  return Math.round((parseISO(r.end).getTime() - parseISO(r.start).getTime()) / DAY) + 1;
}

/** Período anterior de mesma duração, terminando no dia antes do início. */
export function previousRange(r: DateRange): DateRange {
  const n = daysBetween(r);
  const end = new Date(parseISO(r.start).getTime() - DAY);
  const start = new Date(end.getTime() - (n - 1) * DAY);
  return { start: toISO(start), end: toISO(end) };
}

export function eachDay(r: DateRange): string[] {
  const out: string[] = [];
  for (let t = parseISO(r.start).getTime(); t <= parseISO(r.end).getTime(); t += DAY) out.push(toISO(new Date(t)));
  return out;
}

export function isValidRange(r: Partial<DateRange>): r is DateRange {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  return !!r.start && !!r.end && re.test(r.start) && re.test(r.end) && r.start <= r.end && daysBetween(r as DateRange) <= 400;
}
