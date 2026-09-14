import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSaplNorm, fetchSapl } from '../src/lib/sources/sapl.mjs';
import { parseTceSp, parseCisamapi } from '../src/lib/sources/web-scrapers.mjs';
import { parseFeed, fetchRssFeeds } from '../src/lib/sources/rss-feeds.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { formatWhatsAppMessage } from '../src/lib/format.mjs';
import { fetchQueridoDiario } from '../src/lib/sources/querido-diario.mjs';

test('TCE-SP usa data da notícia, sem misturar o clipping lateral', () => {
  const html = '<div class="listagem-noticia"><div class="field--item"><h2><a href="/auditoria">Consórcio público fiscalizado</a></h2></div><div class="field--item">12/09/2026 – Tribunal apura irregularidades.</div></div><aside><time>14/09/2026</time></aside>';
  const items = parseTceSp(html, { url: 'https://www.tce.sp.gov.br/noticias', name: 'TCE-SP' }, new Date('2026-09-01'));
  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt, '2026-09-12T15:00:00.000Z');
  assert.equal(items[0].url, 'https://www.tce.sp.gov.br/auditoria');
  assert.throws(() => parseTceSp('<html>layout mudou</html>', {}, new Date()), /não encontrada/);
});

test('CISAMAPI extrai data da URL, não da data da raspagem', () => {
  const html = '<div class="news-post-txt"><h2><a href="/noticia/geral/04-09-2026/5742/eleicao">Cisamapi elege presidência</a></h2></div>';
  const items = parseCisamapi(html, { url: 'https://www.cisamapi.mg.gov.br/noticias', name: 'CISAMAPI' }, new Date('2026-09-01'));
  assert.equal(items[0].publishedAt, '2026-09-04T15:00:00.000Z');
});

test('SAPL usa publicação da norma e descarta metadados de usuários da API', () => {
  const item = parseSaplNorm({ id: 1, __str__: 'Lei nº 1', data: '2026-08-01', data_publicacao: '2026-09-10', ementa: 'Ratifica alteração do estatuto do consórcio público.', ip: 'interno', user: 99 },
    { url: 'https://sapl.exemplo.leg.br', name: 'SAPL', municipality: 'Exemplo', publish: true }, new Date('2026-09-01'), new Date('2026-09-15'));
  assert.equal(item.publishedAt, '2026-09-10T12:00:00-03:00');
  assert.equal(item.kind, 'legislation');
  assert.equal(item.ip, undefined);
  assert.equal(item.user, undefined);
  assert.equal(item.url, 'https://sapl.exemplo.leg.br/norma/1');
});

test('SAPL sinaliza paginação limitada e isola portal indisponível', async () => {
  const result = await fetchSapl({ enabled: true, maxPages: 1, sites: [
    { name: 'Saudável', url: 'https://ok.leg.br' }, { name: 'Falha', url: 'https://fail.leg.br' },
  ] }, new Date(), async (url) => String(url).includes('fail.') ? new Response('', { status: 503 }) : Response.json({ results: [], pagination: { next_page: 2 } }));
  assert.equal(result.degraded, true);
  assert.equal(result.diagnostics[0].status, 'degraded');
  assert.equal(result.diagnostics[1].status, 'error');
});

test('RSS rejeita HTML 200 e prioriza texto integral em vez de teaser', async () => {
  assert.throws(() => parseFeed('<html>captcha</html>', {}, new Date()), /RSS/);
  const xml = '<rss><channel><item><title>Notícia &#8211; nova</title><link>https://exemplo.gov.br/1</link><pubDate>Thu, 10 Sep 2026 15:00:00 GMT</pubDate><description>Resumo cortado...</description><content:encoded><![CDATA[Texto completo da notícia, sem corte.]]></content:encoded></item></channel></rss>';
  const result = await fetchRssFeeds({ enabled: true, retries: 0, feeds: [{ name: 'OK', url: 'https://ok.gov.br' }, { name: 'Erro', url: 'https://bad.gov.br' }] }, new Date('2026-09-01'), async (url) => new Response(String(url).includes('bad.') ? '<html>captcha</html>' : xml));
  assert.equal(result.items[0].title, 'Notícia – nova');
  assert.match(result.items[0].summary, /^Texto completo/);
  assert.equal(result.degraded, true);
});

test('reconhece plural público, mas podcast não vira fiscalização', () => {
  const result = classifyItem({ title: 'PodContas debate o papel dos Consórcios Públicos na gestão municipal', summary: 'Tribunal de Contas entrevista especialista em consórcios públicos.' });
  assert.equal(result.publicContext, true);
  assert.equal(result.category, 'GERAL');
});

