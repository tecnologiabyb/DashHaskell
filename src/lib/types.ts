export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

export interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
}

export interface DailyPoint extends Totals {
  date: string;
}

export interface CampaignRow extends Totals {
  id?: string;
  name: string;
  /** Google: tipo da campanha (Pesquisa, Shopping, Performance Max...). */
  type?: string;
  /** Google: parcela de impressões conquistada e perdida (0 a 1). Ausente quando o Google não informa. */
  impressionShare?: number;
  lostBudget?: number;
  lostRank?: number;
}

export interface BreakdownRow {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
}

export interface MetaTotals extends Totals {
  reach: number;
  landingViews: number;
  addToCart: number;
  checkout: number;
}

export interface MetaAd extends Totals {
  id: string;
  name: string;
  campaignId?: string;
  thumbnail?: string;
}

export interface MetaData {
  totals: MetaTotals;
  prev: MetaTotals;
  daily: DailyPoint[];
  campaigns: CampaignRow[];
  /** Todos os anúncios do período, do melhor para o pior (filtrar por campaignId). */
  ads: MetaAd[];
  age: BreakdownRow[];
  gender: BreakdownRow[];
  region: BreakdownRow[];
}

export interface KeywordRow {
  keyword: string;
  clicks: number;
  impressions: number;
  purchases: number;
  spend: number;
}

export interface ProductRow extends Totals {
  id: string;
  name: string;
}

export interface SearchTermRow {
  term: string;
  /** O termo contém o nome da marca. */
  brand: boolean;
  spend: number;
  clicks: number;
  purchases: number;
  revenue: number;
}

export interface GoogleData {
  totals: Totals;
  prev: Totals;
  daily: DailyPoint[];
  campaigns: CampaignRow[];
  keywords: KeywordRow[];
  device: BreakdownRow[];
  /** Produtos anunciados em Shopping e Performance Max, do que mais vendeu para o que menos vendeu. */
  products: ProductRow[];
  /** Termos de pesquisa (campanhas de Pesquisa e Shopping) com maior investimento. */
  terms: SearchTermRow[];
  /** Soma de todos os termos de pesquisa, separados entre os que citam a marca e os demais. */
  brandSplit: { brand: Totals; generic: Totals };
}

export interface StoreTotals {
  /** Pedidos criados (pagos ou não). */
  created: number;
  /** Pedidos pagos e não cancelados. */
  orders: number;
  /** Faturamento dos pedidos pagos (com frete). */
  revenue: number;
}

export interface StoreDay extends StoreTotals {
  date: string;
}

export interface StoreState {
  /** Estado de entrega do pedido. */
  name: string;
  orders: number;
  revenue: number;
}

export interface StoreData {
  totals: StoreTotals;
  prev: StoreTotals;
  daily: StoreDay[];
  /** Dias do período anterior (mesma duração), para comparar a evolução. */
  prevDaily: StoreDay[];
  /** Pedidos pagos por estado de entrega no período, do maior para o menor. */
  states: StoreState[];
  updatedAt: string | null;
}

export interface SourceResult<T> {
  data: T;
  mock: boolean;
  error?: string;
}

export interface DashboardResponse {
  range: DateRange;
  prevRange: DateRange;
  meta: SourceResult<MetaData>;
  google: SourceResult<GoogleData>;
  /** Vendas reais da loja (Nuvemshop). `data` é null quando a fonte não está configurada ou falhou. */
  store: { data: StoreData | null; error?: string };
  updatedAt: string;
}
