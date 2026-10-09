import { AI_PROMPT_VERSION, applyAiReview, reviewQueue } from './ai-review.mjs';
import { itemId } from './dedupe.mjs';
import { normalizeWhitespace } from './text.mjs';

// A prévia decorrente da leitura do artigo pode ser resolvida por uma segunda
// revisão. Prévia imposta pela própria fonte (ainda não homologada) continua
// bloqueada: a IA não tem autoridade para homologar uma fonte.
export async function resolveArticlePreviews(items, originals, state, {
  apiKey, maxCallsRun = 3, maxCallsDay = 60, review = reviewQueue,
} = {}) {
  const candidates = items.filter((item, index) => item.previewOnly &&
    !originals[index]?.previewOnly && !item.editorialDecision &&
    item.contentProvenance === 'pagina_original' &&
    normalizeWhitespace(item.rawText || '').length >= 160 &&
    item.classification?.category !== 'GERAL');
  if (!candidates.length) return { items, audit: [], callsRun: 0 };

  const result = await review(candidates, state, {
    apiKey, maxPosts: candidates.length, maxCallsRun, maxCallsDay,
  });
  const byId = new Set(candidates.map(itemId));
  const resolved = items.map((item) => {
    if (!byId.has(itemId(item))) return item;
    const ai = state.aiReviews?.[itemId(item)];
    if (ai?.promptVersion !== AI_PROMPT_VERSION || !['approved', 'rejected'].includes(ai.status)) return item;
    // A prova deve existir no artigo, não apenas no título ou no resumo do feed.
    if (!normalizeWhitespace(item.rawText).includes(normalizeWhitespace(ai.evidence || '')) ||
      normalizeWhitespace(ai.evidence || '').length < 12) return item;
    const reviewed = applyAiReview(item, ai);
    return { ...reviewed, previewOnly: false, reviewReason: '',
      classification: { ...reviewed.classification, evidenceText: ai.evidence },
      triageResolution: { decision: ai.status === 'approved' ? 'adotado' : 'descartado',
        reason: 'segunda revisão automática com trecho conferido no artigo', evidence: ai.evidence } };
  });
  return { items: resolved, audit: result.audit || [], callsRun: result.callsRun || 0 };
}
