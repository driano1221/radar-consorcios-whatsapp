import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classifyItem, isPublishableClassification } from '../src/lib/classifier.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import { itemId, reclassifyPending, selectUnseen } from '../src/lib/dedupe.mjs';
import { applyEditorialGuard, loadConfirmedEventRegistry, loadEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { fileURLToPath } from 'node:url';

async function readNdjson(name) {
  const text = await readFile(new URL(`../data/catalogo/${name}`, import.meta.url), 'utf8');
  return text.trim().split('\n').map((line) => JSON.parse(line));
}

test('todas as revisões apontam para registro e trecho vigentes; duplicatas têm documento principal', async () => {
  const [archive, reviews] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'), readNdjson('revisoes-eventos.ndjson'),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  for (const review of reviews) {
    const row = byId.get(review.documento_id);
    assert.ok(row, `documento ausente: ${review.documento_id}`);
    assert.equal(review.trecho_sha256, createHash('sha256').update(row.trecho || '').digest('hex'),
      `trecho mudou desde a revisão: ${review.documento_id}`);
    if (review.decisao === 'duplicata') {
      assert.ok(byId.has(review.documento_relacionado), `principal ausente: ${review.documento_relacionado}`);
      assert.notEqual(review.documento_id, review.documento_relacionado);
    }
  }
});

test('duplicatas revistas também são bloqueadas na coleta futura', async () => {
  const [archive, reviews] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'), readNdjson('revisoes-eventos.ndjson'),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const guard = await loadEditorialGuard(fileURLToPath(new URL('../data/catalogo/', import.meta.url)));
  for (const review of reviews.filter((row) => row.decisao === 'duplicata')) {
    const row = byId.get(review.documento_id);
    const item = applyEditorialGuard({ url: row.url,
      classification: { category: 'ADESÃO', score: 12, reasons: [] } }, guard);
    assert.equal(item.classification.category, 'GERAL', row.id);
    assert.equal(item.editorialDecision, 'duplicata');
  }
});

test('fatos históricos confirmados ficam na base, mas não voltam à fila como notícia nova', async () => {
  const [archive, reviews] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'), readNdjson('revisoes-eventos.ndjson'),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const guard = await loadEditorialGuard(fileURLToPath(new URL('../data/catalogo/', import.meta.url)));
  const withheld = reviews.filter((review) => review.publicar === false);
  assert.ok(withheld.length >= 3);
  assert.ok(withheld.some((review) => review.documento_id === '2c093a1ef9c6e2f74c3d4cb97872cd433b097f62146e0fcb83b420ed99dc82b4'),
    'a assembleia futura do CONIAPE deve ficar na base, sem alerta');
  for (const review of withheld) {
    assert.equal(review.decisao, 'confirmar_evento');
    const row = byId.get(review.documento_id);
    const protectedItem = decidePublication(applyEditorialGuard({ url: row.url,
      classification: { category: 'PROTOCOLO', score: 12, reasons: [] } }, guard));
    assert.equal(protectedItem.classification.category, review.categoria, row.id);
    assert.equal(protectedItem.catalogDecision, 'confirmado');
    assert.equal(protectedItem.publicationDecision, 'historico');
    assert.equal(isNotifiable(protectedItem), false);
    assert.ok(protectedItem.publicationReason);
  }
});

test('ato formal confirmado evita alerta duplicado de outra fonte sem bloquear a fonte principal', async () => {
  const directory = fileURLToPath(new URL('../data/catalogo/', import.meta.url));
  const registry = await loadConfirmedEventRegistry(directory);
  const key = 'lei:campina grande do sul:1117/2026';
  assert.ok(registry.has(key));
  const base = { title: 'Lei 1117/2026 autoriza ingresso do Município de Campina Grande do Sul no CISPAR',
    classification: { category: 'ADESÃO AUTORIZADA', score: 10,
      evidenceText: 'Lei 1117/2026 autoriza ingresso do Município de Campina Grande do Sul no CISPAR.' } };
  const alternative = { ...base, url: 'https://outro-portal.example/noticia' };
  assert.equal(selectUnseen([alternative], { seen: {}, pending: {} }, { confirmedEvents: registry }).length, 0);
  const original = { ...base, url: 'https://news.google.com/rss/articles/CBMib0FVX3lxTE9uUkdrUFJtMHFmMHVMY1pHTGZoTXhxbTFmSWdJSHF6MVU0Z1FvQmw2RnRqT1k3R3JaTjN2dEpFSWpwa3MxeVY0Y08wU2JsZ216c0NSTVNYdV8xNkN4VU5YbGZRemJZSDF1UnA4cV9IVQ?oc=5' };
  assert.equal(selectUnseen([original], { seen: {}, pending: {} }, { confirmedEvents: registry }).length, 1);
});

test('falsos positivos editoriais não retornam à coleta, fila ou resumo semanal', async () => {
  const [archive, recovered, largeRecovered, reviews] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'),
    readNdjson('recuperacao-pdf.ndjson'),
    readNdjson('recuperacao-pdf-grandes.ndjson'),
    readNdjson('revisoes-eventos.ndjson'),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const pdfById = new Map([...recovered, ...largeRecovered.filter((row) => row.trechos?.length)]
    .map((row) => [row.documento_id, row]));
  const rejected = reviews.filter((row) => row.decisao === 'nao_evento');
  assert.ok(rejected.length >= 33, 'as decisões editoriais históricas devem permanecer');
  const guard = await loadEditorialGuard(fileURLToPath(new URL('../data/catalogo/', import.meta.url)));

  const state = { seen: {}, pending: {}, observations: {} };
  const at = '2026-10-02T15:00:00.000Z';
  for (const review of rejected) {
    const original = byId.get(review.documento_id);
    assert.ok(original, `documento ausente: ${review.documento_id}`);
    const excerpts = pdfById.get(review.documento_id)?.trechos?.map((part) => part.texto) || [];
    const item = {
      kind: 'gazette', title: original.titulo, url: original.url,
      source: original.fonte, publishedAt: original.data_publicacao,
      summary: excerpts.length ? excerpts.join(' ') : original.trecho,
      excerpts,
    };
    const fresh = classifyItem(item);
    const protectedItem = applyEditorialGuard({ ...item, classification: fresh }, guard);
    assert.equal(isPublishableClassification(protectedItem.classification), false,
      `${original.titulo} (${review.documento_id}): revisão editorial não aplicada`);

    // Simula uma fila e um histórico que ainda guardam o rótulo antigo.
    const id = itemId(item);
    const stale = applyEditorialGuard({ ...item,
      classification: { category: original.tipo_evento, score: 11, emoji: '📰' } }, guard);
    state.pending[id] = { item: stale, queuedAt: at };
    state.observations[id] = { item: stale, firstSeenAt: at, lastSeenAt: at };
  }

  assert.equal(reclassifyPending(state, 5,
    (item, classification) => applyEditorialGuard({ ...item, classification }, guard).classification), rejected.length);
  assert.equal(Object.keys(state.pending).length, 0);
  const report = buildWeeklyReport(state, {
    start: new Date('2026-09-27T12:00:00.000Z'),
    end: new Date('2026-10-04T12:00:00.000Z'),
  });
  assert.equal(report.events, 0);
  assert.equal(report.highlights.length, 0);
});
