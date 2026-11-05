'use client';

import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GoogleData } from '@/lib/types';
import { brl, compact, dec, div, int, pct, roas, shortDate } from '@/lib/format';
import { axis, C, Card, DataTable, Kpi, Legend, PIE, Stat, tooltipStyle } from './ui';

export default function GoogleView({ g }: { g: GoogleData }) {
  const t = g.totals;
  const p = g.prev;
  const spark = (k: 'spend' | 'purchases' | 'revenue' | 'clicks') => g.daily.map((x) => x[k]);
  const series = g.daily.map((x) => ({ date: shortDate(x.date), spend: x.spend, clicks: x.clicks, conv: x.purchases }));
  const devTotal = g.device.reduce((s, x) => s + x.clicks, 0) || 1;

  return (
    <>
      <div className="grid kpis">
        <Kpi label="Investimento" value={brl(t.spend)} cur={t.spend} prev={p.spend} color={C.green} spark={spark('spend')} />
        <Kpi label="Cliques" value={int(t.clicks)} cur={t.clicks} prev={p.clicks} color={C.purple} spark={spark('clicks')} />
        <Kpi label="Conversões" value={dec(t.purchases)} cur={t.purchases} prev={p.purchases} color={C.olive} spark={spark('purchases')} />
        <Kpi label="Valor de conversão" value={brl(t.revenue)} cur={t.revenue} prev={p.revenue} color={C.mint} spark={spark('revenue')} />
        <Kpi label="Custo por conversão" value={brl(div(t.spend, t.purchases))} cur={div(t.spend, t.purchases)} prev={div(p.spend, p.purchases)} color={C.lilac} invert />
        <Kpi label="CPC médio" value={brl(div(t.spend, t.clicks))} cur={div(t.spend, t.clicks)} prev={div(p.spend, p.clicks)} color={C.greenDark} invert />
      </div>

      <div className="row r-google-1">
        <Card title="Palavras-chave">
          <DataTable
            rows={g.keywords}
            empty="Sem palavras-chave com cliques (campanhas PMax/Shopping não têm palavras-chave)"
            columns={[
              { key: 'k', label: 'Palavra-chave', render: (r) => r.keyword },
              { key: 'c', label: 'Cliques', num: true, render: (r) => int(r.clicks), value: (r) => r.clicks, heat: C.green },
              { key: 'p', label: 'Conv.', num: true, render: (r) => dec(r.purchases) },
            ]}
          />
        </Card>

        <Card title="Investimento, cliques e conversões">
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 6, right: 0, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={14} />
                <YAxis yAxisId="l" tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
                <YAxis yAxisId="r" orientation="right" tick={axis} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => (n === 'Investimento' ? brl(Number(v)) : dec(Number(v)))} />
                <Line yAxisId="l" dataKey="spend" name="Investimento" stroke={C.green} strokeWidth={2.5} dot={false} />
                <Line yAxisId="l" dataKey="clicks" name="Cliques" stroke={C.purple} strokeWidth={2} dot={false} />
                <Line yAxisId="r" dataKey="conv" name="Conversões" stroke={C.olive} strokeWidth={2} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend
            items={[
              { label: 'Investimento', color: C.green },
              { label: 'Cliques', color: C.purple },
              { label: 'Conversões (eixo direito)', color: C.olive },
            ]}
          />
        </Card>

        <Card title="Cliques por dispositivo">
          <div style={{ height: 190 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={g.device} dataKey="clicks" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                  {g.device.map((_, i) => (
                    <Cell key={i} fill={PIE[(i + 1) % PIE.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v) => [`${int(Number(v))} (${pct((Number(v) / devTotal) * 100)})`, 'Cliques']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend items={g.device.map((x, i) => ({ label: `${x.name} · ${pct((x.clicks / devTotal) * 100)}`, color: PIE[(i + 1) % PIE.length] }))} />
          <div className="stats inline" style={{ marginTop: 14 }}>
            <Stat label="CTR" value={pct(div(t.clicks, t.impressions) * 100)} />
            <Stat label="Taxa de conv." value={pct(div(t.purchases, t.clicks) * 100)} />
          </div>
          <div className="stats inline" style={{ marginTop: 8 }}>
            <Stat label="ROAS" value={roas(div(t.revenue, t.spend))} />
            <Stat label="Impressões" value={compact(t.impressions)} />
          </div>
        </Card>
      </div>

      <Card title="Campanhas">
        <DataTable
          rows={g.campaigns}
          columns={[
            { key: 'n', label: 'Campanha', render: (r) => r.name },
            { key: 's', label: 'Investimento', num: true, render: (r) => brl(r.spend), value: (r) => r.spend, heat: C.green },
            { key: 'i', label: 'Impressões', num: true, render: (r) => int(r.impressions) },
            { key: 'c', label: 'Cliques', num: true, render: (r) => int(r.clicks) },
            { key: 'ctr', label: 'CTR', num: true, render: (r) => pct(div(r.clicks, r.impressions) * 100) },
            { key: 'p', label: 'Conversões', num: true, render: (r) => dec(r.purchases), value: (r) => r.purchases, heat: C.purple },
            { key: 'cpa', label: 'Custo/conv.', num: true, render: (r) => brl(div(r.spend, r.purchases)) },
            { key: 'tx', label: 'Taxa de conv.', num: true, render: (r) => pct(div(r.purchases, r.clicks) * 100), value: (r) => div(r.purchases, r.clicks), heat: C.olive },
            { key: 'ro', label: 'ROAS', num: true, render: (r) => roas(div(r.revenue, r.spend)) },
          ]}
        />
      </Card>
    </>
  );
}
