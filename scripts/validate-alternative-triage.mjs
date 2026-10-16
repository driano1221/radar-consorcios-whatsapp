// Read-only production validation. Fixtures and reports stay outside data/ and state/.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readAlternativeRows, reviewAlternative, sha } from '../src/lib/alternative-triage.mjs';
import { decideWithAlternatives, triageAlternativeTexts } from './triage-alternative-texts.mjs';
import { buildDashboardData, buildPublicDashboardData } from './build-dashboard.mjs';

const output = 'output/alternative-triage';
await mkdir(output, { recursive: true });
const [archive, sources, reviews] = await Promise.all([
  readAlternativeRows('data/catalogo', 'arquivo-coletas.ndjson'),
  readAlternativeRows('data/catalogo', 'fontes-alternativas.ndjson'),
  readAlternativeRows('data/catalogo', 'revisoes-eventos.ndjson'),
]);
const original = archive.find(r => r.id === '0783e43a286fe81821ff9ad5e33526f40fbe35e930c9b89eb251277777fb2b64');
assert.ok(original, 'Amostra real ausente');
const alternatives = sources.filter(s => s.documento_id === original.id);
assert.equal(alternatives.length, 2);
const report = { at: new Date().toISOString(), mode: 'somente validação; sem gravação na base ou WhatsApp', cases: [], calls: 0 };
const cache = new Map();
const liveReview = async (input, options) => {
  const result = await reviewAlternative(input, options);
  report.calls++;
  cache.set(JSON.stringify(input), result);
  return result;
};
const cachedReview = async input => {
  const result = cache.get(JSON.stringify(input));
  assert.ok(result, 'Validação de idempotência não pode fazer nova chamada à API');
  return result;
};
const options = { apiKey: process.env.DEEPSEEK_API_KEY, review: liveReview };
let temporary;
try {
  // Historical document is examined in memory only, never made eligible in production.
  const accepted = await decideWithAlternatives(original, alternatives, options);
  report.cases.push({ name: 'Leitura real: CISGA / Semana 7, Rede da Notícia e Araguaia', expected: 'aceito', result: accepted });
  assert.equal(accepted.status, 'aceito');
  assert.equal(accepted.category, 'ATUAÇÃO');
  const duplicate = await decideWithAlternatives(original, alternatives, { ...options, review: cachedReview, archive, reviews });
  report.cases.push({ name: 'Mesmo caso confrontado com acervo: não contar novamente', expected: 'duplicata', result: duplicate });
  assert.equal(duplicate.status, 'duplicata');

  const title = 'CISVARC publica termo de credenciamento com laboratório para exames';
  const text = 'O Consórcio Intermunicipal de Saúde CISVARC celebrou termo de credenciamento com laboratório para exames. Contrato rotineiro com fornecedor para prestação de serviços assistenciais. ' +
    'O instrumento contém cláusulas de penalidade em caso de descumprimento, sem notícia de aplicação de sanções. '.repeat(5);
  const control = { ...original, id: 'controle-sintetico-fornecedor', titulo: title, trecho: title };
  const controlSource = { ...alternatives[0], id: 'controle-sintetico-fonte', documento_id: control.id,
    titulo_fonte: title, texto: text, texto_sha256: sha(text), url_fonte: 'https://example.org/controle-sintetico', fonte: 'Fixture sintética, não é notícia real' };
  const discarded = await decideWithAlternatives(control, [controlSource], options);
  report.cases.push({ name: 'Controle SINTÉTICO: contrato rotineiro não é crise', expected: 'descartado', result: discarded });
  assert.equal(discarded.status, 'descartado');

  const mismatch = { ...original, titulo: original.titulo.replace('100', '900'), trecho: original.trecho.replace('100', '900') };
  const uncertain = await decideWithAlternatives(mismatch, [alternatives[0]], options);
  report.cases.push({ name: 'Controle SINTÉTICO: título alterado para 900 pacientes; corpo tem 100', expected: 'pendente', result: uncertain });
  assert.equal(uncertain.status, 'pendente');

  // An isolated copy simulates a new arrival; only timestamps/ID change here.
  temporary = await mkdtemp(path.join(os.tmpdir(), 'radar-alternative-ci-'));
  const newRow = { ...original, id: 'fixture-new', primeira_coleta: '2026-10-16T18:00:00Z', enviado_em: '' };
  const newSources = alternatives.map(s => ({ ...s, documento_id: newRow.id }));
  for (const [file, rows] of [['arquivo-coletas', [newRow]], ['fontes-alternativas', newSources]])
    await writeFile(path.join(temporary, `${file}.ndjson`), rows.map(JSON.stringify).join('\n') + '\n');
  const before = await readFile(path.join(temporary, 'arquivo-coletas.ndjson'), 'utf8');
  const first = await triageAlternativeTexts({ directory: temporary, apply: true, ...options, review: cachedReview });
  assert.equal(first.results[0]?.status, 'aceito');
  const repeat = await triageAlternativeTexts({ directory: temporary, apply: true, ...options, review: cachedReview });
  assert.equal(repeat.calls, 0);
  assert.equal(await readFile(path.join(temporary, 'arquivo-coletas.ndjson'), 'utf8'), before);
  const dashboard = buildPublicDashboardData(buildDashboardData({ archive: [newRow], events: [], consortia: [], links: [], pendingIdentity: [],
    alternativeTexts: newSources, alternativeDecisions: first.results }));
  assert.equal(dashboard.items[0].baseDecision, 'confirmado');
  assert.equal(dashboard.items[0].alternativeSources[0].decisionUse, 'automatic');
  assert.equal(dashboard.items[0].alternativeSources[0].fullText, '');
  await writeFile(`${output}/fixture-painel-publico.json`, JSON.stringify(dashboard, null, 2));
  report.isolatedIntegration = { status: first.results[0].status, secondRunCalls: repeat.calls, originalUnchanged: true };

  const actual = await triageAlternativeTexts({ apply: false, ...options, review: async () => { throw new Error('Históricos não podem ser reprocessados'); } });
  assert.equal(actual.calls, 0); assert.equal(actual.attempted, 0);
  report.production = { calls: actual.calls, changedDocuments: actual.attempted, sentMessages: 0 };
  report.success = true;
} catch (error) {
  report.success = false; report.error = error.message;
  process.exitCode = 1;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  if (temporary) await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ success: report.success, cases: report.cases.map(c => ({ name: c.name, expected: c.expected, actual: c.result.status, reason: c.result.reason })),
    calls: report.calls, production: report.production, error: report.error }, null, 2));
}
