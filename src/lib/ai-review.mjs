import { itemId } from './dedupe.mjs';
import { normalizeWhitespace } from './text.mjs';
import { INSTITUTIONAL_REVIEW_POLICY } from './institutional-proof.mjs';
import { locateQuote } from './quote-evidence.mjs';

export const AI_PROMPT_VERSION = 6;

// A IA revisa no envio real e, se pedido, na prévia (para a prévia mostrar o que de fato seria publicado).
export function shouldReviewWithAi({ aiReviewEnabled, sendEnabled, aiPreview }, remainingToday) {
  return Boolean(aiReviewEnabled && (sendEnabled || aiPreview) && remainingToday > 0);
}

const EMOJI = {
  CRIAÇÃO: '🟩', ADESÃO: '🟦', 'ADESÃO AUTORIZADA': '🟦', SAÍDA: '🟧',
  RATEIO: '🟪', 'RATEIO EM TRAMITAÇÃO': '🟪', PROTOCOLO: '🟨', GOVERNANÇA: '🟨', CONTROLE: '🔎',
  CRISE: '🟥', ATUAÇÃO: '📰', FINANÇAS: '💰',
};

const SYSTEM = `Você revisa notícias sobre consórcios públicos intermunicipais brasileiros. Classifique APENAS o fato comprovado no texto recebido. CRIAÇÃO significa fundação de NOVA entidade consorcial; se consórcio existente criou agenda ou projeto relevante, classifique ATUAÇÃO. ADESÃO é ingresso oficializado; ADESÃO AUTORIZADA é lei ou ato que autoriza ingresso, relevante, mas NÃO prova adesão concluída; mera proposta sem autorização é irrelevante. CRISE inclui inadimplência que retire financiamento, paralise atividade ou cause prejuízo concreto a municípios. RATEIO exige contrato de rateio concreto publicado ou celebrado, não linha contábil, balanço, orçamento ou menção normativa. RATEIO EM TRAMITAÇÃO é autorização específica de dispensa ou outra etapa para formalizar contrato de rateio, sem prova de que foi assinado; nunca chame esse ato de contrato publicado. PROTOCOLO exige ratificação, assinatura ou alteração como fato principal, não citação incidental em contrato de serviço. Contrato rotineiro de prestação de serviço ou locação, mesmo com consórcio, não é notícia estrutural relevante. CONTROLE exige fiscalização real, não cláusula genérica sobre improbidade. Se o texto não comprova evento novo, marque relevante=false e categoria=IRRELEVANTE. Responda somente JSON: {"relevante":boolean,"categoria":"CRIAÇÃO|ADESÃO|ADESÃO AUTORIZADA|SAÍDA|RATEIO|RATEIO EM TRAMITAÇÃO|PROTOCOLO|GOVERNANÇA|CONTROLE|CRISE|ATUAÇÃO|IRRELEVANTE|INCERTO","novo_consorcio":boolean,"evidencia":"trecho literal curto do texto","justificativa":"uma frase"}. Não invente fatos nem use conhecimento externo.`;

export function inputFor(item) {
  const body = normalizeWhitespace(item.rawText || '');
  const proof = normalizeWhitespace(item.classification?.evidenceText || '');
  const start = Math.max(0, body.indexOf(proof.slice(0, 100)) - 1000);
  return {
    titulo: item.title || '',
    resumo: (item.summary || '').slice(0, 1400),
    trecho: (item.classification?.evidenceText || item.rawText || '').slice(0, 2200),
    // Short articles are supplied in full. Long documents retain the beginning
    // and a separate contextual window; never splice two spans into one quote.
    corpo: body.length <= 24000 ? body : body.slice(0, 12000),
    contexto_do_trecho: body.length > 24000 ? body.slice(start, start + 12000) : '',
    corpo_parcial: body.length > 24000,
    etapa_identificada: item.classification?.stage || '',
    abrangencia: item.classification?.scope || '',
    fonte: item.source || '',
  };
}

