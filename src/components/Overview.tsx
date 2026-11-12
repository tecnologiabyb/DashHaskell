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

  const genderTotal = m.gender.reduce((s, x) => s + x.purchases, 0) || 1;  const store = d.store?.data ?? null;

  // Representatividade: quanto do faturamento real da loja cada plataforma atribui a si.
  // O que sobra são as vendas sem anúncio atribuído (orgânico, direto, e-mail, TikTok, recorrentes).
  const share = store
    ? [
        { name: 'Meta Ads', color: C.purple, t: m.totals },
        { name: 'Google Ads', color: C.green, t: g.totals },
      ].map((x) => ({
        ...x,
        revShare: div(x.t.revenue, store.totals.revenue) * 100,
        orderShare: div(x.t.purchases, store.totals.orders) * 100,
      }))
    : [];
  // Evolução da receita: loja no período, loja no período anterior (mesmo dia da sequência) e receita atribuída pelas plataformas.
  const revDates = store ? store.daily.map((x) => x.date) : dates;
  const revSeries = revDates.map((date, i) => ({
    date: shortDate(date),
    loja: store?.daily[i]?.revenue,
    anterior: store?.prevDaily[i]?.revenue,
    anteriorData: store?.prevDaily[i] ? shortDate(store.prevDaily[i].date) : '',
    midia: (m.daily.find((x) => x.date === date)?.revenue ?? 0) + (g.daily.find((x) => x.date === date)?.revenue ?? 0),
  }));

  const otherRevenue = store ? store.totals.revenue - cur.revenue : 0;
  const otherOrders = store ? store.totals.orders - cur.purchases : 0;

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

      {store && (
        <Card title="Loja (Nuvemshop) · vendas reais" className="store">
          <div className="stats inline col-on-mobile">
            <Stat label="Faturamento da loja" value={brl(store.totals.revenue)} cur={store.totals.revenue} prev={store.prev.revenue} />
            <Stat label="Pedidos pagos" value={int(store.totals.orders)} cur={store.totals.orders} prev={store.prev.orders} />
            <Stat label="Ticket médio" value={brl(div(store.totals.revenue, store.totals.orders))} cur={div(store.totals.revenue, store.totals.orders)} prev={div(store.prev.revenue, store.prev.orders)} />
            <Stat label="Vendido na loja por R$ 1 de mídia" value={brl(div(store.totals.revenue, cur.spend))} cur={div(store.totals.revenue, cur.spend)} prev={div(store.prev.revenue, prev.spend)} />
            <Stat label="Receita atribuída ÷ faturamento" value={pct(div(cur.revenue, store.totals.revenue) * 100)} />
          </div>
          <p className="note">
            Faturamento e pedidos vêm dos pedidos pagos da loja. A receita das plataformas (Meta + Google) é a venda que cada uma atribui a si,
            então a mesma venda pode aparecer nas duas. Vendas de TikTok, orgânico, e-mail e clientes recorrentes entram só no faturamento da loja.
          </p>
        </Card>
      )}

      {store && (
        <Card title="Representatividade das plataformas na loja" className="store">
          <div className="share-bar" aria-hidden>
            {share.map((x) => (
              <div key={x.name} style={{ width: `${Math.min(x.revShare, 100)}%`, background: x.color }} />
            ))}
          </div>
          <div className="share-rows">
            {share.map((x) => (
              <div className="share-row" key={x.name}>
                <div className="share-name">
                  <span className="sw" style={{ background: x.color }} />
                  {x.name}
                </div>
                <div className="share-pct">{pct(x.revShare)}</div>
                <div className="share-cells">
                  <span>Receita atribuída<b>{brl(x.t.revenue)}</b></span>
                  <span>Compras<b>{dec(x.t.purchases)} ({pct(x.orderShare)} dos pedidos)</b></span>
                  <span>Investimento<b>{brl(x.t.spend)}</b></span>
                  <span>ROAS<b>{roas(div(x.t.revenue, x.t.spend))}</b></span>
                </div>
              </div>
            ))}
            <div className="share-row">
              <div className="share-name">
                <span className="sw" style={{ background: C.grey }} />
                {otherRevenue >= 0 ? 'Sem anúncio atribuído' : 'Atribuição acima da loja'}
              </div>
              <div className="share-pct">{pct(Math.abs(div(otherRevenue, store.totals.revenue)) * 100)}</div>
              <div className="share-cells">
                <span>{otherRevenue >= 0 ? 'Faturamento restante' : 'Excesso atribuído'}<b>{brl(Math.abs(otherRevenue))}</b></span>
                <span>Pedidos<b>{otherOrders >= 0 ? int(otherOrders) : `${int(-otherOrders)} a mais que a loja`}</b></span>
                <span>Total da loja<b>{brl(store.totals.revenue)}</b></span>
                <span>Pedidos da loja<b>{int(store.totals.orders)}</b></span>
              </div>
            </div>
          </div>
          <p className="note">
            {otherRevenue >= 0
              ? 'Cada porcentagem é a receita que a plataforma atribui a si dividida pelo faturamento da loja no período. O restante vem de busca orgânica, acesso direto, e-mail, TikTok e clientes recorrentes.'
              : 'As plataformas somadas atribuem a si mais do que a loja faturou no período: a mesma venda está sendo contada por mais de uma delas.'}
          </p>
        </Card>
      )}

      <Card title="Evolução da receita" className="store">
        <div className="stats inline col-on-mobile">
          {store && <Stat label="Receita da loja no período" value={brl(store.totals.revenue)} cur={store.totals.revenue} prev={store.prev.revenue} />}
          {store && <Stat label="Período anterior" value={brl(store.prev.revenue)} />}
          <Stat label="Receita atribuída (Meta + Google)" value={brl(cur.revenue)} cur={cur.revenue} prev={prev.revenue} />
          {store && <Stat label="Média por dia na loja" value={brl(div(store.totals.revenue, store.daily.length))} cur={div(store.totals.revenue, store.daily.length)} prev={div(store.prev.revenue, store.prevDaily.length)} />}
        </div>
        <div style={{ height: 280, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={revSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, n, item) => [brl(Number(v)), n === 'Loja · período anterior' && item?.payload?.anteriorData ? `${n} (${item.payload.anteriorData})` : n]}
              />
              {store && <Line dataKey="anterior" name="Loja · período anterior" stroke={C.grey} strokeWidth={2} strokeDasharray="5 4" dot={false} />}
              <Line dataKey="midia" name="Atribuída Meta + Google" stroke={C.purple} strokeWidth={2} dot={false} />
              {store && <Line dataKey="loja" name="Loja · período atual" stroke={C.green} strokeWidth={3} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend
          items={[
            ...(store ? [{ label: 'Loja · período atual', color: C.green }, { label: 'Loja · período anterior (tracejado)', color: C.grey }] : []),
            { label: 'Receita atribuída Meta + Google', color: C.purple },
          ]}
        />
      </Card>

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
        <Card title="Dados demográficos (Meta) · compras">
          <div className="split">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={m.age} margin={{ top: 16, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [dec(Number(v)), 'Compras']} cursor={{ fill: '#e3efe9' }} />
                  <Bar dataKey="purchases" fill={C.olive} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Legend items={[{ label: 'Compras por faixa etária', color: C.olive }]} />
            </div>
            <div className="stats">
              <Stat label="Cliques" value={int(m.totals.clicks)} cur={m.totals.clicks} prev={m.prev.clicks} />
              <Stat label="Visitas ao site" value={int(m.totals.landingViews)} cur={m.totals.landingViews} prev={m.prev.landingViews} />
              <Stat label="Compras" value={dec(m.totals.purchases)} cur={m.totals.purchases} prev={m.prev.purchases} />
            </div>
          </div>
        </Card>

        <Card title="Gênero (compras)">
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={m.gender} dataKey="purchases" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                  {m.gender.map((_, i) => (
                    <Cell key={i} fill={PIE[i % PIE.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v) => [`${dec(Number(v))} (${pct((Number(v) / genderTotal) * 100)})`, 'Compras']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend items={m.gender.map((x, i) => ({ label: `${x.name} · ${pct((x.purchases / genderTotal) * 100)}`, color: PIE[i % PIE.length] }))} />
        </Card>

        {/* A Meta não informa compras do site por estado; com a loja ligada, a região mostra os pedidos pagos reais. */}
        {store && store.states.length > 0 ? (
          <Card title="Região · compras na loja">
            <DataTable
              rows={store.states}
              columns={[
                { key: 'r', label: 'Estado', render: (r) => r.name },
                { key: 'p', label: 'Compras', num: true, render: (r) => int(r.orders), value: (r) => r.orders, heat: C.purple },
                { key: 'v', label: 'Faturamento', num: true, render: (r) => brl(r.revenue) },
              ]}
            />
          </Card>
        ) : (
          <Card title="Região (impressões Meta)">
            <DataTable
              rows={m.region}
              columns={[
                { key: 'r', label: 'Estado', render: (r) => r.name },
                { key: 'i', label: 'Impressões', num: true, render: (r) => int(r.impressions), value: (r) => r.impressions, heat: C.purple },
              ]}
            />
          </Card>
        )}
      </div>
    </>
  );
}
