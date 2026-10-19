import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isWhatsAppCategoryAllowed } from '../src/lib/whatsapp-policy.mjs';
import { prepareWeeklyState } from '../src/lib/weekly-selection.mjs';
import { buildWeeklyReport, weeklyWindow } from '../src/lib/history.mjs';
import { reviewWeeklyFindings } from '../src/lib/ai-review.mjs';
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
  const auditState = structuredClone(state);
  const ai = await reviewWeeklyFindings(report.highlights, auditState, { apiKey: 'cache-only',
    reviewImpl: async () => { throw new Error('Este teste usa somente decisões já salvas'); } });
  assert.equal(ai.highlights.length, 9);
  assert.ok(ai.highlights.every(isWhatsAppCategoryAllowed));
  assert.ok(ai.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('c24a8dce')));
  assert.ok(ai.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('635e46ab')), 'CIM-AMFRI é atuação, não controle');
  const text = formatWeeklyMessages({ ...report, events: 9, highlights: ai.highlights }).join('\n');
  assert.doesNotMatch(text, /TCE-MG|FISCALIZAÇÃO\*/);
  assert.equal(JSON.stringify(state), before, 'fila, acervo e recibos não são alterados');
  const rejectedControls = prepared.weeklySelectionAudit.filter(r => r.reason.startsWith('Controle/fiscalização:'));
  assert.ok(rejectedControls.length >= 6);
});
