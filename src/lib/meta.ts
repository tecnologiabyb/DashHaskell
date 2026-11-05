import type { BreakdownRow, CampaignRow, DailyPoint, DateRange, MetaAd, MetaData, MetaTotals } from './types';
import { previousRange } from './dates';

const API = 'https://graph.facebook.com/v21.0';

type Action = { action_type: string; value: string };

// Ordem de preferência: o primeiro tipo encontrado é usado (evita contar a mesma compra duas vezes).
const PURCHASE = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
const ADD_TO_CART = ['omni_add_to_cart', 'add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'];
const CHECKOUT = ['omni_initiated_checkout', 'initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout'];
const LANDING = ['landing_page_view', 'omni_landing_page_view'];

function pick(list: Action[] | undefined, types: string[]): number {
  if (!list) return 0;
  for (const t of types) {
    const a = list.find((x) => x.action_type === t);
    if (a) return parseFloat(a.value) || 0;
  }
  return 0;
}

const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;

async function get(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  // segue paginação (limite de segurança)
  let data = json.data ?? [];
  let next = json.paging?.next;
  for (let i = 0; next && i < 10; i++) {
    const r = await (await fetch(next, { cache: 'no-store' })).json();
    data = data.concat(r.data ?? []);
    next = r.paging?.next;
  }
  return data as any[];
}

function toTotals(row: any): MetaTotals {
  return {
    spend: num(row?.spend),
    impressions: num(row?.impressions),
    clicks: num(row?.inline_link_clicks ?? row?.clicks),
    reach: num(row?.reach),
    purchases: pick(row?.actions, PURCHASE),
    revenue: pick(row?.action_values, PURCHASE),
    landingViews: pick(row?.actions, LANDING),
    addToCart: pick(row?.actions, ADD_TO_CART),
    checkout: pick(row?.actions, CHECKOUT),
  };
}

const BASE_FIELDS = 'spend,impressions,reach,inline_link_clicks,actions,action_values';

function breakdown(rows: any[], key: string): BreakdownRow[] {
  return rows
    .map((r) => ({
      name: r[key] ?? 'Desconhecido',
      spend: num(r.spend),
      impressions: num(r.impressions),
      clicks: num(r.inline_link_clicks),
      purchases: pick(r.actions, PURCHASE),
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

export async function fetchMeta(range: DateRange): Promise<MetaData> {
  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;
  if (!token || !account) throw new Error('Meta: META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurado');
  const act = account.startsWith('act_') ? account : `act_${account}`;
  const prev = previousRange(range);
  const tr = (r: DateRange) => JSON.stringify({ since: r.start, until: r.end });
  const insights = (p: Record<string, string>) => get(`${act}/insights`, { limit: '500', ...p }, token);

  const [cur, before, daily, campaigns, ads, age, gender, region] = await Promise.all([
    insights({ time_range: tr(range), fields: BASE_FIELDS }),
    insights({ time_range: tr(prev), fields: BASE_FIELDS }),
    insights({ time_range: tr(range), time_increment: '1', fields: BASE_FIELDS }),
    insights({ time_range: tr(range), level: 'campaign', fields: `campaign_name,${BASE_FIELDS}` }),
    insights({ time_range: tr(range), level: 'ad', fields: `ad_id,ad_name,${BASE_FIELDS}` }),
    insights({ time_range: tr(range), breakdowns: 'age', fields: BASE_FIELDS }),
    insights({ time_range: tr(range), breakdowns: 'gender', fields: BASE_FIELDS }),
    insights({ time_range: tr(range), breakdowns: 'region', fields: BASE_FIELDS }),
  ]);

  const dailyPoints: DailyPoint[] = daily.map((r) => ({ date: r.date_start, ...toTotals(r) }));

  const campaignRows: CampaignRow[] = campaigns
    .map((r) => ({ name: r.campaign_name, ...toTotals(r) }))
    .sort((a, b) => b.spend - a.spend);

  const topAds: MetaAd[] = ads
    .map((r) => ({ id: r.ad_id, name: r.ad_name, ...toTotals(r) }))
    .sort((a, b) => b.purchases - a.purchases || b.revenue - a.revenue || b.clicks - a.clicks)
    .slice(0, 6);

  // Miniaturas dos melhores anúncios
  if (topAds.length) {
    try {
      const url = new URL(API);
      url.searchParams.set('ids', topAds.map((a) => a.id).join(','));
      // Sem tamanho explícito a thumbnail_url vem em 64x64; pedimos 600x600 (cobre vídeos).
      url.searchParams.set('fields', 'creative.thumbnail_width(600).thumbnail_height(600){image_url,thumbnail_url}');
      url.searchParams.set('access_token', token);
      const thumbs = await (await fetch(url, { cache: 'no-store' })).json();
      for (const a of topAds) {
        const c = thumbs?.[a.id]?.creative;
        a.thumbnail = c?.image_url ?? c?.thumbnail_url;
      }
    } catch {
      /* miniaturas são opcionais */
    }
  }

  return {
    totals: toTotals(cur[0]),
    prev: toTotals(before[0]),
    daily: dailyPoints,
    campaigns: campaignRows,
    ads: topAds,
    age: breakdown(age, 'age').sort((a, b) => a.name.localeCompare(b.name)),
    gender: breakdown(gender, 'gender').map((g) => ({
      ...g,
      name: g.name === 'female' ? 'Feminino' : g.name === 'male' ? 'Masculino' : 'Não informado',
    })),
    region: breakdown(region, 'region').slice(0, 30),
  };
}
