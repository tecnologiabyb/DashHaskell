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
  name: string;
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
  thumbnail?: string;
}

export interface MetaData {
  totals: MetaTotals;
  prev: MetaTotals;
  daily: DailyPoint[];
  campaigns: CampaignRow[];
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

export interface GoogleData {
  totals: Totals;
  prev: Totals;
  daily: DailyPoint[];
  campaigns: CampaignRow[];
  keywords: KeywordRow[];
  device: BreakdownRow[];
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
  updatedAt: string;
}
