import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { observeRun, weeklyWindow, buildWeeklyReport } from '../src/lib/history.mjs';
import { formatWeeklyMessage, formatWeeklyMessages } from '../src/lib/format.mjs';
import { loadState, saveState } from '../src/lib/dedupe.mjs';

const item = { kind: 'news', title: 'Município adere ao consórcio intermunicipal regional',
  url: 'https://exemplo.gov.br/noticia', source: 'Portal oficial', publishedAt: '2026-09-15T15:00:00Z',
  summary: 'Foi aprovada a entrada municipal.', classification: { score: 12, category: 'ADESÃO', publicContext: true, emoji: '🟦' } };

test('janela semanal em Brasília permanece igual na retentativa das 12h', () => {
  const a = weeklyWindow(new Date('2026-09-19T12:05:00Z'));
  const b = weeklyWindow(new Date('2026-09-19T15:05:00Z'));
  assert.equal(a.start.toISOString(), '2026-09-12T12:00:00.000Z');
  assert.equal(a.end.toISOString(), '2026-09-19T12:00:00.000Z');
  assert.deepEqual(a, b);
  assert.equal(weeklyWindow(new Date('2026-09-19T11:59:00Z')).end.toISOString(), a.start.toISOString());
});

test('resumo inclui achados não enviados sem somar observações repetidas', () => {
  const state = { seen: {}, pending: {} };
  observeRun(state, [item], [{ name: 'API', status: 'ok' }], 5, new Date('2026-09-15T17:00:00Z'));
  observeRun(state, [item, { ...item, url: item.url + '?utm_source=feed' }], [{ name: 'API', status: 'error' }], 5, new Date('2026-09-16T17:00:00Z'));
  const report = buildWeeklyReport(state, weeklyWindow(new Date('2026-09-19T13:00:00Z')));
  assert.equal(report.observations, 1);
  assert.equal(report.events, 1);
  assert.equal(report.sent, 0);
  assert.equal(report.runs, 2);
  assert.equal(report.partial, true);
  assert.deepEqual(report.failures, ['API']);
  assert.match(formatWeeklyMessage(report), /1 achado relevante/);
  assert.doesNotMatch(formatWeeklyMessage(report), /publicações únicas|Histórico parcial|Cobertura com falhas/);
});

test('contadores de saúde zeram apenas depois de uma coleta saudável', () => {
  const state = { seen: {} };
  for (let n = 0; n < 3; n++) observeRun(state, [], [{ name: 'QD', status: 'error' }], 5);
  assert.equal(state.health.QD.consecutiveFailures, 3);
  observeRun(state, [], [{ name: 'QD', status: 'ok' }], 5);
  assert.equal(state.health.QD.consecutiveFailures, 0);
  assert.ok(state.health.QD.lastSuccessAt);
});

