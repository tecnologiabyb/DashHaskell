'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { delta, pct } from '@/lib/format';

export const C = {
  green: '#006852',
  greenDark: '#044a3b',
  olive: '#7b9c49',
  purple: '#9a4096',
  mint: '#5fa88f',
  lilac: '#d59bd2',
  grey: '#b9b9c0',
};
export const PIE = [C.purple, C.green, C.olive, C.lilac, C.mint, C.grey];

export const axis = { fontSize: 11, fill: '#6b6b72' };
export const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: '1px solid #e3e3e7', fontSize: 12, fontFamily: 'inherit' },
  labelStyle: { fontWeight: 700, color: '#044a3b' },
};

/** Variação vs período anterior. `invert` = métrica onde subir é ruim (CPA, CPC). */
export function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  const d = delta(cur, prev);
  if (d === null) return <span className="delta flat">— sem base anterior</span>;
  const good = invert ? d < 0 : d > 0;
  const cls = Math.abs(d) < 0.05 ? 'flat' : good ? 'up' : 'down';
  return (
    <span className={`delta ${cls}`}>
      {d > 0 ? '▲' : d < 0 ? '▼' : '•'} {pct(Math.abs(d))}
      <span className="prev">vs anterior</span>
    </span>
  );
}

interface KpiProps {
  label: string;
  value: string;
  cur: number;
  prev: number;
  color: string;
  invert?: boolean;
  spark?: number[];
}

/** Card de KPI: barra mostra o atual vs. anterior (marca = período anterior), ou sparkline diária. */
export function Kpi({ label, value, cur, prev, color, invert, spark }: KpiProps) {
  const max = Math.max(cur, prev) || 1;
  const gid = `g-${label.normalize('NFD').replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value" title={value}>{value}</div>
      <Delta cur={cur} prev={prev} invert={invert} />
      {spark ? (
        <div className="spark">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bar" aria-hidden>
          <div className="fill" style={{ width: `${(cur / max) * 100}%`, background: color }} />
          {prev > 0 && <div className="mark" style={{ left: `calc(${(prev / max) * 100}% - 1px)` }} />}
        </div>
      )}
    </div>
  );
}

export function Stat({ label, value, cur, prev, invert }: { label: string; value: string; cur?: number; prev?: number; invert?: boolean }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {cur !== undefined && prev !== undefined && <Delta cur={cur} prev={prev} invert={invert} />}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <h3>
          <span className="dot" />
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  value?: (row: T) => number;
  num?: boolean;
  heat?: string; // cor da barra de calor
}

export function DataTable<T>({ rows, columns, empty = 'Sem dados no período' }: { rows: T[]; columns: Column<T>[]; empty?: string }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  const max: Record<string, number> = {};
  for (const c of columns) if (c.heat && c.value) max[c.key] = Math.max(...rows.map(c.value)) || 1;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.num ? 'num' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c, j) => (
                <td key={c.key} className={[c.num ? 'num' : '', j === 0 ? 'name' : '', c.heat ? 'heat' : ''].join(' ')}>
                  {c.heat && c.value ? (
                    <>
                      <span className="bg" style={{ width: `calc(${(c.value(r) / max[c.key]) * 100}% - 8px)`, background: c.heat }} />
                      <span className="v">{c.render(r)}</span>
                    </>
                  ) : (
                    c.render(r)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
