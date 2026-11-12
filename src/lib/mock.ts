// Dados de exemplo usados enquanto as credenciais reais não estão configuradas.
import type { DateRange, GoogleData, MetaData, MetaTotals, Totals } from './types';
import { eachDay } from './dates';

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function day(date: string, base: number, salt: string): Totals {
  const r = rng(date + salt);
  const spend = base * (0.7 + r() * 0.6);
  const impressions = Math.round(spend * (45 + r() * 20));
  const clicks = Math.round(impressions * (0.012 + r() * 0.01));
  const purchases = Math.round(clicks * (0.02 + r() * 0.02));
  const revenue = purchases * (110 + r() * 60);
  return { spend, impressions, clicks, purchases, revenue };
}

function add(a: Totals, b: Totals): Totals {
  return {
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    purchases: a.purchases + b.purchases,
    revenue: a.revenue + b.revenue,
  };
}
const zero: Totals = { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };

function metaTotals(t: Totals): MetaTotals {
  return {
    ...t,
    reach: Math.round(t.impressions * 0.52),
    landingViews: Math.round(t.clicks * 0.78),
    addToCart: Math.round(t.purchases * 4.2),
    checkout: Math.round(t.purchases * 2.1),
  };
}

function split<T extends string>(names: T[], total: Totals, seed: string) {
  const r = rng(seed);
  const w = names.map(() => 0.3 + r());
  const s = w.reduce((a, b) => a + b, 0);
  return names.map((name, i) => ({
    name,
    spend: (total.spend * w[i]) / s,
    impressions: Math.round((total.impressions * w[i]) / s),
    clicks: Math.round((total.clicks * w[i]) / s),
    purchases: Math.round((total.purchases * w[i]) / s),
    revenue: (total.revenue * w[i]) / s,
  }));
}

export function mockMeta(range: DateRange, prev: DateRange): MetaData {
  const daily = eachDay(range).map((d) => ({ date: d, ...day(d, 900, 'meta') }));
  const totals = daily.reduce<Totals>(add, zero);
  const prevTotals = eachDay(prev).map((d) => day(d, 780, 'meta')).reduce(add, zero);
  const campaigns = split(
    ['[VENDAS] CATÁLOGO - ADVANTAGE+', '[VENDAS] SE CURVE - CONVERSÃO', '[VENDAS] KITS PROMOÇÃO', '[REMARKETING] CARRINHO ABANDONADO', '[TOPO] DENSI RESIST - ALCANCE'],
    totals,
    'camp',
  )
    .map((c, i) => ({ ...c, id: `camp${i}` }))
    .sort((a, b) => b.spend - a.spend);
  const ads = split(['Vídeo Se Curve 01', 'Carrossel Kits', 'Estático Frizz Cancelado', 'Reels Densi Resist', 'Catálogo Dinâmico', 'UGC Coloração'], totals, 'ads')
    .map((a, i) => ({ ...a, id: String(i), campaignId: `camp${i % 5}` }))
    .sort((a, b) => b.purchases - a.purchases);
  return {
    totals: metaTotals(totals),
    prev: metaTotals(prevTotals),
    daily,
    campaigns,
    ads,
    age: split(['18-24', '25-34', '35-44', '45-54', '55-64', '65+'], totals, 'age'),
    gender: split(['Feminino', 'Masculino', 'Não informado'], totals, 'gender').map((g, i) => (i === 0 ? { ...g, impressions: g.impressions * 4 } : g)),
    region: split(['São Paulo', 'Minas Gerais', 'Rio de Janeiro', 'Bahia', 'Paraná', 'Rio Grande do Sul', 'Pernambuco', 'Goiás', 'Santa Catarina', 'Ceará'], totals, 'region').sort(
      (a, b) => b.impressions - a.impressions,
    ),
  };
}

export function mockGoogle(range: DateRange, prev: DateRange): GoogleData {
  const daily = eachDay(range).map((d) => ({ date: d, ...day(d, 650, 'google') }));
  const totals = daily.reduce<Totals>(add, zero);
  const prevTotals = eachDay(prev).map((d) => day(d, 600, 'google')).reduce(add, zero);
  const kw = ['shampoo haskell', 'haskell cosméticos', 'máscara capilar', 'kit cronograma capilar', 'haskell se curve', 'finalizador cachos', 'shampoo antiqueda', 'haskell densi resist', 'tônico capilar', 'leave in cabelo cacheado'];
  return {
    totals,
    prev: prevTotals,
    daily,
    campaigns: split(['[PMAX] SHOPPING - TODOS OS PRODUTOS', '[SEARCH] INSTITUCIONAL - MARCA', '[SEARCH] CATEGORIAS - SHAMPOO', '[PMAX] KITS', '[SEARCH] CONCORRENTES'], totals, 'gcamp').sort(
      (a, b) => b.spend - a.spend,
    ),
    keywords: split(kw, totals, 'kw')
      .map((k) => ({ keyword: k.name, clicks: k.clicks, impressions: k.impressions, purchases: k.purchases, spend: k.spend }))
      .sort((a, b) => b.clicks - a.clicks),
    device: split(['Celular', 'Computador', 'Tablet'], totals, 'dev').map((d, i) => (i === 0 ? { ...d, impressions: d.impressions * 3 } : d)),
    products: [],
    terms: [],
    brandSplit: { brand: zero, generic: zero },
  };
}
