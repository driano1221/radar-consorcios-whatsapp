import { itemId } from './dedupe.mjs';
import { normalizeWhitespace } from './text.mjs';

export const AI_PROMPT_VERSION = 2;

const EMOJI = {
  CRIAÇÃO: '🟩', ADESÃO: '🟦', 'ADESÃO AUTORIZADA': '🟦', SAÍDA: '🟧',
  RATEIO: '🟪', PROTOCOLO: '🟨', GOVERNANÇA: '🟨', CONTROLE: '🔎',
  CRISE: '🟥', ATUAÇÃO: '📰',
};

const SYSTEM = `Você revisa notícias sobre consórcios públicos intermunicipais brasileiros. Classifique APENAS o fato comprovado no texto recebido. CRIAÇÃO significa fundação de NOVA entidade consorcial; se consórcio existente criou agenda ou projeto relevante, classifique ATUAÇÃO. ADESÃO é ingresso oficializado; ADESÃO AUTORIZADA é lei ou ato que autoriza ingresso, relevante, mas NÃO prova adesão concluída; mera proposta sem autorização é irrelevante. CRISE inclui inadimplência que retire financiamento, paralise atividade ou cause prejuízo concreto a municípios. RATEIO exige contrato de rateio concreto publicado ou celebrado, não linha contábil, balanço, orçamento ou menção normativa. PROTOCOLO exige ratificação, assinatura ou alteração como fato principal, não citação incidental em contrato de serviço. Contrato rotineiro de prestação de serviço ou locação, mesmo com consórcio, não é notícia estrutural relevante. CONTROLE exige fiscalização real, não cláusula genérica sobre improbidade. Se o texto não comprova evento novo, marque relevante=false e categoria=IRRELEVANTE. Responda somente JSON: {"relevante":boolean,"categoria":"CRIAÇÃO|ADESÃO|ADESÃO AUTORIZADA|SAÍDA|RATEIO|PROTOCOLO|GOVERNANÇA|CONTROLE|CRISE|ATUAÇÃO|IRRELEVANTE|INCERTO","novo_consorcio":boolean,"evidencia":"trecho literal curto do texto","justificativa":"uma frase"}. Não invente fatos nem use conhecimento externo.`;

function inputFor(item) {
  return {
    titulo: item.title || '',
    resumo: (item.summary || '').slice(0, 1400),
    trecho: (item.classification?.evidenceText || item.rawText || '').slice(0, 2200),
    fonte: item.source || '',
  };
}

function validateAnswer(answer, input) {
  if (typeof answer?.relevante !== 'boolean' || typeof answer?.novo_consorcio !== 'boolean' ||
    typeof answer?.categoria !== 'string' || typeof answer?.evidencia !== 'string') return null;
  const evidence = normalizeWhitespace(answer.evidencia);
  const supplied = normalizeWhitespace(`${input.titulo} ${input.resumo} ${input.trecho}`);
  if (evidence.length < 12 || !supplied.includes(evidence)) return null;
  if (answer.relevante) {
    if (!Object.hasOwn(EMOJI, answer.categoria)) return null;
    if ((answer.categoria === 'CRIAÇÃO') !== answer.novo_consorcio) return null;
    return { status: 'approved', category: answer.categoria, evidence };
  }
  if (answer.categoria !== 'IRRELEVANTE' || answer.novo_consorcio) return null;
  return { status: 'rejected', category: 'IRRELEVANTE', evidence };
}

export async function reviewWithDeepSeek(item, { apiKey, fetchImpl = fetch, timeoutMs = 25000 } = {}) {
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY ausente. Publicação suspensa.');
  const input = inputFor(item);
  const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' },
      response_format: { type: 'json_object' }, max_tokens: 250,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(input) }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`DeepSeek respondeu HTTP ${response.status}.`);
  const payload = await response.json();
  let answer;
  try { answer = JSON.parse(payload.choices?.[0]?.message?.content || ''); }
  catch { throw new Error('DeepSeek retornou JSON vazio ou inválido.'); }
  const decision = validateAnswer(answer, input);
  if (!decision) throw new Error('DeepSeek retornou decisão ou evidência inconsistente.');
  return { ...decision, promptVersion: AI_PROMPT_VERSION, model: 'deepseek-flash',
    usage: { inputTokens: payload.usage?.prompt_tokens || 0, outputTokens: payload.usage?.completion_tokens || 0 } };
}

export function applyAiReview(item, review) {
  if (!review || review.promptVersion !== AI_PROMPT_VERSION) return item;
  if (review.status === 'rejected') return { ...item, aiReview: review,
    classification: { ...item.classification, category: 'GERAL', score: 0, emoji: '📰', reasons: ['rejeitado pela segunda revisão de IA'] } };
  if (review.status === 'approved') return { ...item, aiReview: review,
    classification: { ...item.classification, category: review.category,
      score: Math.max(5, item.classification?.score || 0), emoji: EMOJI[review.category] } };
  if (review.status === 'disputed') return { ...item, aiReview: review };
  return item;
}

function localDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(now);
}

export async function reviewQueue(items, state, {
  apiKey, maxPosts = 3, maxCallsRun = 12, maxCallsDay = 60,
  now = new Date(), reviewImpl = reviewWithDeepSeek,
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
      if (callsRun >= maxCallsRun || state.aiUsage.calls >= maxCallsDay) {
        audit.push({ id, status: 'deferred', reason: 'limite de chamadas' });
        continue;
      }
      callsRun += 1;
      state.aiUsage.calls += 1;
      try {
        review = await reviewImpl(item, { apiKey });
        state.aiUsage.inputTokens += review.usage?.inputTokens || 0;
        state.aiUsage.outputTokens += review.usage?.outputTokens || 0;
        state.aiReviews[id] = { ...review, reviewedAt: now.toISOString() };
      } catch (error) {
        audit.push({ id, status: 'deferred', reason: error.message });
        console.warn(`[ia] Revisão suspensa para ${id.slice(0, 10)}: ${error.message}`);
        break;
      }
    }
    // Divergência sobre rateio concreto fica na fila para auditoria; não se perde o registro.
    if (item.classification?.category === 'RATEIO' && ['rejected', 'disputed'].includes(review.status)) {
      state.aiReviews[id] = { ...state.aiReviews[id], status: 'disputed' };
      audit.push({ id, status: 'disputed', original: 'RATEIO', reviewed: 'IRRELEVANTE' });
      continue;
    }
    if (review.status === 'rejected') {
      delete state.pending?.[id];
      audit.push({ id, status: 'rejected', category: 'IRRELEVANTE' });
      continue;
    }
    if (review.status === 'approved') {
      selected.push(applyAiReview(item, review));
      audit.push({ id, status: 'approved', category: review.category });
    }
  }
  return { selected, audit, callsRun, usage: { ...state.aiUsage } };
}