function validateAnswer(answer, input) {
  if (typeof answer?.relevante !== 'boolean' || typeof answer?.novo_consorcio !== 'boolean' ||
    typeof answer?.categoria !== 'string' || typeof answer?.evidencia !== 'string') {
    return { reason: 'campos obrigatórios ausentes' };
  }
  // O modelo por vezes troca aspas, travessões ou espaços do PDF. Exigimos as
  // mesmas palavras na mesma ordem; paráfrase ou fato ausente segue bloqueado.
  const evidence = locateQuote(answer.evidencia,
    [input.corpo, input.contexto_do_trecho, input.trecho, input.resumo, input.titulo]);
  if (!evidence) {
    return { reason: 'evidência não localizada no texto fornecido' };
  }
  if (answer.relevante) {
    if (!Object.hasOwn(EMOJI, answer.categoria)) return { reason: 'categoria relevante inválida' };
    if ((answer.categoria === 'CRIAÇÃO') !== answer.novo_consorcio) {
      return { reason: 'categoria e criação de consórcio contraditórias' };
    }
    return { decision: { status: 'approved', category: answer.categoria, evidence } };
  }
  if (answer.categoria !== 'IRRELEVANTE' || answer.novo_consorcio) {
    return { reason: 'irrelevância e categoria contraditórias' };
  }
  return { decision: { status: 'rejected', category: 'IRRELEVANTE', evidence } };
}

export async function reviewWithDeepSeek(item, { apiKey, fetchImpl = fetch, timeoutMs = 25000,
  retryStrict = false } = {}) {
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY ausente. Publicação suspensa.');
  const input = inputFor(item);
  const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' },
      response_format: { type: 'json_object' }, max_tokens: 250,
      messages: [{ role: 'system', content: INSTITUTIONAL_REVIEW_POLICY + '\n' + SYSTEM.replace('|CRISE|ATUAÇÃO|', '|CRISE|ATUAÇÃO|FINANÇAS|') +
        '\nFINANÇAS também inclui orientação tributária geral, com ato identificado, aplicável a consórcios públicos. É relevante mesmo sem entidade individual: preserve a abrangência geral, sem inventar nome ou CNPJ. Portaria que só nomeia fiscal de rateio já celebrado é documento de acompanhamento, não novo contrato nem novo alerta.' +
        '\nCláusulas condicionais sobre falência de fornecedor, multas, descredenciamento ou retirada de ordens NÃO são CRISE, CONTROLE ou SAÍDA municipal. Credenciamento e contrato rotineiro com fornecedor privado ficam fora, mesmo firmados. Isso não exclui rateio entre município e consórcio nem fiscalização realmente realizada. Votação de projeto de ratificação com resultado aprovado não comprova sanção ou constituição. Assembleia e visita realizadas pelo consórcio são ATUAÇÃO; não inferir inauguração ou contas aprovadas.' +
        '\nCopie evidencia de um ÚNICO campo, como frase curta contígua e literal. Prefira corpo/contexto_do_trecho quando disponíveis; nunca complete trecho cortado com palavras presumidas. corpo_parcial=true significa leitura limitada, não prova de ausência no documento completo.' }, { role: 'user', content: JSON.stringify(input) },
        ...(retryStrict ? [{ role: 'user', content: 'A resposta precisa ter campos coerentes. Em evidencia, copie uma frase curta e CONTÍGUA exatamente de titulo, resumo ou trecho acima. Não use paráfrase, reticências, colchetes nem informação externa. Se não houver prova textual, responda relevante=false com evidencia literal da menção examinada.' }] : [])] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`DeepSeek respondeu HTTP ${response.status}.`);
  const payload = await response.json();
  let answer;
  try { answer = JSON.parse(payload.choices?.[0]?.message?.content || ''); }
  catch {
    const error = new Error('DeepSeek retornou JSON vazio ou inválido.');
    error.code = 'INVALID_AI_DECISION';
    throw error;
  }
  const { decision, reason } = validateAnswer(answer, input);
  if (!decision) {
    const error = new Error(`DeepSeek retornou decisão ou evidência inconsistente: ${reason}.`);
    error.code = 'INVALID_AI_DECISION';
    throw error;
  }
  return { ...decision, promptVersion: AI_PROMPT_VERSION, model: 'deepseek-flash',
    usage: { inputTokens: payload.usage?.prompt_tokens || 0, outputTokens: payload.usage?.completion_tokens || 0 } };
}

