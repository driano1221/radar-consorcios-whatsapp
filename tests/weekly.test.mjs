import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { observeRun, weeklyWindow, buildWeeklyReport } from '../src/lib/history.mjs';
import { formatWeeklyMessage } from '../src/lib/format.mjs';
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
  assert.match(formatWeeklyMessage(report), /1 achados relevantes/);
  assert.match(formatWeeklyMessage(report), /Histórico parcial/);
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
