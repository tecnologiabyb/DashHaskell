import type { BreakdownRow, CampaignRow, DailyPoint, DateRange, GoogleData, KeywordRow, ProductRow, SearchTermRow, Totals } from './types';
import { previousRange } from './dates';

const API = 'https://googleads.googleapis.com/v23';

let cachedToken: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.value;
  const { GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_REFRESH_TOKEN) {
    throw new Error('Google Ads: credenciais OAuth não configuradas');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_ADS_CLIENT_ID,
      client_secret: GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Google Ads OAuth: ${json.error_description || json.error}`);
  cachedToken = { value: json.access_token, exp: Date.now() + (json.expires_in - 60) * 1000 };
  return json.access_token;
}

async function search(query: string): Promise<any[]> {
  const customer = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '');
  const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '');
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!customer || !devToken) throw new Error('Google Ads: GOOGLE_ADS_CUSTOMER_ID ou DEVELOPER_TOKEN não configurado');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'developer-token': devToken,
    Authorization: `Bearer ${await accessToken()}`,
  };
  if (login && login !== customer) headers['login-customer-id'] = login;

  let rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetch(`${API}/customers/${customer}/googleAds:search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, pageToken }),
      cache: 'no-store',
    });
    const json = await res.json();
    if (json.error) throw new Error(`Google Ads: ${json.error.message}`);
    rows = rows.concat(json.results ?? []);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return rows;
}

const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;

function toTotals(m: any): Totals {
  return {
    spend: num(m?.costMicros) / 1e6,
    impressions: num(m?.impressions),
    clicks: num(m?.clicks),
    purchases: num(m?.conversions),
    revenue: num(m?.conversionsValue),
  };
}

const METRICS = 'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value';
const between = (r: DateRange) => `segments.date BETWEEN '${r.start}' AND '${r.end}'`;

function sum(rows: Totals[]): Totals {
  return rows.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      purchases: a.purchases + r.purchases,
      revenue: a.revenue + r.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 },
  );
}

// A coluna "conversões" do Google Ads soma todas as ações de compra marcadas como principais em cada data.
// Na Haskell, até 12/11/2026 eram três ações contando a mesma venda, e o histórico não é recalculado.
// Com GOOGLE_ADS_CONVERSION_ACTION definido, compras e receita passam a vir só dessa ação, em qualquer período.
const CONV_METRICS = 'metrics.conversions, metrics.conversions_value';
type Conv = { purchases: number; revenue: number };

function convAction(): string | null {
  const name = process.env.GOOGLE_ADS_CONVERSION_ACTION?.trim();
  return name ? name.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : null;
}

/** Soma compras e receita da ação escolhida, agrupadas pela chave devolvida por `key`. */
async function convBy(from: string, select: string, where: string, key: (r: any) => string): Promise<Map<string, Conv>> {
  const action = convAction();
  const map = new Map<string, Conv>();
  if (!action) return map;
  const rows = await search(
    `SELECT ${select ? `${select}, ` : ''}segments.conversion_action_name, ${CONV_METRICS} FROM ${from} WHERE ${where} AND segments.conversion_action_name = '${action}'`,
  );
  for (const r of rows) {
    const k = key(r);
    const e = map.get(k) ?? { purchases: 0, revenue: 0 };
    e.purchases += num(r.metrics?.conversions);
    e.revenue += num(r.metrics?.conversionsValue);
    map.set(k, e);
  }
  return map;
}

/** Troca compras e receita pelas da ação escolhida (zero quando a ação não teve conversão). */
function withConv<T extends { purchases: number; revenue?: number }>(row: T, conv: Map<string, Conv>, k: string): T {
  if (!convAction()) return row;
  const c = conv.get(k) ?? { purchases: 0, revenue: 0 };
  return 'revenue' in row ? { ...row, purchases: c.purchases, revenue: c.revenue } : { ...row, purchases: c.purchases };
}

