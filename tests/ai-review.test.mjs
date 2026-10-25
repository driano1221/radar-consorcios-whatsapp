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

test('IA não promove dispensa autorizada a contrato de rateio celebrado', async () => {
  const authorized = { ...item('Campo Mourão autoriza dispensa para formalizar rateio', 'RATEIO EM TRAMITAÇÃO'),
    kind: 'gazette', classification: { category: 'RATEIO EM TRAMITAÇÃO', score: 12, emoji: '🟪',
      stage: 'dispensa autorizada para formalizar rateio; contrato não assinado no ato' } };
  const state = { pending: { [itemId(authorized)]: { item: authorized } } };
  const reviewed = await reviewQueue([authorized], state, {
    reviewImpl: async () => result('approved', 'RATEIO'), maxPosts: 1,
  });
  assert.equal(reviewed.selected[0].classification.category, 'RATEIO EM TRAMITAÇÃO');
  assert.equal(reviewed.selected[0].aiReview.proposedCategory, 'RATEIO');
  assert.equal(reviewed.audit[0].category, 'RATEIO EM TRAMITAÇÃO');
  assert.equal(applyAiReview(authorized, state.aiReviews[itemId(authorized)]).classification.category,
    'RATEIO EM TRAMITAÇÃO');
});

test('IA não converte autorização de ingresso ou de repasse em ato consumado', () => {
  const entry = { ...item('Betim autoriza ingresso no consórcio', 'ADESÃO AUTORIZADA'),
    classification: { category: 'ADESÃO AUTORIZADA', score: 12, emoji: '🟦',
      stage: 'lei autoriza ingresso; adesão não comprovada' } };
  const transfer = { ...item('Lei autoriza repasse ao consórcio', 'FINANÇAS'),
    classification: { category: 'FINANÇAS', score: 12, emoji: '💰',
      stage: 'lei autoriza repasse de recursos; pagamento e contrato de rateio não comprovados' } };
  assert.equal(applyAiReview(entry, result('approved', 'ADESÃO')).classification.category,
    'ADESÃO AUTORIZADA');
  assert.equal(applyAiReview(transfer, result('approved', 'RATEIO')).classification.category,
    'FINANÇAS');
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

test('segunda tentativa do DeepSeek pede citação contígua e mantém validação literal', async () => {
  const entry = item('Câmara aprova participação de Umuarama no Conclima', 'PROTOCOLO');
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.match(request.messages.at(-1).content, /CONTÍGUA/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      relevante: true, categoria: 'PROTOCOLO', novo_consorcio: false,
      evidencia: 'Câmara aprova participação de Umuarama no Conclima', justificativa: 'Projeto aprovado.',
    }) } }] });
  };
  const reviewed = await reviewWithDeepSeek(entry, { apiKey: 'teste', fetchImpl, retryStrict: true });
  assert.equal(reviewed.status, 'approved');
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

test('coleta mantém o cache aprovado após falha de API e não perde os outros itens pendentes', async () => {
  const broken = item('Lei aguardando leitura', 'ADESÃO');
  const waiting = item('Outra lei aguardando leitura', 'ADESÃO');
  const valid = item('Lei previamente aprovada', 'ADESÃO');
  const state = { aiReviews: { [itemId(valid)]: result('approved', 'ADESÃO AUTORIZADA') },
    pending: Object.fromEntries([broken, waiting, valid].map(i => [itemId(i), { item: i }])) };
  const reviewed = await reviewQueue([broken, waiting, valid], state, {
    reviewImpl: async () => { throw new Error('HTTP 503'); },
  });
  assert.equal(reviewed.callsRun, 1);
  assert.equal(reviewed.usage.calls, 1);
  assert.deepEqual(reviewed.audit.map(v => v.status), ['deferred', 'deferred', 'approved']);
  assert.deepEqual(reviewed.selected.map(v => v.title), [valid.title]);
  assert.ok(state.pending[itemId(broken)]);
  assert.ok(state.pending[itemId(waiting)]);
});

