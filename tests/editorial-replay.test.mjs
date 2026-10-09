import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classifyItem, isPublishableClassification } from '../src/lib/classifier.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import { itemId, reclassifyPending } from '../src/lib/dedupe.mjs';
import { applyEditorialGuard, loadEditorialGuard } from '../src/lib/editorial-guard.mjs';
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
