import type { BreakdownRow, CampaignRow, DailyPoint, DateRange, GoogleData, KeywordRow, Totals } from './types';
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

const DEVICE: Record<string, string> = { MOBILE: 'Celular', DESKTOP: 'Computador', TABLET: 'Tablet', CONNECTED_TV: 'TV', OTHER: 'Outros' };

export async function fetchGoogle(range: DateRange): Promise<GoogleData> {
  const prev = previousRange(range);

  const [cur, before, daily, campaigns, keywords, device] = await Promise.all([
    search(`SELECT ${METRICS} FROM customer WHERE ${between(range)}`),
    search(`SELECT ${METRICS} FROM customer WHERE ${between(prev)}`),
    search(`SELECT segments.date, ${METRICS} FROM customer WHERE ${between(range)} ORDER BY segments.date`),
    search(`SELECT campaign.name, ${METRICS} FROM campaign WHERE ${between(range)} AND metrics.impressions > 0`),
    search(
      `SELECT ad_group_criterion.keyword.text, ${METRICS} FROM keyword_view WHERE ${between(range)} AND metrics.clicks > 0 ORDER BY metrics.clicks DESC LIMIT 200`,
    ),
    search(`SELECT segments.device, ${METRICS} FROM customer WHERE ${between(range)}`),
  ]);

  const dailyPoints: DailyPoint[] = daily.map((r) => ({ date: r.segments.date, ...toTotals(r.metrics) }));

  const campaignRows: CampaignRow[] = campaigns
    .map((r) => ({ name: r.campaign.name, ...toTotals(r.metrics) }))
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

  const deviceRows: BreakdownRow[] = device
    .map((r) => {
      const t = toTotals(r.metrics);
      return { name: DEVICE[r.segments.device] ?? r.segments.device, spend: t.spend, impressions: t.impressions, clicks: t.clicks, purchases: t.purchases };
    })
    .filter((d) => d.impressions > 0);

  return {
    totals: sum(cur.map((r) => toTotals(r.metrics))),
    prev: sum(before.map((r) => toTotals(r.metrics))),
    daily: dailyPoints,
    campaigns: campaignRows,
    keywords: [...kwMap.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 50),
    device: deviceRows,
  };
}