test('coleta não grava resposta malformada como decisão concluída', async () => {
  const candidate = item('Lei com retorno sem status', 'ADESÃO');
  const state = { pending: { [itemId(candidate)]: { item: candidate } } };
  const reviewed = await reviewQueue([candidate], state, { reviewImpl: async () => ({ status: 'unknown' }) });
  assert.equal(reviewed.callsRun, 2);
  assert.equal(reviewed.audit[0].status, 'deferred');
  assert.equal(reviewed.selected.length, 0);
  assert.equal(state.aiReviews[itemId(candidate)], undefined);
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

test('resumo semanal não publica rateio divergente sem triagem canônica verificada', async () => {
  const agenda = item('Consórcio cria agenda', 'CRIAÇÃO');
  const balance = item('Balanço contábil menciona consórcio', 'RATEIO');
  const rateio = { ...item('Município publica contrato de rateio', 'RATEIO'), kind: 'gazette',
    summary: 'Contrato de Rateio. CLÁUSULA QUARTA - DO VALOR E DA COMPOSIÇÃO DO CONTRATO.' };
  const state = {};
  const reviewed = await reviewWeeklyFindings([agenda, balance, rateio], state, {
    apiKey: 'segredo-falso', reviewImpl: async (entry) => entry === agenda
      ? result('approved', 'ATUAÇÃO') : result('rejected', 'IRRELEVANTE'),
  });
  assert.deepEqual(reviewed.highlights.map((entry) => entry.classification.category), ['ATUAÇÃO']);
  assert.deepEqual(reviewed.audit.map((entry) => entry.status), ['approved', 'rejected', 'deferred']);
  assert.equal(reviewed.calls, 3);
  const again = await reviewWeeklyFindings([agenda], state, {
    apiKey: 'segredo-falso', reviewImpl: async () => { throw new Error('não deveria consultar'); },
  });
  assert.equal(again.calls, 0);
});

test('resumo semanal tenta novamente uma decisão inválida sem duplicar achados', async () => {
  const candidate = item('Lei autoriza ingresso no consórcio', 'ADESÃO');
  const state = {};
  let attempts = 0;
  const reviewed = await reviewWeeklyFindings([candidate], state, {
    apiKey: 'segredo-falso', reviewImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('DeepSeek retornou decisão ou evidência inconsistente.');
        error.code = 'INVALID_AI_DECISION';
        throw error;
      }
      return result('approved', 'ADESÃO AUTORIZADA');
    },
  });
  assert.equal(reviewed.calls, 2);
  assert.deepEqual(reviewed.audit.map(({ status }) => status), ['approved']);
  assert.equal(reviewed.highlights.length, 1);
  assert.equal(state.aiReviews[itemId(candidate)].status, 'approved');
});

test('duas decisões inválidas adiam só o achado afetado e preservam o próximo', async () => {
  const broken = item('Proposta de ingresso no consórcio', 'ADESÃO');
  const valid = item('Lei autoriza ingresso no consórcio', 'ADESÃO');
  const state = {};
  const reviewed = await reviewWeeklyFindings([broken, valid], state, {
    apiKey: 'segredo-falso', reviewImpl: async (entry) => {
      if (entry === broken) {
        const error = new Error('DeepSeek retornou decisão ou evidência inconsistente.');
        error.code = 'INVALID_AI_DECISION';
        throw error;
      }
      return result('approved', 'ADESÃO AUTORIZADA');
    },
  });
  assert.equal(reviewed.calls, 3);
  assert.deepEqual(reviewed.audit.map(({ status }) => status), ['deferred', 'approved']);
  assert.equal(reviewed.audit[0].attempts, 2);
  assert.deepEqual(reviewed.highlights.map(({ title }) => title), [valid.title]);
  assert.equal(state.aiReviews[itemId(broken)], undefined);
});

test('resumo preserva ratificação de protocolo mesmo com criação aprovada no cache da IA', async () => {
  const candidate = { ...item('Lei ratifica protocolo de intenções', 'PROTOCOLO'),
    classification: { category: 'PROTOCOLO', score: 12, proofKind: 'ratified_protocol',
      stage: 'ratificação legal; constituição não comprovada' } };
  const cached = result('approved', 'CRIAÇÃO');
  const state = { aiReviews: { [itemId(candidate)]: cached } };
  const reviewed = await reviewWeeklyFindings([candidate], state, {
    apiKey: 'segredo-falso', reviewImpl: async () => { throw new Error('não consultar a API'); },
  });
  assert.equal(reviewed.calls, 0);
  assert.equal(reviewed.highlights[0].classification.category, 'PROTOCOLO');
  assert.equal(reviewed.highlights[0].classification.stage, candidate.classification.stage);
  assert.equal(reviewed.highlights[0].aiReview.proposedCategory, 'CRIAÇÃO');
  assert.equal(reviewed.audit[0].category, 'PROTOCOLO');
  assert.deepEqual(state.aiReviews[itemId(candidate)], cached);
});

