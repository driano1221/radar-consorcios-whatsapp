import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import { formalEventKey } from '../src/lib/event-identity.mjs';
import { assertOriginalPreserved } from './helpers/archive-invariants.mjs';

const directory = fileURLToPath(new URL('../data/catalogo/', import.meta.url));
const nd = async name => (await readFile(`${directory}/${name}`, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const batch = 'piloto-retroativo-10-2026-10-16';

test('lote aprovado conserva dez originais, dez textos e somente cinco fatos únicos', async () => {
  const journal = JSON.parse(await readFile(`${directory}/lote-retroativo-10.json`, 'utf8'));
  const archive = await nd('arquivo-coletas.ndjson');
  const reviews = (await nd('revisoes-eventos.ndjson')).filter(r => r.lote_retroativo === batch);
  const texts = (await nd('textos-artigos.ndjson')).filter(r => r.lote_retroativo === batch);
  assert.equal(journal.registros.length, 10);
  assert.equal(reviews.length, 10);
  assert.equal(texts.length, 10);
  assert.equal(new Set(texts.map(t => t.documento_id)).size, 10);
  assert.equal(reviews.filter(r => r.decisao === 'confirmar_evento').length, 5);
  assert.equal(reviews.filter(r => r.decisao === 'nao_evento').length, 3);
  assert.equal(reviews.filter(r => r.decisao === 'duplicata').length, 2);
  const eventIds = [...(await readFile(`${directory}/eventos.csv`, 'utf8')).matchAll(/^"([a-f0-9]{64})",/gm)].map(m => m[1]);
  for (const saved of journal.registros) {
    assertOriginalPreserved(archive.find(r => r.id === saved.documento_id), saved.original,
      texts.find(r => r.documento_id === saved.documento_id), archive);
    const review = reviews.find(r => r.documento_id === saved.documento_id);
    const text = texts.find(r => r.documento_id === saved.documento_id);
    assert.equal(review.publicar, false);
    assert.equal(text.pdf_sha256, saved.pdf_sha256);
    assert.equal(text.texto_sha256, createHash('sha256').update(text.texto).digest('hex'));
    assert.ok(text.completo && text.texto.length > 200);
    const proof = text.paginas.find(p => p.pagina === review.fatos.pagina_pdf);
    assert.ok(proof.texto.replace(/\s+/g, ' ').trim().includes(review.evidencia));
    assert.equal(eventIds.filter(id => id === saved.documento_id).length, saved.proposta === 'aceito' ? 1 : 0);
    assert.equal(review.fatos.ano_ingresso, '');
  }
});

test('URLs Google e PDFs do lote não notificam nem entram no resumo, mesmo vistos hoje', async () => {
  const guard = await loadEditorialGuard(directory);
  const reviews = (await nd('revisoes-eventos.ndjson')).filter(r => r.lote_retroativo === batch);
  const at = '2026-10-16T12:00:00.000Z';
  const state = { observations: {}, pending: {}, seen: {} };
  let index = 0;
  for (const review of reviews) for (const url of review.urls_documento) {
    const item = decidePublication(applyEditorialGuard({ url, title: review.titulo, publishedAt: at,
      classification: { category: 'ADESÃO', score: 15, reasons: [] } }, guard));
    assert.equal(isNotifiable(item), false, url);
    state.observations[index++] = { item, firstSeenAt: at, lastSeenAt: at };
  }
  const report = buildWeeklyReport(state, { start: new Date('2026-10-15T00:00:00Z'), end: new Date('2026-10-17T00:00:00Z') });
  assert.equal(report.highlights.length, 0);
  assert.equal(report.events, 0);
  const unrelated = { url: 'https://santaines.pb.leg.br/arquivos/novo-documento.pdf',
    classification: { category: 'ADESÃO', score: 15, reasons: [] } };
  assert.equal(applyEditorialGuard(unrelated, guard).editorialDecision, undefined);
});

test('lei de Varre-Sai usa município emissor, não confunde beneficiário; CISVAP preserva ano comprovado', async () => {
  const reviews = (await nd('revisoes-eventos.ndjson')).filter(r => r.lote_retroativo === batch);
  const varre = reviews.find(r => r.documento_id.startsWith('928d130d'));
  assert.equal(formalEventKey({ title: varre.titulo, classification: { category: varre.categoria }, editorialFacts: varre.fatos }), 'lei:varre-sai:1152/2026');
  const cisvap = reviews.find(r => r.documento_id.startsWith('c385fb9c'));
  assert.equal(cisvap.fatos.ano, 2025);
  assert.equal(cisvap.fatos.ano_ingresso, '');
});
