import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBrazilianDate,
  parseCnm,
  parseDiarioMunicipalIndex,
  parseRncp,
  parseTceMg,
  parseTcePrHome,
  parseAmmMtIndex,
  fetchWebScrapers,
} from '../src/lib/sources/web-scrapers.mjs';

const since = new Date('2026-08-13T00:00:00Z');

test('converte data brasileira sem deslocar o dia', () => {
  assert.equal(parseBrazilianDate('17/08/2026'), '2026-08-17T15:00:00.000Z');
  assert.equal(parseBrazilianDate('02/10/26'), '2026-10-02T15:00:00.000Z');
  assert.equal(parseBrazilianDate('sem data'), null);
});

test('extrai índice AMM-MT com link para próxima página', () => {
  const html = `<ol id="publications-list"><li><a href="/publicacao/1919144/">
    <div class="publication-title">LEI MUNICIPAL Nº 1193/2026</div>
    <div class="entity-title">Consórcio Portal do Araguaia</div>
    <span class="date">02/10/26</span></a></li></ol>
    <a href="/publicacoes/?sa=next">Próxima Página</a>`;
  const result = parseAmmMtIndex(html,
    { name: 'AMM-MT', url: 'https://amm.diariomunicipal.org/publicacoes/' }, since);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].url, 'https://amm.diariomunicipal.org/publicacao/1919144/');
  assert.equal(result.items[0].stateCode, 'MT');
  assert.equal(result.nextUrl, 'https://amm.diariomunicipal.org/publicacoes/?sa=next');
});

test('extrai manchetes TCE-PR com data e URL próprios', () => {
  const html = `<a class="home-latest-news__card" href="noticias/decisao.htm">
    <h3 class="home-latest-news__card-title">TCE decide sobre consórcio</h3>
    <time datetime="02/10/2026 14:00">2 de outubro</time></a>`;
  const items = parseTcePrHome(html, { name: 'TCE-PR', url: 'https://www.tce.pr.gov.br/' }, since);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://www.tce.pr.gov.br/noticias/decisao.htm');
});

test('AMM-MT enriquece texto do ato mas mantém publicação em prévia', async () => {
  const index = `<ol id="publications-list"><li><a href="/publicacao/1919144/">
    <div class="publication-title">LEI MUNICIPAL Nº 1193/2026</div>
    <div class="entity-title">Consórcio Portal do Araguaia</div>
    <span class="date">02/10/26</span></a></li></ol>`;
  const article = `<div id="publication-text"><p>Ratifica o Estatuto Consolidado do Consórcio Intermunicipal CIDESAPA e altera o contrato de consórcio público.</p></div>`;
  const result = await fetchWebScrapers({ enabled: true, timeoutMs: 1000, retries: 0,
    sites: [{ name: 'AMM-MT', adapter: 'amm-mt', url: 'https://amm.diariomunicipal.org/publicacoes/', publish: false }] },
  since, async (url) => new Response(url.includes('/publicacao/') ? article : index, { status: 200 }));
  assert.equal(result.items.length, 1);
  assert.match(result.items[0].rawText, /Ratifica o Estatuto/);
  assert.equal(result.items[0].previewOnly, true);
  assert.equal(result.diagnostics[0].status, 'ok');
});

test('AMM-MT usa corpo article quando o seletor específico mudou', async () => {
  const index = '<ol id="publications-list"><li><a href="/publicacao/1/"><div class="publication-title">LEI MUNICIPAL Nº 10/2026</div><div class="entity-title">Consórcio</div><span class="date">02/10/26</span></a></li></ol>';
  const article = '<article><nav>Menu irrelevante</nav><p>Ratifica o protocolo de intenções do Consórcio Intermunicipal e autoriza participação do município.</p></article>';
  const result = await fetchWebScrapers({ enabled: true, timeoutMs: 1000, retries: 0,
    sites: [{ name: 'AMM-MT', adapter: 'amm-mt', url: 'https://amm.diariomunicipal.org/publicacoes/', publish: false }] },
  since, async (url) => new Response(url.includes('/publicacao/') ? article : index));
  assert.match(result.items[0].rawText, /Ratifica o protocolo/);
  assert.doesNotMatch(result.items[0].rawText, /Menu irrelevante/);
  assert.equal(result.diagnostics[0].status, 'ok');
});

