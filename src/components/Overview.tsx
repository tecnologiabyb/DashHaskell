'use client';

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardResponse, Totals } from '@/lib/types';
import { brl, byWeekday, compact, dec, div, int, pct, roas, shortDate } from '@/lib/format';
import { axis, C, Card, DataTable, Kpi, Legend, PIE, Stat, tooltipStyle } from './ui';

function add(a: Totals, b: Totals): Totals {
  return {
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    purchases: a.purchases + b.purchases,
    revenue: a.revenue + b.revenue,
  };
}

export default function Overview({ d }: { d: DashboardResponse }) {
  const m = d.meta.data;
  const g = d.google.data;
  const cur = add(m.totals, g.totals);
  const prev = add(m.prev, g.prev);

  // Série diária combinada (investimento por plataforma)
  const dates = Array.from(new Set([...m.daily, ...g.daily].map((x) => x.date))).sort();
  const series = dates.map((date) => ({
    date: shortDate(date),
    meta: m.daily.find((x) => x.date === date)?.spend ?? 0,
    google: g.daily.find((x) => x.date === date)?.spend ?? 0,
  }));

  const genderTotal = m.gender.reduce((s, x) => s + x.impressions, 0) || 1;

  return (
    <>
      <div className="grid kpis">
        <Kpi label="Investimento total" value={brl(cur.spend)} cur={cur.spend} prev={prev.spend} color={C.purple} />
        <Kpi label="Receita total" value={brl(cur.revenue)} cur={cur.revenue} prev={prev.revenue} color={C.green} />
        <Kpi label="Compras totais" value={dec(cur.purchases)} cur={cur.purchases} prev={prev.purchases} color={C.olive} />
        <Kpi label="ROAS" value={roas(div(cur.revenue, cur.spend))} cur={div(cur.revenue, cur.spend)} prev={div(prev.revenue, prev.spend)} color={C.mint} />
        <Kpi label="CPA" value={brl(div(cur.spend, cur.purchases))} cur={div(cur.spend, cur.purchases)} prev={div(prev.spend, prev.purchases)} color={C.lilac} invert />
        <Kpi label="Cliques gerais" value={int(cur.clicks)} cur={cur.clicks} prev={prev.clicks} color={C.greenDark} />
      </div>

      <div className="row r-overview-1">
        <Card title="Impressões totais">
          <Kpi label="Meta + Google" value={int(cur.impressions)} cur={cur.impressions} prev={prev.impressions} color={C.green} />
          <div style={{ height: 190, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
                <Tooltip {...tooltipStyle} formatter={(v) => brl(Number(v))} />
                <Line dataKey="meta" name="Meta Ads" stroke={C.purple} strokeWidth={2} dot={false} />
                <Line dataKey="google" name="Google Ads" stroke={C.green} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'Investimento Meta', color: C.purple }, { label: 'Investimento Google', color: C.green }]} />
        </Card>

        <Card title="Meta Ads">
          <div className="split">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={byWeekday(m.daily, 'purchases')} margin={{ top: 16, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [dec(Number(v)), 'Compras']} cursor={{ fill: '#f4e8f3' }} />
                  <Bar dataKey="value" fill={C.purple} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Legend items={[{ label: 'Compras por dia da semana', color: C.purple }]} />
            </div>
            <div className="stats">
              <Stat label="Investimento" value={brl(m.totals.spend)} cur={m.totals.spend} prev={m.prev.spend} />
              <Stat label="Compras" value={dec(m.totals.purchases)} cur={m.totals.purchases} prev={m.prev.purchases} />
              <Stat label="Custo por compra" value={brl(div(m.totals.spend, m.totals.purchases))} cur={div(m.totals.spend, m.totals.purchases)} prev={div(m.prev.spend, m.prev.purchases)} invert />
            </div>
          </div>
        </Card>

        <Card title="Google Ads">
          <div className="split">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={byWeekday(g.daily, 'clicks')} margin={{ top: 16, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [int(Number(v)), 'Cliques']} cursor={{ fill: '#e3efe9' }} />
                  <Bar dataKey="value" fill={C.green} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Legend items={[{ label: 'Cliques por dia da semana', color: C.green }]} />
            </div>
            <div className="stats">
              <Stat label="Investimento" value={brl(g.totals.spend)} cur={g.totals.spend} prev={g.prev.spend} />
              <Stat label="Cliques" value={int(g.totals.clicks)} cur={g.totals.clicks} prev={g.prev.clicks} />
              <Stat label="Custo por conversão" value={brl(div(g.totals.spend, g.totals.purchases))} cur={div(g.totals.spend, g.totals.purchases)} prev={div(g.prev.spend, g.prev.purchases)} invert />
            </div>
          </div>
        </Card>
      </div>

      <div className="row r-overview-2">
        <Card title="Dados demográficos (Meta)">
          <div className="split">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={m.age} margin={{ top: 16, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [int(Number(v)), 'Impressões']} cursor={{ fill: '#e3efe9' }} />
                  <Bar dataKey="impressions" fill={C.olive} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Legend items={[{ label: 'Impressões por faixa etária', color: C.olive }]} />
            </div>
            <div className="stats">
              <Stat label="Alcance" value={int(m.totals.reach)} cur={m.totals.reach} prev={m.prev.reach} />
              <Stat label="Visitas ao site" value={int(m.totals.landingViews)} cur={m.totals.landingViews} prev={m.prev.landingViews} />
              <Stat label="Impressões" value={int(m.totals.impressions)} cur={m.totals.impressions} prev={m.prev.impressions} />
            </div>
          </div>
        </Card>

        <Card title="Gênero">
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={m.gender} dataKey="impressions" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                  {m.gender.map((_, i) => (
                    <Cell key={i} fill={PIE[i % PIE.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v) => [`${int(Number(v))} (${pct((Number(v) / genderTotal) * 100)})`, 'Impressões']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend items={m.gender.map((x, i) => ({ label: `${x.name} · ${pct((x.impressions / genderTotal) * 100)}`, color: PIE[i % PIE.length] }))} />
        </Card>

        <Card title="Região">
          <DataTable
            rows={m.region}
            columns={[
              { key: 'r', label: 'Estado', render: (r) => r.name },
              { key: 'i', label: 'Impressões', num: true, render: (r) => int(r.impressions), value: (r) => r.impressions, heat: C.purple },
              { key: 'p', label: 'Compras', num: true, render: (r) => dec(r.purchases) },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
