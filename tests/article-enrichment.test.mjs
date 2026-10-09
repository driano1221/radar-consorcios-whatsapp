import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichArticle, enrichArticles, extractArticleText, lacksArticleText,
  classifyEnrichedItem } from '../src/lib/article-enrichment.mjs';

test('detecta quando resumo é somente o título', () => {
  assert.equal(lacksArticleText({ title: 'Consórcio abre concurso - Portal', summary: 'Consórcio abre concurso Portal' }), true);
  assert.equal(lacksArticleText({ title: 'Consórcio aprova adesão', summary: 'A assembleia aprovou a adesão do município após votação.' }), true);
  assert.equal(lacksArticleText({ title: 'Consórcio aprova adesão', rawText: 'A assembleia aprovou a adesão do município após votação. '.repeat(3), contentProvenance: 'pagina_original' }), false);
});

test('extrai corpo do artigo sem menus e anúncios', () => {
  const text = extractArticleText(`<nav>Menu</nav><article><h1>Adesão ao consórcio</h1><p>${'O município aprovou o ingresso no consórcio. '.repeat(12)}</p></article>`);
  assert.match(text, /município aprovou o ingresso/);
  assert.doesNotMatch(text, /Menu/);
});

test('preserva o fim de artigos longos para a triagem', () => {
  const body = `<article><p>${'Contexto administrativo sem decisão. '.repeat(160)}</p>` +
    '<p>A Câmara aprovou a participação de Umuarama no Consórcio Nacional Conclima.</p></article>';
  const text = extractArticleText(body);
  assert.ok(text.length > 4000);
  assert.match(text, /Câmara aprovou a participação/);
});

test('resolve Google News e preserva a URL original para deduplicação', async () => {
  const article = { kind: 'news', title: 'Município aprova adesão a consórcio - Portal',
    url: 'https://news.google.com/rss/articles/CBMiABC', summary: 'Município aprova adesão a consórcio Portal' };
  const result = await enrichArticle(article, {
    decode: async () => ({ status: true, decoded_url: 'https://example.org/noticia' }),
    fetchImpl: async () => new Response(`<article>${'Município aprova adesão ao consórcio intermunicipal. '.repeat(12)}</article>`,
      { headers: { 'content-type': 'text/html' } }),
  });
  assert.equal(result.url, article.url);
  assert.equal(result.articleUrl, 'https://example.org/noticia');
  assert.match(result.summary, /aprova adesão/);
  assert.equal(result.contentProvenance, 'pagina_original');
});

test('resumo parcial também dispara leitura integral do artigo', async () => {
  const article = { kind: 'news', title: 'Consórcio de prevenção a desastres',
    url: 'https://example.org/noticia', summary: 'A cidade discute o consórcio de prevenção a desastres.' };
  const fullText = 'A Câmara Municipal aprovou o projeto que ratifica a participação da cidade no consórcio. '.repeat(24);
  const result = await enrichArticle(article, {
    fetchImpl: async () => new Response('<article>Corpo da notícia</article>',
      { headers: { 'content-type': 'text/html' } }),
    readability: () => fullText,
    trafilatura: async () => fullText,
  });
  assert.ok(result.rawText.length > 1600);
  assert.equal(result.contentProvenance, 'pagina_original');
});

test('não substitui título por página bloqueada ou sem conteúdo relevante', async () => {
  const article = { kind: 'news', title: 'Novo consórcio', url: 'https://example.org/noticia', summary: '' };
  const result = await enrichArticle(article, { fetchImpl: async () => new Response('<html><main>Entrar na conta</main></html>',
    { headers: { 'content-type': 'text/html' } }) });
  assert.equal(result, article);
});

test('recuperação informa por que a página não trouxe texto, sem promover o título a prova', async () => {
  const article = { kind: 'news', title: 'Consórcio em pauta', url: 'https://example.org/noticia', summary: '' };
  const reasons = [];
  const result = await enrichArticle(article, {
    fetchImpl: async () => new Response('bloqueado', { status: 403, headers: { 'content-type': 'text/html' } }),
    onFailure: (_, reason) => reasons.push(reason),
  });
  assert.equal(result, article);
  assert.deepEqual(reasons, ['http_403']);
});

