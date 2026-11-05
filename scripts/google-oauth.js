// Gera o GOOGLE_ADS_REFRESH_TOKEN via fluxo OAuth "loopback" (cliente do tipo Desktop).
// Uso: node scripts/google-oauth.js
// Abre o navegador; faça login com uma conta que tenha acesso ao MCC BYB.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');

const envFile = path.join(__dirname, '..', '.env.local');
const env = {};
for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const { GOOGLE_ADS_CLIENT_ID: clientId, GOOGLE_ADS_CLIENT_SECRET: clientSecret } = env;
if (!clientId || !clientSecret) throw new Error('GOOGLE_ADS_CLIENT_ID/SECRET ausentes no .env.local');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (!code && !err) return res.end();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (err) {
    res.end(`<h2>Autorização negada: ${err}</h2>`);
    console.error('Erro:', err);
    return server.close();
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const json = await tokenRes.json();
  if (!json.refresh_token) {
    res.end('<h2>Falhou ao obter o refresh token. Veja o terminal.</h2>');
    console.error('Resposta sem refresh_token:', json.error, json.error_description);
    return server.close();
  }
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith('GOOGLE_ADS_REFRESH_TOKEN='));
  if (idx >= 0) lines[idx] = `GOOGLE_ADS_REFRESH_TOKEN=${json.refresh_token}`;
  else lines.push(`GOOGLE_ADS_REFRESH_TOKEN=${json.refresh_token}`);
  fs.writeFileSync(envFile, lines.join('\n'));
  res.end('<h2 style="font-family:sans-serif;color:#006852">Pronto! Refresh token salvo no .env.local. Pode fechar esta aba.</h2>');
  console.log('OK: GOOGLE_ADS_REFRESH_TOKEN salvo no .env.local');
  server.close();
});

let redirectUri;
server.listen(0, '127.0.0.1', () => {
  redirectUri = `http://127.0.0.1:${server.address().port}`;
  const auth =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/adwords',
      access_type: 'offline',
      prompt: 'consent',
    });
  console.log('Abra no navegador se não abrir sozinho:\n' + auth);
  exec(`start "" "${auth}"`);
});

setTimeout(() => {
  console.error('Tempo esgotado (10 min).');
  process.exit(1);
}, 10 * 60 * 1000);
