import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROMPT_VERSION, applyAiReview, reviewQueue, reviewWeeklyFindings, reviewWithDeepSeek, shouldReviewWithAi } from '../src/lib/ai-review.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { itemId } from '../src/lib/dedupe.mjs';

const item = (title, category = 'CRIAÇÃO') => ({
  title, summary: `${title}. A publicação descreve um fato consorcial.`,
  url: `https://exemplo.gov.br/${encodeURIComponent(title)}`,
  source: 'Portal público', publishedAt: '2026-09-22T12:00:00Z',
  classification: { category, score: 12, evidenceText: title, emoji: '🟩' },
});
const result = (status, category) => ({ status, category, promptVersion: AI_PROMPT_VERSION,
  evidence: 'Consórcio Intermunicipal', usage: { inputTokens: 200, outputTokens: 50 } });

test('aprovação antiga da IA não ressuscita lei de 2022 rejeitada pela regra atual', () => {
  const old = { ...item('14/03/2022 - LEI Nº559-2022 (Ratifica protocolo de intenções do Consórcio publico)'),
    kind: 'news', publishedAt: '2026-10-04T11:02:26Z' };
  old.classification = classifyItem(old);
  assert.equal(old.classification.category, 'GERAL');
  const reviewed = applyAiReview(old, result('approved', 'PROTOCOLO'));
  assert.equal(reviewed.classification.category, 'GERAL');
  assert.equal(reviewed.classification.score, 0);
});

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

test('DeepSeek aceita só diferença de pontuação em evidência fiel ao texto', async () => {
  const entry = { ...item('Consórcio Intermunicipal firma parceria'),
    summary: 'O consórcio firmou, em setembro, parceria com o ministério.' };
  const fetchImpl = async () => Response.json({ choices: [{ message: { content: JSON.stringify({
    relevante: true, categoria: 'ATUAÇÃO', novo_consorcio: false,
    evidencia: 'O consórcio firmou em setembro parceria com o ministério', justificativa: 'Acordo firmado.',
  }) } }] });
  assert.equal((await reviewWithDeepSeek(entry, { apiKey: 'teste', fetchImpl })).status, 'approved');
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
  const rateio = { ...item('Município publicou contrato de rateio', 'RATEIO'), kind: 'gazette',
    summary: 'Contrato de rateio celebrado com consórcio. CLÁUSULA QUARTA - DO VALOR E DA COMPOSIÇÃO DO CONTRATO.' };
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

test('rateio meramente contábil rejeitado pela IA sai da fila', async () => {
  const balance = { ...item('Diário Oficial de Antas', 'RATEIO'), kind: 'gazette',
    summary: 'RREO – VALORES TRANSFERIDOS POR CONTRATO DE RATEIO. DESPESAS EXECUTADAS.' };
  const id = itemId(balance);
  const state = { pending: { [id]: { item: balance } } };
  const reviewed = await reviewQueue([balance], state, {
    reviewImpl: async () => result('rejected', 'IRRELEVANTE'),
  });
  assert.equal(reviewed.selected.length, 0);
  assert.equal(reviewed.audit[0].status, 'rejected');
  assert.equal(state.pending[id], undefined);
});

test('rateio contábil já marcado como divergente é limpo sem nova chamada', async () => {
  const balance = { ...item('Diário Oficial de Deodápolis', 'RATEIO'), kind: 'gazette',
    summary: 'VALORES TRANSFERIDOS POR CONTRATO DE RATEIO (a) 0,00 DESPESAS PAGAS 0,00.' };
  const id = itemId(balance);
  const state = { pending: { [id]: { item: balance } },
    aiReviews: { [id]: result('disputed', 'IRRELEVANTE') } };
  const reviewed = await reviewQueue([balance], state, {
    reviewImpl: async () => { throw new Error('não deve chamar a IA novamente'); },
  });
  assert.equal(reviewed.callsRun, 0);
  assert.equal(state.pending[id], undefined);
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

test('resposta inválida da IA adia só o item afetado e não bloqueia o próximo', async () => {
  const broken = item('Proposta de ingresso no consórcio', 'ADESÃO');
  const valid = item('Lei autoriza ingresso no consórcio', 'ADESÃO');
  const state = { pending: {
    [itemId(broken)]: { item: broken }, [itemId(valid)]: { item: valid },
  } };
  const reviewed = await reviewQueue([broken, valid], state, {
    reviewImpl: async (entry) => {
      if (entry === broken) {
        const error = new Error('DeepSeek retornou decisão ou evidência inconsistente.');
        error.code = 'INVALID_AI_DECISION';
        throw error;
      }
      return result('approved', 'ADESÃO AUTORIZADA');
    },
  });
  assert.deepEqual(reviewed.audit.map(({ status }) => status), ['deferred', 'approved']);
  assert.equal(reviewed.selected.length, 1);
  assert.ok(state.pending[itemId(broken)]);
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

test('IA revisa no envio e na prévia só quando pedida', () => {
  const base = { aiReviewEnabled: true, sendEnabled: false, aiPreview: false };
  assert.equal(shouldReviewWithAi(base, 5), false);
  assert.equal(shouldReviewWithAi({ ...base, aiPreview: true }, 5), true);
  assert.equal(shouldReviewWithAi({ ...base, sendEnabled: true }, 5), true);
  assert.equal(shouldReviewWithAi({ ...base, sendEnabled: true }, 0), false);
  assert.equal(shouldReviewWithAi({ ...base, aiReviewEnabled: false, aiPreview: true }, 5), false);
});