export function applyAiReview(item, review, { preserveHistoricalRejection = false } = {}) {
  // Atualizar o prompt renova a revisão para novos envios, mas não invalida
  // retroativamente um descarte ao reconstruir o catálogo com o mesmo texto.
  if (!review || (review.promptVersion !== AI_PROMPT_VERSION &&
    !(preserveHistoricalRejection && review.status === 'rejected'))) return item;
  if (review.status === 'rejected') return { ...item, aiReview: review,
    classification: { ...item.classification, category: 'GERAL', score: 0, emoji: '📰', reasons: ['rejeitado pela segunda revisão de IA'] } };
  // Uma aprovação antiga não pode ressuscitar um item que as regras atuais
  // agora rejeitam (por exemplo, lei de 2022 reindexada em 2026).
  if (item.classification?.category === 'GERAL' || (item.classification?.score ?? 0) < 5) {
    return { ...item, aiReview: review };
  }
  if (review.status === 'approved') {
    // A segunda leitura não pode transformar uma autorização preparatória em
    // contrato celebrado, mesmo que o modelo devolva a categoria RATEIO.
    const originalCategory = item.classification.category;
    const preparatory = ['RATEIO EM TRAMITAÇÃO', 'ADESÃO AUTORIZADA', 'COOPERAÇÃO AUTORIZADA']
      .includes(originalCategory) || (originalCategory === 'PROTOCOLO' &&
        /sanção e constituição não provadas/i.test(item.classification.stage || '')) || (originalCategory === 'FINANÇAS' &&
        /contrato de rateio não comprovado/i.test(item.classification.stage || ''));
    const roleBounded = (originalCategory === 'CONTROLE' && item.classification.proofKind === 'court_decision') ||
      (originalCategory === 'ATUAÇÃO' && ['inspection_participation', 'performed_institutional_activity', 'signed_cooperation'].includes(item.classification.proofKind)) ||
      (originalCategory === 'PROTOCOLO' && ['signed_municipal_protocol', 'ratified_protocol'].includes(item.classification.proofKind)) ||
      (originalCategory === 'GOVERNANÇA' && item.classification.proofKind === 'documented_composition');
    const category = preparatory || roleBounded || item.classification.scope === 'orientacao_geral' ? originalCategory : review.category;
    const boundedReview = category === review.category ? review
      : { ...review, category, proposedCategory: review.category, boundedBy: 'etapa do ato' };
    return { ...item, aiReview: boundedReview,
      classification: { ...item.classification, category,
        score: Math.max(5, item.classification?.score || 0),
        emoji: EMOJI[category] || item.classification.emoji } };
  }
  if (review.status === 'disputed') return { ...item, aiReview: review };
  return item;
}

function localDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(now);
}

export async function reviewQueue(items, state, {
  apiKey, maxPosts = 3, maxCallsRun = 12, maxCallsDay = 60,
  now = new Date(), reviewImpl = reviewWithDeepSeek, selectable = () => true,
} = {}) {
  state.aiReviews ||= {};
  const today = localDay(now);
  if (state.aiUsage?.day !== today) state.aiUsage = { day: today, calls: 0, inputTokens: 0, outputTokens: 0 };
  const selected = [];
  const audit = [];
  let callsRun = 0;
  for (const item of items) {
    if (selected.length >= maxPosts) break;
    const id = item.id || itemId(item);
    let review = state.aiReviews[id];
    if (!review || review.promptVersion !== AI_PROMPT_VERSION) {
      review = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (callsRun >= maxCallsRun || state.aiUsage.calls >= maxCallsDay) {
          audit.push({ id, status: 'deferred', reason: 'limite de chamadas' });
          break;
        }
        callsRun += 1;
        state.aiUsage.calls += 1;
        try {
          review = await reviewImpl(item, { apiKey, retryStrict: attempt === 2 });
          state.aiUsage.inputTokens += review.usage?.inputTokens || 0;
          state.aiUsage.outputTokens += review.usage?.outputTokens || 0;
          state.aiReviews[id] = { ...review, reviewedAt: now.toISOString() };
          break;
        } catch (error) {
          if (error.code === 'INVALID_AI_DECISION' && attempt === 1) continue;
          audit.push({ id, status: 'deferred', reason: error.message });
          console.warn(`[ia] Revisão suspensa para ${id.slice(0, 10)}: ${error.message}`);
          // A network failure stops additional paid calls. Invalid decisions
          // only defer the affected item after the bounded second attempt.
          if (error.code !== 'INVALID_AI_DECISION')
            return { selected, audit, callsRun, usage: { ...state.aiUsage } };
          break;
        }
      }
      if (!review) continue;
    }
    // Apenas um contrato de rateio concreto merece auditoria manual. Linhas de orçamento,
    // RREO e menções normativas rejeitadas pela IA não devem ocupar a fila indefinidamente.
    if (item.classification?.category === 'RATEIO' && ['rejected', 'disputed'].includes(review.status)) {
      if (concreteRateio(item)) {
        state.aiReviews[id] = { ...state.aiReviews[id], status: 'disputed' };
        audit.push({ id, status: 'disputed', original: 'RATEIO', reviewed: 'IRRELEVANTE' });
        continue;
      }
      delete state.pending?.[id];
      audit.push({ id, status: 'rejected', category: 'IRRELEVANTE', reason: 'rateio sem contrato concreto' });
      continue;
    }
    if (review.status === 'rejected') {
      delete state.pending?.[id];
      audit.push({ id, status: 'rejected', category: 'IRRELEVANTE' });
      continue;
    }
    if (review.status === 'approved') {
      const approvedItem = applyAiReview(item, review);
      const selectedForDelivery = selectable(approvedItem);
      if (selectedForDelivery) selected.push(approvedItem);
      audit.push({ id, status: 'approved', category: approvedItem.classification.category, selected: selectedForDelivery });
    }
  }
  return { selected, audit, callsRun, usage: { ...state.aiUsage } };
}

