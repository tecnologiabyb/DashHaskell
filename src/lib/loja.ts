import type { DateRange, StoreData, StoreDay, StoreState, StoreTotals } from './types';
import { previousRange } from './dates';

// Resumo diário da loja (Nuvemshop), servido pelo projeto de conversões da BYB.
// Traz só números somados por dia: pedidos criados, pedidos pagos e faturamento.

function sum(rows: StoreDay[]): StoreTotals {
  return rows.reduce(
    (a, r) => ({ created: a.created + r.created, orders: a.orders + r.orders, revenue: a.revenue + r.revenue }),
    { created: 0, orders: 0, revenue: 0 },
  );
}

export async function fetchStore(range: DateRange): Promise<StoreData> {
  const { LOJA_API_URL, LOJA_API_KEY } = process.env;
  if (!LOJA_API_URL || !LOJA_API_KEY) throw new Error('Loja: LOJA_API_URL ou LOJA_API_KEY não configurado');

  const prev = previousRange(range);
  const url = new URL(LOJA_API_URL);
  url.searchParams.set('start', prev.start);
  url.searchParams.set('end', range.end);
  url.searchParams.set('estados_desde', range.start);
  const res = await fetch(url, { headers: { 'x-painel-key': LOJA_API_KEY }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Loja: HTTP ${res.status}`);
  const json = await res.json();

  const days: StoreDay[] = (json.daily ?? []).map((d: StoreDay) => ({
    date: d.date,
    created: Number(d.created) || 0,
    orders: Number(d.orders) || 0,
    revenue: Number(d.revenue) || 0,
  }));
  const daily = days.filter((d) => d.date >= range.start);
  return {
    totals: sum(daily),
    prev: sum(days.filter((d) => d.date <= prev.end)),
    daily,
    prevDaily: days.filter((d) => d.date <= prev.end),
    states: (json.states ?? []).map((s: StoreState) => ({ name: String(s.name), orders: Number(s.orders) || 0, revenue: Number(s.revenue) || 0 })),
    updatedAt: json.updatedAt ?? null,
  };
}
