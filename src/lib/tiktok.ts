import type { BreakdownRow, CampaignRow, DailyPoint, DateRange, MetaAd, TikTokData, TikTokTotals } from './types';
import { parseISO, previousRange, toISO } from './dates';

// TikTok Business API (Marketing API) v1.3
const API = 'https://business-api.tiktok.com/open_api/v1.3';

// Compras = "Pagamento concluído" (evento CompletePayment do pixel); receita = valor desses pagamentos.
// (o nome `total_complete_payment_rate` é da própria API, apesar de ser um valor em R$)
const METRICS = ['spend', 'impressions', 'clicks', 'reach', 'complete_payment', 'total_complete_payment_rate', 'total_landing_page_view', 'video_play_actions'];
const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;

type Row = { dimensions: Record<string, string>; metrics: Record<string, string> };

function toTotals(m: Record<string, string> | undefined): TikTokTotals {
  return {
    spend: num(m?.spend),
    impressions: num(m?.impressions),
    clicks: num(m?.clicks),
    reach: num(m?.reach),
    purchases: num(m?.complete_payment),
    revenue: num(m?.total_complete_payment_rate),
    landingViews: num(m?.total_landing_page_view),
    videoViews: num(m?.video_play_actions),
  };
}

const rankAds = (a: MetaAd, b: MetaAd) => b.purchases - a.purchases || b.revenue - a.revenue || b.clicks - a.clicks;

const AGE: Record<string, string> = {
  AGE_13_17: '13-17',
  AGE_18_24: '18-24',
  AGE_25_34: '25-34',
  AGE_35_44: '35-44',
  AGE_45_54: '45-54',
  AGE_55_100: '55+',
  NONE: 'N/I',
};
const GENDER: Record<string, string> = { FEMALE: 'Feminino', MALE: 'Masculino', NONE: 'Não informado' };

/** Divide o período em blocos de até 30 dias (limite da API para relatórios por dia). */
function chunks30(r: DateRange): DateRange[] {
  const out: DateRange[] = [];
  let start = parseISO(r.start);
  const end = parseISO(r.end);
  while (start <= end) {
    const stop = new Date(Math.min(start.getTime() + 29 * 86_400_000, end.getTime()));
    out.push({ start: toISO(start), end: toISO(stop) });
    start = new Date(stop.getTime() + 86_400_000);
  }
  return out;
}

