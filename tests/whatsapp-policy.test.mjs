import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isWhatsAppCategoryAllowed } from '../src/lib/whatsapp-policy.mjs';
import { prepareWeeklyState } from '../src/lib/weekly-selection.mjs';
import { buildWeeklyReport, weeklyWindow } from '../src/lib/history.mjs';
import { formatWeeklyMessages } from '../src/lib/format.mjs';

test('controle é excluído do canal; atuação de acompanhamento técnico continua permitida', () => {
  for (const category of ['CONTROLE', 'FISCALIZAÇÃO', 'Controle / fiscalização'])
    assert.equal(isWhatsAppCategoryAllowed({ classification: { category } }), false);
  for (const category of ['ATUAÇÃO', 'RATEIO', 'PROTOCOLO', 'GOVERNANÇA', 'CRISE'])
    assert.equal(isWhatsAppCategoryAllowed({ classification: { category } }), true);
});

test('edição aprovada tem nove achados, CIMSAMU incluído e seis controles só na base', async () => {
  const state = JSON.parse(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(state);
  const directory = new URL('../data/catalogo/', import.meta.url);
  const { fileURLToPath } = await import('node:url');
  const window = weeklyWindow(new Date('2026-10-17T20:13:00Z'));
  const prepared = await prepareWeeklyState(state, fileURLToPath(directory), window);
  const report = buildWeeklyReport(prepared, window);
  assert.ok(report.highlights.every(isWhatsAppCategoryAllowed));
  assert.ok(report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('c24a8dce')));
  assert.ok(report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('635e46ab')), 'CIM-AMFRI é atuação, não controle');
  // Counts use the approved immutable edition, not the mutable live cache:
  // normal recrawls/pruning must not cause future Actions failures.
  const approved = JSON.parse(await readFile(new URL('./fixtures/weekly-approved-20261017.json', import.meta.url), 'utf8'));
  const highlights = approved.highlights.filter(isWhatsAppCategoryAllowed);
  assert.equal(highlights.length, 9);
  const text = formatWeeklyMessages({ ...approved, events: 9, highlights }).join('\n');
  assert.doesNotMatch(text, /TCE-MG|FISCALIZAÇÃO\*/);
  assert.equal(JSON.stringify(state), before, 'fila, acervo e recibos não são alterados');
  const rejectedControls = prepared.weeklySelectionAudit.filter(r => r.reason.startsWith('Controle/fiscalização:'));
  assert.ok(rejectedControls.length >= 6);
});
