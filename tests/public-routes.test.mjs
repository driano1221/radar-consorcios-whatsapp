import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePortalTpRows, parseSemana7Rss, selectNewPublicItems, fetchPublicRoute,
  readKnownPublicUrls } from '../src/lib/sources/public-routes.mjs';
import { fetchWebScrapers } from '../src/lib/sources/web-scrapers.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { buildWeeklyReport, observeRun } from '../src/lib/history.mjs';

const now = new Date('2026-10-18T12:00:00Z');
const since = new Date('2026-10-10');
const site = { name: 'Semana 7 (RSS público)', adapter: 'semana7-rss', url: 'https://www.semana7.com.br/rss.php',
  discoverFrom: '2026-10-16T15:40:00Z', alertsFrom: '2026-10-16T15:40:00Z', discoveryOnly: true };
const item = { title: 'Consórcio realiza atendimento', url: 'https://www.semana7.com.br/saude/teste/1',
  publishedAt: '2026-10-17T12:00:00Z', rawText: 'Atendimento pelo consórcio.' };
const xml = `<rss><channel><item><title>${item.title}</title><link>${item.url}</link>
  <pubDate>Sat, 17 Oct 2026 08:00:00 -0400</pubDate><description><![CDATA[<p>Texto do consórcio</p>]]></description></item></channel></rss>`;
const doc = { link_documento: 'https://s3.amazonaws.com/el.com.br/portal/uploads/3177/arquivos/1.pdf',
  descricao: 'Decreto: consórcio regional', publicado_em: '2026-10-17T12:26:21.6166667' };

test('RSS público valida estrutura, limpa HTML e não inventa texto completo/UF', () => {
  const [row] = parseSemana7Rss(xml);
  assert.equal(row.rawText, 'Texto do consórcio');
  assert.equal(row.publishedAt, new Date(item.publishedAt).toISOString());
  assert.equal(row.stateCode, undefined);
  assert.equal(row.articleReader, undefined);
  assert.throws(() => parseSemana7Rss('<html>Just a moment...</html>'), /RSS/);
  assert.equal(parseSemana7Rss(xml.replace(item.url, 'https://evil.example/1')).length, 0);
});

test('novas rotas não importam backlog, links conhecidos, duplicatas, temas alheios ou datas inválidas', () => {
  const all = [item, { ...item }, { ...item, url: `${item.url}?utm_source=rss` },
    { ...item, url: `${item.url}2`, publishedAt: '2026-10-15' },
    { ...item, url: `${item.url}3`, publishedAt: 'invalid' },
    { ...item, url: `${item.url}4`, publishedAt: '2027-01-01' },
    { ...item, url: `${item.url}5`, publishedAt: '' },
    { ...item, url: `${item.url}6`, title: 'Futebol', rawText: 'Esporte' }];
  const rows = selectNewPublicItems(all, site, since, new Set(), now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].discoveryOnly, true);
  assert.equal(rows[0].previewOnly, true);
  assert.equal(selectNewPublicItems(all, site, since, new Set([item.url]), now).length, 0);
  assert.throws(() => selectNewPublicItems(all, { ...site, discoverFrom: '' }, since), /marco/);
});

test('PortalTP não atribui CNPJ, entidade consórcio nem data de vigência à ementa', () => {
  const [row] = parsePortalTpRows([doc]);
  assert.equal(row.publishedAt, '2026-10-17T12:26:21-03:00');
  assert.equal(row.eventAt, undefined);
  assert.equal(row.entityName, undefined);
  assert.equal(row.stateCode, 'MG');
  assert.equal(parsePortalTpRows([{ ...doc, link_documento: 'https://evil.example/1.pdf' }]).length, 0);
  assert.throws(() => parsePortalTpRows({ error: true }), /lista válida/);
  assert.throws(() => parsePortalTpRows([{}]), /lista válida/);
});

test('uma aprovação antiga/IA não libera envios de uma rota apenas de descoberta', () => {
  const classification = { category: 'ATUACAO', score: 20, excluded: false };
  const candidate = { ...item, source: site.name, previewOnly: false, catalogDecision: 'confirmado', classification };
  const gated = decidePublication(candidate, { now, sourceActivations: [site] });
  assert.equal(gated.publicationDecision, 'previa');
  assert.equal(gated.catalogDecision, 'confirmado');
  assert.equal(isNotifiable(gated), false);
  assert.equal(isNotifiable({ ...candidate, discoveryOnly: true }), false);
  // Don't suspend an existing independent source on the same hostname.
  assert.equal(decidePublication({ ...candidate, source: 'Outra fonte' }, { now,
    sourceActivations: [site] }).publicationDecision, 'elegivel');
});

test('exportação PortalTP usa somente o formulário público e preserva tokens sem logá-los', async () => {
  const portal = { ...site, name: 'Guanhães Prefeitura (PortalTP)', adapter: 'guanhaes-portaltp',
    url: 'https://guanhaes-mg.portaltp.com.br/api/institucional/api-legislacao.aspx' };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(calls.length === 1 ? '<form action="./api-legislacao.aspx"><input type="hidden" name="__VIEWSTATE" value="test-state"><select name="ctl00$containerCorpo$cbxFormato"><option value="JSON">JSON</option></select></form>' : JSON.stringify([doc]));
  };
  await fetchPublicRoute(portal, since, { knownPublicUrls: new Set() }, fetchImpl);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, portal.url);
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.body.get('__VIEWSTATE'), 'test-state');
  assert.equal(calls[1].options.body.get('ctl00$containerCorpo$cbxFormato'), 'JSON');
  await assert.rejects(() => fetchPublicRoute(portal, since, { knownPublicUrls: new Set() },
    async () => new Response('<html>Verification required</html>')), /formulário/);
});

test('HTTP 403 isola a rota e não é repetido agressivamente', async () => {
  let count = 0;
  const result = await fetchWebScrapers({ enabled: true, sites: [site], knownPublicUrls: new Set() }, since,
    async () => { count++; return new Response('Forbidden', { status: 403 }); });
  assert.equal(count, 1);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].status, 'error');
  assert.equal(result.items.length, 0);
});

test('rota pública repete timeout transitório com limite, sem duplicar a entrada', async () => {
  let calls=0;
  const result=await fetchWebScrapers({enabled:true,sites:[{...site,timeoutMs:25000,retries:1}],knownPublicUrls:new Set()},since,
    async (_url,options)=>{calls++;assert.ok(options.signal);if(calls===1)throw new DOMException('Timeout','TimeoutError');return new Response(xml);});
  assert.equal(calls,2);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].discoveryOnly,true);
});

test('índice de URLs do catálogo inclui originais e URLs resolvidas; não escreve no arquivo', async () => {
  const known = await readKnownPublicUrls(new URL('../data/catalogo/arquivo-coletas.ndjson', import.meta.url));
  assert.ok(known.size > 0);
  await assert.rejects(() => readKnownPublicUrls('does-not-exist.ndjson'), /ENOENT/);
});

test('observação preserva bloqueio da descoberta e resumo semanal não a envia', () => {
  const state = { seen: {} };
  const record = { ...item, discoveryOnly: true, source: site.name,
    classification: { category: 'ATUAÇÃO', score: 20 } };
  observeRun(state, [record], [], 5, new Date('2026-10-17T14:00:00Z'));
  assert.equal(Object.values(state.observations)[0].item.discoveryOnly, true);
  const report = buildWeeklyReport(state, { start: since, end: now });
  assert.equal(report.highlights.length, 0);
});
