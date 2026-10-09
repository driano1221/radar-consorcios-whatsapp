import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcePublicationDate } from '../src/lib/publication-date.mjs';
import { decidePublication, isNotifiable, publicationDate } from '../src/lib/publication-gate.mjs';
import { reclassifyPending, itemId } from '../src/lib/dedupe.mjs';

const now = new Date('2026-10-09T12:00:00Z');
const base = { title: 'Consórcio realiza assembleia', url: 'https://exemplo.org/noticia',
  publishedAt: '2026-10-08T12:00:00Z', classification: { category: 'GOVERNANÇA', score: 9, reasons: [] } };

test('data da página original prevalece sobre a reindexação do Google', () => {
  const html = '<html><head><meta property="article:published_time" content="2026-09-10T14:53:00-03:00"><meta property="article:modified_time" content="2026-10-08T12:00:00-03:00"></head><body></body></html>';
  const published = sourcePublicationDate(html, now);
  assert.equal(published.date, '2026-09-10T17:53:00.000Z');
  const item = decidePublication({ ...base, sourcePublishedAt: published.date }, { now });
  assert.equal(publicationDate(item).field, 'fonte');
  assert.equal(item.catalogDecision, 'candidato');
  assert.equal(item.publicationDecision, 'historico');
  assert.equal(isNotifiable(item), false);
});

test('JSON-LD de artigo também fornece data original, mas dateModified não', () => {
  const html = '<script type="application/ld+json">{"@graph":[{"@type":"WebSite","datePublished":"2026-10-08"},{"@type":"NewsArticle","datePublished":"2026-09-10","dateModified":"2026-10-08"}]}</script>';
  assert.equal(sourcePublicationDate(html, now).date, '2026-09-10T00:00:00.000Z');
  assert.equal(sourcePublicationDate('<meta property="article:modified_time" content="2026-10-08">', now), null);
});

test('fato confirmado pode entrar na base sem alertar; fato atual pode alertar', () => {
  const old = decidePublication({ ...base, catalogDecision: 'confirmado', eventAt: '2026-06-23T00:00:00Z' }, { now });
  assert.equal(old.catalogDecision, 'confirmado');
  assert.equal(old.publicationDecision, 'historico');
  const fresh = decidePublication({ ...base, catalogDecision: 'confirmado',
    sourcePublishedAt: '2026-10-07T10:00:00Z' }, { now });
  assert.equal(fresh.publicationDecision, 'elegivel');
  assert.equal(isNotifiable(fresh), true);
});

test('lei com data expressa no título não vira notícia de outubro por reindexação', () => {
  const item = decidePublication({ ...base,
    title: 'Lei Ordinária nº 5.651, de 12 de agosto de 2026 - Câmara Municipal',
    publishedAt: '2026-10-08T12:00:00Z',
  }, { now });
  assert.equal(publicationDate(item).field, 'ato');
  assert.equal(item.publicationDecision, 'historico');
});

test('mês conhecido basta para barrar evento antigo sem inventar dia exato', () => {
  const item = decidePublication({ ...base, eventMonth: '2026-09' }, { now });
  assert.equal(publicationDate(item).field, 'mês do fato');
  assert.equal(item.publicationDecision, 'historico');
  assert.equal(item.eventAt, undefined);
});

test('fila antiga também remove evento que envelheceu, sem apagar evidência da base', () => {
  const id = itemId(base);
  const state = { pending: { [id]: { item: { ...base, eventAt: '2026-06-23T00:00:00Z' } } } };
  const removed = reclassifyPending(state, 5, null,
    (item, classification) => isNotifiable(decidePublication({ ...item, classification }, { now })));
  assert.equal(removed, 1);
  assert.equal(Object.keys(state.pending).length, 0);
});