function concreteRateio(item) {
  if (item.kind !== 'gazette') return false;
  const text = normalizeWhitespace(`${item.summary || ''} ${item.classification?.evidenceText || ''}`).toLocaleLowerCase('pt-BR');
  return /contrato de rateio/.test(text) &&
    /cláusula\s+(?:[a-z]+|\d+)|do valor e da composição do contrato/.test(text) &&
    !/balanço patrimonial|relatório resumido da execução orçamentária|demonstrativo da despesa com pessoal/.test(text);
}

export async function reviewWeeklyFindings(items, state, {
  apiKey, maxCalls = 40, reviewImpl = reviewWithDeepSeek, now = new Date(),
} = {}) {
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY ausente; resumo não enviado sem revisão.');
  state.aiReviews ||= {};
  const highlights = [];
  const audit = [];
  let calls = 0;
  for (const item of items) {
    const id = item.id || itemId(item);
    if (item.weeklyDecision === 'incluir' && item.weeklyEvidence?.documentId &&
      ['confirmar_evento', 'corrigir_categoria'].includes(item.editorialDecision)) {
      highlights.push(item);
      audit.push({ id, status: 'editorial-confirmed', category: item.classification.category });
      continue;
    }
    let review = state.aiReviews[id];
    if (!review || review.promptVersion !== AI_PROMPT_VERSION) {
      review = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (calls >= maxCalls) throw new Error('Resumo excedeu o teto de revisões por IA; envio suspenso.');
        calls += 1;
        try {
          review = await reviewImpl(item, { apiKey, retryStrict: attempt === 2 });
          state.aiReviews[id] = { ...review, reviewedAt: now.toISOString() };
          break;
        } catch (error) {
          // Só decisões inválidas são isoladas. Falhas da API ou da rede não
          // permitem concluir a revisão e continuam bloqueando o boletim.
          if (error.code !== 'INVALID_AI_DECISION') throw error;
          if (attempt === 2) {
            audit.push({ id, status: 'deferred', reason: error.message, attempts: attempt });
            console.warn(`[ia] Achado semanal ${id.slice(0, 10)} adiado após ${attempt} respostas inválidas: ${error.message}`);
          }
        }
      }
      if (!review) continue;
    }
    if (review.status === 'approved') {
      const approved = applyAiReview(item, state.aiReviews[id]);
      highlights.push(approved);
      audit.push({ id, status: 'approved', category: approved.classification.category });
    } else if (item.classification?.category === 'RATEIO' && concreteRateio(item)) {
      state.aiReviews[id] = { ...state.aiReviews[id], status: 'disputed' };
      highlights.push(item);
      audit.push({ id, status: 'disputed-kept', category: 'RATEIO' });
    } else {
      audit.push({ id, status: 'rejected', category: item.classification?.category });
    }
  }
  return { highlights, audit, calls };
}
