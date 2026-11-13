'use client';

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TikTokData } from '@/lib/types';
import { brl, compact, dec, div, int, pct, roas, shortDate } from '@/lib/format';
import { axis, C, Card, Kpi, Legend, PIE, Stat, tooltipStyle } from './ui';
import CampaignExplorer from './CampaignExplorer';

const FUNNEL_COLORS = [C.greenDark, C.green, C.mint, C.olive];

export default function TikTokView({ t: d }: { t: TikTokData }) {
  const t = d.totals;
  const p = d.prev;
  const spark = (k: 'spend' | 'purchases' | 'revenue' | 'clicks' | 'impressions') => d.daily.map((x) => x[k]);

  const steps = [
    { l: 'Impressões', v: t.impressions },
    { l: 'Cliques', v: t.clicks },
    { l: 'Visitas à página', v: t.landingViews },
    { l: 'Compras', v: t.purchases },
  ];

  const series = d.daily.map((x) => ({ date: shortDate(x.date), spend: x.spend, purchases: x.purchases }));
  const genderTotal = d.gender.reduce((s, x) => s + x.clicks, 0) || 1;

  return (
    <>
      <div className="grid kpis">
        <Kpi label="Investimento" value={brl(t.spend)} cur={t.spend} prev={p.spend} color={C.olive} spark={spark('spend')} />
        <Kpi label="Compras" value={dec(t.purchases)} cur={t.purchases} prev={p.purchases} color={C.green} spark={spark('purchases')} />
        <Kpi label="Receita" value={brl(t.revenue)} cur={t.revenue} prev={p.revenue} color={C.purple} spark={spark('revenue')} />
        <Kpi label="Cliques" value={int(t.clicks)} cur={t.clicks} prev={p.clicks} color={C.mint} spark={spark('clicks')} />
        <Kpi label="Impressões" value={int(t.impressions)} cur={t.impressions} prev={p.impressions} color={C.lilac} spark={spark('impressions')} />
        <Kpi label="Visualizações de vídeo" value={int(t.videoViews)} cur={t.videoViews} prev={p.videoViews} color={C.greenDark} />
      </div>

      <div className="row r-meta-1">
        <Card title="Funil de vendas">
          <div className="funnel">
            {steps.map((s, i) => (
              <div key={s.l} style={{ display: 'contents' }}>
                {i > 0 && <div className="rate">{pct(div(s.v, steps[i - 1].v) * 100)}</div>}
                <div className="step" style={{ background: FUNNEL_COLORS[i], width: `${100 - i * 15}%` }}>
                  <div className="l">{s.l}</div>
                  <div className="v">{s.v >= 100000 ? compact(s.v) : int(s.v)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="stats inline">
            <Stat label="CTR" value={pct(div(t.clicks, t.impressions) * 100)} />
            <Stat label="Alcance" value={compact(t.reach)} />
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
                <Bar yAxisId="l" dataKey="spend" name="Investimento" fill={C.olive} radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line yAxisId="r" dataKey="purchases" name="Compras" stroke={C.green} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'Investimento', color: C.olive }, { label: 'Compras', color: C.green }]} />
        </Card>
      </div>

      {(d.age.length > 0 || d.gender.length > 0) && (
        <div className="row r-google-2">
          <Card title="Faixa etária · cliques">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.age} margin={{ top: 16, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="name" tick={{ ...axis, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v, _n, item) => [`${int(Number(v))} cliques · ${brl(item?.payload?.spend ?? 0)} investidos`, 'Faixa']}
                  cursor={{ fill: '#eef3e6' }}
                />
                <Bar dataKey="clicks" fill={C.olive} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="note">O TikTok não informa compras por idade ou gênero; por isso estes gráficos usam cliques.</p>
          </Card>

          <Card title="Gênero · cliques">
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={d.gender} dataKey="clicks" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                    {d.gender.map((_, i) => (
                      <Cell key={i} fill={PIE[i % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${int(Number(v))} (${pct((Number(v) / genderTotal) * 100)})`, 'Cliques']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Legend items={d.gender.map((x, i) => ({ label: `${x.name} · ${pct((x.clicks / genderTotal) * 100)}`, color: PIE[i % PIE.length] }))} />
          </Card>
        </div>
      )}

      <CampaignExplorer campaigns={d.campaigns} ads={d.ads} accent={C.mint} thumbLabel="Abrir a capa do vídeo" />
    </>
  );
}