const DEVICE: Record<string, string> = { MOBILE: 'Celular', DESKTOP: 'Computador', TABLET: 'Tablet', CONNECTED_TV: 'TV', OTHER: 'Outros' };

const CHANNEL: Record<string, string> = {
  SEARCH: 'Pesquisa',
  SHOPPING: 'Shopping',
  PERFORMANCE_MAX: 'Performance Max',
  DISPLAY: 'Display',
  VIDEO: 'Vídeo',
  DEMAND_GEN: 'Demand Gen',
};

// Parcela de impressões: o Google devolve 0.0999 para "menos de 10%" e 0.9001 para "mais de 90%".
const share = (v: unknown): number | undefined => (v === undefined || v === null ? undefined : num(v));

/** Termos que identificam a marca nas buscas (separados por vírgula). */
function brandTerms(): string[] {
  return (process.env.GOOGLE_ADS_BRAND_TERMS ?? 'haskell')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Visões extras da aba Google: se uma delas falhar, o restante do painel continua. */
async function optional<T>(what: string, fn: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`Google Ads (${what}): ${e instanceof Error ? e.message : String(e)}`);
    return empty;
  }
}

const ZERO: Totals = { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };

export async function fetchGoogle(range: DateRange): Promise<GoogleData> {
  const prev = previousRange(range);

  const [cur, before, daily, campaigns, keywords, device] = await Promise.all([
    search(`SELECT ${METRICS} FROM customer WHERE ${between(range)}`),
    search(`SELECT ${METRICS} FROM customer WHERE ${between(prev)}`),
    search(`SELECT segments.date, ${METRICS} FROM customer WHERE ${between(range)} ORDER BY segments.date`),
    search(
      `SELECT campaign.name, campaign.advertising_channel_type, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share, ${METRICS} FROM campaign WHERE ${between(range)} AND metrics.impressions > 0`,
    ),
    search(
      `SELECT ad_group_criterion.keyword.text, ${METRICS} FROM keyword_view WHERE ${between(range)} AND metrics.clicks > 0 ORDER BY metrics.clicks DESC LIMIT 200`,
    ),
    search(`SELECT segments.device, ${METRICS} FROM customer WHERE ${between(range)}`),
  ]);

  const [cCur, cPrev, cDaily, cCampaign, cKeyword, cDevice] = await Promise.all([
    convBy('customer', '', between(range), () => 'all'),
    convBy('customer', '', between(prev), () => 'all'),
    convBy('customer', 'segments.date', between(range), (r) => r.segments.date),
    convBy('campaign', 'campaign.name', between(range), (r) => r.campaign.name),
    convBy('keyword_view', 'ad_group_criterion.keyword.text', between(range), (r) => r.adGroupCriterion?.keyword?.text ?? '—'),
    convBy('customer', 'segments.device', between(range), (r) => r.segments.device),
  ]);

  const [products, cProduct, terms, cTerm] = await Promise.all([
    optional('produtos', () => search(`SELECT segments.product_item_id, segments.product_title, ${METRICS} FROM shopping_performance_view WHERE ${between(range)}`), [] as any[]),
    optional('produtos', () => convBy('shopping_performance_view', 'segments.product_item_id', between(range), (r) => r.segments.productItemId), new Map<string, Conv>()),
    optional('termos', () => search(`SELECT search_term_view.search_term, ${METRICS} FROM search_term_view WHERE ${between(range)}`), [] as any[]),
    optional('termos', () => convBy('search_term_view', 'search_term_view.search_term', between(range), (r) => r.searchTermView.searchTerm), new Map<string, Conv>()),
  ]);

  // Produtos: o mesmo item aparece em várias campanhas e grupos
  const prodMap = new Map<string, ProductRow>();
  for (const r of products) {
    const id = r.segments?.productItemId ?? '—';
    const t = toTotals(r.metrics);
    const e = prodMap.get(id) ?? { id, name: r.segments?.productTitle || id, ...ZERO };
    e.spend += t.spend;
    e.impressions += t.impressions;
    e.clicks += t.clicks;
    e.purchases += t.purchases;
    e.revenue += t.revenue;
    prodMap.set(id, e);
  }
  const productRows = [...prodMap.values()]
    .map((p) => withConv(p, cProduct, p.id))
    .filter((p) => p.spend > 0 || p.purchases > 0)
    .sort((a, b) => b.revenue - a.revenue || b.spend - a.spend)
    .slice(0, 60);

  // Termos de pesquisa: soma por termo e separa marca x não marca
  const marks = brandTerms();
  const termMap = new Map<string, SearchTermRow & { impressions: number }>();
  for (const r of terms) {
    const term = r.searchTermView?.searchTerm ?? '—';
    const t = toTotals(r.metrics);
    const e = termMap.get(term) ?? { term, brand: marks.some((m) => term.toLowerCase().includes(m)), spend: 0, clicks: 0, impressions: 0, purchases: 0, revenue: 0 };
    e.spend += t.spend;
    e.clicks += t.clicks;
    e.impressions += t.impressions;
    e.purchases += t.purchases;
    e.revenue += t.revenue;
    termMap.set(term, e);
  }
  const termRows = [...termMap.values()].map((t) => withConv(t, cTerm, t.term));
  const brandSplit = { brand: { ...ZERO }, generic: { ...ZERO } };
  for (const t of termRows) {
    const b = t.brand ? brandSplit.brand : brandSplit.generic;
    b.spend += t.spend;
    b.impressions += t.impressions;
    b.clicks += t.clicks;
    b.purchases += t.purchases;
    b.revenue += t.revenue;
  }

  const dailyPoints: DailyPoint[] = daily.map((r) => withConv({ date: r.segments.date, ...toTotals(r.metrics) }, cDaily, r.segments.date));

  const campaignRows: CampaignRow[] = campaigns
    .map((r) =>
      withConv(
        {
          name: r.campaign.name,
          type: CHANNEL[r.campaign.advertisingChannelType] ?? r.campaign.advertisingChannelType,
          impressionShare: share(r.metrics?.searchImpressionShare),
          lostBudget: share(r.metrics?.searchBudgetLostImpressionShare),
          lostRank: share(r.metrics?.searchRankLostImpressionShare),
          ...toTotals(r.metrics),
        },
        cCampaign,
        r.campaign.name,
      ),
    )
    .sort((a, b) => b.spend - a.spend);

  // Agrega a mesma palavra-chave presente em vários grupos de anúncio
  const kwMap = new Map<string, KeywordRow>();
  for (const r of keywords) {
    const k = r.adGroupCriterion?.keyword?.text ?? '—';
    const t = toTotals(r.metrics);
    const e = kwMap.get(k) ?? { keyword: k, clicks: 0, impressions: 0, purchases: 0, spend: 0 };
    e.clicks += t.clicks;
    e.impressions += t.impressions;
    e.purchases += t.purchases;
    e.spend += t.spend;
    kwMap.set(k, e);
  }
  if (convAction()) for (const e of kwMap.values()) e.purchases = cKeyword.get(e.keyword)?.purchases ?? 0;

  const deviceRows: BreakdownRow[] = device
    .map((r) => {
      const t = withConv(toTotals(r.metrics), cDevice, r.segments.device);
      return { name: DEVICE[r.segments.device] ?? r.segments.device, spend: t.spend, impressions: t.impressions, clicks: t.clicks, purchases: t.purchases };
    })
    .filter((d) => d.impressions > 0);

  return {
    totals: withConv(sum(cur.map((r) => toTotals(r.metrics))), cCur, 'all'),
    prev: withConv(sum(before.map((r) => toTotals(r.metrics))), cPrev, 'all'),
    daily: dailyPoints,
    campaigns: campaignRows,
    keywords: [...kwMap.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 50),
    device: deviceRows,
    products: productRows,
    terms: termRows
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 40)
      .map(({ term, brand, spend, clicks, purchases, revenue }) => ({ term, brand, spend, clicks, purchases, revenue })),
    brandSplit,
  };
}
