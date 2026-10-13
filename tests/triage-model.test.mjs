import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingKinds, pendingLabels, triageBucket } from '../dashboard/src/triage-model.mjs';

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