export async function fetchTikTok(range: DateRange): Promise<TikTokData> {
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim();
  const advertiser = process.env.TIKTOK_ADVERTISER_ID?.trim();
  if (!token || !advertiser) throw new Error('TikTok: TIKTOK_ACCESS_TOKEN ou TIKTOK_ADVERTISER_ID não configurado');

  async function call(path: string, params: Record<string, unknown>) {
    const url = new URL(`${API}/${path}`);
    url.searchParams.set('advertiser_id', advertiser!);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    const res = await fetch(url, { headers: { 'Access-Token': token! }, cache: 'no-store' });
    const json = await res.json();
    if (json.code !== 0) throw new Error(`TikTok: ${json.message ?? `HTTP ${res.status}`}`);
    return json.data;
  }

  /** Relatório com paginação (limite de segurança de 20 páginas de 1000 linhas). */
  async function report(params: Record<string, unknown>): Promise<Row[]> {
    let rows: Row[] = [];
    for (let page = 1; page <= 20; page++) {
      const data = await call('report/integrated/get/', { report_type: 'BASIC', page_size: 1000, page, ...params });
      rows = rows.concat(data?.list ?? []);
      if (page >= (data?.page_info?.total_page ?? 1)) break;
    }
    return rows;
  }

  const prev = previousRange(range);
  const period = (r: DateRange) => ({ start_date: r.start, end_date: r.end });
  const advertiserLevel = { data_level: 'AUCTION_ADVERTISER', dimensions: ['advertiser_id'], metrics: METRICS };
  const audience = (dim: string) =>
    report({
      report_type: 'AUDIENCE',
      data_level: 'AUCTION_ADVERTISER',
      dimensions: ['advertiser_id', dim],
      metrics: ['spend', 'impressions', 'clicks'],
      ...period(range),
    }).catch(() => [] as Row[]); // idade e gênero são opcionais

  const [cur, before, dailyChunks, campaigns, ads, age, gender] = await Promise.all([
    report({ ...advertiserLevel, ...period(range) }),
    report({ ...advertiserLevel, ...period(prev) }),
    Promise.all(
      chunks30(range).map((r) =>
        report({ data_level: 'AUCTION_ADVERTISER', dimensions: ['stat_time_day'], metrics: METRICS.filter((m) => m !== 'reach'), ...period(r) }),
      ),
    ),
    report({ data_level: 'AUCTION_CAMPAIGN', dimensions: ['campaign_id'], metrics: ['campaign_name', ...METRICS], ...period(range) }),
    report({ data_level: 'AUCTION_AD', dimensions: ['ad_id'], metrics: ['ad_name', 'campaign_id', ...METRICS.filter((m) => m !== 'reach')], ...period(range) }),
    audience('age'),
    audience('gender'),
  ]);

  const active = (t: { spend: number; impressions: number }) => t.spend > 0 || t.impressions > 0;

  const daily: DailyPoint[] = dailyChunks
    .flat()
    .map((r) => ({ date: r.dimensions.stat_time_day.slice(0, 10), ...toTotals(r.metrics) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const campaignRows: CampaignRow[] = campaigns
    .map((r) => ({ id: r.dimensions.campaign_id, name: r.metrics.campaign_name?.trim() || r.dimensions.campaign_id, ...toTotals(r.metrics) }))
    .filter(active)
    .sort((a, b) => b.spend - a.spend);

  const adRows: MetaAd[] = ads
    .map((r) => ({
      id: r.dimensions.ad_id,
      name: r.metrics.ad_name?.trim() || r.dimensions.ad_id,
      campaignId: r.metrics.campaign_id,
      ...toTotals(r.metrics),
    }))
    .filter(active)
    .sort(rankAds);

  await addThumbnails(adRows.slice(0, 300), call);

  const breakdown = (rows: Row[], key: string, names: Record<string, string>): BreakdownRow[] =>
    rows.map((r) => ({
      name: names[r.dimensions[key]] ?? r.dimensions[key],
      spend: num(r.metrics.spend),
      impressions: num(r.metrics.impressions),
      clicks: num(r.metrics.clicks),
      purchases: 0,
    }));

  const ageOrder = Object.values(AGE);
  return {
    totals: toTotals(cur[0]?.metrics),
    prev: toTotals(before[0]?.metrics),
    daily,
    campaigns: campaignRows,
    ads: adRows,
    age: breakdown(age, 'age', AGE).sort((a, b) => ageOrder.indexOf(a.name) - ageOrder.indexOf(b.name)),
    gender: breakdown(gender, 'gender', GENDER).sort((a, b) => b.clicks - a.clicks),
  };
}

type AdInfo = {
  ad_id: string;
  video_id?: string | null;
  image_ids?: string[];
  tiktok_item_id?: string | null;
  identity_type?: string;
  identity_id?: string;
  identity_authorized_bc_id?: string;
};

// Capas dos posts (Spark Ads) já buscadas: evita refazer uma chamada por anúncio a cada atualização.
// As URLs da CDN do TikTok são assinadas e expiram, por isso o cache dura poucas horas.
const coverCache = new Map<string, { url: string; at: number }>();
const COVER_TTL = 3 * 60 * 60 * 1000;

/** Executa `fn` em lotes de `size` em paralelo. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/**
 * Capa de cada anúncio. Opcional: falhas não derrubam a dash.
 * - Anúncios com vídeo enviado ao gerenciador: capa do vídeo (video_id).
 * - Spark Ads (post do perfil do TikTok): capa do post (tiktok_item_id), uma chamada por anúncio.
 * - Anúncios de imagem: a primeira imagem.
 */
async function addThumbnails(ads: MetaAd[], call: (path: string, params: Record<string, unknown>) => Promise<any>) {
  try {
    const info: AdInfo[] = [];
    for (let i = 0; i < ads.length; i += 100) {
      const data = await call('ad/get/', {
        filtering: { ad_ids: ads.slice(i, i + 100).map((a) => a.id) },
        fields: ['ad_id', 'video_id', 'image_ids', 'tiktok_item_id', 'identity_type', 'identity_id', 'identity_authorized_bc_id'],
        page_size: 100,
      });
      info.push(...(data?.list ?? []));
    }

    // Alguns anúncios vêm sem o Business Center do perfil: reaproveita o de outro anúncio do mesmo perfil
    const bcByIdentity = new Map<string, string>();
    for (const x of info) if (x.identity_id && x.identity_authorized_bc_id) bcByIdentity.set(x.identity_id, x.identity_authorized_bc_id);
    for (const x of info) if (x.identity_id && !x.identity_authorized_bc_id) x.identity_authorized_bc_id = bcByIdentity.get(x.identity_id);

    // Spark Ads: até 120 anúncios (os melhores primeiro), 10 chamadas por vez
    const order = new Map(ads.map((a, i) => [a.id, i]));
    const spark = info
      .filter((x) => !x.video_id && x.tiktok_item_id && x.identity_id)
      .sort((a, b) => (order.get(a.ad_id) ?? 0) - (order.get(b.ad_id) ?? 0))
      .slice(0, 120);
    const sparkCovers = new Map<string, string>();
    await inBatches(spark, 4, async (x) => {
      const item = x.tiktok_item_id!;
      const hit = coverCache.get(item);
      if (hit && Date.now() - hit.at < COVER_TTL) return void sparkCovers.set(x.ad_id, hit.url);
      // O TikTok limita chamadas por segundo: tenta de novo com pausa antes de desistir
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const data = await call('identity/video/info/', {
            identity_type: x.identity_type,
            identity_id: x.identity_id,
            ...(x.identity_authorized_bc_id ? { identity_authorized_bc_id: x.identity_authorized_bc_id } : {}),
            item_id: item,
          });
          const d = data?.video_detail;
          const cover = d?.video_info?.poster_url ?? d?.carousel_info?.image_info?.[0]?.image_url;
          if (cover) {
            sparkCovers.set(x.ad_id, cover);
            coverCache.set(item, { url: cover, at: Date.now() });
          }
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
        }
      }
      /* post removido ou sem permissão: fica sem prévia */
    });

    const videoIds = [...new Set(info.map((x) => x.video_id).filter(Boolean))] as string[];
    const imageIds = [...new Set(info.flatMap((x) => (x.video_id ? [] : x.image_ids?.slice(0, 1) ?? [])))];
    const covers = new Map<string, string>();
    for (let i = 0; i < videoIds.length; i += 60) {
      const data = await call('file/video/ad/info/', { video_ids: videoIds.slice(i, i + 60) });
      for (const v of data?.list ?? []) if (v.video_cover_url || v.poster_url) covers.set(v.video_id, v.video_cover_url ?? v.poster_url);
    }
    for (let i = 0; i < imageIds.length; i += 100) {
      const data = await call('file/image/ad/info/', { image_ids: imageIds.slice(i, i + 100) });
      for (const img of data?.list ?? []) if (img.image_url) covers.set(img.image_id, img.image_url);
    }

    const byAd = new Map(info.map((x) => [x.ad_id, sparkCovers.get(x.ad_id) ?? covers.get(x.video_id ?? '') ?? covers.get(x.image_ids?.[0] ?? '')]));
    for (const a of ads) a.thumbnail = byAd.get(a.id);
  } catch (e) {
    console.error('TikTok miniaturas:', e instanceof Error ? e.message : e);
  }
}
