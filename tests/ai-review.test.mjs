import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROMPT_VERSION, applyAiReview, reviewQueue, reviewWeeklyFindings, reviewWithDeepSeek } from '../src/lib/ai-review.mjs';
import { itemId } from '../src/lib/dedupe.mjs';

const item = (title, category = 'CRIAÇÃO') => ({
  title, summary: `${title}. A publicação descreve um fato consorcial.`,
  url: `https://exemplo.gov.br/${encodeURIComponent(title)}`,
  source: 'Portal público', publishedAt: '2026-09-22T12:00:00Z',
  classification: { category, score: 12, evidenceText: title, emoji: '🟩' },
});
const result = (status, category) => ({ status, category, promptVersion: AI_PROMPT_VERSION,
  evidence: 'Consórcio Intermunicipal', usage: { inputTokens: 200, outputTokens: 50 } });

test('DeepSeek exige JSON consistente e evidência literal', async () => {
  const entry = item('Consórcio Intermunicipal cria agenda de investimentos');
  const response = (answer) => async (_url, options) => {
    assert.equal(options.headers.authorization, 'Bearer segredo-falso');
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'deepseek-flash');
    assert.equal(request.thinking.type, 'disabled');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }],
      usage: { prompt_tokens: 200, completion_tokens: 50 } }) };
  };
  const valid = { relevante: true, categoria: 'ATUAÇÃO', novo_consorcio: false,
    evidencia: 'Consórcio Intermunicipal cria agenda', justificativa: 'Agenda de entidade existente.' };
  assert.equal((await reviewWithDeepSeek(entry, { apiKey: 'segredo-falso', fetchImpl: response(valid) })).category, 'ATUAÇÃO');
  await assert.rejects(reviewWithDeepSeek(entry, { apiKey: 'segredo-falso',
    fetchImpl: response({ ...valid, categoria: 'CRIAÇÃO', novo_consorcio: false }) }), /inconsistente/);
  await assert.rejects(reviewWithDeepSeek(entry, { apiKey: 'segredo-falso',
    fetchImpl: response({ ...valid, evidencia: 'frase não encontrada na fonte' }) }), /inconsistente/);
  await assert.rejects(reviewWithDeepSeek(entry), /DEEPSEEK_API_KEY ausente/);
});

test('fila preserva revisão aprovada, rejeita falso positivo e não paga duas vezes', async () => {
  const falsePositive = item('Consórcio cria agenda', 'CRIAÇÃO');
  const authorized = item('Lei autoriza ingresso em consórcio', 'ADESÃO');
  const state = { pending: {
    [itemId(falsePositive)]: { item: falsePositive }, [itemId(authorized)]: { item: authorized },
  } };
  let calls = 0;
  const reviewImpl = async (entry) => { calls += 1; return entry === falsePositive
    ? result('rejected', 'IRRELEVANTE') : result('approved', 'ADESÃO AUTORIZADA'); };
  const first = await reviewQueue([falsePositive, authorized], state, { reviewImpl, maxPosts: 1 });
  assert.equal(calls, 2);
  assert.equal(first.selected[0].classification.category, 'ADESÃO AUTORIZADA');
  assert.equal(state.pending[itemId(falsePositive)], undefined);
  assert.equal(state.aiUsage.calls, 2);
  const second = await reviewQueue([authorized], state, { reviewImpl, maxPosts: 1 });
  assert.equal(calls, 2);
  assert.equal(second.selected.length, 1);
  assert.equal(applyAiReview(falsePositive, state.aiReviews[itemId(falsePositive)]).classification.score, 0);
});

test('discordância sobre rateio fica na fila e limite impede envio sem revisão', async () => {
  const rateio = item('Município publicou contrato de rateio', 'RATEIO');
  const next = item('Município cria consórcio', 'CRIAÇÃO');
  const state = { pending: { [itemId(rateio)]: { item: rateio } } };
  const reviewed = await reviewQueue([rateio, next], state, {
    reviewImpl: async (entry) => entry === rateio ? result('rejected', 'IRRELEVANTE') : result('approved', 'CRIAÇÃO'),
    maxCallsRun: 1,
  });
  assert.equal(reviewed.selected.length, 0);
  assert.equal(reviewed.audit[0].status, 'disputed');
  assert.equal(reviewed.audit[1].status, 'deferred');
  assert.ok(state.pending[itemId(rateio)]);
});

test('falha de API não vira aprovação automática', async () => {
  const candidate = item('Município integra consórcio', 'ADESÃO');
  const state = { pending: { [itemId(candidate)]: { item: candidate } } };
  const reviewed = await reviewQueue([candidate], state, {
    reviewImpl: async () => { throw new Error('HTTP 503'); },
  });
  assert.equal(reviewed.selected.length, 0);
  assert.equal(reviewed.audit[0].status, 'deferred');
  assert.ok(state.pending[itemId(candidate)]);
});

test('resumo semanal revisa todos os achados, retém rateio documentado e remove ruído', async () => {
  const agenda = item('Consórcio cria agenda', 'CRIAÇÃO');
  const balance = item('Balanço contábil menciona consórcio', 'RATEIO');
  const rateio = { ...item('Município publica contrato de rateio', 'RATEIO'), kind: 'gazette',
    summary: 'Contrato de Rateio. CLÁUSULA QUARTA - DO VALOR E DA COMPOSIÇÃO DO CONTRATO.' };
  const state = {};
  const reviewed = await reviewWeeklyFindings([agenda, balance, rateio], state, {
    apiKey: 'segredo-falso', reviewImpl: async (entry) => entry === agenda
      ? result('approved', 'ATUAÇÃO') : result('rejected', 'IRRELEVANTE'),
  });
  assert.deepEqual(reviewed.highlights.map((entry) => entry.classification.category), ['ATUAÇÃO', 'RATEIO']);
  assert.deepEqual(reviewed.audit.map((entry) => entry.status), ['approved', 'rejected', 'disputed-kept']);
  assert.equal(reviewed.calls, 3);
  const again = await reviewWeeklyFindings([agenda], state, {
    apiKey: 'segredo-falso', reviewImpl: async () => { throw new Error('não deveria consultar'); },
  });
  assert.equal(again.calls, 0);
});
