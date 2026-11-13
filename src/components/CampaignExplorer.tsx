'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CampaignRow, MetaAd, Totals } from '@/lib/types';
import { brl, dec, div, int, pct, roas } from '@/lib/format';
import { C, Card, Column, DataTable } from './ui';

/** Colunas de métricas usadas tanto na tabela de campanhas quanto na de anúncios. */
export function metricColumns<T extends Totals>(accent: string = C.purple): Column<T>[] {
  return [
    { key: 's', label: 'Investimento', num: true, render: (r) => brl(r.spend), value: (r) => r.spend, heat: accent },
    { key: 'i', label: 'Impressões', num: true, render: (r) => int(r.impressions), value: (r) => r.impressions },
    { key: 'c', label: 'Cliques', num: true, render: (r) => int(r.clicks), value: (r) => r.clicks },
    { key: 'ctr', label: 'CTR', num: true, render: (r) => pct(div(r.clicks, r.impressions) * 100), value: (r) => div(r.clicks, r.impressions) },
    { key: 'p', label: 'Compras', num: true, render: (r) => dec(r.purchases), value: (r) => r.purchases, heat: C.green },
    // Sem compras não há CPA: mostra "—" e fica sempre no fim ao ordenar
    {
      key: 'cpa',
      label: 'CPA',
      num: true,
      lowerIsBetter: true,
      render: (r) => (r.purchases ? brl(r.spend / r.purchases) : '—'),
      value: (r) => (r.purchases ? r.spend / r.purchases : Infinity),
    },
    { key: 'rv', label: 'Receita', num: true, render: (r) => brl(r.revenue), value: (r) => r.revenue },
    { key: 'ro', label: 'ROAS', num: true, render: (r) => roas(div(r.revenue, r.spend)), value: (r) => div(r.revenue, r.spend), heat: C.olive },
  ];
}

/**
 * Melhores anúncios + tabela de campanhas. Clicar numa campanha abre a tabela com os anúncios dela.
 * `ads` deve vir ordenado do melhor para o pior e com `campaignId` preenchido.
 */
export default function CampaignExplorer({
  campaigns,
  ads,
  accent = C.purple,
  thumbLabel = 'Abrir a imagem em tamanho maior',
}: {
  campaigns: CampaignRow[];
  ads: MetaAd[];
  accent?: string;
  thumbLabel?: string;
}) {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const adsRef = useRef<HTMLDivElement>(null);
  const campaign = campaigns.find((c) => c.id && c.id === campaignId);
  const campaignAds = useMemo(() => ads.filter((a) => a.campaignId === campaignId), [ads, campaignId]);

  const openCampaign = (id: string | null) => {
    setCampaignId(id);
    if (id) requestAnimationFrame(() => adsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Fecha o detalhe se a campanha sumir ao trocar o período
  useEffect(() => {
    if (campaignId && !campaigns.some((c) => c.id === campaignId)) setCampaignId(null);
  }, [campaigns, campaignId]);

  return (
    <>
      <div className="row r-meta-2">
        <Card title="Melhores anúncios">
          {ads.length ? (
            <div className="ads best">
              {ads.slice(0, 6).map((a) => (
                <div className="ad" key={a.id}>
                  <div className="thumb">
                    {a.thumbnail ? (
                      <a href={a.thumbnail} target="_blank" rel="noreferrer" title={thumbLabel}>
                        <img src={a.thumbnail} alt={a.name} loading="lazy" />
                      </a>
                    ) : (
                      'Sem prévia'
                    )}
                  </div>
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
          <p className="hint">Clique em uma campanha para ver os anúncios dela. Clique no título de uma coluna para ordenar.</p>
          <DataTable
            rows={campaigns}
            sortable
            onRowClick={(r) => openCampaign(r.id && r.id === campaignId ? null : r.id ?? null)}
            isSelected={(r) => !!r.id && r.id === campaignId}
            columns={[{ key: 'n', label: 'Campanha', render: (r) => r.name, sort: (r) => r.name }, ...metricColumns<CampaignRow>(accent)]}
          />
        </Card>
      </div>

      {campaign && (
        <div ref={adsRef} className="row">
          <Card title={`Anúncios da campanha (${campaignAds.length})`}>
            <div className="filter-chip">
              <b title={campaign.name}>{campaign.name}</b>
              <button type="button" onClick={() => setCampaignId(null)}>
                Fechar ✕
              </button>
            </div>
            <DataTable
              rows={campaignAds}
              sortable
              empty="Nenhum anúncio com veiculação nesta campanha no período"
              columns={[
                {
                  key: 'img',
                  label: '',
                  cls: 'thumb-cell',
                  render: (a) => (a.thumbnail ? <img src={a.thumbnail} alt="" loading="lazy" /> : <span className="no-thumb">—</span>),
                },
                { key: 'n', label: 'Anúncio', cls: 'name', render: (a) => a.name, sort: (a) => a.name },
                ...metricColumns<MetaAd>(accent),
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}