test('estado preserva histórico e confirmação semanal ao reiniciar', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'radar-weekly-test-'));
  try {
    const file = path.join(dir, 'state.json');
    await saveState(file, { version: 4, seen: {}, pending: {}, observations: { a: { item } }, weekly: { sample: { sentAt: '2026-09-19' } } });
    const state = await loadState(file);
    assert.equal(state.weekly.sample.sentAt, '2026-09-19');
    assert.equal(state.observations.a.item.title, item.title);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('resumo vazio informa cobertura e não inventa notícias', () => {
  const report = buildWeeklyReport({ seen: {} }, weeklyWindow(new Date('2026-09-19T13:00:00Z')));
  const text = formatWeeklyMessage(report);
  assert.match(text, /0 achados relevantes/);
  assert.match(text, /Nenhum achado atingiu/);
  assert.doesNotMatch(text, /undefined|NaN/);
});

test('resumo lista todos os achados, sem limite de cinco e sem estatísticas de coleta', () => {
  const state = { seen: {}, pending: {} };
  const now = new Date('2026-09-18T17:00:00Z');
  const categories = ['ADESÃO', 'RATEIO', 'SAÍDA', 'CRISE', 'GOVERNANÇA', 'PROTOCOLO', 'FINANÇAS'];
  for (let i = 0; i < 7; i++) {
    observeRun(state, [{ ...item, title: `Achado real ${i + 1}`, url: `https://exemplo.gov.br/noticia-${i + 1}`,
      classification: { ...item.classification, category: categories[i] } }],
      [{ name: 'API', status: 'error' }], 5, now, `run-${i}`);
  }
  const report = buildWeeklyReport(state, weeklyWindow(new Date('2026-09-19T13:00:00Z')));
  const text = formatWeeklyMessage(report);
  assert.equal(report.events, 7);
  assert.equal(report.highlights.length, 7);
  assert.match(text, /7\. \*FINANÇAS\*\n\*Achado real 7\*/);
  assert.doesNotMatch(text, /publicações únicas|coletas|Cobertura com falhas|Origem dos achados/);
});

test('observação guarda o trecho forte quando busca posterior só encontra menção fraca', () => {
  const state = { seen: {}, pending: {} };
  const strong = { ...item, kind: 'gazette', title: 'Diário Oficial de Simão Dias',
    summary: 'Lei ratifica protocolo de intenções do consórcio.',
    classification: { ...item.classification, category: 'GOVERNANÇA', score: 18 } };
  const weak = { ...strong, summary: 'Cláusula orçamentária menciona contrato de rateio.',
    classification: { ...strong.classification, category: 'RATEIO', score: 17 } };
  observeRun(state, [strong], [], 5, new Date('2026-09-18T12:00:00Z'));
  observeRun(state, [weak], [], 5, new Date('2026-09-19T12:00:00Z'));
  assert.equal(Object.values(state.observations)[0].item.classification.category, 'GOVERNANÇA');
  assert.equal(Object.values(state.observations)[0].lastSeenAt, '2026-09-19T12:00:00.000Z');
});

test('boletim extenso é dividido sem perder achados nem exceder tamanho seguro', () => {
  const report = { start: '2026-09-12T12:00:00Z', end: '2026-09-19T12:00:00Z', events: 25,
    highlights: Array.from({ length: 25 }, (_, index) => ({ ...item,
      title: `Fato consorcial específico ${index + 1} e seu município`,
      url: `https://exemplo.gov.br/noticia-${index + 1}`,
    })) };
  const parts = formatWeeklyMessages(report, false, 950);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((part) => part.length <= 950 && part.includes('RADAR CONSÓRCIOS')));
  assert.match(parts[0], /Parte 1\//);
  assert.match(parts.at(-1), /25\. \*ADESÃO\*/);
  assert.equal((parts.join('\n').match(/https:\/\/exemplo\.gov\.br\/noticia-/g) || []).length, 25);
});

test('boletim omite menções contábeis e corrige rótulos históricos enganosos', () => {
  const state = { seen: {}, pending: {} };
  const now = new Date('2026-09-18T17:00:00Z');
  const rows = [
    { ...item, url: 'https://exemplo.gov.br/rateio', kind: 'gazette', title: 'Diário Oficial de Arataca',
      classification: { ...item.classification, category: 'RATEIO', evidenceText: 'RELATÓRIO RESUMIDO DA EXECUÇÃO ORÇAMENTÁRIA. Valores transferidos por contrato de rateio.' } },
    { ...item, url: 'https://exemplo.gov.br/contrato', kind: 'gazette', title: 'Diário Oficial de Campo Mourão',
      classification: { ...item.classification, category: 'PROTOCOLO', evidenceText: 'EXTRATO DO CONTRATO DE PRESTAÇÃO DE SERVIÇOS. Locação de equipamentos de acordo com o Protocolo de Intenções.' } },
    { ...item, url: 'https://exemplo.gov.br/agenda', title: 'Consórcio Intermunicipal cria agenda setorial com Brasília',
      classification: { ...item.classification, category: 'CRIAÇÃO' } },
    { ...item, url: 'https://exemplo.gov.br/lei', title: 'Município autoriza adesão ao consórcio' },
  ];
  observeRun(state, rows, [{ name: 'API', status: 'ok' }], 5, now);
  const report = buildWeeklyReport(state, weeklyWindow(new Date('2026-09-19T13:00:00Z')));
  assert.equal(report.events, 2);
  assert.deepEqual(report.categories, { 'ATUAÇÃO': 1, 'ADESÃO AUTORIZADA': 1 });
  assert.doesNotMatch(formatWeeklyMessage(report), /Arataca|Campo Mourão|NOVO CONSÓRCIO/);
});

test('boletim distingue autorização de ingresso de adesão efetivada', () => {
  const state = { seen: {}, pending: {} };
  const news = { ...item, title: 'Lei autoriza o ingresso de Exemplo no consórcio público regional',
    summary: 'A lei municipal autoriza o ingresso de Exemplo no consórcio público regional.' };
  observeRun(state, [news], [{ name: 'API', status: 'ok' }], 5, new Date('2026-09-18T17:00:00Z'));
  const report = buildWeeklyReport(state, weeklyWindow(new Date('2026-09-19T13:00:00Z')));
  assert.deepEqual(report.categories, { 'ADESÃO AUTORIZADA': 1 });
  assert.match(formatWeeklyMessage(report), /INGRESSO AUTORIZADO/);
});
