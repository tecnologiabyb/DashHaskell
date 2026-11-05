const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const brl = (n: number) => brlFmt.format(n || 0);
export const int = (n: number) => intFmt.format(n || 0);
export const dec = (n: number) => decFmt.format(n || 0);
export const pct = (n: number) => `${decFmt.format(n || 0)}%`;
export const compact = (n: number) => compactFmt.format(n || 0);
export const roas = (n: number) => `${decFmt.format(n || 0)}x`;

export const div = (a: number, b: number) => (b ? a / b : 0);

/** Variação percentual vs período anterior; null quando não há base. */
export function delta(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function longDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export function weekday(iso: string) {
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** Soma uma métrica por dia da semana (Seg → Dom). */
export function byWeekday<T extends { date: string }>(rows: T[], key: keyof T) {
  const order = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const acc: Record<string, number> = Object.fromEntries(order.map((d) => [d, 0]));
  for (const r of rows) acc[weekday(r.date)] += Number(r[key]) || 0;
  return order.map((d) => ({ name: d, value: acc[d] }));
}
