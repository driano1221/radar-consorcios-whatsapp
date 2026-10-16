import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import { dashboardAlternatives } from '../scripts/dashboard-recovery.mjs';

const directory = fileURLToPath(new URL('../data/catalogo/', import.meta.url));
const nd = async name => (await readFile(`${directory}/${name}`, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const batch = 'historicos-13-2026-10-16';
const hash = text => createHash('sha256').update(text).digest('hex');

test('13 históricos têm prova preservada, 5 confirmações, 4 duplicatas e 4 descartes; originais intactos', async () => {
  const journal = JSON.parse(await readFile(`${directory}/lote-historicos-13.json`, 'utf8'));
  const archive = await nd('arquivo-coletas.ndjson');
  const reviews = (await nd('revisoes-eventos.ndjson')).filter(r => r.lote_retroativo === batch);
  const texts = (await nd('textos-artigos.ndjson')).filter(r => r.lote_retroativo === batch);
  const alternatives = (await nd('fontes-alternativas.ndjson')).filter(r => r.lote_retroativo === batch);
  assert.equal(journal.registros.length, 13); assert.equal(reviews.length, 13);
  assert.equal(texts.length, 12); assert.equal(alternatives.length, 1);
  assert.equal(new Set(texts.map(r => r.documento_id)).size, 12);
  for (const [decision, count] of [['confirmar_evento', 5], ['duplicata', 4], ['nao_evento', 4]])
    assert.equal(reviews.filter(r => r.decisao === decision).length, count);
  const events = await readFile(`${directory}/eventos.csv`, 'utf8');
  for (const saved of journal.registros) {
    const review = reviews.find(r => r.documento_id === saved.documento_id);
    const reading = [...texts, ...alternatives].find(r => r.documento_id === saved.documento_id);
    assert.deepEqual(archive.find(r => r.id === saved.documento_id), saved.original);
    assert.equal(review.trecho_sha256, hash(saved.original.trecho || ''));
    assert.equal(review.publicar, false);
    assert.equal(hash(reading.texto), saved.texto_sha256);
    assert.equal(hash(reading.texto), review.texto_evidencia_sha256);
    assert.ok(reading.texto.replace(/\s+/g, ' ').trim().includes(review.evidencia));
    assert.equal(events.includes(saved.documento_id), review.decisao === 'confirmar_evento');
    assert.equal(review.fatos.ano_ingresso, '');
  }
});

test('CNM original continua distinto da reprodução Conclima; Paraná e protocolo, não adesão consumada', async () => {
  const review = (await nd('revisoes-eventos.ndjson')).find(r => r.documento_id.startsWith('74fb6772'));
  const source = (await nd('fontes-alternativas.ndjson')).find(r => r.documento_id === review.documento_id);
  assert.ok(!(await nd('textos-artigos.ndjson')).some(r => r.documento_id === review.documento_id));
  assert.equal(review.categoria, 'PROTOCOLO'); assert.equal(review.fatos.uf, 'PR');
  assert.equal(review.fatos.quantidade_municipios, 12); assert.deepEqual(review.fatos.municipios, []);
  assert.match(source.url_original_bloqueada, /cnm.org.br/);
  assert.match(source.url_fonte, /conclima.org.br/);
  const [display] = dashboardAlternatives(review.documento_id, [source], review);
  assert.equal(display.decisionUse, 'cited'); assert.match(display.relation, /Paraná/);
  const [unreviewed] = dashboardAlternatives(review.documento_id, [source], null);
  assert.equal(unreviewed.decisionUse, 'not_cited'); assert.doesNotMatch(unreviewed.relation, /Revisão documental/);
});

test('composição aproveitada cria quatro relações, sem sigla AMURC, sem ano de ingresso ou atendimento presumido', async () => {
  const review = (await nd('revisoes-eventos.ndjson')).find(r => r.documento_id.startsWith('0c2c9c6b'));
  assert.equal(review.fatos.sigla, ''); assert.equal(review.fatos.ano, 2026);
  const lines = (await readFile(`${directory}/participacoes.csv`, 'utf8')).split('\n').filter(l => l.includes(review.documento_id));
  assert.equal(lines.length, 4);
  for (const town of review.fatos.municipios) assert.ok(lines.some(l => l.includes(`"${town}"`)));
  for (const line of lines) assert.ok(line.includes('"","2026","participação documentada'));
  assert.match(review.motivo, /sem afirmar início dos atendimentos/);
});

test('convocação não confirma deliberação; três coberturas Metodista apontam ao fato já existente', async () => {
  const reviews = (await nd('revisoes-eventos.ndjson')).filter(r => r.lote_retroativo === batch);
  assert.equal(reviews.find(r => r.documento_id.startsWith('e41368d4')).decisao, 'nao_evento');
  for (const prefix of ['1bb8aa8d', '68160372', 'a22322a6']) {
    const r = reviews.find(r => r.documento_id.startsWith(prefix));
    assert.equal(r.decisao, 'duplicata'); assert.ok(r.documento_relacionado.startsWith('ca8c07d2'));
  }
});

test('nenhuma URL histórica do lote gera alerta ou resumo, mesmo com data de hoje', async () => {
  const guard = await loadEditorialGuard(directory);
  const reviews = (await nd('revisoes-eventos.ndjson')).filter(r => r.lote_retroativo === batch);
  const at = '2026-10-16T12:00:00.000Z', state = { observations: {}, pending: {}, seen: {} };
  let index = 0;
  for (const review of reviews) for (const url of review.urls_documento) {
    const item = decidePublication(applyEditorialGuard({ url, title: review.titulo, publishedAt: at,
      classification: { category: 'ADESÃO', score: 15, reasons: [] } }, guard));
    assert.equal(isNotifiable(item), false, url);
    state.observations[index++] = { item, firstSeenAt: at, lastSeenAt: at };
  }
  const report = buildWeeklyReport(state, { start: new Date('2026-10-15T00:00:00Z'), end: new Date('2026-10-17T00:00:00Z') });
  assert.equal(report.highlights.length, 0); assert.equal(report.events, 0);
});
