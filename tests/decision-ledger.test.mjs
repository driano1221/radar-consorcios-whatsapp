import test from 'node:test';
import assert from 'node:assert/strict';
import { recordRunDecisions } from '../src/lib/decision-ledger.mjs';
import { itemId } from '../src/lib/dedupe.mjs';

const now = new Date('2026-10-05T15:00:00.000Z');
const item = (url, category, score, reasons = []) => ({
  url, title: 'Documento de teste', source: 'Fonte pública',
  publishedAt: now.toISOString(), classification: { category, score, reasons },
});

test('registra o motivo individual sem texto integral e diferencia prévia, fila e descarte', () => {
  const rejected = item('https://example.org/antigo', 'GERAL', 0, ['rejeitado: ato antigo com data recente de indexação']);
  const preview = { ...item('https://example.org/previa', 'RATEIO', 11), previewOnly: true };
  const queued = item('https://example.org/fila', 'ADESÃO', 12);
  const state = { seen: {}, pending: {}, decisions: {} };
  state.pending[itemId(queued)] = { item: queued };
  recordRunDecisions(state, [rejected, preview, queued], { now, relevant: [preview, queued], discovered: [queued] });
  const rows = Object.values(state.decisions);
  assert.equal(rows.find((row) => row.url.endsWith('/antigo')).status, 'descartado');
  assert.match(rows.find((row) => row.url.endsWith('/antigo')).reason, /ato antigo/);
  assert.equal(rows.find((row) => row.url.endsWith('/previa')).status, 'previa');
  assert.equal(rows.find((row) => row.url.endsWith('/fila')).status, 'fila');
  assert.ok(rows.every((row) => !('summary' in row) && !('rawText' in row)));
});

test('mantém contagem por URL e limita a retenção', () => {
  const current = item('https://example.org/atual', 'RATEIO', 12);
  const state = { seen: {}, pending: {}, decisions: {
    old: { lastSeenAt: '2026-09-01T00:00:00.000Z' },
  } };
  recordRunDecisions(state, [current], { now, relevant: [current], discovered: [current] });
  recordRunDecisions(state, [current], { now, relevant: [current], discovered: [current] });
  assert.equal(Object.values(state.decisions).length, 1);
  assert.equal(Object.values(state.decisions)[0].observedCount, 2);
});