test('convocação de assembleia sem decisão não vira notícia de governança', () => {
  const c = classifyItem({ title: 'Consórcio intermunicipal convoca municípios para assembleia', summary: 'O encontro ocorrerá na próxima semana.' });
  assert.equal(c.category, 'GERAL');
});

test('sigla de entidade validada permite reconhecer eleição real', () => {
  const c = classifyItem({ title: 'Cisamapi elege nova Presidência para 2027/2028', summary: 'O CISAMAPI realizou assembleia para eleição. Foram eleitos os novos dirigentes.', entityAlias: 'CISAMAPI', entityName: 'Consórcio Intermunicipal de Saúde da Microrregião do Vale do Piranga' });
  assert.equal(c.category, 'GOVERNANÇA');
});

test('resumo não repete manchete quando a fonte só fornece o título', () => {
  const title = 'Consórcio público recebe novos municípios';
  const message = formatWhatsAppMessage({ title, summary: title, source: 'Portal', url: 'https://exemplo.gov.br/1', publishedAt: '2026-09-10' });
  assert.equal(message.split(title).length - 1, 1);
});

test('caso real de suspensão do Ciminas continua reconhecido como controle', () => {
  const c = classifyItem({ title: 'Irregularidades suspendem credenciamento de consórcio para contratação de empresas de assessoria ambiental', summary: 'O Tribunal de Contas referendou a suspensão do credenciamento promovido pelo Consórcio Interfederativo Minas Gerais (Ciminas).', sourceUrl: 'https://www.tce.mg.gov.br' });
  assert.equal(c.category, 'CONTROLE');
});

test('suspensão de seleção de pessoal não vira fiscalização de consórcio', () => {
  const c = classifyItem({ title: 'Consórcio Intermunicipal de Saúde suspende processo seletivo 01/2026', summary: 'Inscrições abertas para candidatos.' });
  assert.equal(c.category, 'GERAL');
});

test('Querido Diário usa endereço atual e sinaliza falha parcial e página cheia', async () => {
  const urls = [];
  const result = await fetchQueridoDiario({ enabled: true, pageSize: 1, retries: 0, queryGroups: [['consórcio'], ['rateio']] }, new Date('2026-09-01'), async (url) => {
    urls.push(url);
    return url.includes('rateio') ? new Response('', { status: 503 }) : Response.json({ gazettes: [{ url: 'https://exemplo.gov.br/ato.pdf', territory_name: 'Exemplo', date: '2026-09-10', excerpts: ['consórcio intermunicipal'] }] });
  });
  assert.ok(urls.every((url) => url.startsWith('https://queridodiario.ok.org.br/api/gazettes?')));
  assert.equal(result.items.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.degraded, true);
  assert.equal(result.diagnostics[0].status, 'degraded');
  assert.equal(result.diagnostics[1].status, 'error');
});

test('Querido Diário não mascara HTML ou JSON inesperado como coleta vazia saudável', async () => {
  const result = await fetchQueridoDiario({ enabled: true, retries: 0, queryGroups: [['consórcio']] }, new Date(), async () => Response.json({ error: 'unavailable' }));
  assert.equal(result.ok, false);
  assert.equal(result.items.length, 0);
});

test('demonstrativos contábeis não viram novo contrato de rateio', () => {
  for (const summary of [
    'Demonstrativo da Despesa com Pessoal — Consórcios Públicos. VALORES TRANSFERIDOS POR CONTRATO DE RATEIO. Despesa Total com Pessoal — DTP.',
    'FINANCIAMENTO. RATEIO DO CONSORCIO INTERMUNICIPAL CULTURANDO SUBVENÇÃO SOCIAL — EXECUÇÃO DOS SERVIÇOS.',
  ]) assert.equal(classifyItem({ kind: 'gazette', title: 'Diário Oficial', summary }).category, 'GERAL');
});

test('proposta de ingresso não é apresentada como adesão efetivada nem inventa sigla', () => {
  const message = formatWhatsAppMessage({ kind: 'gazette', territoryName: 'Valinhos', title: 'Diário Oficial de Valinhos', summary: 'Aprovação da Proposta de Ingresso do Município de Valinhos no Consórcio Intermunicipal do SAMU Regional Hortolândia/Sumaré. Atribuições le- gais conferidas.', publishedAt: '2026-09-11', url: 'https://exemplo.gov.br/ato.pdf', source: 'Querido Diário', classification: { category: 'ADESÃO', emoji: '🟦' } });
  assert.match(message, /publica proposta de adesão/);
  assert.match(message, /não comprova/);
  assert.doesNotMatch(message, /GAIS|autoriza Valinhos/);
});
