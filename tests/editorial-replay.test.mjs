import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyItem, isPublishableClassification } from '../src/lib/classifier.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import { itemId, reclassifyPending } from '../src/lib/dedupe.mjs';

async function readNdjson(name) {
  const text = await readFile(new URL(`../data/catalogo/${name}`, import.meta.url), 'utf8');
  return text.trim().split('\n').map((line) => JSON.parse(line));
}

test('18 falsos positivos editoriais não retornam à coleta, fila ou resumo semanal', async () => {
  const [archive, recovered, reviews] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'),
    readNdjson('recuperacao-pdf.ndjson'),
    readNdjson('revisoes-eventos.ndjson'),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const pdfById = new Map(recovered.map((row) => [row.documento_id, row]));
  const rejected = reviews.filter((row) => row.decisao === 'nao_evento');
  assert.equal(rejected.length, 18, 'alteração no corpus exige nova revisão editorial');

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
    assert.equal(isPublishableClassification(fresh), false,
      `${original.titulo} (${review.documento_id}): ${fresh.category}, ${fresh.score}`);

    // Simula uma fila e um histórico que ainda guardam o rótulo antigo.
    const id = itemId(item);
    const stale = { ...item, classification: { category: original.tipo_evento, score: 11, emoji: '📰' } };
    state.pending[id] = { item: stale, queuedAt: at };
    state.observations[id] = { item: stale, firstSeenAt: at, lastSeenAt: at };
  }

  assert.equal(reclassifyPending(state), 18);
  assert.equal(Object.keys(state.pending).length, 0);
  const report = buildWeeklyReport(state, {
    start: new Date('2026-09-27T12:00:00.000Z'),
    end: new Date('2026-10-04T12:00:00.000Z'),
  });
  assert.equal(report.events, 0);
  assert.equal(report.highlights.length, 0);
});
