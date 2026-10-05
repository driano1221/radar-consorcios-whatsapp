import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichArticle, enrichArticles, extractArticleText, lacksArticleText,
  classifyEnrichedItem } from '../src/lib/article-enrichment.mjs';

test('detecta quando resumo é somente o título', () => {
  assert.equal(lacksArticleText({ title: 'Consórcio abre concurso - Portal', summary: 'Consórcio abre concurso Portal' }), true);
  assert.equal(lacksArticleText({ title: 'Consórcio aprova adesão', summary: 'A assembleia aprovou a adesão do município após votação.' }), false);
});

test('extrai corpo do artigo sem menus e anúncios', () => {
  const text = extractArticleText(`<nav>Menu</nav><article><h1>Adesão ao consórcio</h1><p>${'O município aprovou o ingresso no consórcio. '.repeat(12)}</p></article>`);
  assert.match(text, /município aprovou o ingresso/);
  assert.doesNotMatch(text, /Menu/);
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

test('não substitui título por página bloqueada ou sem conteúdo relevante', async () => {
  const article = { kind: 'news', title: 'Novo consórcio', url: 'https://example.org/noticia', summary: '' };
  const result = await enrichArticle(article, { fetchImpl: async () => new Response('<html><main>Entrar na conta</main></html>',
    { headers: { 'content-type': 'text/html' } }) });
  assert.equal(result, article);
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
