// Uso: node scripts/set-env.js CHAVE=valor [CHAVE2=valor2 ...]
// Atualiza (ou adiciona) chaves no .env.local sem imprimir os valores.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '.env.local');
let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];

for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf('=');
  const key = arg.slice(0, i);
  const value = arg.slice(i + 1);
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  console.log(`${key} atualizado`);
}
fs.writeFileSync(file, lines.join('\n'));