test('falha de API suspende novas chamadas sem bloquear o cache aprovado posterior', async () => {
  const unavailable = item('Lei autoriza ingresso no consórcio', 'ADESÃO');
  const waiting = item('Outra lei ainda sem revisão', 'ADESÃO');
  const cached = item('Lei já aprovada', 'ADESÃO');
  const state = { aiReviews: { [itemId(cached)]: result('approved', 'ADESÃO AUTORIZADA') } };
  const reviewed = await reviewWeeklyFindings([unavailable, waiting, cached], state, {
    apiKey: 'fake-test-key', reviewImpl: async () => { throw new Error('DeepSeek respondeu HTTP 503.'); },
  });
  assert.equal(reviewed.calls, 1);
  assert.deepEqual(reviewed.audit.map(v => v.status), ['deferred', 'deferred', 'approved']);
  assert.deepEqual(reviewed.highlights.map(v => v.title), [cached.title]);
  assert.equal(state.aiReviews[itemId(unavailable)], undefined);
});

test('teto de chamadas não impede itens aprovados no cache nem autoriza os demais', async () => {
  const first = item('Lei primeira', 'ADESÃO'), second = item('Lei segunda', 'ADESÃO');
  const cached = item('Lei no cache', 'ADESÃO');
  const reviewed = await reviewWeeklyFindings([first, second, cached], {
    aiReviews: { [itemId(cached)]: result('approved', 'ADESÃO AUTORIZADA') },
  }, { apiKey: 'fake-test-key', maxCalls: 1, reviewImpl: async () => result('approved', 'ADESÃO AUTORIZADA') });
  assert.equal(reviewed.calls, 1);
  assert.deepEqual(reviewed.audit.map(v => v.status), ['approved', 'deferred', 'approved']);
  assert.equal(reviewed.audit[1].reason, 'limite de chamadas');
  assert.equal(reviewed.highlights.length, 2);
});

test('credencial ausente não apaga aprovação no cache nem aprova item sem revisão', async () => {
  const waiting = item('Lei sem revisão', 'ADESÃO'), cached = item('Lei aprovada', 'ADESÃO');
  const reviewed = await reviewWeeklyFindings([waiting, cached], {
    aiReviews: { [itemId(cached)]: result('approved', 'ADESÃO AUTORIZADA') },
  }, { reviewImpl: async () => { throw new Error('Não chamar a API'); } });
  assert.equal(reviewed.calls, 0);
  assert.deepEqual(reviewed.audit.map(v => v.status), ['deferred', 'approved']);
  assert.equal(reviewed.highlights.length, 1);
});

test('cache com status desconhecido não é convertido silenciosamente em rejeição', async () => {
  const waiting = item('Lei com cache inválido', 'ADESÃO');
  const reviewed = await reviewWeeklyFindings([waiting], {
    aiReviews: { [itemId(waiting)]: { promptVersion: AI_PROMPT_VERSION, status: 'unknown' } },
  });
  assert.equal(reviewed.calls, 0);
  assert.equal(reviewed.audit[0].status, 'deferred');
  assert.equal(reviewed.highlights.length, 0);
});

test('resposta sem decisão válida é adiada sem gravar aprovação ou rejeição no cache', async () => {
  const candidate = item('Lei com resposta incompleta', 'ADESÃO');
  const state = {};
  const reviewed = await reviewWeeklyFindings([candidate], state, {
    apiKey: 'fake-test-key', reviewImpl: async () => ({ status: 'unknown' }),
  });
  assert.equal(reviewed.calls, 2);
  assert.equal(reviewed.audit[0].status, 'deferred');
  assert.equal(reviewed.highlights.length, 0);
  assert.equal(state.aiReviews[itemId(candidate)], undefined);
});

test('IA revisa no envio e na prévia só quando pedida', () => {
  const base = { aiReviewEnabled: true, sendEnabled: false, aiPreview: false };
  assert.equal(shouldReviewWithAi(base, 5), false);
  assert.equal(shouldReviewWithAi({ ...base, aiPreview: true }, 5), true);
  assert.equal(shouldReviewWithAi({ ...base, sendEnabled: true }, 5), true);
  assert.equal(shouldReviewWithAi({ ...base, sendEnabled: true }, 0), false);
  assert.equal(shouldReviewWithAi({ ...base, aiReviewEnabled: false, aiPreview: true }, 5), false);
});
