// Troca o auth_code do TikTok for Business pelo TIKTOK_ACCESS_TOKEN (longo prazo) e salva no .env.local.
// Uso: node scripts/tiktok-token.js <auth_code>
//
// Como conseguir o auth_code:
// 1. No portal de desenvolvedores (business-api.tiktok.com/portal), abra o app da BYB (Marketing API)
//    com as permissões de leitura de relatórios e de anúncios.
// 2. Abra o "Advertiser authorization URL" do app, entre com a conta que gerencia a Haskell e autorize.
// 3. O TikTok redireciona para a URL de retorno do app com ?auth_code=...  Copie esse valor (vale por 1 hora).
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.local');
const env = {};
for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const authCode = process.argv[2];
if (!authCode) throw new Error('Informe o auth_code: node scripts/tiktok-token.js <auth_code>');
if (!env.TIKTOK_APP_ID || !env.TIKTOK_APP_SECRET) throw new Error('TIKTOK_APP_ID/TIKTOK_APP_SECRET ausentes no .env.local');

(async () => {
  const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.TIKTOK_APP_ID, secret: env.TIKTOK_APP_SECRET, auth_code: authCode }),
  });
  const json = await res.json();
  const token = json?.data?.access_token;
  if (json.code !== 0 || !token) {
    console.error('Falhou:', json.message);
    process.exit(1);
  }

  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  const set = (key, value) => {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  };
  set('TIKTOK_ACCESS_TOKEN', token);
  if (!env.TIKTOK_ADVERTISER_ID) set('TIKTOK_ADVERTISER_ID', '7124342994907512833');
  fs.writeFileSync(envFile, lines.join('\n'));

  const ids = json.data.advertiser_ids ?? [];
  console.log('OK: TIKTOK_ACCESS_TOKEN salvo no .env.local');
  console.log(ids.includes('7124342994907512833') ? 'A conta da Haskell está autorizada.' : `Atenção: a conta da Haskell não veio na autorização. Contas: ${ids.join(', ')}`);
})();
