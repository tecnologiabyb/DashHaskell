'use client';

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetaData } from '@/lib/types';
import { brl, compact, dec, div, int, pct, roas, shortDate } from '@/lib/format';
import { axis, C, Card, DataTable, Kpi, Legend, Stat, tooltipStyle } from './ui';

const FUNNEL_COLORS = [C.greenDark, C.green, C.mint, C.olive, C.purple, '#7d2f79'];

export default function MetaView({ m }: { m: MetaData }) {
  const t = m.totals;
  const p = m.prev;
  const spark = (k: 'spend' | 'purchases' | 'revenue' | 'clicks' | 'impressions') => m.daily.map((x) => x[k]);

  const steps = [
    { l: 'Impressões', v: t.impressions },
    { l: 'Cliques no link', v: t.clicks },
    { l: 'Visitas ao site', v: t.landingViews },
    { l: 'Add. ao carrinho', v: t.addToCart },
    { l: 'Checkout', v: t.checkout },
    { l: 'Compras', v: t.purchases },
  ];

  const series = m.daily.map((x) => ({ date: shortDate(x.date), spend: x.spend, purchases: x.purchases }));

  return (
    <>
      <div className="grid kpis">
        <Kpi label="Investimento" value={brl(t.spend)} cur={t.spend} prev={p.spend} color={C.purple} spark={spark('spend')} />
        <Kpi label="Compras" value={dec(t.purchases)} cur={t.purchases} prev={p.purchases} color={C.green} spark={spark('purchases')} />
        <Kpi label="Receita" value={brl(t.revenue)} cur={t.revenue} prev={p.revenue} color={C.olive} spark={spark('revenue')} />
        <Kpi label="Cliques no link" value={int(t.clicks)} cur={t.clicks} prev={p.clicks} color={C.mint} spark={spark('clicks')} />
        <Kpi label="Impressões" value={int(t.impressions)} cur={t.impressions} prev={p.impressions} color={C.lilac} spark={spark('impressions')} />
        <Kpi label="Alcance" value={int(t.reach)} cur={t.reach} prev={p.reach} color={C.greenDark} />
      </div>

      <div className="row r-meta-1">
        <Card title="Funil de vendas">
          <div className="funnel">
            {steps.map((s, i) => (
              <div key={s.l} style={{ display: 'contents' }}>
                {i > 0 && <div className="rate">{pct(div(s.v, steps[i - 1].v) * 100)}</div>}
                <div className="step" style={{ background: FUNNEL_COLORS[i], width: `${100 - i * 11}%` }}>
                  <div className="l">{s.l}</div>
                  <div className="v">{s.v >= 100000 ? compact(s.v) : int(s.v)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="stats inline">
            <Stat label="CTR" value={pct(div(t.clicks, t.impressions) * 100)} />
            <Stat label="Frequência" value={dec(div(t.impressions, t.reach))} />
            <Stat label="CPM" value={brl(div(t.spend, t.impressions) * 1000)} />
          </div>
        </Card>

        <div className="stats panel">
          <Stat label="ROAS" value={roas(div(t.revenue, t.spend))} cur={div(t.revenue, t.spend)} prev={div(p.revenue, p.spend)} />
          <Stat label="Custo por compra" value={brl(div(t.spend, t.purchases))} cur={div(t.spend, t.purchases)} prev={div(p.spend, p.purchases)} invert />
          <Stat label="Custo por clique" value={brl(div(t.spend, t.clicks))} cur={div(t.spend, t.clicks)} prev={div(p.spend, p.clicks)} invert />
          <Stat label="Ticket médio" value={brl(div(t.revenue, t.purchases))} cur={div(t.revenue, t.purchases)} prev={div(p.revenue, p.purchases)} />
          <Stat label="Taxa de conversão" value={pct(div(t.purchases, t.clicks) * 100)} cur={div(t.purchases, t.clicks)} prev={div(p.purchases, p.clicks)} />
        </div>

        <Card title="Investimento x compras por dia">
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 6, right: 0, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={14} />
                <YAxis yAxisId="l" tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
                <YAxis yAxisId="r" orientation="right" tick={axis} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => (n === 'Investimento' ? brl(Number(v)) : dec(Number(v)))} />
                <Bar yAxisId="l" dataKey="spend" name="Investimento" fill={C.purple} radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line yAxisId="r" dataKey="purchases" name="Compras" stroke={C.green} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'Investimento', color: C.purple }, { label: 'Compras', color: C.green }]} />
        </Card>
      </div>

      <div className="row r-meta-2">
        <Card title="Melhores anúncios">
          {m.ads.length ? (
            <div className="ads" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {m.ads.map((a) => (
                <div className="ad" key={a.id}>
                  <div className="thumb">{a.thumbnail ? <img src={a.thumbnail} alt={a.name} loading="lazy" /> : 'Sem prévia'}</div>
                  <div className="info">
                    <div className="n" title={a.name}>{a.name}</div>
                    <div className="m">
                      {dec(a.purchases)} compras · {roas(div(a.revenue, a.spend))}
                    </div>
                    <div className="m">{brl(a.spend)} investidos</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Sem anúncios no período</div>
          )}
        </Card>

        <Card title="Campanhas">
          <DataTable
            rows={m.campaigns}
            columns={[
              { key: 'n', label: 'Campanha', render: (r) => r.name },
              { key: 's', label: 'Investimento', num: true, render: (r) => brl(r.spend), value: (r) => r.spend, heat: C.purple },
              { key: 'i', label: 'Impressões', num: true, render: (r) => int(r.impressions) },
              { key: 'c', label: 'Cliques', num: true, render: (r) => int(r.clicks) },
              { key: 'ctr', label: 'CTR', num: true, render: (r) => pct(div(r.clicks, r.impressions) * 100) },
              { key: 'p', label: 'Compras', num: true, render: (r) => dec(r.purchases), value: (r) => r.purchases, heat: C.green },
              { key: 'cpa', label: 'CPA', num: true, render: (r) => brl(div(r.spend, r.purchases)) },
              { key: 'rv', label: 'Receita', num: true, render: (r) => brl(r.revenue) },
              { key: 'ro', label: 'ROAS', num: true, render: (r) => roas(div(r.revenue, r.spend)), value: (r) => div(r.revenue, r.spend), heat: C.olive },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
