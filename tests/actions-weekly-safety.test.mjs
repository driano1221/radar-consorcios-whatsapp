import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mergeStateIntoCatalog } from '../src/lib/catalog.mjs';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { prepareWeeklyState, weeklyPublicationDate } from '../src/lib/weekly-selection.mjs';
import { weeklyWindow, buildWeeklyReport } from '../src/lib/history.mjs';
import { reviewWeeklyFindings } from '../src/lib/ai-review.mjs';
import { isNotifiable } from '../src/lib/publication-gate.mjs';
import { formatWeeklyMessages } from '../src/lib/format.mjs';
import { spawnSync } from 'node:child_process';

const dir = fileURLToPath(new URL('../data/catalogo/', import.meta.url));
const read = async name => (await readFile(`${dir}/${name}`, 'utf8')).trim().split('\n').map(JSON.parse);
const hash = value => createHash('sha256').update(value || '').digest('hex');
const window = weeklyWindow(new Date('2026-10-17T20:13:00Z'));

test('recaptura e fila nunca sobrescrevem os trechos lacrados do acervo real', async () => {
  const rows = await read('arquivo-coletas.ndjson');
  const reviews = await read('revisoes-eventos.ndjson');
  const state = JSON.parse(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(state);
  const records = new Map(rows.map(r => [r.id, { ...r }]));
  const ids = new Set(reviews.map(r => r.documento_id));
  const target = rows.find(r => r.id.startsWith('0783e43a'));
  state.pending.regression = { queuedAt: '2026-10-19', item: {
    url: target.url, title: target.titulo, summary: 'Texto mais longo '.repeat(100),
    classification: { category: 'ADESÃO', score: 20 } } };
  const injected = JSON.stringify(state);
  for (let n = 0; n < 2; n++) mergeStateIntoCatalog(records, state, { reviewedIds: ids });
  assert.equal(JSON.stringify(state), injected);
  for (const review of reviews) if (records.has(review.documento_id))
    assert.equal(hash(records.get(review.documento_id).trecho), review.trecho_sha256, review.documento_id);
  delete state.pending.regression;
  assert.equal(JSON.stringify(state), before);
  const guard = await loadEditorialGuard(dir);
  assert.equal(applyEditorialGuard({ url: target.url }, guard).editorialDecision, 'duplicata');
});

test('resumo inclui CIMSAMU em 14/10 sem liberar alerta, alterar recibos ou incluir Campo Mourão de 09/10', async () => {
  const state = JSON.parse(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(state);
  const prepared = await prepareWeeklyState(state, dir, window);
  const report = buildWeeklyReport(prepared, window);
  const cimsamu = report.highlights.find(i => i.weeklyEvidence?.documentId.startsWith('c24a8dce'));
  assert.ok(cimsamu);
  assert.match(cimsamu.weeklyDate, /^2026-10-14/);
  assert.equal(cimsamu.publicationDecision, 'historico');
  assert.equal(isNotifiable(cimsamu), false);
  assert.ok(report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('8c7dbb9e')));
  assert.ok(!report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('437fe78c')));
  assert.ok(!report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('b06ea64f')));
  for (const prefix of ['ac59dad5', 'd3c65b15'])
    assert.ok(!report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith(prefix)), 'lei histórica não reaparece como novidade');
  const ai = await reviewWeeklyFindings([cimsamu], { aiReviews: {} }, { apiKey: 'test',
    reviewImpl: async () => { throw new Error('A IA não deve revogar decisão humana lacrada'); } });
  assert.equal(ai.highlights.length, 1);
  assert.equal(ai.calls, 0);
  const next = weeklyWindow(new Date('2026-10-24T12:01:00Z'));
  const later = buildWeeklyReport(await prepareWeeklyState(state, dir, next), next);
  assert.ok(!later.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('c24a8dce')));
  assert.equal(JSON.stringify(state), before);
  assert.match(formatWeeklyMessages({ ...report, events: 1, highlights: [cimsamu] }).join('\n'), /14\/10/);
});

test('data original tem prioridade sobre data da coleta; Google sem prova não inventa data', () => {
  assert.equal(weeklyPublicationDate({ url: 'https://news.google.com/a', publishedAt: '2026-10-19' },
    { data_noticia_original: '2022-12-06' }, { fatos: {} }), '2022-12-06T12:00:00-03:00');
  assert.equal(weeklyPublicationDate({ url: 'https://news.google.com/a', publishedAt: '2026-10-19' }, {}, { fatos: {} }), '');
});

test('workflows serializados leem branch atual e só criptografam sessão restaurada', async () => {
  for (const name of ['radar', 'weekly', 'session-health', 'recuperar-textos']) {
    const text = await readFile(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    assert.match(text, /group: radar-consorcios-whatsapp/);
    assert.match(text, /ref: \$\{\{ github.ref_name \}\}/);
    if (name !== 'recuperar-textos') assert.match(text, /if: always\(\) && steps.restore_session.outcome == 'success'/);
  }
});

test('prévia histórica rejeita SEND_ENABLED=true antes de conectar ou modificar estado', async () => {
  const file = new URL('../state/news-state.json', import.meta.url);
  const before = await readFile(file, 'utf8');
  const result = spawnSync(process.execPath, ['src/weekly.mjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8', env: { ...process.env, SEND_ENABLED: 'true', WEEKLY_REBUILD_PREVIEW: 'true',
      WEEKLY_REFERENCE_TIME: '2026-10-17T20:13:00Z' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /só pode rodar sem envio/);
  assert.equal(await readFile(file, 'utf8'), before);
});
