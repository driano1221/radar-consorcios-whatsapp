import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard', 'dist');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/redesign.css', ['redesign.css', 'text/css; charset=utf-8']],
  ['/xp.css', ['xp.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/triage-model.mjs', ['triage-model.mjs', 'text/javascript; charset=utf-8']],
  ['/data.json', ['data.json', 'application/json; charset=utf-8']],
]);
const port = Number(process.env.DASHBOARD_PORT || 4173);
createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = files.get(route);
  if (!file) { response.writeHead(404); response.end('Não encontrado'); return; }
  try {
    const body = await readFile(path.join(root, file[0]));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'" });
    response.end(body);
  } catch { response.writeHead(404); response.end('Execute npm run dashboard:build primeiro.'); }
}).listen(port, '127.0.0.1', () => {
  console.log(`[painel] http://127.0.0.1:${port}/ (somente neste computador)`);
});
