'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DashboardResponse, DateRange } from '@/lib/types';
import { longDate } from '@/lib/format';
import Overview from '@/components/Overview';
import MetaView from '@/components/MetaView';
import GoogleView from '@/components/GoogleView';

type Tab = 'overview' | 'meta' | 'google';
const TABS: { id: Tab; label: string; title: string }[] = [
  { id: 'overview', label: 'Visão geral', title: 'Meta Ads + Google Ads' },
  { id: 'meta', label: 'Meta Ads', title: 'Meta Ads' },
  { id: 'google', label: 'Google Ads', title: 'Google Ads' },
];

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

function preset(id: string): DateRange {
  const today = new Date();
  const back = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  switch (id) {
    case 'today':
      return { start: iso(today), end: iso(today) };
    case '14':
      return { start: iso(back(14)), end: iso(back(1)) };
    case '30':
      return { start: iso(back(30)), end: iso(back(1)) };
    case 'month':
      return { start: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end: iso(today) };
    case 'lastmonth':
      return { start: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), end: iso(new Date(today.getFullYear(), today.getMonth(), 0)) };
    default:
      return { start: iso(back(7)), end: iso(back(1)) };
  }
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [presetId, setPresetId] = useState('7');
  const [range, setRange] = useState<DateRange>(() => preset('7'));
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (r: DateRange, refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/dashboard?start=${r.start}&end=${r.end}${refresh ? '&refresh=1' : ''}`);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  function choosePreset(id: string) {
    setPresetId(id);
    if (id !== 'custom') setRange(preset(id));
  }

  async function logout() {
    await fetch('/api/login', { method: 'DELETE' });
    window.location.href = '/login';
  }

  const current = TABS.find((t) => t.id === tab)!;
  const mockSources = data ? [data.meta.mock && 'Meta Ads', data.google.mock && 'Google Ads'].filter(Boolean) : [];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <img src="/haskell-logo.webp" alt="Haskell Cosméticos" />
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="foot">
          {data && <>Atualizado em {new Date(data.updatedAt).toLocaleString('pt-BR')}<br /></>}
          <button onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{current.title}</h1>
            <div className="sub">
              Relatório de marketing | <b>Haskell Cosméticos</b>
              {data && <> · comparando com {longDate(data.prevRange.start)} – {longDate(data.prevRange.end)}</>}
            </div>
          </div>
          <div className="filters">
            <select value={presetId} onChange={(e) => choosePreset(e.target.value)} aria-label="Período">
              <option value="today">Hoje</option>
              <option value="7">Últimos 7 dias</option>
              <option value="14">Últimos 14 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="month">Este mês</option>
              <option value="lastmonth">Mês passado</option>
              <option value="custom">Personalizado</option>
            </select>
            <input type="date" value={range.start} max={range.end} aria-label="Data inicial" onChange={(e) => { setPresetId('custom'); setRange({ ...range, start: e.target.value }); }} />
            <input type="date" value={range.end} min={range.start} aria-label="Data final" onChange={(e) => { setPresetId('custom'); setRange({ ...range, end: e.target.value }); }} />
            <button className="btn" onClick={() => load(range, true)} disabled={loading}>
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </header>

        {error && <div className="banner">Erro: {error}</div>}
        {mockSources.length > 0 && (
          <div className="banner">
            <b>Dados de exemplo em {mockSources.join(' e ')}.</b> As credenciais ainda não estão configuradas ou falharam
            {data?.meta.error && <><br />Meta: {data.meta.error}</>}
            {data?.google.error && <><br />Google: {data.google.error}</>}
          </div>
        )}
        {data?.store?.error && <div className="banner">Dados da loja indisponíveis. {data.store.error}</div>}

        {data ? (
          <div className={loading ? 'loading' : ''}>
            {tab === 'overview' && <Overview d={data} />}
            {tab === 'meta' && <MetaView m={data.meta.data} />}
            {tab === 'google' && <GoogleView g={data.google.data} />}
          </div>
        ) : (
          !error && <div className="empty">Carregando dados…</div>
        )}
      </main>
    </div>
  );
}