test('extrai cards de noticias da RNCP', () => {
  const html = `<div class="post-item">
    <span class="post-date updated">14/08/2026</span>
    <h2 class="entry-title"><a href="noticia/novo-consorcio/123">Novo consorcio publico e criado</a></h2>
  </div>`;
  const items = parseRncp(html, { name: 'RNCP', url: 'https://www.rncp.org.br/noticias' }, since);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://www.rncp.org.br/noticia/novo-consorcio/123');
});

test('extrai dados estruturados da pagina da CNM', () => {
  const page = JSON.stringify({ props: { dados: { data: [{
    titulo: 'Municipio passa a integrar consorcio publico',
    slug: 'municipio-integra-consorcio',
    datetime: '16/08/2026',
    conteudo: 'A adesao foi aprovada pelos municipios.',
  }] } } });
  const html = `<div id="app" data-page='${page}'></div>`;
  const items = parseCnm(html, { name: 'CNM', url: 'https://cnm.org.br/' }, since);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://cnm.org.br/comunicacao/noticias/municipio-integra-consorcio');
});

test('extrai noticias e resumo do TCE-MG', () => {
  const html = `<h2><span class="data-noticia-internas">15/08/2026 - </span>
    <a href="/TCE-fiscaliza-consorcio.html/Noticia/111">TCE fiscaliza consorcio intermunicipal</a></h2>
    <p><a href="/TCE-fiscaliza-consorcio.html/Noticia/111">Auditoria encontrou irregularidade.</a></p>`;
  const items = parseTceMg(html, { name: 'TCE-MG', url: 'https://www.tce.mg.gov.br/noticia' }, since);
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, 'Auditoria encontrou irregularidade.');
  assert.equal(items[0].sourceUrl, 'https://www.tce.mg.gov.br/noticia');
});

test('monitora o indice do Diario Municipal sem tratar a edicao como noticia', () => {
  const html = `<input id="urlPdf" value="https://storage.exemplo/edicao.pdf">
    <figure id="ultima-edicao"><span>17/08/2026</span></figure>`;
  const items = parseDiarioMunicipalIndex(
    html,
    { name: 'Diario Municipal AMM-MG', url: 'https://www.diariomunicipal.com.br/amm-mg/' },
    since,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'gazette-index');
});

test('isola falha de portal e mantem todos os itens do scraper em previa', async () => {
  const html = `<div class="post-item">
    <span class="post-date updated">14/08/2026</span>
    <h2 class="entry-title"><a href="noticia/adesao/1">Municipio adere ao consorcio publico</a></h2>
  </div>`;
  const config = {
    enabled: true,
    publish: false,
    timeoutMs: 1000,
    retries: 0,
    sites: [
      {
        name: 'Portal saudavel',
        adapter: 'rncp',
        url: 'https://saudavel.exemplo/noticias',
        publish: true,
      },
      { name: 'Portal indisponivel', adapter: 'rncp', url: 'https://erro.exemplo/noticias' },
    ],
  };
  const fetchImpl = async (url) =>
    url.includes('erro.exemplo')
      ? new Response('erro', { status: 503 })
      : new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

  const result = await fetchWebScrapers(config, since, fetchImpl);
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].previewOnly, false);
  assert.deepEqual(result.diagnostics.map((entry) => entry.status), ['ok', 'error']);
});

test('sinaliza quando todos os portais falham', async () => {
  const result = await fetchWebScrapers(
    {
      enabled: true,
      publish: false,
      timeoutMs: 1000,
      retries: 0,
      sites: [{ name: 'Portal alterado', adapter: 'rncp', url: 'https://alterado.exemplo/' }],
    },
    since,
    async () => new Response('<html></html>', { status: 200 }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.items.length, 0);
  assert.equal(result.diagnostics[0].status, 'error');
  assert.match(result.diagnostics[0].message, /post-item/);
});

test('nao requisita portal desativado e informa a cobertura alternativa', async () => {
  let requests = 0;
  const result = await fetchWebScrapers(
    {
      enabled: true,
      publish: false,
      sites: [{
        name: 'Portal bloqueado no Actions',
        adapter: 'rncp',
        url: 'https://bloqueado.exemplo/',
        enabled: false,
        fallback: 'Google News',
      }],
    },
    since,
    async () => {
      requests += 1;
      return new Response('nao deveria ser chamado');
    },
  );
  assert.equal(requests, 0);
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics[0].status, 'disabled');
  assert.match(result.diagnostics[0].message, /Google News/);
});