test('HTTP 200 com desafio antibot não é confundido com artigo vazio', async () => {
  const article = { kind: 'news', title: 'Consórcio em pauta', url: 'https://example.org/noticia', summary: '' };
  const reasons = [];
  const result = await enrichArticle(article, {
    fetchImpl: async () => new Response('<html><title>Just a moment...</title><body>Checking your browser before accessing</body></html>',
      { headers: { 'content-type': 'text/html' } }),
    onFailure: (_, reason) => reasons.push(reason),
  });
  assert.equal(result, article);
  assert.deepEqual(reasons, ['bloqueio_antibot']);
});

test('limita tentativas por rodada e mantém itens intocados quando falham', async () => {
  const items = Array.from({ length: 4 }, (_, index) => ({ kind: 'news', title: `Consórcio ${index}`,
    url: `https://example.org/${index}`, summary: '' }));
  const result = await enrichArticles(items, { limit: 2, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.attempted, 2);
  assert.equal(result.failed, 2);
  assert.deepEqual(result.items, items);
});

test('mudança de categoria após ler artigo fica em prévia, sem envio automático', () => {
  const original = { kind: 'news', title: 'Municípios discutem cooperação',
    url: 'https://example.org/a', summary: '' };
  const enriched = { ...original, contentProvenance: 'pagina_original',
    summary: 'Município aprova ingresso em consórcio intermunicipal. '.repeat(8),
    rawText: 'Município aprova ingresso em consórcio intermunicipal. '.repeat(8) };
  const classified = classifyEnrichedItem(enriched, original);
  assert.equal(classified.previewOnly, true);
});

test('discordância entre Readability e Trafilatura trava publicação automática', async () => {
  const article = { kind: 'news', title: 'Notícia sobre consórcio público intermunicipal',
    url: 'https://example.org/noticia', summary: '' };
  const result = await enrichArticle(article, {
    fetchImpl: async () => new Response('<article>Consórcio intermunicipal em debate.</article>',
      { headers: { 'content-type': 'text/html' } }),
    readability: () => 'Lei municipal institui o Consórcio Intermunicipal do Vale do Sol. '.repeat(4),
    trafilatura: async () => 'O prefeito questionou a possível criação de um novo consórcio intermunicipal. '.repeat(4),
  });
  assert.equal(result.extractionDisagreement, true);
  assert.equal(result.previewOnly, true);
  assert.equal(result.extractionCategories.readability, 'CRIAÇÃO');
  assert.equal(result.extractionCategories.trafilatura, 'GERAL');
  assert.match(result.reviewReason, /discordaram/);
});

test('recupera URL antiga do TCE-MG, respeita charset e ignora conteúdo fora da notícia', async () => {
  const article = { kind: 'news', title: 'TCE suspende licitação de consórcio',
    url: 'https://www.tce.mg.gov.br/Manchete.html/Noticia/1111629096', summary: '' };
  const body = 'O Tribunal suspendeu preventivamente a licitação do Consórcio Cimcentral. '.repeat(7);
  const html = `<div class="conteudo"><div class="breadcrumb">Menu</div><h1>Licitação suspensa</h1><p>${body}</p></div><aside>${'Outro consórcio irrelevante. '.repeat(100)}</aside>`;
  let requestedUrl = '';
  const result = await enrichArticle(article, {
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(Buffer.from(html, 'latin1'),
        { headers: { 'content-type': 'text/html; charset=iso-8859-1' } });
    },
    readability: () => `${body} ${'Outro consórcio irrelevante. '.repeat(100)}`,
    trafilatura: async () => body,
  });
  assert.equal(requestedUrl, 'https://www.tce.mg.gov.br/noticia/Detalhe/1111629096');
  assert.equal(result.articleReader, 'tce_mg_corpo');
  assert.match(result.rawText, /Cimcentral/);
  assert.doesNotMatch(result.rawText, /Outro consórcio/);
  assert.doesNotMatch(result.rawText, /Menu/);
});
