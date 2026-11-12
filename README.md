# Dash Haskell

Dashboard de Meta Ads + Google Ads da Haskell Cosméticos (Next.js, deploy na Vercel). O layout foi baseado na dash "Saraiva" do Data Studio e segue a identidade visual de haskellcosmeticos.com.br.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000 e entre com a senha `ADMIN_PASSWORD` do `.env.local`.

## Variáveis de ambiente

Veja `.env.example`. Contas já mapeadas:

| Plataforma | Conta |
| --- | --- |
| Meta Ads | `612696705843205` (Haskell Cosméticos) |
| Google Ads | `5959379905`, acessada via MCC BYB `6363710958` |

Enquanto `META_ACCESS_TOKEN` ou `GOOGLE_ADS_REFRESH_TOKEN` não estiverem válidos, a dash mostra **dados de exemplo** e um aviso no topo explicando o erro.

## Páginas

- **Visão geral**: KPIs somados (investimento, receita, compras, ROAS, CPA, cliques), investimento diário por plataforma, compras e cliques por dia da semana, idade, gênero e região (Meta).
- **Meta Ads**: KPIs com sparkline, funil (impressão → clique → visita → carrinho → checkout → compra), CTR, frequência, CPM, investimento x compras por dia, melhores anúncios e campanhas.
- **Google Ads**: KPIs com sparkline, palavras-chave, série diária, cliques por dispositivo e campanhas.

A **Visão geral** também mostra as vendas reais da loja (Nuvemshop): faturamento, pedidos pagos, ticket médio e quanto a loja vende para cada R$ 1 de mídia. Esses números vêm do resumo diário mantido pelo projeto de conversões da BYB (`LOJA_API_URL` / `LOJA_API_KEY`). Sem essas variáveis, o bloco da loja não aparece e um aviso informa o motivo.

Todas as variações comparam com o período anterior de mesma duração.

## Deploy (Vercel)

1. Suba o repositório no GitHub e importe na Vercel.
2. Cadastre as variáveis do `.env.example` em Settings → Environment Variables.
