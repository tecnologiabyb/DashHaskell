import { NextRequest, NextResponse } from 'next/server';
import { fetchMeta } from '@/lib/meta';
import { fetchGoogle } from '@/lib/google';
import { mockGoogle, mockMeta } from '@/lib/mock';
import { isValidRange, previousRange, toISO } from '@/lib/dates';
import type { DashboardResponse, DateRange, SourceResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Cache em memória por 10 min para não estourar limites das APIs
const cache = new Map<string, { at: number; body: DashboardResponse }>();
const TTL = 10 * 60 * 1000;

async function safe<T>(fn: () => Promise<T>, fallback: () => T): Promise<SourceResult<T>> {
  try {
    return { data: await fn(), mock: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return { data: fallback(), mock: true, error: msg };
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const today = new Date();
  const defStart = new Date(today.getTime() - 7 * 86_400_000);
  const defEnd = new Date(today.getTime() - 86_400_000);
  const range: Partial<DateRange> = { start: sp.get('start') ?? toISO(defStart), end: sp.get('end') ?? toISO(defEnd) };
  if (!isValidRange(range)) return NextResponse.json({ error: 'Período inválido' }, { status: 400 });

  const key = `${range.start}_${range.end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL && sp.get('refresh') !== '1') return NextResponse.json(hit.body);

  const prevRange = previousRange(range);
  const [meta, google] = await Promise.all([
    safe(() => fetchMeta(range), () => mockMeta(range, prevRange)),
    safe(() => fetchGoogle(range), () => mockGoogle(range, prevRange)),
  ]);

  const body: DashboardResponse = { range, prevRange, meta, google, updatedAt: new Date().toISOString() };
  if (!meta.mock && !google.mock) cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
