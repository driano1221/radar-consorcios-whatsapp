import test from 'node:test';
import assert from 'node:assert/strict';
import { compareNewestDiscovery, pendingKinds, pendingLabels, triageBucket } from '../dashboard/src/triage-model.mjs';

test('ordena pela primeira coleta e não pela redescoberta ou data da notícia', () => {
  const items = [
    { id: 'antigo', firstSeenAt: '2026-10-10T12:00:00Z', lastSeenAt: '2026-10-14T18:00:00Z', publishedAt: '2026-10-09' },
    { id: 'novo', firstSeenAt: '2026-10-14T11:31:00-03:00', lastSeenAt: '2026-10-14T14:31:00Z', publishedAt: '2026-06-01' },
    { id: 'sem-data', lastSeenAt: '2026-10-15', publishedAt: '2026-10-15' },
    { id: 'invalida', firstSeenAt: 'inválida' },
  ];
  assert.deepEqual(items.sort(compareNewestDiscovery).map(item => item.id), ['novo', 'antigo', 'sem-data', 'invalida']);
});

test('empates da mesma coleta têm ordem estável por publicação e ID', () => {
  const firstSeenAt = '2026-10-14T14:31:00Z';
  const rows = [{ id:'b', firstSeenAt, publishedAt:'2026-10-13' },
    { id:'a', firstSeenAt, publishedAt:'2026-10-13' }, { id:'c', firstSeenAt, publishedAt:'2026-10-14' }];
  assert.deepEqual(rows.sort(compareNewestDiscovery).map(item => item.id), ['c', 'a', 'b']);
});

test('nova pista não apaga decisão de descarte da base', () => {
  const item = { baseDecision: 'descartado', decisionStatus: 'descartado',
    recoverySuggestion: { category: 'CONTROLE' } };
  assert.equal(triageBucket(item), 'rejected');
  assert.deepEqual(pendingLabels(item), ['Nova pista no texto']);
});

test('identidade incompleta é pendência adicional mesmo para evento confirmado', () => {
  const item = { baseDecision: 'confirmado', identityPending: 'sigla não comprovada' };
  assert.equal(triageBucket(item), 'accepted');
  assert.deepEqual(pendingLabels(item), ['Identidade incompleta']);
  assert.deepEqual(pendingLabels({ baseDecision: 'descartado', identityPending: 'sigla não comprovada' }), []);
});

test('fonte em teste e divergência são marcadores diferentes da decisão', () => {
  assert.deepEqual(pendingKinds.map((kind) => kind.key), ['identity', 'preview', 'divergence', 'suggestion']);
  assert.equal(triageBucket({ baseDecision: 'candidato', decisionStatus: 'previa' }), 'pending');
  assert.deepEqual(pendingLabels({ baseDecision: 'descartado', decisionStatus: 'revisao' }), ['Leituras divergentes']);
  assert.deepEqual(pendingLabels({ baseDecision: 'candidato', decisionStatus: 'rejeitado', aiStatus: 'disputed',
    identityPending: 'entidade ambígua' }), ['Identidade incompleta', 'Leituras divergentes']);
  assert.deepEqual(pendingLabels({ baseDecision: 'candidato', rejectedEvent: true, decisionStatus: 'rejeitado',
    aiStatus: 'disputed', identityPending: 'entidade ambígua' }), ['Leituras divergentes']);
});

test('divergência antiga desaparece após decisão editorial documentada', () => {
  assert.deepEqual(pendingLabels({ baseDecision: 'candidato', decisionStatus: 'revisao', aiStatus: 'disputed',
    editorialReview: { decision: 'confirmar_evento' } }), []);
  assert.deepEqual(pendingLabels({ baseDecision: 'descartado', decisionStatus: 'revisao', aiStatus: 'disputed',
    editorialReview: { decision: 'nao_evento' } }), []);
});
