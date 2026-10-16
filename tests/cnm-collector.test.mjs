import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchWebScrapers, parseCnm } from '../src/lib/sources/web-scrapers.mjs';
import { decidePublication } from '../src/lib/publication-gate.mjs';

const site = { name: 'Confederação Nacional de Municípios', adapter: 'cnm',
  url: 'https://cnm.org.br/areas_tecnicas/consorcios/noticias', publish: true, maxArticles: 1 };
const row = (slug = 'noticia-consorcios') => ({slug, titulo: 'Orientação sobre consórcios públicos',
  datetime: '13/10/2026', conteudo: '<p>Resumo cortado…</p>'});
const html = page => `<div id="app" data-page='${JSON.stringify(page).replace(/'/g, '&#39;')}'></div>`;
const index = rows => html({props: {dados: {data: rows}}});
const article = html({component: 'Portal/Comunicacao/Noticia', url: '/comunicacao/noticias/noticia-consorcios',
  props: {noticia: { ...row(), id: 1, conteudo: '<p>Orientação institucional aplicável aos consórcios públicos. Este texto completo esclarece o alcance da orientação, sem inventar uma entidade específica nem uma adesão municipal.</p>'}}});
const response = (body, status = 200) => new Response(body, {status, headers: {'content-type': 'text/html'}});
const config = {enabled: true, timeoutMs: 100, retries: 0, sites: [site]};
const since = new Date('2026-10-01');

test('CNM listagem não finge íntegra e rejeita slug fora da rota', () => {
  const rows = parseCnm(index([row(), row('../outro')]), site, since);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rawText, '');
  assert.equal(rows[0].summary, 'Resumo cortado…');
  assert.equal(rows[0].contentProvenance, 'resumo_listagem');
});
test('CNM coletor lê íntegra e data original antes de liberar prévia', async () => {
  const result = await fetchWebScrapers(config, since, async url => response(url === site.url ? index([row()]) : article));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].articleReader, 'cnm_inertia_publica');
  assert.equal(result.items[0].contentProvenance, 'pagina_original');
  assert.equal(result.items[0].sourcePublishedAt, '2026-10-13');
  assert.equal(result.items[0].previewOnly, false);
  assert.equal(result.items[0].entityName, undefined);
});
test('CNM bloqueio não transforma resumo em íntegra nem libera envio', async () => {
  const result = await fetchWebScrapers(config, since, async url => response(url === site.url ? index([row()]) : 'Forbidden', url === site.url ? 200 : 403));
  assert.equal(result.items[0].previewOnly, true);
  assert.equal(result.items[0].rawText, '');
  assert.match(result.items[0].extractionError, /403/);
  assert.equal(result.diagnostics[0].status, 'degraded');
});
test('CNM limita leituras e mantém excedente sem envio', async () => {
  let articles = 0;
  const result = await fetchWebScrapers(config, since, async url => {
    if (url === site.url) return response(index([row(), row('outra-noticia')]));
    articles++; return response(article);
  });
  assert.equal(articles, 1);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1].previewOnly, true);
});
test('ativação CNM não libera acervo antigo nem data desconhecida do Google', async () => {
  const cfg = JSON.parse(await readFile(new URL('../config/default.json', import.meta.url)));
  const activation = cfg.webScrapers.sites.find(s => s.adapter === 'cnm');
  // Direct index remains disabled after a real runner 403. Its gate also
  // protects CNM URLs discovered through Google News.
  assert.equal(activation.enabled, false);
  const classification = {category: 'GOVERNANÇA', score: 12, publicContext: true};
  const options = {now: new Date('2026-10-18T12:00:00Z'), sourceActivations: [activation]};
  const old = {url: 'https://cnm.org.br/comunicacao/noticias/noticia-consorcios',
    source: site.name, sourcePublishedAt: '2026-10-13', classification};
  assert.equal(decidePublication(old, options).publicationDecision, 'historico');
  assert.equal(decidePublication({...old, sourcePublishedAt: '', url: 'https://news.google.com/rss/articles/id'}, options).publicationDecision, 'data_nao_verificada');
  assert.equal(decidePublication({...old, sourcePublishedAt: '2026-10-18'}, options).publicationDecision, 'elegivel');
});
